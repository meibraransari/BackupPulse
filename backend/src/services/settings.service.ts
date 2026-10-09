import cron from 'node-cron';
import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { rescheduleCronJobs } from './cron.service';

export interface SettingDefinition {
  key: string;
  category: 'general' | 'alerts' | 'google_chat' | 'slack' | 'discord' | 'telegram' | 'email' | 'retention';
  label: string;
  description: string;
  isEncrypted: boolean;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password';
  options?: string[];
  getDefaultValue: () => string;
}

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // 1. General
  {
    key: 'APP_BASE_URL',
    category: 'general',
    label: 'Dashboard Base URL',
    description: 'Public URL of BackupPulse dashboard used in report & alert links',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.APP_BASE_URL || 'http://localhost:3000',
  },
  {
    key: 'INGESTION_API_KEY',
    category: 'general',
    label: 'Master Ingestion API Key',
    description: 'Global master API key used by backup scripts to send telemetry reports',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.INGESTION_API_KEY || 'bkp_live_secret_key_12345',
  },
  {
    key: 'ENABLE_CONSOLE_LOG',
    category: 'general',
    label: 'Console HTTP Request Logging',
    description: 'Log all incoming HTTP requests to stdout console',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_CONSOLE_LOG),
  },
  {
    key: 'LOG_LEVEL',
    category: 'general',
    label: 'Console Log Level',
    description: 'Stdout logger verbosity',
    isEncrypted: false,
    type: 'select',
    options: ['info', 'debug', 'warn', 'error'],
    getDefaultValue: () => config.LOG_LEVEL || 'info',
  },
  {
    key: 'ENABLE_SWAGGER',
    category: 'general',
    label: 'Swagger OpenAPI Documentation UI',
    description: 'Enable interactive API documentation at /api/docs and OpenAPI JSON schema (disable for production security hardening)',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => (process.env.ENABLE_SWAGGER !== undefined ? process.env.ENABLE_SWAGGER : 'true'),
  },

  // 2. Automated Alerts & Schedules
  {
    key: 'REPORT_CRON',
    category: 'alerts',
    label: 'Daily Digest Cron Schedule',
    description: 'Standard 5-part cron expression for daily summary report (e.g. "0 9 * * *" = 9:00 AM)',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.REPORT_CRON || '0 9 * * *',
  },
  {
    key: 'INSTANT_ALERT_ON_FAILURE',
    category: 'alerts',
    label: 'Real-Time Failure Alerts',
    description: 'Immediately dispatch alert cards when a backup job fails or size anomaly is detected',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.INSTANT_ALERT_ON_FAILURE),
  },

  // 3. Google Chat
  {
    key: 'ENABLE_GOOGLE_CHAT',
    category: 'google_chat',
    label: 'Enable Google Chat Channel',
    description: 'Send daily summary cards and failure alerts to Google Chat',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_GOOGLE_CHAT),
  },
  {
    key: 'GOOGLE_CHAT_WEBHOOK_URL',
    category: 'google_chat',
    label: 'Google Chat Webhook URL',
    description: 'Incoming webhook URL generated in your Google Chat Space',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.GOOGLE_CHAT_WEBHOOK_URL || '',
  },

  // 4. Slack
  {
    key: 'ENABLE_SLACK',
    category: 'slack',
    label: 'Enable Slack Channel',
    description: 'Send Block Kit formatted daily summaries and instant alerts to Slack',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_SLACK),
  },
  {
    key: 'SLACK_WEBHOOK_URL',
    category: 'slack',
    label: 'Slack Webhook URL',
    description: 'Incoming webhook URL for your Slack channel (https://hooks.slack.com/services/...)',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.SLACK_WEBHOOK_URL || '',
  },

  // 5. Discord
  {
    key: 'ENABLE_DISCORD',
    category: 'discord',
    label: 'Enable Discord Channel',
    description: 'Send Rich Embed daily digests and instant failure alerts to Discord',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_DISCORD),
  },
  {
    key: 'DISCORD_WEBHOOK_URL',
    category: 'discord',
    label: 'Discord Webhook URL',
    description: 'Discord Channel Incoming Webhook URL (https://discord.com/api/webhooks/...)',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.DISCORD_WEBHOOK_URL || '',
  },

  // 6. Telegram
  {
    key: 'ENABLE_TELEGRAM',
    category: 'telegram',
    label: 'Enable Telegram Channel',
    description: 'Send formatted HTML digests and alerts to Telegram Bot',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_TELEGRAM),
  },
  {
    key: 'TELEGRAM_BOT_TOKEN',
    category: 'telegram',
    label: 'Telegram Bot API Token',
    description: 'Bot token provided by @BotFather',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.TELEGRAM_BOT_TOKEN || '',
  },
  {
    key: 'TELEGRAM_CHAT_ID',
    category: 'telegram',
    label: 'Telegram Chat / Group ID',
    description: 'Numeric Chat ID or Channel Username (e.g. -100123456789 or @mychannel)',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.TELEGRAM_CHAT_ID || '',
  },

  // 7. Email Delivery
  {
    key: 'ENABLE_EMAIL',
    category: 'email',
    label: 'Enable Email Delivery',
    description: 'Dispatch daily reports and incident alerts via email',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_EMAIL),
  },
  {
    key: 'EMAIL_PROVIDER',
    category: 'email',
    label: 'Active Email Provider',
    description: 'Delivery backend engine (Standard SMTP, SendGrid, or AWS SES)',
    isEncrypted: false,
    type: 'select',
    options: ['smtp', 'sendgrid', 'ses'],
    getDefaultValue: () => config.EMAIL_PROVIDER || 'smtp',
  },
  {
    key: 'EMAIL_FROM',
    category: 'email',
    label: 'Sender Address (From)',
    description: 'Sender email e.g. "BackupPulse <alerts@yourdomain.com>"',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.EMAIL_FROM || 'BackupPulse <alerts@backup-pulse.internal>',
  },
  {
    key: 'EMAIL_TO',
    category: 'email',
    label: 'Recipient Address (To)',
    description: 'Destination email addresses, comma-separated',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.EMAIL_TO || '',
  },
  {
    key: 'SMTP_HOST',
    category: 'email',
    label: 'SMTP Host',
    description: 'SMTP server hostname or relay (e.g. smtp.gmail.com, mail.domain.com)',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.SMTP_HOST || '',
  },
  {
    key: 'SMTP_PORT',
    category: 'email',
    label: 'SMTP Port',
    description: 'Port number (587 for STARTTLS, 465 for SSL)',
    isEncrypted: false,
    type: 'number',
    getDefaultValue: () => String(config.SMTP_PORT || 587),
  },
  {
    key: 'SMTP_SECURE',
    category: 'email',
    label: 'SMTP Secure (SSL/TLS)',
    description: 'True for SSL on port 465, false for STARTTLS on port 587',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.SMTP_SECURE),
  },
  {
    key: 'SMTP_USER',
    category: 'email',
    label: 'SMTP Username',
    description: 'Authentication username or email address',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.SMTP_USER || '',
  },
  {
    key: 'SMTP_PASSWORD',
    category: 'email',
    label: 'SMTP Password',
    description: 'Authentication password or application-specific password',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.SMTP_PASSWORD || '',
  },
  {
    key: 'SENDGRID_API_KEY',
    category: 'email',
    label: 'SendGrid API Key',
    description: 'SendGrid Web API v3 key (SG.***)',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.SENDGRID_API_KEY || '',
  },
  {
    key: 'AWS_SES_REGION',
    category: 'email',
    label: 'AWS SES Region',
    description: 'Region hosting Amazon SES (e.g. us-east-1, eu-west-1)',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.AWS_SES_REGION || 'us-east-1',
  },
  {
    key: 'AWS_SES_ACCESS_KEY_ID',
    category: 'email',
    label: 'AWS SES Access Key ID',
    description: 'AWS IAM access key with SES dispatch permissions',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.AWS_SES_ACCESS_KEY_ID || '',
  },
  {
    key: 'AWS_SES_SECRET_ACCESS_KEY',
    category: 'email',
    label: 'AWS SES Secret Access Key',
    description: 'AWS IAM secret access key',
    isEncrypted: true,
    type: 'password',
    getDefaultValue: () => config.AWS_SES_SECRET_ACCESS_KEY || '',
  },

  // 8. Retention & Housekeeping
  {
    key: 'ENABLE_HOUSEKEEPING',
    category: 'retention',
    label: 'Enable Automated Housekeeping',
    description: 'Automatically purge telemetry and audit logs older than retention period',
    isEncrypted: false,
    type: 'boolean',
    getDefaultValue: () => String(config.ENABLE_HOUSEKEEPING),
  },
  {
    key: 'DB_RETENTION_DAYS',
    category: 'retention',
    label: 'Data Retention Period (Days)',
    description: 'Keep backup records and audit logs for this number of days (e.g. 365)',
    isEncrypted: false,
    type: 'number',
    getDefaultValue: () => String(config.DB_RETENTION_DAYS || 365),
  },
  {
    key: 'HOUSEKEEPING_CRON',
    category: 'retention',
    label: 'Housekeeping Cron Schedule',
    description: 'Cron schedule for database purge job (e.g. "0 3 * * *" = 3:00 AM daily)',
    isEncrypted: false,
    type: 'string',
    getDefaultValue: () => config.HOUSEKEEPING_CRON || '0 3 * * *',
  },
];

const MASKED_SECRET_PLACEHOLDER = '••••••••';

/**
 * Synchronizes the in-memory config object with current key-value pairs
 */
export function syncConfigFromSettings(settingsMap: Map<string, string>): void {
  if (settingsMap.has('APP_BASE_URL')) {
    config.APP_BASE_URL = settingsMap.get('APP_BASE_URL') || config.APP_BASE_URL;
  }
  if (settingsMap.has('INGESTION_API_KEY')) {
    config.INGESTION_API_KEY = settingsMap.get('INGESTION_API_KEY') || config.INGESTION_API_KEY;
  }
  if (settingsMap.has('ENABLE_CONSOLE_LOG')) {
    config.ENABLE_CONSOLE_LOG = settingsMap.get('ENABLE_CONSOLE_LOG') === 'true';
  }
  if (settingsMap.has('LOG_LEVEL')) {
    config.LOG_LEVEL = settingsMap.get('LOG_LEVEL') || 'info';
  }
  if (settingsMap.has('ENABLE_SWAGGER')) {
    config.ENABLE_SWAGGER = settingsMap.get('ENABLE_SWAGGER') === 'true';
  }

  if (settingsMap.has('REPORT_CRON')) {
    config.REPORT_CRON = settingsMap.get('REPORT_CRON') || config.REPORT_CRON;
  }
  if (settingsMap.has('INSTANT_ALERT_ON_FAILURE')) {
    config.INSTANT_ALERT_ON_FAILURE = settingsMap.get('INSTANT_ALERT_ON_FAILURE') === 'true';
  }

  if (settingsMap.has('ENABLE_GOOGLE_CHAT')) {
    config.ENABLE_GOOGLE_CHAT = settingsMap.get('ENABLE_GOOGLE_CHAT') === 'true';
  }
  if (settingsMap.has('GOOGLE_CHAT_WEBHOOK_URL')) {
    config.GOOGLE_CHAT_WEBHOOK_URL = settingsMap.get('GOOGLE_CHAT_WEBHOOK_URL') || '';
  }

  if (settingsMap.has('ENABLE_SLACK')) {
    config.ENABLE_SLACK = settingsMap.get('ENABLE_SLACK') === 'true';
  }
  if (settingsMap.has('SLACK_WEBHOOK_URL')) {
    config.SLACK_WEBHOOK_URL = settingsMap.get('SLACK_WEBHOOK_URL') || '';
  }

  if (settingsMap.has('ENABLE_DISCORD')) {
    config.ENABLE_DISCORD = settingsMap.get('ENABLE_DISCORD') === 'true';
  }
  if (settingsMap.has('DISCORD_WEBHOOK_URL')) {
    config.DISCORD_WEBHOOK_URL = settingsMap.get('DISCORD_WEBHOOK_URL') || '';
  }

  if (settingsMap.has('ENABLE_TELEGRAM')) {
    config.ENABLE_TELEGRAM = settingsMap.get('ENABLE_TELEGRAM') === 'true';
  }
  if (settingsMap.has('TELEGRAM_BOT_TOKEN')) {
    config.TELEGRAM_BOT_TOKEN = settingsMap.get('TELEGRAM_BOT_TOKEN') || '';
  }
  if (settingsMap.has('TELEGRAM_CHAT_ID')) {
    config.TELEGRAM_CHAT_ID = settingsMap.get('TELEGRAM_CHAT_ID') || '';
  }

  const emailEnabled = settingsMap.get('ENABLE_EMAIL') === 'true';
  config.ENABLE_EMAIL = emailEnabled;
  config.ENABLE_SMTP = emailEnabled;

  if (settingsMap.has('EMAIL_PROVIDER')) {
    config.EMAIL_PROVIDER = (settingsMap.get('EMAIL_PROVIDER') || 'smtp').toLowerCase() as any;
  }
  if (settingsMap.has('EMAIL_FROM')) {
    const from = settingsMap.get('EMAIL_FROM') || config.EMAIL_FROM;
    config.EMAIL_FROM = from;
    config.SMTP_FROM = from;
    config.SENDGRID_FROM = from;
    config.AWS_SES_FROM = from;
  }
  if (settingsMap.has('EMAIL_TO')) {
    const to = settingsMap.get('EMAIL_TO') || config.EMAIL_TO;
    config.EMAIL_TO = to;
    config.SMTP_TO = to;
  }
  if (settingsMap.has('SMTP_HOST')) {
    config.SMTP_HOST = settingsMap.get('SMTP_HOST') || '';
  }
  if (settingsMap.has('SMTP_PORT')) {
    config.SMTP_PORT = parseInt(settingsMap.get('SMTP_PORT') || '587', 10);
  }
  if (settingsMap.has('SMTP_SECURE')) {
    config.SMTP_SECURE = settingsMap.get('SMTP_SECURE') === 'true';
  }
  if (settingsMap.has('SMTP_USER')) {
    config.SMTP_USER = settingsMap.get('SMTP_USER') || '';
  }
  if (settingsMap.has('SMTP_PASSWORD')) {
    config.SMTP_PASSWORD = settingsMap.get('SMTP_PASSWORD') || '';
  }

  if (settingsMap.has('SENDGRID_API_KEY')) {
    config.SENDGRID_API_KEY = settingsMap.get('SENDGRID_API_KEY') || '';
  }

  if (settingsMap.has('AWS_SES_REGION')) {
    config.AWS_SES_REGION = settingsMap.get('AWS_SES_REGION') || 'us-east-1';
  }
  if (settingsMap.has('AWS_SES_ACCESS_KEY_ID')) {
    config.AWS_SES_ACCESS_KEY_ID = settingsMap.get('AWS_SES_ACCESS_KEY_ID') || '';
  }
  if (settingsMap.has('AWS_SES_SECRET_ACCESS_KEY')) {
    config.AWS_SES_SECRET_ACCESS_KEY = settingsMap.get('AWS_SES_SECRET_ACCESS_KEY') || '';
  }

  if (settingsMap.has('ENABLE_HOUSEKEEPING')) {
    config.ENABLE_HOUSEKEEPING = settingsMap.get('ENABLE_HOUSEKEEPING') === 'true';
  }
  if (settingsMap.has('DB_RETENTION_DAYS')) {
    config.DB_RETENTION_DAYS = parseInt(settingsMap.get('DB_RETENTION_DAYS') || '365', 10);
  }
  if (settingsMap.has('HOUSEKEEPING_CRON')) {
    config.HOUSEKEEPING_CRON = settingsMap.get('HOUSEKEEPING_CRON') || '0 3 * * *';
  }
}

/**
 * Initializes settings table on boot: seeds any missing setting definitions from .env / defaults
 * and updates config memory cache.
 */
export async function initSettings(): Promise<void> {
  try {
    const existing = await prisma.systemSetting.findMany();
    const existingMap = new Map(existing.map((s) => [s.key, s]));

    const missingToCreate: Array<{
      key: string;
      value: string;
      category: string;
      description: string;
      isEncrypted: boolean;
    }> = [];

    for (const def of SETTING_DEFINITIONS) {
      if (!existingMap.has(def.key)) {
        missingToCreate.push({
          key: def.key,
          value: def.getDefaultValue(),
          category: def.category,
          description: def.description,
          isEncrypted: def.isEncrypted,
        });
      }
    }

    if (missingToCreate.length > 0) {
      console.log(`[SETTINGS] Seeding ${missingToCreate.length} system setting(s) to database...`);
      for (const item of missingToCreate) {
        await prisma.systemSetting.create({
          data: item,
        });
      }
    }

    // Refresh all settings from database and synchronize in-memory config
    const current = await prisma.systemSetting.findMany();
    const settingsMap = new Map(current.map((s) => [s.key, s.value]));
    syncConfigFromSettings(settingsMap);
    console.log(`[SETTINGS] System settings loaded successfully (${current.length} settings active from database).`);
  } catch (err: any) {
    console.error('[SETTINGS] Warning: Could not initialize database settings (fallback to .env):', err.message);
  }
}

/**
 * Retrieves all settings grouped by category for the administrator UI.
 * Masks secret values so sensitive credentials are not leaked.
 */
export async function getAllSettings(): Promise<{
  settings: Array<{
    key: string;
    value: string;
    category: string;
    label: string;
    description: string;
    isEncrypted: boolean;
    type: string;
    options?: string[];
    isConfigured: boolean;
    updatedAt: string;
    updatedBy: string | null;
  }>;
  categories: Array<{ id: string; name: string }>;
}> {
  const rows = await prisma.systemSetting.findMany({
    orderBy: { key: 'asc' },
  });
  const rowMap = new Map(rows.map((r) => [r.key, r]));

  const result: any[] = [];

  for (const def of SETTING_DEFINITIONS) {
    const row = rowMap.get(def.key);
    const rawVal = row ? row.value : def.getDefaultValue();
    const isConfigured = Boolean(rawVal && rawVal.trim().length > 0);

    let displayVal = rawVal;
    if (def.isEncrypted && isConfigured) {
      displayVal = MASKED_SECRET_PLACEHOLDER;
    }

    result.push({
      key: def.key,
      value: displayVal,
      category: def.category,
      label: def.label,
      description: def.description,
      isEncrypted: def.isEncrypted,
      type: def.type,
      options: def.options,
      isConfigured,
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
      updatedBy: row?.updatedBy || null,
    });
  }

  const categories = [
    { id: 'general', name: 'General & Hub' },
    { id: 'alerts', name: 'Alerts & Cron Schedules' },
    { id: 'google_chat', name: 'Google Chat' },
    { id: 'slack', name: 'Slack' },
    { id: 'discord', name: 'Discord' },
    { id: 'telegram', name: 'Telegram' },
    { id: 'email', name: 'Email Delivery (SMTP / SendGrid / SES)' },
    { id: 'retention', name: 'Retention & Housekeeping' },
  ];

  return { settings: result, categories };
}

/**
 * Updates system settings and immediately updates active in-memory services & cron tasks
 */
export async function updateSettings(
  updates: Record<string, string>,
  updatedBy: string
): Promise<{ success: boolean; updatedCount: number; message: string }> {
  const defMap = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]));
  const currentRows = await prisma.systemSetting.findMany();
  const currentRowMap = new Map(currentRows.map((r) => [r.key, r]));

  // Validation phase
  if (updates.REPORT_CRON && !cron.validate(updates.REPORT_CRON)) {
    throw new Error(`Invalid cron format for REPORT_CRON: "${updates.REPORT_CRON}"`);
  }
  if (updates.HOUSEKEEPING_CRON && !cron.validate(updates.HOUSEKEEPING_CRON)) {
    throw new Error(`Invalid cron format for HOUSEKEEPING_CRON: "${updates.HOUSEKEEPING_CRON}"`);
  }
  if (updates.DB_RETENTION_DAYS) {
    const num = parseInt(updates.DB_RETENTION_DAYS, 10);
    if (isNaN(num) || num < 1) {
      throw new Error('DB_RETENTION_DAYS must be a positive integer (e.g. 30, 90, 365).');
    }
  }
  if (updates.SMTP_PORT) {
    const port = parseInt(updates.SMTP_PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid port number between 1 and 65535.');
    }
  }

  let updatedCount = 0;
  let shouldRescheduleCron = false;

  for (const [key, rawValue] of Object.entries(updates)) {
    const def = defMap.get(key);
    if (!def) continue;

    let finalValue = String(rawValue ?? '').trim();

    // If an encrypted field is left masked, preserve existing value in DB
    if (def.isEncrypted && (finalValue === MASKED_SECRET_PLACEHOLDER || finalValue === '')) {
      const existing = currentRowMap.get(key);
      if (existing && existing.value) {
        continue; // Keep existing stored secret
      }
    }

    if (key === 'REPORT_CRON' || key === 'HOUSEKEEPING_CRON' || key.startsWith('ENABLE_')) {
      shouldRescheduleCron = true;
    }

    await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value: finalValue,
        category: def.category,
        description: def.description,
        isEncrypted: def.isEncrypted,
        updatedBy,
      },
      create: {
        key,
        value: finalValue,
        category: def.category,
        description: def.description,
        isEncrypted: def.isEncrypted,
        updatedBy,
      },
    });

    updatedCount++;
  }

  // Reload all settings from DB and immediately sync config in-memory
  const freshRows = await prisma.systemSetting.findMany();
  const settingsMap = new Map(freshRows.map((r) => [r.key, r.value]));
  syncConfigFromSettings(settingsMap);

  // If cron schedules or enable toggles changed, immediately reschedule active cron jobs
  if (shouldRescheduleCron) {
    rescheduleCronJobs();
  }

  console.log(`[SETTINGS] Successfully updated ${updatedCount} setting(s) by ${updatedBy}. Active in-memory config reloaded.`);

  return {
    success: true,
    updatedCount,
    message: `${updatedCount} settings updated and applied immediately in memory.`,
  };
}
