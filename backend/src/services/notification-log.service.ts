import { prisma } from '../db/prisma';

export interface RecordNotificationLogInput {
  channel: 'GOOGLE_CHAT' | 'SMTP';
  eventType: 'DAILY_REPORT' | 'TEST_NOTIFICATION' | 'FAILURE_ALERT';
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  payload?: any;
}

export interface NotificationLogFilter {
  page?: number;
  limit?: number;
  channel?: string;
  status?: string;
  eventType?: string;
}

/**
 * Persists an alert/report send record to the database
 */
export async function recordNotificationLog(data: RecordNotificationLogInput) {
  try {
    const log = await prisma.notificationLog.create({
      data: {
        channel: data.channel,
        eventType: data.eventType,
        recipient: data.recipient,
        status: data.status,
        message: data.message,
        payload: data.payload || undefined,
      },
    });
    return log;
  } catch (error: any) {
    console.error('[NOTIFICATION_LOG] Failed to record alert log in database:', error.message);
    return null;
  }
}

/**
 * Retrieves paginated notification audit logs with optional filters
 */
export async function getNotificationLogs(filter: NotificationLogFilter = {}) {
  const page = Math.max(1, Number(filter.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(filter.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filter.channel && filter.channel !== 'ALL') {
    where.channel = filter.channel;
  }
  if (filter.status && filter.status !== 'ALL') {
    where.status = filter.status;
  }
  if (filter.eventType && filter.eventType !== 'ALL') {
    where.eventType = filter.eventType;
  }

  const [logs, total] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notificationLog.count({ where }),
  ]);

  return {
    data: logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
