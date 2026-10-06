import cron from 'node-cron';
import { config } from '../config/env';
import { sendDailyBackupReportToGoogleChat } from './gchat.service';
import { sendDailyBackupReportEmail } from './smtp.service';

export function initCronJobs(): void {
  const isGchatEnabled = config.ENABLE_GOOGLE_CHAT;
  const isSmtpEnabled = config.ENABLE_SMTP;

  if (!isGchatEnabled && !isSmtpEnabled) {
    console.log('[CRON] Automated daily reporting is disabled (Both Google Chat and SMTP channels are turned off in settings).');
    return;
  }

  if (!cron.validate(config.REPORT_CRON)) {
    console.error(`[CRON] Invalid cron expression: "${config.REPORT_CRON}". Daily reporting not scheduled.`);
    return;
  }

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

  console.log(`[CRON] Scheduled daily reporter active for [${activeChannels.join(' & ')}] with cron: "${config.REPORT_CRON}"`);
}
