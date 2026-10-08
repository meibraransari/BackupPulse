import { FastifyInstance } from 'fastify';
import { config } from '../config/env';
import { sendTestGoogleChatNotification } from '../services/gchat.service';
import { sendTestEmailNotification } from '../services/smtp.service';
import {
  sendTestSlackNotification,
  sendTestDiscordNotification,
  sendTestTelegramNotification,
} from '../services/webhook.service';
import { dispatchDailyReportToAllChannels } from '../services/alert-dispatcher.service';
import { getNotificationLogs } from '../services/notification-log.service';

export async function notificationRoutes(fastify: FastifyInstance) {
  // 1. Get Notification Channels Status & Settings
  fastify.get(
    '/api/v1/notifications/status',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get current status and active configuration of notification channels (Google Chat, Email, Slack, Discord, Telegram)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request: any, reply: any) => {
      const isGchatConfigured = Boolean(config.GOOGLE_CHAT_WEBHOOK_URL && config.GOOGLE_CHAT_WEBHOOK_URL.trim().length > 0);
      const isSlackConfigured = Boolean(config.SLACK_WEBHOOK_URL && config.SLACK_WEBHOOK_URL.trim().length > 0);
      const isDiscordConfigured = Boolean(config.DISCORD_WEBHOOK_URL && config.DISCORD_WEBHOOK_URL.trim().length > 0);
      const isTelegramConfigured = Boolean(config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID);

      const provider = (config.EMAIL_PROVIDER || 'smtp').toLowerCase();
      let isEmailConfigured = false;

      if (provider === 'sendgrid') {
        isEmailConfigured = Boolean(config.SENDGRID_API_KEY && (config.EMAIL_TO || config.SMTP_TO));
      } else if (provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses') {
        isEmailConfigured = Boolean(config.AWS_SES_REGION && (config.EMAIL_TO || config.SMTP_TO));
      } else {
        isEmailConfigured = Boolean(config.SMTP_HOST && (config.EMAIL_TO || config.SMTP_TO));
      }

      const emailFrom = config.EMAIL_FROM || config.SMTP_FROM;
      const emailTo = config.EMAIL_TO || config.SMTP_TO || '';

      const isAnyActive =
        config.ENABLE_GOOGLE_CHAT ||
        config.ENABLE_SMTP ||
        config.ENABLE_SLACK ||
        config.ENABLE_DISCORD ||
        config.ENABLE_TELEGRAM;

      return reply.send({
        instantAlerts: {
          enabled: config.INSTANT_ALERT_ON_FAILURE,
        },
        googleChat: {
          enabled: config.ENABLE_GOOGLE_CHAT,
          configured: isGchatConfigured,
        },
        email: {
          enabled: config.ENABLE_SMTP,
          configured: isEmailConfigured,
          provider: config.EMAIL_PROVIDER,
          from: emailFrom,
          to: emailTo,
        },
        smtp: {
          enabled: config.ENABLE_SMTP,
          configured: isEmailConfigured,
          provider: config.EMAIL_PROVIDER,
          host: config.SMTP_HOST || '',
          port: config.SMTP_PORT,
          from: emailFrom,
          to: emailTo,
        },
        slack: {
          enabled: config.ENABLE_SLACK,
          configured: isSlackConfigured,
        },
        discord: {
          enabled: config.ENABLE_DISCORD,
          configured: isDiscordConfigured,
        },
        telegram: {
          enabled: config.ENABLE_TELEGRAM,
          configured: isTelegramConfigured,
        },
        cron: {
          expression: config.REPORT_CRON,
          active: isAnyActive,
        },
      });
    }
  );

  // 2. Test Google Chat Webhook
  const testGchatHandler = async (_request: any, reply: any) => {
    const result = await sendTestGoogleChatNotification();
    if (!result.success) return reply.status(400).send(result);
    return reply.send(result);
  };
  fastify.post('/api/v1/notifications/test-gchat', { preValidation: [(fastify as any).authenticate] }, testGchatHandler);
  fastify.get('/api/v1/notifications/test-gchat', { preValidation: [(fastify as any).authenticate] }, testGchatHandler);

  // 3. Test SMTP / Unified Email
  const testEmailHandler = async (_request: any, reply: any) => {
    const result = await sendTestEmailNotification();
    if (!result.success) return reply.status(400).send(result);
    return reply.send(result);
  };
  fastify.post('/api/v1/notifications/test-smtp', { preValidation: [(fastify as any).authenticate] }, testEmailHandler);
  fastify.get('/api/v1/notifications/test-smtp', { preValidation: [(fastify as any).authenticate] }, testEmailHandler);
  fastify.post('/api/v1/notifications/test-email', { preValidation: [(fastify as any).authenticate] }, testEmailHandler);
  fastify.get('/api/v1/notifications/test-email', { preValidation: [(fastify as any).authenticate] }, testEmailHandler);

  // 4. Test Slack Webhook
  const testSlackHandler = async (_request: any, reply: any) => {
    const result = await sendTestSlackNotification();
    if (!result.success) return reply.status(400).send(result);
    return reply.send(result);
  };
  fastify.post('/api/v1/notifications/test-slack', { preValidation: [(fastify as any).authenticate] }, testSlackHandler);
  fastify.get('/api/v1/notifications/test-slack', { preValidation: [(fastify as any).authenticate] }, testSlackHandler);

  // 5. Test Discord Webhook
  const testDiscordHandler = async (_request: any, reply: any) => {
    const result = await sendTestDiscordNotification();
    if (!result.success) return reply.status(400).send(result);
    return reply.send(result);
  };
  fastify.post('/api/v1/notifications/test-discord', { preValidation: [(fastify as any).authenticate] }, testDiscordHandler);
  fastify.get('/api/v1/notifications/test-discord', { preValidation: [(fastify as any).authenticate] }, testDiscordHandler);

  // 6. Test Telegram Bot
  const testTelegramHandler = async (_request: any, reply: any) => {
    const result = await sendTestTelegramNotification();
    if (!result.success) return reply.status(400).send(result);
    return reply.send(result);
  };
  fastify.post('/api/v1/notifications/test-telegram', { preValidation: [(fastify as any).authenticate] }, testTelegramHandler);
  fastify.get('/api/v1/notifications/test-telegram', { preValidation: [(fastify as any).authenticate] }, testTelegramHandler);

  // 7. Manually Trigger Daily Report across all active channels
  const triggerHandler = async (_request: any, reply: any) => {
    const result = await dispatchDailyReportToAllChannels();
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  };
  fastify.post('/api/v1/notifications/trigger-daily-report', { preValidation: [(fastify as any).authenticate] }, triggerHandler);
  fastify.get('/api/v1/notifications/trigger-daily-report', { preValidation: [(fastify as any).authenticate] }, triggerHandler);

  // 8. Query Alert & Notification Delivery Audit Logs
  fastify.get(
    '/api/v1/notifications/logs',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Retrieve paginated notification delivery audit logs across all channels',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            channel: { type: 'string', description: 'Filter by channel: GOOGLE_CHAT, SMTP, SLACK, DISCORD, TELEGRAM, or ALL' },
            status: { type: 'string', description: 'Filter by status: SUCCESS, FAILED, or ALL' },
            eventType: { type: 'string', description: 'Filter by event type: DAILY_REPORT, FAILURE_ALERT, TEST_NOTIFICATION, or ALL' },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      const result = await getNotificationLogs(request.query);
      return reply.send(result);
    }
  );
}
