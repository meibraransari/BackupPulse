import { FastifyInstance } from 'fastify';
import { runDatabaseHousekeeping, getHousekeepingStatus } from '../services/housekeeping.service';

export async function systemRoutes(fastify: FastifyInstance) {
  // 1. Get Housekeeping & Retention Status
  fastify.get(
    '/api/v1/system/housekeeping',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get database retention status, configured threshold in days, and count of records eligible for cleanup',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              retentionDays: { type: 'number' },
              cutoffDate: { type: 'string' },
              housekeepingCron: { type: 'string' },
              backupReports: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  eligibleForCleanup: { type: 'number' },
                },
              },
              notificationLogs: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  eligibleForCleanup: { type: 'number' },
                },
              },
              userLoginLogs: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  eligibleForCleanup: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (_request: any, reply: any) => {
      const status = await getHousekeepingStatus();
      return reply.send(status);
    }
  );

  // 2. Trigger Database Housekeeping Cleanup (POST & GET)
  const cleanupHandler = async (request: any, reply: any) => {
    const daysOverride = request.body?.days || request.query?.days;
    const result = await runDatabaseHousekeeping(daysOverride);
    if (!result.success && result.retentionDays <= 0) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  };

  fastify.post(
    '/api/v1/system/cleanup',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually execute database housekeeping to purge backup telemetry and alert logs older than DB_RETENTION_DAYS (or custom days)',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            days: {
              type: 'integer',
              description: 'Optional override for retention days (defaults to DB_RETENTION_DAYS from .env)',
            },
          },
          additionalProperties: true,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              retentionDays: { type: 'number' },
              cutoffDate: { type: 'string' },
              deletedBackupReports: { type: 'number' },
              deletedNotificationLogs: { type: 'number' },
              deletedUserLoginLogs: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              retentionDays: { type: 'number' },
              deletedBackupReports: { type: 'number' },
              deletedNotificationLogs: { type: 'number' },
              deletedUserLoginLogs: { type: 'number' },
            },
          },
        },
      },
    },
    cleanupHandler
  );

  fastify.get(
    '/api/v1/system/cleanup',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually execute database housekeeping cleanup (GET alias with optional ?days= query param)',
        tags: ['System'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer' },
          },
        },
      },
    },
    cleanupHandler
  );
}
