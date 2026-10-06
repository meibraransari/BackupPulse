import { FastifyInstance } from 'fastify';
import { sendTestGoogleChatNotification, sendDailyBackupReportToGoogleChat } from '../services/gchat.service';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Test Google Chat Webhook (Supports both POST and GET)
  const testHandler = async (_request: any, reply: any) => {
    const result = await sendTestGoogleChatNotification();
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  };

  fastify.post(
    '/api/v1/notifications/test-gchat',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send a test notification to Google Chat webhook',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    testHandler
  );

  fastify.get(
    '/api/v1/notifications/test-gchat',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send a test notification to Google Chat webhook (GET alias)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    testHandler
  );

  // Trigger Daily Backup Report Manually
  const triggerHandler = async (_request: any, reply: any) => {
    const result = await sendDailyBackupReportToGoogleChat();
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  };

  fastify.post(
    '/api/v1/notifications/trigger-daily-report',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually trigger and dispatch the daily backup report to Google Chat',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {},
          additionalProperties: true,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    triggerHandler
  );

  fastify.get(
    '/api/v1/notifications/trigger-daily-report',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually trigger and dispatch the daily backup report to Google Chat (GET alias)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    triggerHandler
  );
}
