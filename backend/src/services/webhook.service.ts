import { config } from '../config/env';
import { DailySummaryStats, formatBytes } from './gchat.service';
import { recordNotificationLog } from './notification-log.service';

function maskUrl(url: string, type: string): string {
  if (!url) return 'Unconfigured';
  try {
    if (url.includes('hooks.slack.com')) {
      const parts = url.split('/');
      return `Slack Webhook (.../${parts[parts.length - 1]?.slice(0, 4)}****)`;
    }
    if (url.includes('discord.com/api/webhooks')) {
      const parts = url.split('/');
      return `Discord Webhook (.../${parts[parts.length - 1]?.slice(0, 4)}****)`;
    }
    return `${type} Webhook`;
  } catch {
    return `${type} Webhook`;
  }
}

// ==============================================================================
// 1. SLACK INTEGRATION (Block Kit)
// ==============================================================================

export async function sendSlackWebhook(payload: any): Promise<{ success: boolean; message: string }> {
  if (!config.SLACK_WEBHOOK_URL) {
    return { success: false, message: 'SLACK_WEBHOOK_URL is not configured.' };
  }

  try {
    const res = await fetch(config.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Slack API error ${res.status}: ${err}`);
    }

    return { success: true, message: 'Slack notification delivered successfully.' };
  } catch (err: any) {
    console.error('[SLACK] Dispatch failed:', err.message);
    return { success: false, message: err.message };
  }
}

export async function sendSlackInstantAlert(report: {
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
    ? `Backup Anomaly Warning: ${report.projectName}`
    : `Backup Run Failed: ${report.projectName}`;
  const errorText = report.errorMessage || report.anomalyReason || 'Unknown error occurred during execution.';

  const payload = {
    text: `${statusEmoji} *${alertTitle}* on \`${report.hostname}\``,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${statusEmoji} ${alertTitle}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Project:*\n${report.projectName}` },
          { type: 'mrkdwn', text: `*Server:*\n${report.serverId} (\`${report.hostname}\`)` },
          { type: 'mrkdwn', text: `*Status:*\n${report.status}` },
          { type: 'mrkdwn', text: `*Backup Type:*\n${report.backupType.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Size:*\n${formatBytes(report.backupSizeBytes)}` },
          { type: 'mrkdwn', text: `*Duration:*\n${report.durationSeconds}s` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Diagnostic Details:*\n\`\`\`${errorText.slice(0, 1000)}\`\`\``,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '🔍 View in Dashboard', emoji: true },
            url: config.APP_BASE_URL,
            style: 'danger',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `BackupPulse Real-Time Watchdog • ${new Date().toUTCString()}`,
          },
        ],
      },
    ],
  };

  const res = await sendSlackWebhook(payload);

  await recordNotificationLog({
    channel: 'SLACK',
    eventType: 'FAILURE_ALERT',
    recipient: maskUrl(config.SLACK_WEBHOOK_URL, 'Slack'),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: {
      project: report.projectName,
      server: report.serverId,
      status: report.status,
      error: errorText,
    },
  });

  return res;
}

export async function sendSlackDailyReport(stats: DailySummaryStats): Promise<{ success: boolean; message: string }> {
  const isHealthy = stats.failed === 0 && stats.anomaliesCount === 0;
  const emoji = isHealthy ? '✅' : stats.failed > 0 ? '🚨' : '⚠️';

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${emoji} BackupPulse Daily Telemetry Summary`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Success Rate:*\n${stats.successRate}%` },
        { type: 'mrkdwn', text: `*Total Backups:*\n${stats.total}` },
        { type: 'mrkdwn', text: `*Successful:*\n${stats.success}` },
        { type: 'mrkdwn', text: `*Failed:*\n${stats.failed}` },
        { type: 'mrkdwn', text: `*Warnings / Anomalies:*\n${stats.warning + stats.anomaliesCount}` },
        { type: 'mrkdwn', text: `*Volume Transferred:*\n${stats.totalSizeHuman}` },
      ],
    },
  ];

  if (stats.failedReports.length > 0) {
    const list = stats.failedReports
      .slice(0, 5)
      .map((r) => `• *${r.projectName}* (${r.serverId}): ${r.errorMessage || 'Failure'}`)
      .join('\n');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🚨 Recent Failures:*\n${list}`,
      },
    });
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '📊 Open Dashboard', emoji: true },
        url: config.APP_BASE_URL,
      },
    ],
  });

  const res = await sendSlackWebhook({
    text: `${emoji} BackupPulse Daily Summary: ${stats.successRate}% success across ${stats.total} runs`,
    blocks,
  });

  await recordNotificationLog({
    channel: 'SLACK',
    eventType: 'DAILY_REPORT',
    recipient: maskUrl(config.SLACK_WEBHOOK_URL, 'Slack'),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: {
      total: stats.total,
      successRate: stats.successRate,
      failed: stats.failed,
    },
  });

  return res;
}

export async function sendTestSlackNotification(): Promise<{ success: boolean; message: string }> {
  const payload = {
    text: '🚀 BackupPulse — Slack Webhook Connection Test',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🚀 Slack Webhook Connection Test', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Success!* BackupPulse is successfully connected to your Slack channel and ready to dispatch alerts.',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Dashboard', emoji: true },
            url: config.APP_BASE_URL,
          },
        ],
      },
    ],
  };

  const res = await sendSlackWebhook(payload);

  await recordNotificationLog({
    channel: 'SLACK',
    eventType: 'TEST_NOTIFICATION',
    recipient: maskUrl(config.SLACK_WEBHOOK_URL, 'Slack'),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: { test: true },
  });

  return res;
}

// ==============================================================================
// 2. DISCORD INTEGRATION (Rich Embeds)
// ==============================================================================

export async function sendDiscordWebhook(payload: any): Promise<{ success: boolean; message: string }> {
  if (!config.DISCORD_WEBHOOK_URL) {
    return { success: false, message: 'DISCORD_WEBHOOK_URL is not configured.' };
  }

  try {
    const res = await fetch(config.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Discord API error ${res.status}: ${err}`);
    }

    return { success: true, message: 'Discord notification delivered successfully.' };
  } catch (err: any) {
    console.error('[DISCORD] Dispatch failed:', err.message);
    return { success: false, message: err.message };
  }
}

export async function sendDiscordInstantAlert(report: {
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
  const color = isAnomaly ? 0xf59e0b : 0xef4444; // Amber or Red
  const title = isAnomaly
    ? `⚠️ Backup Anomaly Alert: ${report.projectName}`
    : `🚨 Backup Failure Alert: ${report.projectName}`;
  const errorText = report.errorMessage || report.anomalyReason || 'Execution failure';

  const payload = {
    embeds: [
      {
        title,
        url: config.APP_BASE_URL,
        color,
        description: `**Server:** \`${report.serverId}\` (${report.hostname})\n**Error Diagnostic:**\n\`\`\`${errorText.slice(0, 1000)}\`\`\``,
        fields: [
          { name: 'Status', value: report.status, inline: true },
          { name: 'Type', value: report.backupType.toUpperCase(), inline: true },
          { name: 'Archive Size', value: formatBytes(report.backupSizeBytes), inline: true },
          { name: 'Duration', value: `${report.durationSeconds}s`, inline: true },
        ],
        footer: { text: 'BackupPulse Automated Incident Watchdog' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await sendDiscordWebhook(payload);

  await recordNotificationLog({
    channel: 'DISCORD',
    eventType: 'FAILURE_ALERT',
    recipient: maskUrl(config.DISCORD_WEBHOOK_URL, 'Discord'),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: {
      project: report.projectName,
      server: report.serverId,
      status: report.status,
    },
  });

  return res;
}

export async function sendDiscordDailyReport(stats: DailySummaryStats): Promise<{ success: boolean; message: string }> {
  const isHealthy = stats.failed === 0 && stats.anomaliesCount === 0;
  const color = isHealthy ? 0x10b981 : stats.failed > 0 ? 0xef4444 : 0xf59e0b;

  const payload = {
    embeds: [
      {
        title: '📊 BackupPulse Daily Telemetry Summary',
        url: config.APP_BASE_URL,
        color,
        fields: [
          { name: 'Success Rate', value: `${stats.successRate}%`, inline: true },
          { name: 'Total Backups', value: String(stats.total), inline: true },
          { name: 'Successful', value: String(stats.success), inline: true },
          { name: 'Failed', value: String(stats.failed), inline: true },
          { name: 'Warnings', value: String(stats.warning + stats.anomaliesCount), inline: true },
          { name: 'Transferred', value: stats.totalSizeHuman, inline: true },
        ],
        footer: { text: 'BackupPulse Daily Digest' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await sendDiscordWebhook(payload);

  await recordNotificationLog({
    channel: 'DISCORD',
    eventType: 'DAILY_REPORT',
    recipient: maskUrl(config.DISCORD_WEBHOOK_URL, 'Discord'),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: { total: stats.total, successRate: stats.successRate },
  });

  return res;
}

export async function sendTestDiscordNotification(): Promise<{ success: boolean; message: string }> {
  const payload = {
    embeds: [
      {
        title: '🚀 BackupPulse — Discord Webhook Connection Test',
        description: 'Success! BackupPulse is successfully connected to Discord and ready to stream real-time backup alerts.',
        color: 0x3b82f6,
        footer: { text: 'BackupPulse System Check' },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await sendDiscordWebhook(payload);

  await recordNotificationLog({
    channel: 'DISCORD',
    eventType: 'TEST_NOTIFICATION',
    recipient: maskUrl(config.DISCORD_WEBHOOK_URL, 'Discord'),
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: { test: true },
  });

  return res;
}

// ==============================================================================
// 3. TELEGRAM BOT INTEGRATION (HTML Mode)
// ==============================================================================

export async function sendTelegramMessage(text: string): Promise<{ success: boolean; message: string }> {
  if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    return { success: false, message: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not configured.' };
  }

  const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        chat_id: config.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data: any = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
    }

    return { success: true, message: 'Telegram notification delivered successfully.' };
  } catch (err: any) {
    console.error('[TELEGRAM] Dispatch failed:', err.message);
    return { success: false, message: err.message };
  }
}

export async function sendTelegramInstantAlert(report: {
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
  const alertHeader = isAnomaly
    ? `<b>⚠️ Backup Anomaly Alert: ${report.projectName}</b>`
    : `<b>🚨 Backup Failure Alert: ${report.projectName}</b>`;
  const errorText = report.errorMessage || report.anomalyReason || 'Execution failure';

  const text = [
    statusEmoji + ' ' + alertHeader,
    `<b>Server:</b> <code>${report.serverId}</code> (${report.hostname})`,
    `<b>Status:</b> ${report.status} | <b>Type:</b> ${report.backupType.toUpperCase()}`,
    `<b>Size:</b> ${formatBytes(report.backupSizeBytes)} | <b>Duration:</b> ${report.durationSeconds}s`,
    `<b>Diagnostic:</b>\n<pre>${errorText.slice(0, 800)}</pre>`,
    `🔗 <a href="${config.APP_BASE_URL}">Open BackupPulse Dashboard</a>`,
  ].join('\n');

  const res = await sendTelegramMessage(text);

  await recordNotificationLog({
    channel: 'TELEGRAM',
    eventType: 'FAILURE_ALERT',
    recipient: `Telegram Chat ID: ${config.TELEGRAM_CHAT_ID}`,
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: {
      project: report.projectName,
      server: report.serverId,
      status: report.status,
    },
  });

  return res;
}

export async function sendTelegramDailyReport(stats: DailySummaryStats): Promise<{ success: boolean; message: string }> {
  const isHealthy = stats.failed === 0 && stats.anomaliesCount === 0;
  const emoji = isHealthy ? '✅' : stats.failed > 0 ? '🚨' : '⚠️';

  const text = [
    `${emoji} <b>BackupPulse Daily Telemetry Summary</b>`,
    `<b>Success Rate:</b> ${stats.successRate}%`,
    `<b>Total Runs:</b> ${stats.total} | <b>Success:</b> ${stats.success} | <b>Failed:</b> ${stats.failed}`,
    `<b>Volume Transferred:</b> ${stats.totalSizeHuman}`,
    `🔗 <a href="${config.APP_BASE_URL}">View Telemetry Dashboard</a>`,
  ].join('\n');

  const res = await sendTelegramMessage(text);

  await recordNotificationLog({
    channel: 'TELEGRAM',
    eventType: 'DAILY_REPORT',
    recipient: `Telegram Chat ID: ${config.TELEGRAM_CHAT_ID}`,
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: { total: stats.total, successRate: stats.successRate },
  });

  return res;
}

export async function sendTestTelegramNotification(): Promise<{ success: boolean; message: string }> {
  const text = [
    `🚀 <b>BackupPulse — Telegram Webhook Test</b>`,
    `Success! BackupPulse is connected to Telegram and ready to dispatch notifications.`,
    `🔗 <a href="${config.APP_BASE_URL}">Open Dashboard</a>`,
  ].join('\n');

  const res = await sendTelegramMessage(text);

  await recordNotificationLog({
    channel: 'TELEGRAM',
    eventType: 'TEST_NOTIFICATION',
    recipient: `Telegram Chat ID: ${config.TELEGRAM_CHAT_ID}`,
    status: res.success ? 'SUCCESS' : 'FAILED',
    message: res.message,
    payload: { test: true },
  });

  return res;
}
