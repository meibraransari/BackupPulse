import { FastifyInstance } from 'fastify';
import { sendTestGoogleChatNotification, sendDailyBackupReportToGoogleChat } from '../services/gchat.service';

export async function notificationRoutes(fastify: FastifyInstance) {
  // Test Google Chat Webhook
  fastify.post(
    '/api/v1/notifications/test-gchat',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send a test notification to Google Chat webhook',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const result = await sendTestGoogleChatNotification();
      if (!result.success) {
        return reply.status(400).send(result);
      }
      return reply.send(result);
    }
  );

  // Trigger Daily Backup Report Manually
  fastify.post(
    '/api/v1/notifications/trigger-daily-report',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually trigger and dispatch the daily backup report to Google Chat',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const result = await sendDailyBackupReportToGoogleChat();
      if (!result.success) {
        return reply.status(400).send(result);
      }
      return reply.send(result);
    }
  );
}
