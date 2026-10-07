import cron from 'node-cron';
import { config } from '../config/env';
import { sendDailyBackupReportToGoogleChat } from './gchat.service';
import { sendDailyBackupReportEmail } from './smtp.service';
import { runDatabaseHousekeeping } from './housekeeping.service';

export function initCronJobs(): void {
  // ============================================================================
  // 1. Automated Daily Telemetry Reports (Google Chat and/or SMTP)
  // ============================================================================
  const isGchatEnabled = config.ENABLE_GOOGLE_CHAT;
  const isSmtpEnabled = config.ENABLE_SMTP;

  if (isGchatEnabled || isSmtpEnabled) {
    if (cron.validate(config.REPORT_CRON)) {
      cron.schedule(config.REPORT_CRON, async () => {
        console.log('[CRON] Executing scheduled daily backup summary report...');

        // 1. Dispatch Google Chat report if enabled
        if (config.ENABLE_GOOGLE_CHAT) {
          try {
            const res = await sendDailyBackupReportToGoogleChat();
            if (res.success) {
              console.log('[CRON] [GChat] Daily summary report sent successfully.');
            } else {
              console.warn('[CRON] [GChat] Skipped or failed:', res.message);
            }
          } catch (err: any) {
            console.error('[CRON] [GChat] Unhandled error:', err.message);
          }
        }

        // 2. Dispatch SMTP Email report if enabled
        if (config.ENABLE_SMTP) {
          try {
            const res = await sendDailyBackupReportEmail();
            if (res.success) {
              console.log('[CRON] [SMTP] Daily report email sent successfully.');
            } else {
              console.warn('[CRON] [SMTP] Skipped or failed:', res.message);
            }
          } catch (err: any) {
            console.error('[CRON] [SMTP] Unhandled error:', err.message);
          }
        }
      });

      const activeChannels: string[] = [];
      if (isGchatEnabled) activeChannels.push('Google Chat');
      if (isSmtpEnabled) activeChannels.push('SMTP Email');

      console.log(
        `[CRON] Scheduled daily reporter active for [${activeChannels.join(' & ')}] with cron: "${config.REPORT_CRON}"`
      );
    } else {
      console.error(`[CRON] Invalid cron expression: "${config.REPORT_CRON}". Daily reporting not scheduled.`);
    }
  } else {
    console.log('[CRON] Automated daily reporting is disabled (Both Google Chat and SMTP channels are turned off in settings).');
  }

  // ============================================================================
  // 2. Automated Database Retention Housekeeping
  // ============================================================================
  if (config.ENABLE_HOUSEKEEPING && config.DB_RETENTION_DAYS > 0) {
    if (cron.validate(config.HOUSEKEEPING_CRON)) {
      cron.schedule(config.HOUSEKEEPING_CRON, async () => {
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
