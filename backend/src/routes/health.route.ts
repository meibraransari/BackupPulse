import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Check service health and database connectivity',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              uptime: { type: 'number' },
              timestamp: { type: 'string' },
              database: { type: 'string' },
            },
          },
          500: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return reply.send({
          status: 'ok',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          database: 'connected',
        });
      } catch (err: any) {
        return reply.status(500).send({
          status: 'error',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: err.message,
        });
      }
    }
  );
}
