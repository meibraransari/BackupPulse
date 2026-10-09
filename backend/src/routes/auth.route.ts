import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { comparePassword, hashPassword } from '../services/auth.service';

export async function authRoutes(fastify: FastifyInstance) {
  // 1. Login with Tracker Logging (Rate limited to 10 attempts per minute to mitigate brute force)
  fastify.post(
    '/api/v1/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        description: 'Authenticate user and return JWT access token, recording login audit telemetry in database',
        tags: ['Authentication'],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              token: { type: 'string' },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  username: { type: 'string' },
                  email: { type: 'string' },
                  fullName: { type: 'string', nullable: true },
                  avatar: { type: 'string', nullable: true },
                  role: { type: 'string' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { username, password } = request.body as any;
      const clientIp =
        (request.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        request.ip ||
        '127.0.0.1';
      const userAgent = (request.headers['user-agent'] as string) || 'Unknown Browser / Client';

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        console.warn(`[AUTH] Failed login attempt: User "${username}" not found (IP: ${clientIp})`);
        await prisma.userLoginLog.create({
          data: {
            username,
            ipAddress: clientIp,
            userAgent,
            status: 'FAILED',
            failureReason: 'User not found',
          },
        });
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      if (!user.isActive) {
        console.warn(`[AUTH] Failed login attempt: User "${username}" is disabled (IP: ${clientIp})`);
        await prisma.userLoginLog.create({
          data: {
            userId: user.id,
            username: user.username,
            ipAddress: clientIp,
            userAgent,
            status: 'FAILED',
            failureReason: 'Account deactivated',
          },
        });
        return reply.status(403).send({ error: 'Account is deactivated. Contact an administrator.' });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        console.warn(`[AUTH] Failed login attempt: Invalid password for user "${username}" (IP: ${clientIp})`);
        await prisma.userLoginLog.create({
          data: {
            userId: user.id,
            username: user.username,
            ipAddress: clientIp,
            userAgent,
            status: 'FAILED',
            failureReason: 'Invalid credentials',
          },
        });
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      // Record successful login in audit tracker
      await prisma.userLoginLog.create({
        data: {
          userId: user.id,
          username: user.username,
          ipAddress: clientIp,
          userAgent,
          status: 'SUCCESS',
        },
      });

      console.log(`[AUTH] User "${user.username}" authenticated successfully from ${clientIp}`);

      const token = fastify.jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          assignedProjects: user.assignedProjects || [],
        },
        { expiresIn: '7d' }
      );

      return reply.send({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email || '',
          fullName: user.fullName || null,
          avatar: user.avatar || null,
          role: user.role,
          assignedProjects: user.assignedProjects || [],
        },
      });
    }
  );

  // 2. Get current user profile
  fastify.get(
    '/api/v1/auth/me',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get authenticated user details with avatar and role',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const authUser = (request as any).user;
      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          avatar: true,
          role: true,
          assignedProjects: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ user });
    }
  );

  // 3. Update current user profile (Image, Full Name, Email, Password)
  fastify.put(
    '/api/v1/auth/profile',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Update authenticated user profile information, avatar, or password',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            fullName: { type: 'string' },
            email: { type: 'string' },
            avatar: { type: 'string' },
            currentPassword: { type: 'string' },
            newPassword: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const authUser = (request as any).user;
      const body = request.body as any;

      const user = await prisma.user.findUnique({
        where: { id: authUser.id },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updateData: any = {};

      if (body.fullName !== undefined) updateData.fullName = body.fullName?.trim() || null;
      if (body.email !== undefined) updateData.email = body.email?.trim() || null;
      if (body.avatar !== undefined) updateData.avatar = body.avatar || null;

      // Password change verification
      if (body.newPassword) {
        if (!body.currentPassword) {
          return reply.status(400).send({ error: 'Current password is required to set a new password.' });
        }

        const isCurrentValid = await comparePassword(body.currentPassword, user.passwordHash);
        if (!isCurrentValid) {
          return reply.status(400).send({ error: 'Current password provided is incorrect.' });
        }

        if (body.newPassword.length < 6) {
          return reply.status(400).send({ error: 'New password must be at least 6 characters.' });
        }

        updateData.passwordHash = await hashPassword(body.newPassword);
        console.log(`[AUTH] Password updated for user "${user.username}"`);
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          avatar: true,
          role: true,
          createdAt: true,
        },
      });

      console.log(`[AUTH] Profile updated for user "${user.username}"`);
      return reply.send({ success: true, message: 'Profile updated successfully', user: updated });
    }
  );

  // 4. Query Login Tracker Logs (Audit)
  fastify.get(
    '/api/v1/auth/logins',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get user login tracking audit records with IP, status, and timestamps',
        tags: ['Authentication'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 15 },
            status: { type: 'string' },
            username: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '15', 10)));
      const skip = (page - 1) * limit;

      const where: any = {};
      if (query.status && query.status !== 'ALL') {
        where.status = query.status.toUpperCase();
      }
      if (query.username) {
        where.username = { contains: query.username.trim(), mode: 'insensitive' };
      }

      const [logs, total] = await Promise.all([
        prisma.userLoginLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.userLoginLog.count({ where }),
      ]);

      return reply.send({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );
}
