import { config } from '../config/env';
import { getDailyStats, sendDailyBackupReportToGoogleChat, sendGoogleChatInstantAlert } from './gchat.service';
import { sendDailyBackupReportEmail, sendInstantFailureEmail } from './smtp.service';
import {
  sendSlackDailyReport,
  sendSlackInstantAlert,
  sendDiscordDailyReport,
  sendDiscordInstantAlert,
  sendTelegramDailyReport,
  sendTelegramInstantAlert,
} from './webhook.service';

// In-memory cooldown cache: key -> timestamp (ms)
// Key format: `${serverId}:${projectName}`
const failureAlertCooldownMap = new Map<string, number>();
const COOLDOWN_PERIOD_MS = 5 * 60 * 1000; // 5 minutes cooldown per server+project

export interface BackupReportAlertInput {
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
}

/**
 * Dispatches real-time instant alerts across all configured channels
 * when a backup fails or reports an anomaly.
 */
export async function dispatchInstantFailureAlert(report: BackupReportAlertInput): Promise<{
  dispatched: boolean;
  throttled: boolean;
  channels: Record<string, { attempted: boolean; success?: boolean; message?: string }>;
}> {
  if (!config.INSTANT_ALERT_ON_FAILURE) {
    return { dispatched: false, throttled: false, channels: {} };
  }

  // Only trigger on FAILED or when anomaly is flagged
  const isFailed = report.status === 'FAILED';
  const isAnomaly = report.isAnomaly === true;

  if (!isFailed && !isAnomaly) {
    return { dispatched: false, throttled: false, channels: {} };
  }

  // Deduplication check
  const cooldownKey = `${report.serverId}:${report.projectName}`;
  const now = Date.now();
  const lastAlert = failureAlertCooldownMap.get(cooldownKey);

  if (lastAlert && now - lastAlert < COOLDOWN_PERIOD_MS) {
    const remainingSeconds = Math.round((COOLDOWN_PERIOD_MS - (now - lastAlert)) / 1000);
    console.log(
      `[ALERT-DISPATCHER] Instant alert throttled for ${cooldownKey} (cooldown remaining: ${remainingSeconds}s).`
    );
    return { dispatched: false, throttled: true, channels: {} };
  }

  failureAlertCooldownMap.set(cooldownKey, now);

  const results: Record<string, { attempted: boolean; success?: boolean; message?: string }> = {};
  const tasks: Promise<any>[] = [];

  // 1. Google Chat
  if (config.ENABLE_GOOGLE_CHAT && config.GOOGLE_CHAT_WEBHOOK_URL) {
    results.googleChat = { attempted: true };
    tasks.push(
      sendGoogleChatInstantAlert(report)
        .then((res) => {
          results.googleChat = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.googleChat = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // 2. Email (SMTP / SendGrid / SES)
  if ((config.ENABLE_SMTP || config.ENABLE_EMAIL) && (config.EMAIL_TO || config.SMTP_TO)) {
    results.email = { attempted: true };
    tasks.push(
      sendInstantFailureEmail(report)
        .then((res) => {
          results.email = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.email = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // 3. Slack
  if (config.ENABLE_SLACK && config.SLACK_WEBHOOK_URL) {
    results.slack = { attempted: true };
    tasks.push(
      sendSlackInstantAlert(report)
        .then((res) => {
          results.slack = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.slack = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // 4. Discord
  if (config.ENABLE_DISCORD && config.DISCORD_WEBHOOK_URL) {
    results.discord = { attempted: true };
    tasks.push(
      sendDiscordInstantAlert(report)
        .then((res) => {
          results.discord = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.discord = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // 5. Telegram
  if (config.ENABLE_TELEGRAM && config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
    results.telegram = { attempted: true };
    tasks.push(
      sendTelegramInstantAlert(report)
        .then((res) => {
          results.telegram = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.telegram = { attempted: true, success: false, message: err.message };
        })
    );
  }

  await Promise.allSettled(tasks);

  return { dispatched: true, throttled: false, channels: results };
}

/**
 * Dispatches scheduled daily summary reports across all configured channels
 */
export async function dispatchDailyReportToAllChannels(): Promise<{
  success: boolean;
  message: string;
  channels: Record<string, { attempted: boolean; success?: boolean; message?: string }>;
}> {
  const stats = await getDailyStats();
  const results: Record<string, { attempted: boolean; success?: boolean; message?: string }> = {};
  const tasks: Promise<any>[] = [];

  // Google Chat
  if (config.ENABLE_GOOGLE_CHAT) {
    results.googleChat = { attempted: true };
    tasks.push(
      sendDailyBackupReportToGoogleChat()
        .then((res) => {
          results.googleChat = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.googleChat = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // Email
  if (config.ENABLE_SMTP || config.ENABLE_EMAIL) {
    results.email = { attempted: true };
    tasks.push(
      sendDailyBackupReportEmail()
        .then((res) => {
          results.email = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.email = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // Slack
  if (config.ENABLE_SLACK && config.SLACK_WEBHOOK_URL) {
    results.slack = { attempted: true };
    tasks.push(
      sendSlackDailyReport(stats)
        .then((res) => {
          results.slack = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.slack = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // Discord
  if (config.ENABLE_DISCORD && config.DISCORD_WEBHOOK_URL) {
    results.discord = { attempted: true };
    tasks.push(
      sendDiscordDailyReport(stats)
        .then((res) => {
          results.discord = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.discord = { attempted: true, success: false, message: err.message };
        })
    );
  }

  // Telegram
  if (config.ENABLE_TELEGRAM && config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
    results.telegram = { attempted: true };
    tasks.push(
      sendTelegramDailyReport(stats)
        .then((res) => {
          results.telegram = { attempted: true, success: res.success, message: res.message };
        })
        .catch((err) => {
          results.telegram = { attempted: true, success: false, message: err.message };
        })
    );
  }

  await Promise.allSettled(tasks);

  const attemptedCount = Object.keys(results).length;
  const successCount = Object.values(results).filter((r) => r.success).length;

  return {
    success: attemptedCount === 0 || successCount > 0,
    message: `Daily report dispatched: ${successCount}/${attemptedCount} channels succeeded`,
    channels: results,
  };
}
