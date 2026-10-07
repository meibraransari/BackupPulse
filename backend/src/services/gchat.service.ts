import { config } from '../config/env';
import { prisma } from '../db/prisma';
import { recordNotificationLog } from './notification-log.service';

function getMaskedWebhookUrl(url: string): string {
  if (!url) return 'Unconfigured';
  try {
    return url.replace(/token=[^&]+/i, 'token=******');
  } catch {
    return 'Google Chat Webhook';
  }
}

export interface DailySummaryStats {
  total: number;
  success: number;
  failed: number;
  warning: number;
  successRate: number;
  totalSizeHuman: string;
  failedReports: Array<{
    projectName: string;
    serverId: string;
    backupType: string;
    errorMessage: string | null;
  }>;
}

export function formatBytes(bytes: number | bigint): string {
  const num = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (num === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return parseFloat((num / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function getDailyStats(): Promise<DailySummaryStats> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [total, success, failed, warning] = await Promise.all([
    prisma.backupReport.count({ where: { createdAt: { gte: since } } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, status: 'SUCCESS' } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, status: 'WARNING' } }),
  ]);

  const sizeAgg = await prisma.backupReport.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { backupSizeBytes: true },
  });

  const failedReports = await prisma.backupReport.findMany({
    where: { createdAt: { gte: since }, status: 'FAILED' },
    select: {
      projectName: true,
      serverId: true,
      backupType: true,
      errorMessage: true,
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  });

  const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
  const totalBytes = sizeAgg._sum.backupSizeBytes || BigInt(0);

  return {
    total,
    success,
    failed,
    warning,
    successRate,
    totalSizeHuman: formatBytes(totalBytes),
    failedReports,
  };
}

export async function sendGoogleChatMessage(messagePayload: any): Promise<{ success: boolean; message: string }> {
  if (!config.GOOGLE_CHAT_WEBHOOK_URL) {
    return {
      success: false,
      message: 'GOOGLE_CHAT_WEBHOOK_URL is not configured in environment variables.',
    };
  }

  try {
    const response = await fetch(config.GOOGLE_CHAT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Chat API responded with status ${response.status}: ${errText}`);
    }

    return { success: true, message: 'Google Chat notification sent successfully.' };
  } catch (error: any) {
    console.error('[GCHAT] Error dispatching webhook:', error.message);
    return { success: false, message: error.message };
  }
}

export async function sendDailyBackupReportToGoogleChat(): Promise<{ success: boolean; message: string }> {
  const stats = await getDailyStats();
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const statusEmoji = stats.failed === 0 ? '✅' : '⚠️';
  const statusColor = stats.failed === 0 ? '#22c55e' : '#ef4444';

  const widgets: any[] = [
    {
      decoratedText: {
        topLabel: 'Summary Metrics (Last 24 Hours)',
        text: `<b>Total Backups:</b> ${stats.total} | <b>Success:</b> ${stats.success} (${stats.successRate}%) | <b>Failed:</b> ${stats.failed}`,
        startIcon: { knownIcon: 'DESCRIPTION' },
      },
    },
    {
      decoratedText: {
        topLabel: 'Storage Uploaded to S3',
        text: `<b>${stats.totalSizeHuman}</b>`,
        startIcon: { knownIcon: 'MEMBERSHIP' },
      },
    },
  ];

  if (stats.failedReports.length > 0) {
    let failureText = '';
    stats.failedReports.forEach((f, idx) => {
      failureText += `<b>${idx + 1}. [${f.projectName}]</b> on <i>${f.serverId}</i> (${f.backupType})<br>Reason: ${f.errorMessage || 'Unknown error'}<br>`;
    });

    widgets.push({
      decoratedText: {
        topLabel: '🚨 Failed Backups (Recent)',
        text: failureText,
      },
    });
  }

  widgets.push({
    buttonList: {
      buttons: [
        {
          text: 'Open Backup Dashboard',
          onClick: {
            openLink: {
              url: config.APP_BASE_URL,
            },
          },
        },
      ],
    },
  });

  const cardPayload = {
    cardsV2: [
      {
        cardId: 'backup_daily_report',
        card: {
          header: {
            title: `${statusEmoji} Daily Backup Monitoring Report`,
            subtitle: dateStr,
            imageUrl: 'https://cdn-icons-png.flaticon.com/512/2920/2920277.png',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: 'Status Overview',
              widgets,
            },
          ],
        },
      },
    ],
  };

  const res = await sendGoogleChatMessage(cardPayload);

  await recordNotificationLog({
    channel: 'GOOGLE_CHAT',
    eventType: 'DAILY_REPORT',
    recipient: getMaskedWebhookUrl(config.GOOGLE_CHAT_WEBHOOK_URL),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: {
      total: stats.total,
      successRate: stats.successRate,
      failed: stats.failed,
      totalSizeHuman: stats.totalSizeHuman,
    },
  });

  return res;
}

export async function sendTestGoogleChatNotification(): Promise<{ success: boolean; message: string }> {
  const cardPayload = {
    cardsV2: [
      {
        cardId: 'backup_test_notification',
        card: {
          header: {
            title: '🚀 Backup Monitor — Webhook Connection Test',
            subtitle: new Date().toISOString(),
            imageUrl: 'https://cdn-icons-png.flaticon.com/512/2920/2920277.png',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'System Status',
                    text: '<b>Success!</b> Google Chat webhook is connected and receiving notifications.',
                    startIcon: { knownIcon: 'INVITE' },
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'Visit Dashboard',
                        onClick: {
                          openLink: {
                            url: config.APP_BASE_URL,
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };

  const res = await sendGoogleChatMessage(cardPayload);

  await recordNotificationLog({
    channel: 'GOOGLE_CHAT',
    eventType: 'TEST_NOTIFICATION',
    recipient: getMaskedWebhookUrl(config.GOOGLE_CHAT_WEBHOOK_URL),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: { test: true },
  });

  return res;
}

