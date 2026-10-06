import cron from 'node-cron';
import { config } from '../config/env';
import { sendDailyBackupReportToGoogleChat } from './gchat.service';

export function initCronJobs(): void {
  if (!config.ENABLE_DAILY_REPORT) {
    console.log('[CRON] Daily Google Chat reporting is disabled in settings.');
    return;
  }

  if (!cron.validate(config.GOOGLE_CHAT_REPORT_CRON)) {
    console.error(`[CRON] Invalid cron expression: "${config.GOOGLE_CHAT_REPORT_CRON}". Daily reporting not started.`);
    return;
  }

  cron.schedule(config.GOOGLE_CHAT_REPORT_CRON, async () => {
    console.log('[CRON] Running daily backup summary report to Google Chat...');
    try {
      const res = await sendDailyBackupReportToGoogleChat();
      if (res.success) {
        console.log('[CRON] Daily report successfully delivered to Google Chat.');
      } else {
        console.warn('[CRON] Daily report skipped or failed:', res.message);
      }
    } catch (err: any) {
      console.error('[CRON] Unhandled error during scheduled report:', err.message);
    }
  });

  console.log(`[CRON] Daily Google Chat reporter scheduled with cron expression: "${config.GOOGLE_CHAT_REPORT_CRON}"`);
}
