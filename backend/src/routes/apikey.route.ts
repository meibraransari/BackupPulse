import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../db/prisma';

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // 1. List all provisioned API Keys (Admin only)
  fastify.get(
    '/api/v1/api-keys',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'List all provisioned per-server and per-project API tokens',
        tags: ['API Key Management'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin privilege required' });
      }

      const keys = await prisma.apiKey.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          serverId: true,
          projectName: true,
          createdBy: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
      });

      return reply.send({ data: keys });
    }
  );

  // 2. Generate a new API Key (Admin only)
  fastify.post(
    '/api/v1/api-keys',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Provision a new per-server or per-project API key token',
        tags: ['API Key Management'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2, maxLength: 100 },
            serverId: { type: 'string' },
            projectName: { type: 'string' },
            expiresInDays: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin privilege required' });
      }

      const { name, serverId, projectName, expiresInDays } = request.body;

      // Generate a secure 32-byte cryptographically random token
      const rawToken = 'bkp_' + crypto.randomBytes(24).toString('hex');
      const keyPrefix = rawToken.slice(0, 10) + '...';
      const keyHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      let expiresAt: Date | null = null;
      if (expiresInDays && Number(expiresInDays) > 0) {
        expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000);
      }

      const keyRecord = await prisma.apiKey.create({
        data: {
          name,
          keyHash,
          keyPrefix,
          serverId: serverId?.trim() || null,
          projectName: projectName?.trim() || null,
          createdBy: user.username,
          isActive: true,
          expiresAt,
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          serverId: true,
          projectName: true,
          createdBy: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      return reply.status(201).send({
        success: true,
        message: 'API Key generated successfully. Please copy the token now, as it will never be displayed again.',
        key: rawToken, // Displayed ONLY once upon creation!
        apiKey: keyRecord,
      });
    }
  );

  // 3. Revoke an API Key (Admin only)
  fastify.delete(
    '/api/v1/api-keys/:id',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Immediately revoke an active API key token',
        tags: ['API Key Management'],
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
    async (request: any, reply: any) => {
      const user = request.user;
      if (user.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin privilege required' });
      }

      const { id } = request.params;

      const existing = await prisma.apiKey.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: 'API Key not found' });
      }

      const updated = await prisma.apiKey.update({
        where: { id },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          isActive: true,
          revokedAt: true,
        },
      });

      return reply.send({
        success: true,
        message: `API Key '${updated.name}' has been successfully revoked.`,
        apiKey: updated,
      });
    }
  );
}
