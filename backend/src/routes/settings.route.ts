import { FastifyInstance } from 'fastify';
import { getAllSettings, updateSettings } from '../services/settings.service';
import { sendTestGoogleChatNotification } from '../services/gchat.service';
import { sendTestEmailNotification } from '../services/smtp.service';
import {
  sendTestSlackNotification,
  sendTestDiscordNotification,
  sendTestTelegramNotification,
} from '../services/webhook.service';

export async function settingsRoutes(fastify: FastifyInstance) {
  // 1. Get all System Settings (Admin only)
  fastify.get(
    '/api/v1/settings',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get all database-backed system settings grouped by category',
        tags: ['System Settings'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Only administrators have access to system settings.' });
      }

      const data = await getAllSettings();
      return reply.send(data);
    }
  );

  // 2. Update System Settings (Admin only, immediately reloads in memory)
  fastify.patch(
    '/api/v1/settings',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Update system settings in the database and immediately refresh running services without restart',
        tags: ['System Settings'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['settings'],
          properties: {
            settings: {
              type: 'object',
              additionalProperties: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Only administrators can modify system settings.' });
      }

      const body = request.body as { settings: Record<string, string> };
      if (!body.settings || typeof body.settings !== 'object') {
        return reply.status(400).send({ error: 'Invalid payload: "settings" object is required.' });
      }

      try {
        const result = await updateSettings(body.settings, user.username || 'admin');
        return reply.send(result);
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    }
  );

  // 3. Test a Notification Channel directly
  fastify.post(
    '/api/v1/settings/test-channel',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Test a notification channel (Google Chat, Slack, Discord, Telegram, or Email) using current settings',
        tags: ['System Settings'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['channel'],
          properties: {
            channel: {
              type: 'string',
              enum: ['google_chat', 'slack', 'discord', 'telegram', 'email'],
            },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Only administrators can test notification channels.' });
      }

      const { channel } = request.body as { channel: string };

      let result: { success: boolean; message: string };

      switch (channel) {
        case 'google_chat':
          result = await sendTestGoogleChatNotification();
          break;
        case 'slack':
          result = await sendTestSlackNotification();
          break;
        case 'discord':
          result = await sendTestDiscordNotification();
          break;
        case 'telegram':
          result = await sendTestTelegramNotification();
          break;
        case 'email':
          result = await sendTestEmailNotification();
          break;
        default:
          return reply.status(400).send({ error: `Unknown channel: ${channel}` });
      }

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    }
  );
}
