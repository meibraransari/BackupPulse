import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current dir
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3000',

  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres_secure_pass_123@localhost:5432/backup_monitor_db?schema=public',

  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_default_change_in_prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  INGESTION_API_KEY: process.env.INGESTION_API_KEY || 'bkp_live_secret_key_12345',

  INITIAL_ADMIN_USERNAME: process.env.INITIAL_ADMIN_USERNAME || 'admin',
  INITIAL_ADMIN_PASSWORD: process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123456',

  // Automated Report Schedule (Cron)
  REPORT_CRON: process.env.REPORT_CRON || process.env.GOOGLE_CHAT_REPORT_CRON || '0 9 * * *',

  // Google Chat Channel Settings
  ENABLE_GOOGLE_CHAT:
    process.env.ENABLE_GOOGLE_CHAT === 'true' ||
    (process.env.ENABLE_GOOGLE_CHAT !== 'false' && process.env.ENABLE_DAILY_REPORT !== 'false' && !!process.env.GOOGLE_CHAT_WEBHOOK_URL),
  GOOGLE_CHAT_WEBHOOK_URL: process.env.GOOGLE_CHAT_WEBHOOK_URL || '',

  // SMTP Email Channel Settings
  ENABLE_SMTP: process.env.ENABLE_SMTP === 'true',
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || '',
  SMTP_FROM: process.env.SMTP_FROM || 'BackupPulse <alerts@backup-pulse.internal>',
  SMTP_TO: process.env.SMTP_TO || '',

  // Console Logging Configuration (applies across development & production)
  ENABLE_CONSOLE_LOG: process.env.ENABLE_CONSOLE_LOG !== 'false',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Database Housekeeping & Data Retention (e.g. 365 days)
  DB_RETENTION_DAYS: parseInt(process.env.DB_RETENTION_DAYS || '365', 10),
  ENABLE_HOUSEKEEPING: process.env.ENABLE_HOUSEKEEPING !== 'false',
  HOUSEKEEPING_CRON: process.env.HOUSEKEEPING_CRON || '0 3 * * *', // Daily at 03:00 AM
};

