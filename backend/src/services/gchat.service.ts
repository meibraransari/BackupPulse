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
  anomaliesCount: number;
  successRate: number;
  totalSizeHuman: string;
  failedReports: Array<{
    projectName: string;
    serverId: string;
    backupType: string;
    errorMessage: string | null;
  }>;
  anomalies: Array<{
    projectName: string;
    serverId: string;
    backupType: string;
    anomalyReason: string | null;
  }>;
  staleServers: Array<{
    serverId: string;
    hostname: string;
    lastSeenAt: string;
    hoursSinceLastBackup: number;
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

  const [total, success, failed, warning, anomaliesCount] = await Promise.all([
    prisma.backupReport.count({ where: { createdAt: { gte: since } } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, status: 'SUCCESS' } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, status: 'FAILED' } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, status: 'WARNING' } }),
    prisma.backupReport.count({ where: { createdAt: { gte: since }, isAnomaly: true } }),
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

  const anomalies = await prisma.backupReport.findMany({
    where: { createdAt: { gte: since }, isAnomaly: true },
    select: {
      projectName: true,
      serverId: true,
      backupType: true,
      anomalyReason: true,
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  // Dead Man's Snitch: Find active servers silent for >26 hours, excluding muted ones
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);

  const unmonitoredConfigs = await prisma.serverConfig.findMany({
    where: { isMonitored: false },
    select: { serverId: true },
  });
  const unmonitoredSet = new Set(unmonitoredConfigs.map((c) => c.serverId));

  const allActiveServers = await prisma.backupReport.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { serverId: true, hostname: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const latestServerMap = new Map<string, { serverId: string; hostname: string; createdAt: Date }>();
  for (const s of allActiveServers) {
    if (!latestServerMap.has(s.serverId)) {
      latestServerMap.set(s.serverId, s);
    }
  }

  const staleServers: Array<{ serverId: string; hostname: string; lastSeenAt: string; hoursSinceLastBackup: number }> = [];
  const now = Date.now();
  for (const [srvId, info] of latestServerMap.entries()) {
    if (unmonitoredSet.has(srvId)) {
      continue; // Skip muted/unmonitored servers
    }
    if (info.createdAt < twentySixHoursAgo) {
      const hoursAgo = Math.round((now - info.createdAt.getTime()) / (3600 * 1000));
      staleServers.push({
        serverId: info.serverId,
        hostname: info.hostname,
        lastSeenAt: info.createdAt.toISOString(),
        hoursSinceLastBackup: hoursAgo,
      });
    }
  }

  const successRate = total > 0 ? Math.round((success / total) * 100) : 100;
  const totalBytes = sizeAgg._sum.backupSizeBytes || BigInt(0);

  return {
    total,
    success,
    failed,
    warning,
    anomaliesCount,
    successRate,
    totalSizeHuman: formatBytes(totalBytes),
    failedReports,
    anomalies,
    staleServers,
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

  const hasIssues = stats.failed > 0 || stats.anomaliesCount > 0 || (stats.staleServers && stats.staleServers.length > 0);
  const statusEmoji = !hasIssues ? '✅' : '⚠️';

  const widgets: any[] = [
    {
      decoratedText: {
        topLabel: 'Summary Metrics (Last 24 Hours)',
        text: `<b>Total Backups:</b> ${stats.total} | <b>Success:</b> ${stats.success} (${stats.successRate}%) | <b>Failed:</b> ${stats.failed}${stats.anomaliesCount > 0 ? ` | <b>Anomalies:</b> ${stats.anomaliesCount}` : ''}${stats.staleServers.length > 0 ? ` | <b>Stale Hosts:</b> ${stats.staleServers.length}` : ''}`,
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

  if (stats.staleServers && stats.staleServers.length > 0) {
    let staleText = '';
    stats.staleServers.slice(0, 5).forEach((s, idx) => {
      staleText += `<b>${idx + 1}. [${s.serverId}]</b> (${s.hostname}) - Silent for <b>${s.hoursSinceLastBackup}h</b><br>`;
    });

    widgets.push({
      decoratedText: {
        topLabel: `⏱️ Dead Man's Snitch: Missing Backups (${stats.staleServers.length} Stale Server${stats.staleServers.length > 1 ? 's' : ''})`,
        text: staleText,
      },
    });
  }

  if (stats.anomalies.length > 0) {
    let anomalyText = '';
    stats.anomalies.forEach((a, idx) => {
      anomalyText += `<b>${idx + 1}. [${a.projectName}]</b> on <i>${a.serverId}</i>: ${a.anomalyReason || 'Significant size drop detected'}<br>`;
    });

    widgets.push({
      decoratedText: {
        topLabel: '⚠️ Size Anomalies Detected (Potential Truncation)',
        text: anomalyText,
      },
    });
  }

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

export async function sendGoogleChatInstantAlert(report: {
  projectName: string;
  serverId: string;
  hostname: string;
  backupType: string;
  status: string;
  durationSeconds: number;
  backupSizeBytes: bigint | number;
  errorMessage?: string | null;
  anomalyReason?: string | null;
  isAnomaly?: boolean;
}): Promise<{ success: boolean; message: string }> {
  const isAnomaly = report.isAnomaly || false;
  const statusEmoji = isAnomaly ? '⚠️' : '🚨';
  const alertTitle = isAnomaly
    ? `Backup Anomaly Alert: ${report.projectName}`
    : `Backup Failure Alert: ${report.projectName}`;
  const diagnostic = report.errorMessage || report.anomalyReason || 'Unknown error occurred.';

  const cardPayload = {
    cardsV2: [
      {
        cardId: `backup_instant_alert_${Date.now()}`,
        card: {
          header: {
            title: `${statusEmoji} ${alertTitle}`,
            subtitle: `Server: ${report.serverId} (${report.hostname}) • ${new Date().toISOString()}`,
            imageUrl: isAnomaly
              ? 'https://cdn-icons-png.flaticon.com/512/595/595067.png'
              : 'https://cdn-icons-png.flaticon.com/512/753/753345.png',
            imageType: 'CIRCLE',
          },
          sections: [
            {
              header: 'Incident Details',
              widgets: [
                {
                  decoratedText: {
                    topLabel: 'Status / Type',
                    text: `<b>${report.status}</b> | ${report.backupType.toUpperCase()} Backup`,
                    startIcon: { knownIcon: 'DESCRIPTION' },
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Archive Size & Duration',
                    text: `${formatBytes(report.backupSizeBytes)} in ${report.durationSeconds}s`,
                    startIcon: { knownIcon: 'CLOCK' },
                  },
                },
                {
                  decoratedText: {
                    topLabel: 'Error / Reason',
                    text: `<font color="#d93025">${diagnostic.slice(0, 500)}</font>`,
                    wrapText: true,
                  },
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: 'Open Incident Dashboard',
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
    eventType: 'FAILURE_ALERT',
    recipient: getMaskedWebhookUrl(config.GOOGLE_CHAT_WEBHOOK_URL),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: {
      project: report.projectName,
      server: report.serverId,
      status: report.status,
      error: diagnostic,
    },
  });

  return res;
}

