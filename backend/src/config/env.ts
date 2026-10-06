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

  GOOGLE_CHAT_WEBHOOK_URL: process.env.GOOGLE_CHAT_WEBHOOK_URL || '',
  GOOGLE_CHAT_REPORT_CRON: process.env.GOOGLE_CHAT_REPORT_CRON || '0 9 * * *',
  ENABLE_DAILY_REPORT: process.env.ENABLE_DAILY_REPORT !== 'false',

  // Console Logging Configuration (applies across development & production)
  ENABLE_CONSOLE_LOG: process.env.ENABLE_CONSOLE_LOG !== 'false',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
