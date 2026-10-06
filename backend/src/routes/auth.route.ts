import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { comparePassword } from '../services/auth.service';

export async function authRoutes(fastify: FastifyInstance) {
  // Login
  fastify.post(
    '/api/v1/auth/login',
    {
      schema: {
        description: 'Authenticate user and return JWT access token',
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

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      const token = fastify.jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        { expiresIn: '7d' }
      );

      return reply.send({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email || '',
          role: user.role,
        },
      });
    }
  );

  // Get current user profile
  fastify.get(
    '/api/v1/auth/me',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get authenticated user details',
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
          role: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ user });
    }
  );
}
