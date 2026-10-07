import { prisma } from '../db/prisma';
import { config } from '../config/env';

export interface HousekeepingResult {
  success: boolean;
  message: string;
  retentionDays: number;
  cutoffDate?: string;
  deletedBackupReports: number;
  deletedNotificationLogs: number;
}

/**
 * Executes database cleanup to purge backup telemetry and alert logs older than DB_RETENTION_DAYS
 */
export async function runDatabaseHousekeeping(daysOverride?: number): Promise<HousekeepingResult> {
  const retentionDays = daysOverride !== undefined ? Number(daysOverride) : config.DB_RETENTION_DAYS;

  if (retentionDays <= 0) {
    const msg = `[HOUSEKEEPING] Cleanup skipped. Retention days is set to ${retentionDays} (disabled).`;
    console.log(msg);
    return {
      success: false,
      message: msg,
      retentionDays,
      deletedBackupReports: 0,
      deletedNotificationLogs: 0,
    };
  }

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  console.log(
    `[HOUSEKEEPING] Starting automated database purge. Deleting records older than ${retentionDays} days (Cutoff: ${cutoffDate.toISOString()})...`
  );

  try {
    // 1. Purge ancient backup reports
    const deletedReports = await prisma.backupReport.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    // 2. Purge ancient notification audit logs
    const deletedLogs = await prisma.notificationLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    const msg = `[HOUSEKEEPING] Database cleanup successful: Purged ${deletedReports.count} backup report(s) and ${deletedLogs.count} notification log(s) older than ${retentionDays} days.`;
    console.log(msg);

    return {
      success: true,
      message: msg,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      deletedBackupReports: deletedReports.count,
      deletedNotificationLogs: deletedLogs.count,
    };
  } catch (error: any) {
    console.error('[HOUSEKEEPING] Database cleanup failed with error:', error.message);
    return {
      success: false,
      message: `Database housekeeping failed: ${error.message}`,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      deletedBackupReports: 0,
      deletedNotificationLogs: 0,
    };
  }
}

/**
 * Returns current retention settings, database table counts, and records eligible for purge
 */
export async function getHousekeepingStatus() {
  const retentionDays = config.DB_RETENTION_DAYS;
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const [totalReports, eligibleReports, totalLogs, eligibleLogs] = await Promise.all([
    prisma.backupReport.count(),
    prisma.backupReport.count({ where: { createdAt: { lt: cutoffDate } } }),
    prisma.notificationLog.count(),
    prisma.notificationLog.count({ where: { createdAt: { lt: cutoffDate } } }),
  ]);

  return {
    enabled: config.ENABLE_HOUSEKEEPING,
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
    housekeepingCron: config.HOUSEKEEPING_CRON,
    backupReports: {
      total: totalReports,
      eligibleForCleanup: eligibleReports,
    },
    notificationLogs: {
      total: totalLogs,
      eligibleForCleanup: eligibleLogs,
    },
  };
}
