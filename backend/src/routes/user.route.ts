import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { hashPassword } from '../services/auth.service';

export async function userRoutes(fastify: FastifyInstance) {
  // 1. List all users (Admin only)
  fastify.get(
    '/api/v1/users',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get all user accounts across the system',
        tags: ['User Management'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                username: { type: 'string' },
                email: { type: 'string', nullable: true },
                fullName: { type: 'string', nullable: true },
                avatar: { type: 'string', nullable: true },
                role: { type: 'string' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.send(users);
    }
  );

  // 2. Create new user
  fastify.post(
    '/api/v1/users',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Create a new user account with role assignment and optional avatar',
        tags: ['User Management'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            email: { type: 'string' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'operator', 'viewer'], default: 'operator' },
            avatar: { type: 'string' },
            isActive: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      const authUser = (request as any).user;
      if (authUser.role !== 'admin') {
        return reply.status(403).send({ error: 'Only administrators can create user accounts.' });
      }

      const body = request.body as any;
      const username = body.username.trim().toLowerCase();

      const existing = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            ...(body.email ? [{ email: body.email.trim() }] : []),
          ],
        },
      });

      if (existing) {
        return reply.status(400).send({ error: 'Username or email already in use.' });
      }

      if (!body.password || body.password.length < 6) {
        return reply.status(400).send({ error: 'Password must be at least 6 characters.' });
      }

      const passwordHash = await hashPassword(body.password);

      const newUser = await prisma.user.create({
        data: {
          username,
          passwordHash,
          email: body.email?.trim() || null,
          fullName: body.fullName?.trim() || null,
          role: body.role || 'operator',
          avatar: body.avatar || null,
          isActive: body.isActive !== undefined ? body.isActive : true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          avatar: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      console.log(`[USERS] Admin "${authUser.username}" created user "${newUser.username}" (${newUser.role})`);
      return reply.status(201).send({ success: true, user: newUser });
    }
  );

  // 3. Update user
  fastify.put(
    '/api/v1/users/:id',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Update user account properties, role, status, or reset password',
        tags: ['User Management'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            fullName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'operator', 'viewer'] },
            avatar: { type: 'string' },
            isActive: { type: 'boolean' },
            newPassword: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const authUser = (request as any).user;
      if (authUser.role !== 'admin') {
        return reply.status(403).send({ error: 'Only administrators can modify user accounts.' });
      }

      const { id } = request.params as { id: string };
      const body = request.body as any;

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found.' });
      }

      const updateData: any = {};
      if (body.email !== undefined) updateData.email = body.email?.trim() || null;
      if (body.fullName !== undefined) updateData.fullName = body.fullName?.trim() || null;
      if (body.role !== undefined) updateData.role = body.role;
      if (body.avatar !== undefined) updateData.avatar = body.avatar || null;
      if (body.isActive !== undefined) {
        // Prevent disabling yourself
        if (user.id === authUser.id && body.isActive === false) {
          return reply.status(400).send({ error: 'You cannot deactivate your own account.' });
        }
        updateData.isActive = body.isActive;
      }
      if (body.newPassword) {
        if (body.newPassword.length < 6) {
          return reply.status(400).send({ error: 'Password must be at least 6 characters.' });
        }
        updateData.passwordHash = await hashPassword(body.newPassword);
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          avatar: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      console.log(`[USERS] Admin "${authUser.username}" updated user "${updated.username}"`);
      return reply.send({ success: true, user: updated });
    }
  );

  // 4. Delete user
  fastify.delete(
    '/api/v1/users/:id',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Delete a user account',
        tags: ['User Management'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const authUser = (request as any).user;
      if (authUser.role !== 'admin') {
        return reply.status(403).send({ error: 'Only administrators can delete user accounts.' });
      }

      const { id } = request.params as { id: string };

      if (id === authUser.id) {
        return reply.status(400).send({ error: 'You cannot delete your own account.' });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found.' });
      }

      await prisma.user.delete({ where: { id } });
      console.log(`[USERS] Admin "${authUser.username}" deleted user "${user.username}"`);

      return reply.send({ success: true, message: `User "${user.username}" deleted successfully.` });
    }
  );
}
