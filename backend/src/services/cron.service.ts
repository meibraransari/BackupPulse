import cron from 'node-cron';
import { config } from '../config/env';
import { dispatchDailyReportToAllChannels } from './alert-dispatcher.service';
import { runDatabaseHousekeeping } from './housekeeping.service';

let reportCronTask: cron.ScheduledTask | null = null;
let housekeepingCronTask: cron.ScheduledTask | null = null;

export function stopCronJobs(): void {
  if (reportCronTask) {
    reportCronTask.stop();
    reportCronTask = null;
  }
  if (housekeepingCronTask) {
    housekeepingCronTask.stop();
    housekeepingCronTask = null;
  }
}

export function rescheduleCronJobs(): void {
  console.log('[CRON] Reloading cron schedules following dynamic settings update...');
  stopCronJobs();
  initCronJobs();
}

export function initCronJobs(): void {
  // Ensure previous tasks are cleaned up
  stopCronJobs();

  // ============================================================================
  // 1. Automated Daily Telemetry Reports (Google Chat, Email, Slack, Discord, Telegram)
  // ============================================================================
  const isAnyChannelEnabled =
    config.ENABLE_GOOGLE_CHAT ||
    config.ENABLE_SMTP ||
    config.ENABLE_EMAIL ||
    config.ENABLE_SLACK ||
    config.ENABLE_DISCORD ||
    config.ENABLE_TELEGRAM;

  if (isAnyChannelEnabled) {
    if (cron.validate(config.REPORT_CRON)) {
      reportCronTask = cron.schedule(config.REPORT_CRON, async () => {
        console.log('[CRON] Executing scheduled daily backup summary report across all enabled channels...');
        try {
          const res = await dispatchDailyReportToAllChannels();
          console.log(`[CRON] ${res.message}`);
        } catch (err: any) {
          console.error('[CRON] Unhandled error during scheduled report dispatch:', err.message);
        }
      });

      const activeChannels: string[] = [];
      if (config.ENABLE_GOOGLE_CHAT) activeChannels.push('Google Chat');
      if (config.ENABLE_SMTP || config.ENABLE_EMAIL) activeChannels.push(`Email (${(config.EMAIL_PROVIDER || 'smtp').toUpperCase()})`);
      if (config.ENABLE_SLACK) activeChannels.push('Slack');
      if (config.ENABLE_DISCORD) activeChannels.push('Discord');
      if (config.ENABLE_TELEGRAM) activeChannels.push('Telegram');

      console.log(
        `[CRON] Scheduled daily reporter active for [${activeChannels.join(' & ')}] with cron: "${config.REPORT_CRON}"`
      );
    } else {
      console.error(`[CRON] Invalid cron expression: "${config.REPORT_CRON}". Daily reporting not scheduled.`);
    }
  } else {
    console.log('[CRON] Automated daily reporting is disabled (All notification channels are turned off in settings).');
  }

  // ============================================================================
  // 2. Automated Database Retention Housekeeping
  // ============================================================================
  if (config.ENABLE_HOUSEKEEPING && config.DB_RETENTION_DAYS > 0) {
    if (cron.validate(config.HOUSEKEEPING_CRON)) {
      housekeepingCronTask = cron.schedule(config.HOUSEKEEPING_CRON, async () => {
        console.log('[CRON] Executing automated database retention housekeeping...');
        try {
          await runDatabaseHousekeeping();
        } catch (err: any) {
          console.error('[CRON] Housekeeping job error:', err.message);
        }
      });

      console.log(
        `[CRON] Database housekeeping active (Retaining past ${config.DB_RETENTION_DAYS} days) with cron: "${config.HOUSEKEEPING_CRON}"`
      );
    } else {
      console.error(
        `[CRON] Invalid housekeeping cron expression: "${config.HOUSEKEEPING_CRON}". Housekeeping not scheduled.`
      );
    }
  } else {
    console.log(
      `[CRON] Database retention housekeeping is disabled (Retention days: ${config.DB_RETENTION_DAYS}, Enabled: ${config.ENABLE_HOUSEKEEPING}).`
    );
  }
}

