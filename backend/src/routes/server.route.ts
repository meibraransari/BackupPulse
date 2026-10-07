import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';

export async function serverRoutes(fastify: FastifyInstance) {
  // 1. Get all server monitoring configurations
  fastify.get(
    '/api/v1/servers/configs',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get all server monitoring configurations and mute statuses',
        tags: ['Servers'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                serverId: { type: 'string' },
                hostname: { type: 'string', nullable: true },
                isMonitored: { type: 'boolean' },
                muteReason: { type: 'string', nullable: true },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const configs = await prisma.serverConfig.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      return reply.send(configs);
    }
  );

  // 2. Toggle or update monitoring status for a server (Dead Man's Snitch Mute/Unmute)
  fastify.patch(
    '/api/v1/servers/:serverId/monitor',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Update server monitoring status (mute or unmute Dead Man\'s Snitch alerts)',
        tags: ['Servers'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['serverId'],
          properties: {
            serverId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['isMonitored'],
          properties: {
            isMonitored: { type: 'boolean' },
            muteReason: { type: 'string', nullable: true },
            hostname: { type: 'string', nullable: true },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              config: {
                type: 'object',
                properties: {
                  serverId: { type: 'string' },
                  isMonitored: { type: 'boolean' },
                  muteReason: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { serverId } = request.params as { serverId: string };
      const { isMonitored, muteReason, hostname } = request.body as {
        isMonitored: boolean;
        muteReason?: string;
        hostname?: string;
      };

      console.log(
        `[SERVERS] Updating monitoring status for ${serverId}: isMonitored=${isMonitored}, reason=${muteReason || 'None'}`
      );

      const serverConfig = await prisma.serverConfig.upsert({
        where: { serverId },
        update: {
          isMonitored,
          muteReason: isMonitored ? null : muteReason || 'Manually muted by operator',
          ...(hostname ? { hostname } : {}),
        },
        create: {
          serverId,
          hostname: hostname || null,
          isMonitored,
          muteReason: isMonitored ? null : muteReason || 'Manually muted by operator',
        },
      });

      return reply.send({
        success: true,
        message: isMonitored
          ? `Server "${serverId}" is now actively monitored.`
          : `Server "${serverId}" monitoring muted. Excluded from Dead Man's Snitch daily alerts.`,
        config: serverConfig,
      });
    }
  );
}
