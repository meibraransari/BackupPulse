import { FastifyInstance } from 'fastify';
import { config } from '../config/env';
import { sendTestGoogleChatNotification, sendDailyBackupReportToGoogleChat } from '../services/gchat.service';
import { sendTestEmailNotification, sendDailyBackupReportEmail } from '../services/smtp.service';
import { getNotificationLogs } from '../services/notification-log.service';

export async function notificationRoutes(fastify: FastifyInstance) {
  // 1. Get Notification Channels Status & Settings
  fastify.get(
    '/api/v1/notifications/status',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get current status and active configuration of notification channels (Google Chat, SMTP, SendGrid, AWS SES)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              googleChat: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  configured: { type: 'boolean' },
                },
              },
              email: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  configured: { type: 'boolean' },
                  provider: { type: 'string' },
                  from: { type: 'string' },
                  to: { type: 'string' },
                },
              },
              smtp: {
                type: 'object',
                properties: {
                  enabled: { type: 'boolean' },
                  configured: { type: 'boolean' },
                  provider: { type: 'string' },
                  host: { type: 'string' },
                  port: { type: 'number' },
                  from: { type: 'string' },
                  to: { type: 'string' },
                },
              },
              cron: {
                type: 'object',
                properties: {
                  expression: { type: 'string' },
                  active: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    async (_request: any, reply: any) => {
      const isGchatConfigured = Boolean(config.GOOGLE_CHAT_WEBHOOK_URL && config.GOOGLE_CHAT_WEBHOOK_URL.trim().length > 0);
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

      return reply.send({
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
        cron: {
          expression: config.REPORT_CRON,
          active: config.ENABLE_GOOGLE_CHAT || config.ENABLE_SMTP,
        },
      });
    }
  );

  // 2. Test Google Chat Webhook (Supports both POST and GET)
  const testGchatHandler = async (_request: any, reply: any) => {
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
        description: 'Send an instant test notification card to the configured Google Chat webhook',
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
    testGchatHandler
  );

  fastify.get(
    '/api/v1/notifications/test-gchat',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send an instant test notification card to the configured Google Chat webhook (GET alias)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    testGchatHandler
  );

  // 3. Test SMTP Email Delivery (Supports both POST and GET)
  const testSmtpHandler = async (_request: any, reply: any) => {
    const result = await sendTestEmailNotification();
    if (!result.success) {
      return reply.status(400).send(result);
    }
    return reply.send(result);
  };

  fastify.post(
    '/api/v1/notifications/test-smtp',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send an instant test notification email to the configured recipient via active provider (SMTP, SendGrid, or AWS SES)',
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
    testSmtpHandler
  );

  fastify.get(
    '/api/v1/notifications/test-smtp',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send an instant test notification email to the configured recipient via active provider (SMTP, SendGrid, or AWS SES) (GET alias)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    testSmtpHandler
  );

  // Alias endpoints for generic test-email
  fastify.post(
    '/api/v1/notifications/test-email',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send an instant test notification email via active provider (SMTP, SendGrid, or AWS SES)',
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
    testSmtpHandler
  );

  fastify.get(
    '/api/v1/notifications/test-email',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Send an instant test notification email via active provider (SMTP, SendGrid, or AWS SES) (GET alias)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    testSmtpHandler
  );

  // 4. Trigger Daily Backup Report Manually across all enabled channels
  const triggerHandler = async (_request: any, reply: any) => {
    const isGchatEnabled = config.ENABLE_GOOGLE_CHAT;
    const isSmtpEnabled = config.ENABLE_SMTP;

    if (!isGchatEnabled && !isSmtpEnabled) {
      return reply.status(400).send({
        success: false,
        message: 'No notification channels are enabled. Set ENABLE_GOOGLE_CHAT=true and/or ENABLE_SMTP=true in .env to dispatch reports.',
        channels: {},
      });
    }

    const channelResults: {
      googleChat?: { success: boolean; message: string };
      smtp?: { success: boolean; message: string };
    } = {};

    let gchatSuccess = true;
    let smtpSuccess = true;

    if (isGchatEnabled) {
      const gchatRes = await sendDailyBackupReportToGoogleChat();
      channelResults.googleChat = gchatRes;
      if (!gchatRes.success) gchatSuccess = false;
    }

    if (isSmtpEnabled) {
      const smtpRes = await sendDailyBackupReportEmail();
      channelResults.smtp = smtpRes;
      if (!smtpRes.success) smtpSuccess = false;
    }

    const overallSuccess = (isGchatEnabled ? gchatSuccess : true) && (isSmtpEnabled ? smtpSuccess : true);
    const messages: string[] = [];
    if (channelResults.googleChat) {
      messages.push(`Google Chat: ${channelResults.googleChat.message}`);
    }
    if (channelResults.smtp) {
      messages.push(`SMTP: ${channelResults.smtp.message}`);
    }

    const responsePayload = {
      success: overallSuccess,
      message: messages.join(' | '),
      channels: channelResults,
    };

    if (!overallSuccess) {
      return reply.status(400).send(responsePayload);
    }
    return reply.send(responsePayload);
  };

  fastify.post(
    '/api/v1/notifications/trigger-daily-report',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually trigger and dispatch the daily backup report across all enabled notification channels (Google Chat, SMTP email, or both)',
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
              channels: {
                type: 'object',
                properties: {
                  googleChat: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                    },
                  },
                  smtp: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              channels: {
                type: 'object',
                additionalProperties: true,
              },
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
        description: 'Manually trigger and dispatch the daily backup report across all enabled notification channels (GET alias)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
    },
    triggerHandler
  );

  // 5. Query Alert & Notification Delivery Audit Logs
  fastify.get(
    '/api/v1/notifications/logs',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Retrieve paginated notification delivery audit logs (Google Chat webhook and SMTP email dispatches with delivery status and payloads)',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            channel: { type: 'string', description: 'Filter by channel: GOOGLE_CHAT, SMTP, or ALL' },
            status: { type: 'string', description: 'Filter by status: SUCCESS, FAILED, or ALL' },
            eventType: { type: 'string', description: 'Filter by event type: DAILY_REPORT, TEST_NOTIFICATION, etc.' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    channel: { type: 'string' },
                    eventType: { type: 'string' },
                    recipient: { type: 'string' },
                    status: { type: 'string' },
                    message: { type: 'string' },
                    payload: { type: ['object', 'null'], additionalProperties: true },
                    createdAt: { type: 'string' },
                  },
                },
              },
              pagination: {
                type: 'object',
                properties: {
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  total: { type: 'integer' },
                  totalPages: { type: 'integer' },
                },
              },
            },
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

