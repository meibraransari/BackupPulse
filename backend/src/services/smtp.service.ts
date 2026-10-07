import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { getDailyStats } from './gchat.service';
import { recordNotificationLog } from './notification-log.service';

/**
 * Creates and returns configured Nodemailer transport
 */
export function getMailTransporter() {
  if (!config.SMTP_HOST) {
    throw new Error('SMTP_HOST is not configured in environment variables.');
  }

  const transportOptions: any = {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE, // true for 465, false for 587 / other ports
  };

  if (config.SMTP_USER && config.SMTP_PASSWORD) {
    transportOptions.auth = {
      user: config.SMTP_USER,
      pass: config.SMTP_PASSWORD,
    };
  }

  return nodemailer.createTransport(transportOptions);
}

/**
 * Sends a test email to verify SMTP configuration
 */
export async function sendTestEmailNotification(): Promise<{ success: boolean; message: string }> {
  if (!config.ENABLE_SMTP) {
    return {
      success: false,
      message: 'SMTP reporting is disabled. Set ENABLE_SMTP=true in .env to enable.',
    };
  }

  if (!config.SMTP_HOST || !config.SMTP_TO) {
    return {
      success: false,
      message: 'SMTP_HOST and SMTP_TO must be configured in environment variables (.env).',
    };
  }

  try {
    const transporter = getMailTransporter();

    // Verify SMTP connection
    await transporter.verify();

    const timestamp = new Date().toISOString();
    const info = await transporter.sendMail({
      from: config.SMTP_FROM,
      to: config.SMTP_TO,
      subject: `[Test] BackupPulse — SMTP Connection Verified (${timestamp})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
            .card { background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 24px; max-width: 600px; margin: 0 auto; }
            .badge { background-color: #064e3b; color: #34d399; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; display: inline-block; }
            .title { font-size: 20px; font-weight: bold; margin-top: 12px; color: #ffffff; }
            .content { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-top: 12px; }
            .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; pt: 16px; }
            .button { display: inline-block; background-color: #10b981; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">SMTP SUCCESS</span>
            <div class="title">🚀 BackupPulse Email Channel Connected</div>
            <p class="content">
              This is a test notification confirming that your SMTP server (<b>${config.SMTP_HOST}:${config.SMTP_PORT}</b>) 
              is properly configured and delivering automated reports to: <br>
              <code>${config.SMTP_TO}</code>
            </p>
            <a href="${config.APP_BASE_URL}" class="button" target="_blank">Open Backup Dashboard</a>
            <div class="footer">
              Dispatched at ${timestamp} • BackupPulse Automated Telemetry
            </div>
          </div>
        </body>
        </html>
      `,
    });

    await recordNotificationLog({
      channel: 'SMTP',
      eventType: 'TEST_NOTIFICATION',
      recipient: config.SMTP_TO,
      status: 'SUCCESS',
      message: `Test email successfully dispatched to ${config.SMTP_TO} (Message ID: ${info.messageId})`,
      payload: { messageId: info.messageId },
    });

    return {
      success: true,
      message: `Test email successfully dispatched to ${config.SMTP_TO} (Message ID: ${info.messageId})`,
    };
  } catch (error: any) {
    console.error('[SMTP] Error sending test email:', error.message);

    await recordNotificationLog({
      channel: 'SMTP',
      eventType: 'TEST_NOTIFICATION',
      recipient: config.SMTP_TO || 'Unconfigured',
      status: 'FAILED',
      message: `SMTP delivery failed: ${error.message}`,
    });

    return {
      success: false,
      message: `SMTP delivery failed: ${error.message}`,
    };
  }
}

/**
 * Generates and dispatches daily summary backup report via SMTP
 */
export async function sendDailyBackupReportEmail(): Promise<{ success: boolean; message: string }> {
  if (!config.ENABLE_SMTP) {
    return {
      success: false,
      message: 'SMTP reporting is disabled. Set ENABLE_SMTP=true in .env to enable.',
    };
  }

  if (!config.SMTP_HOST || !config.SMTP_TO) {
    return {
      success: false,
      message: 'SMTP_HOST and SMTP_TO must be configured in environment variables.',
    };
  }

  try {
    const transporter = getMailTransporter();
    const stats = await getDailyStats();

    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    const isAllPassed = stats.failed === 0;
    const headerColor = isAllPassed ? '#10b981' : '#ef4444';
    const statusText = isAllPassed ? 'All Systems Healthy' : `${stats.failed} Backup Failure(s) Detected`;

    let failedJobsHtml = '';
    if (stats.failedReports.length > 0) {
      failedJobsHtml = `
        <div style="margin-top: 24px; padding: 16px; background-color: #450a0a; border: 1px solid #7f1d1d; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; color: #f87171; font-size: 14px;">🚨 Failed Backup Jobs (Last 24 Hours)</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #fca5a5;">
            <thead>
              <tr style="border-bottom: 1px solid #7f1d1d; text-align: left;">
                <th style="padding: 6px;">Project</th>
                <th style="padding: 6px;">Server</th>
                <th style="padding: 6px;">Type</th>
                <th style="padding: 6px;">Error Reason</th>
              </tr>
            </thead>
            <tbody>
              ${stats.failedReports
                .map(
                  (f) => `
                <tr style="border-bottom: 1px solid #571010;">
                  <td style="padding: 6px; font-weight: bold;">${f.projectName}</td>
                  <td style="padding: 6px; font-family: monospace;">${f.serverId}</td>
                  <td style="padding: 6px; text-transform: uppercase;">${f.backupType}</td>
                  <td style="padding: 6px; color: #fecaca;">${f.errorMessage || 'Process terminated with non-zero exit code'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 20px; }
          .container { max-width: 650px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
          .header { background-color: ${headerColor}; padding: 20px 24px; color: #ffffff; }
          .header h1 { margin: 0; font-size: 20px; }
          .header p { margin: 4px 0 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 24px; }
          .grid { display: table; width: 100%; margin-top: 16px; }
          .col { display: table-cell; width: 25%; padding: 12px; background-color: #0f172a; border-radius: 8px; text-align: center; border: 1px solid #334155; }
          .col-val { font-size: 22px; font-weight: bold; color: #ffffff; margin-top: 4px; }
          .col-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
          .btn-container { text-align: center; margin-top: 24px; }
          .button { display: inline-block; background-color: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; }
          .footer { padding: 16px 24px; background-color: #0f172a; border-top: 1px solid #334155; font-size: 12px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ Daily Backup Telemetry Report</h1>
            <p>${dateStr} • Status: <strong>${statusText}</strong></p>
          </div>
          <div class="content">
            <div class="grid">
              <div class="col" style="margin-right: 8px;">
                <div class="col-lbl">Total Backups</div>
                <div class="col-val">${stats.total}</div>
              </div>
              <div class="col" style="margin-right: 8px;">
                <div class="col-lbl">Success Rate</div>
                <div class="col-val" style="color: ${stats.successRate >= 90 ? '#34d399' : '#f87171'};">${stats.successRate}%</div>
              </div>
              <div class="col" style="margin-right: 8px;">
                <div class="col-lbl">Failed Jobs</div>
                <div class="col-val" style="color: ${stats.failed > 0 ? '#f87171' : '#ffffff'};">${stats.failed}</div>
              </div>
              <div class="col">
                <div class="col-lbl">Vault Storage</div>
                <div class="col-val">${stats.totalSizeHuman}</div>
              </div>
            </div>

            ${failedJobsHtml}

            <div class="btn-container">
              <a href="${config.APP_BASE_URL}" class="button" target="_blank">Open BackupPulse Dashboard</a>
            </div>
          </div>
          <div class="footer">
            Automated scheduled report sent by BackupPulse Central to ${config.SMTP_TO}.
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `[BackupPulse] Daily Summary: ${stats.successRate}% Success (${stats.total} Total, ${stats.failed} Failed) — ${dateStr}`;

    const info = await transporter.sendMail({
      from: config.SMTP_FROM,
      to: config.SMTP_TO,
      subject,
      html: htmlContent,
    });

    console.log(`[SMTP] Daily backup report email dispatched successfully to ${config.SMTP_TO} (ID: ${info.messageId})`);

    await recordNotificationLog({
      channel: 'SMTP',
      eventType: 'DAILY_REPORT',
      recipient: config.SMTP_TO,
      status: 'SUCCESS',
      message: `Daily report email sent to ${config.SMTP_TO} (ID: ${info.messageId})`,
      payload: {
        total: stats.total,
        successRate: stats.successRate,
        failed: stats.failed,
        totalSizeHuman: stats.totalSizeHuman,
        subject,
      },
    });

    return {
      success: true,
      message: `Daily report email sent to ${config.SMTP_TO}`,
    };
  } catch (error: any) {
    console.error('[SMTP] Failed to send daily report email:', error.message);

    await recordNotificationLog({
      channel: 'SMTP',
      eventType: 'DAILY_REPORT',
      recipient: config.SMTP_TO || 'Unconfigured',
      status: 'FAILED',
      message: `Failed to dispatch daily email: ${error.message}`,
    });

    return {
      success: false,
      message: `Failed to dispatch daily email: ${error.message}`,
    };
  }
}
