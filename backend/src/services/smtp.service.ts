import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { SESClient, SendEmailCommand, GetSendQuotaCommand } from '@aws-sdk/client-ses';
import { config } from '../config/env';
import { getDailyStats } from './gchat.service';
import { recordNotificationLog } from './notification-log.service';

/**
 * Splits comma-separated email list into clean trimmed array
 */
function parseEmailRecipients(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Extracts { name, email } for strictly compliant API payloads (SendGrid)
 */
function parseEmailSender(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { email: raw.trim() };
}

/**
 * Creates and returns configured Nodemailer transport for standard SMTP
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
 * Sends an email using standard SMTP via Nodemailer
 */
export async function sendViaSmtp(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string }> {
  const transporter = getMailTransporter();
  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  return { messageId: info.messageId || `smtp-${Date.now()}` };
}

/**
 * Sends an email using SendGrid Web API v3 (@sendgrid/mail)
 */
export async function sendViaSendGrid(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string }> {
  if (!config.SENDGRID_API_KEY) {
    throw new Error('SENDGRID_API_KEY is not configured in environment variables (.env).');
  }

  sgMail.setApiKey(config.SENDGRID_API_KEY);

  const recipients = parseEmailRecipients(options.to);
  if (recipients.length === 0) {
    throw new Error('No valid recipients found in email destination address.');
  }

  const sender = parseEmailSender(options.from);

  const msg = {
    to: recipients,
    from: sender,
    subject: options.subject,
    html: options.html,
  };

  const [response] = await sgMail.send(msg as any);
  const messageId =
    (response.headers && (response.headers['x-message-id'] as string)) ||
    `sg-${Date.now()}`;

  return { messageId };
}

/**
 * Returns configured AWS SES client
 */
export function getSesClient(): SESClient {
  const clientOptions: any = {
    region: config.AWS_SES_REGION || 'us-east-1',
  };

  if (config.AWS_SES_ACCESS_KEY_ID && config.AWS_SES_SECRET_ACCESS_KEY) {
    clientOptions.credentials = {
      accessKeyId: config.AWS_SES_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SES_SECRET_ACCESS_KEY,
    };
  }

  return new SESClient(clientOptions);
}

/**
 * Sends an email using AWS SES (@aws-sdk/client-ses)
 */
export async function sendViaAwsSes(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string }> {
  const sesClient = getSesClient();
  const recipients = parseEmailRecipients(options.to);
  if (recipients.length === 0) {
    throw new Error('No valid recipients found in email destination address.');
  }

  const command = new SendEmailCommand({
    Source: options.from,
    Destination: {
      ToAddresses: recipients,
    },
    Message: {
      Subject: {
        Data: options.subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: {
          Data: options.html,
          Charset: 'UTF-8',
        },
      },
    },
  });

  const response = await sesClient.send(command);
  return { messageId: response.MessageId || `ses-${Date.now()}` };
}

/**
 * Unified Email Dispatcher: dynamically routes to SMTP, SendGrid, or AWS SES
 */
export async function dispatchEmail(options: {
  from?: string;
  to?: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string; provider: 'SMTP' | 'SENDGRID' | 'AWS_SES' }> {
  const provider = (config.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const from = options.from || config.EMAIL_FROM || config.SMTP_FROM;
  const to = options.to || config.EMAIL_TO || config.SMTP_TO;

  if (!to) {
    throw new Error('No recipient specified. Configure EMAIL_TO or SMTP_TO in .env.');
  }

  if (provider === 'sendgrid') {
    const res = await sendViaSendGrid({ from, to, subject: options.subject, html: options.html });
    return { messageId: res.messageId, provider: 'SENDGRID' };
  } else if (provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses') {
    const res = await sendViaAwsSes({ from, to, subject: options.subject, html: options.html });
    return { messageId: res.messageId, provider: 'AWS_SES' };
  } else {
    const res = await sendViaSmtp({ from, to, subject: options.subject, html: options.html });
    return { messageId: res.messageId, provider: 'SMTP' };
  }
}

/**
 * Sends a test email to verify configured email channel (SMTP, SendGrid, or AWS SES)
 */
export async function sendTestEmailNotification(): Promise<{
  success: boolean;
  message: string;
  provider?: string;
}> {
  if (!config.ENABLE_SMTP && !config.ENABLE_EMAIL) {
    return {
      success: false,
      message: 'Email reporting is disabled. Set ENABLE_SMTP=true (or ENABLE_EMAIL=true) in .env to enable.',
    };
  }

  const provider = (config.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const recipient = config.EMAIL_TO || config.SMTP_TO;

  if (!recipient) {
    return {
      success: false,
      message: 'Email recipient (EMAIL_TO or SMTP_TO) must be configured in environment variables (.env).',
    };
  }

  // Pre-flight checks per provider
  if (provider === 'sendgrid') {
    if (!config.SENDGRID_API_KEY) {
      return {
        success: false,
        message: 'SENDGRID_API_KEY is not configured in .env. Please provide a valid SendGrid API key.',
      };
    }
  } else if (provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses') {
    if (!config.AWS_SES_REGION) {
      return {
        success: false,
        message: 'AWS_SES_REGION is not configured in .env. Please specify AWS SES region (e.g. us-east-1).',
      };
    }
  } else {
    if (!config.SMTP_HOST) {
      return {
        success: false,
        message: 'SMTP_HOST must be configured in environment variables (.env) for SMTP provider.',
      };
    }
  }

  const providerTitle =
    provider === 'sendgrid' ? 'SendGrid API' :
    provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses' ? 'AWS SES' :
    'SMTP Relay';

  const providerChannel =
    provider === 'sendgrid' ? 'SENDGRID' :
    provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses' ? 'AWS_SES' :
    'SMTP';

  const providerConfigInfo =
    provider === 'sendgrid' ? `SendGrid API Key Verified (SG.***)` :
    provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses' ? `AWS SES Region: ${config.AWS_SES_REGION}` :
    `SMTP Server: ${config.SMTP_HOST}:${config.SMTP_PORT}`;

  try {
    const from = config.EMAIL_FROM || config.SMTP_FROM;
    const timestamp = new Date().toISOString();

    const subject = `[Test] BackupPulse — ${providerTitle} Delivery Verified (${timestamp})`;

    const html = `
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
          .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
          .button { display: inline-block; background-color: #10b981; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">${providerTitle.toUpperCase()} SUCCESS</span>
          <div class="title">🚀 BackupPulse Email Channel Connected</div>
          <p class="content">
            This is a test notification confirming that your <b>${providerTitle}</b> channel is properly configured and delivering automated reports.<br><br>
            <b>Provider:</b> ${providerTitle}<br>
            <b>Target Endpoint:</b> ${providerConfigInfo}<br>
            <b>Recipient(s):</b> <code>${recipient}</code>
          </p>
          <a href="${config.APP_BASE_URL}" class="button" target="_blank">Open Backup Dashboard</a>
          <div class="footer">
            Dispatched at ${timestamp} • BackupPulse Automated Telemetry
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await dispatchEmail({ from, to: recipient, subject, html });

    await recordNotificationLog({
      channel: result.provider,
      eventType: 'TEST_NOTIFICATION',
      recipient,
      status: 'SUCCESS',
      message: `Test email successfully dispatched via ${providerTitle} to ${recipient} (ID: ${result.messageId})`,
      payload: { messageId: result.messageId, provider: result.provider },
    });

    console.log(`[EMAIL] [${result.provider}] Test email delivered to ${recipient} (ID: ${result.messageId})`);

    return {
      success: true,
      message: `Test email successfully dispatched via ${providerTitle} to ${recipient} (ID: ${result.messageId})`,
      provider: result.provider,
    };
  } catch (error: any) {
    console.error(`[EMAIL] [${providerChannel}] Error sending test email:`, error.message);

    await recordNotificationLog({
      channel: providerChannel,
      eventType: 'TEST_NOTIFICATION',
      recipient: recipient || 'Unconfigured',
      status: 'FAILED',
      message: `${providerTitle} delivery failed: ${error.message}`,
    });

    return {
      success: false,
      message: `${providerTitle} delivery failed: ${error.message}`,
      provider: providerChannel,
    };
  }
}

/**
 * Generates and dispatches daily summary backup report via the configured Email Provider (SMTP, SendGrid, or AWS SES)
 */
export async function sendDailyBackupReportEmail(): Promise<{ success: boolean; message: string; provider?: string }> {
  if (!config.ENABLE_SMTP && !config.ENABLE_EMAIL) {
    return {
      success: false,
      message: 'Email reporting is disabled. Set ENABLE_SMTP=true (or ENABLE_EMAIL=true) in .env to enable.',
    };
  }

  const recipient = config.EMAIL_TO || config.SMTP_TO;
  const from = config.EMAIL_FROM || config.SMTP_FROM;
  const provider = (config.EMAIL_PROVIDER || 'smtp').toLowerCase();

  if (!recipient) {
    return {
      success: false,
      message: 'Email recipient (EMAIL_TO or SMTP_TO) must be configured in environment variables.',
    };
  }

  try {
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

    let anomaliesHtml = '';
    if (stats.anomalies && stats.anomalies.length > 0) {
      anomaliesHtml = `
        <div style="margin-top: 20px; padding: 14px; background-color: #422006; border: 1px solid #854d0e; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #facc15; font-size: 13px;">⚠️ Size Anomalies Detected (Potential Truncation)</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #fef08a;">
            <thead>
              <tr style="border-bottom: 1px solid #854d0e; text-align: left;">
                <th style="padding: 6px;">Project</th>
                <th style="padding: 6px;">Server</th>
                <th style="padding: 6px;">Type</th>
                <th style="padding: 6px;">Anomaly Reason</th>
              </tr>
            </thead>
            <tbody>
              ${stats.anomalies
                .map(
                  (a) => `
                <tr style="border-bottom: 1px solid #713f12;">
                  <td style="padding: 6px; font-weight: bold;">${a.projectName}</td>
                  <td style="padding: 6px; font-family: monospace;">${a.serverId}</td>
                  <td style="padding: 6px; text-transform: uppercase;">${a.backupType}</td>
                  <td style="padding: 6px; color: #fef9c3;">${a.anomalyReason || 'Significant size drop detected'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let staleServersHtml = '';
    if (stats.staleServers && stats.staleServers.length > 0) {
      staleServersHtml = `
        <div style="margin-top: 20px; padding: 14px; background-color: #451a03; border: 1px solid #7c2d12; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; color: #fb923c; font-size: 13px;">⏱️ Dead Man's Snitch: Missing Expected Backups (>26h)</h3>
          <p style="margin: 0 0 10px 0; font-size: 11px; color: #fdba74;">The following servers are actively monitored but have not dispatched backup telemetry within the expected schedule:</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #fed7aa;">
            <thead>
              <tr style="border-bottom: 1px solid #7c2d12; text-align: left;">
                <th style="padding: 6px;">Server ID</th>
                <th style="padding: 6px;">Hostname</th>
                <th style="padding: 6px;">Last Backup</th>
                <th style="padding: 6px;">Duration Silent</th>
              </tr>
            </thead>
            <tbody>
              ${stats.staleServers
                .map(
                  (s) => `
                <tr style="border-bottom: 1px solid #6c2710;">
                  <td style="padding: 6px; font-weight: bold; font-family: monospace;">${s.serverId}</td>
                  <td style="padding: 6px;">${s.hostname}</td>
                  <td style="padding: 6px; font-family: monospace;">${new Date(s.lastSeenAt).toLocaleString()}</td>
                  <td style="padding: 6px; color: #f97316; font-weight: bold;">${s.hoursSinceLastBackup} hours ago</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const providerTitle =
      provider === 'sendgrid' ? 'SendGrid' :
      provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses' ? 'AWS SES' :
      'SMTP';

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
                <div class="col-lbl">Successful</div>
                <div class="col-val" style="color: #34d399;">${stats.success}</div>
              </div>
              <div class="col">
                <div class="col-lbl">Failed Jobs</div>
                <div class="col-val" style="color: ${stats.failed > 0 ? '#f87171' : '#94a3b8'};">${stats.failed}</div>
              </div>
            </div>

            ${failedJobsHtml}
            ${staleServersHtml}
            ${anomaliesHtml}

            <div class="btn-container">
              <a href="${config.APP_BASE_URL}" class="button" target="_blank">Open BackupPulse Dashboard</a>
            </div>
          </div>
          <div class="footer">
            Automated scheduled report sent by BackupPulse Central via ${providerTitle} to ${recipient}.
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `[BackupPulse] Daily Summary: ${stats.successRate}% Success (${stats.total} Total, ${stats.failed} Failed) — ${dateStr}`;

    const result = await dispatchEmail({
      from,
      to: recipient,
      subject,
      html: htmlContent,
    });

    console.log(`[EMAIL] [${result.provider}] Daily backup report email dispatched successfully to ${recipient} (ID: ${result.messageId})`);

    await recordNotificationLog({
      channel: result.provider,
      eventType: 'DAILY_REPORT',
      recipient,
      status: 'SUCCESS',
      message: `Daily report email sent via ${result.provider} to ${recipient} (ID: ${result.messageId})`,
      payload: {
        total: stats.total,
        success: stats.success,
        successRate: stats.successRate,
        failed: stats.failed,
        subject,
        provider: result.provider,
      },
    });

    return {
      success: true,
      message: `Daily report email sent via ${result.provider} to ${recipient}`,
      provider: result.provider,
    };
  } catch (error: any) {
    const fallbackProvider =
      provider === 'sendgrid' ? 'SENDGRID' :
      provider === 'ses' || provider === 'aws_ses' || provider === 'aws-ses' ? 'AWS_SES' :
      'SMTP';

    console.error(`[EMAIL] [${fallbackProvider}] Failed to send daily report email:`, error.message);

    await recordNotificationLog({
      channel: fallbackProvider,
      eventType: 'DAILY_REPORT',
      recipient: recipient || 'Unconfigured',
      status: 'FAILED',
      message: `Failed to dispatch daily email: ${error.message}`,
    });

    return {
      success: false,
      message: `Failed to dispatch daily email via ${fallbackProvider}: ${error.message}`,
      provider: fallbackProvider,
    };
  }
}

/**
 * Dispatches an immediate high-priority alert email on backup failure or critical anomaly
 */
export async function sendInstantFailureEmail(report: {
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
}): Promise<{ success: boolean; message: string; provider?: string }> {
  if (!config.ENABLE_SMTP && !config.ENABLE_EMAIL) {
    return { success: false, message: 'Email reporting is disabled.' };
  }

  const recipient = config.EMAIL_TO || config.SMTP_TO;
  if (!recipient) {
    return { success: false, message: 'Recipient email address is not configured.' };
  }

  const isAnomaly = report.isAnomaly || false;
  const statusEmoji = isAnomaly ? '⚠️' : '🚨';
  const alertHeader = isAnomaly
    ? `Backup Anomaly Warning: ${report.projectName}`
    : `Backup Run Failed: ${report.projectName}`;
  const diagnostic = report.errorMessage || report.anomalyReason || 'Execution failure reported.';

  const subject = `${statusEmoji} [BackupPulse Alert] ${alertHeader} (${report.hostname})`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { background-color: #1e293b; border-radius: 12px; max-width: 650px; margin: 0 auto; overflow: hidden; border: 1px solid #334155; }
    .header { background: linear-gradient(135deg, ${isAnomaly ? '#b45309, #d97706' : '#991b1b, #dc2626'}); padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 4px 0 0 0; opacity: 0.9; font-size: 13px; }
    .content { padding: 28px 32px; }
    .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
    .metric-box { background-color: #0f172a; padding: 12px 16px; border-radius: 8px; border: 1px solid #334155; }
    .metric-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; }
    .metric-val { font-size: 16px; font-weight: 700; color: #f8fafc; margin-top: 4px; }
    .diag-box { background-color: #090d16; border-left: 4px solid ${isAnomaly ? '#f59e0b' : '#ef4444'}; padding: 16px; border-radius: 4px; font-family: monospace; font-size: 13px; color: #fca5a5; overflow-x: auto; margin: 20px 0; }
    .btn { display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center; }
    .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${statusEmoji} ${alertHeader}</h1>
      <p>Server: ${report.serverId} (${report.hostname}) • ${new Date().toUTCString()}</p>
    </div>
    <div class="content">
      <div class="metric-grid">
        <div class="metric-box">
          <div class="metric-label">Project</div>
          <div class="metric-val">${report.projectName}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Status</div>
          <div class="metric-val" style="color: ${isAnomaly ? '#fbbf24' : '#f87171'}">${report.status}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Backup Type</div>
          <div class="metric-val">${report.backupType.toUpperCase()}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Duration</div>
          <div class="metric-val">${report.durationSeconds}s</div>
        </div>
      </div>

      <div class="metric-label">Diagnostic Error Details:</div>
      <div class="diag-box">${diagnostic}</div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${config.APP_BASE_URL}" class="btn">View Live Telemetry Dashboard</a>
      </div>
    </div>
    <div class="footer">
      Automated Incident Alert from BackupPulse Watchdog
    </div>
  </div>
</body>
</html>`;

  try {
    const result = await dispatchEmail({ subject, html });

    await recordNotificationLog({
      channel: result.provider,
      eventType: 'FAILURE_ALERT',
      recipient,
      status: 'SUCCESS',
      message: `Instant alert email sent via ${result.provider} to ${recipient}`,
      payload: {
        project: report.projectName,
        server: report.serverId,
        status: report.status,
      },
    });

    return {
      success: true,
      message: `Instant alert email sent via ${result.provider} to ${recipient}`,
      provider: result.provider,
    };
  } catch (err: any) {
    const provider = (config.EMAIL_PROVIDER || 'smtp').toUpperCase();
    console.error(`[EMAIL] Failed to send instant failure alert:`, err.message);

    await recordNotificationLog({
      channel: provider,
      eventType: 'FAILURE_ALERT',
      recipient,
      status: 'FAILED',
      message: `Failed to dispatch instant alert email: ${err.message}`,
    });

    return { success: false, message: err.message, provider };
  }
}
