import client from 'prom-client';
import { prisma } from '../db/prisma';

export const register = new client.Registry();

// Enable default Node.js and runtime metrics
client.collectDefaultMetrics({
  register,
  prefix: 'backuppulse_',
});

// Custom Prometheus Metrics
export const backupRunsTotal = new client.Counter({
  name: 'backuppulse_backup_runs_total',
  help: 'Total count of ingested backup reports by status, project, server, and type',
  labelNames: ['status', 'project', 'server', 'backup_type'] as const,
  registers: [register],
});

export const backupSizeBytesGauge = new client.Gauge({
  name: 'backuppulse_backup_size_bytes',
  help: 'Latest recorded backup archive size in bytes',
  labelNames: ['project', 'server'] as const,
  registers: [register],
});

export const backupDurationSecondsGauge = new client.Gauge({
  name: 'backuppulse_backup_duration_seconds',
  help: 'Latest recorded backup run duration in seconds',
  labelNames: ['project', 'server'] as const,
  registers: [register],
});

export const backupFailures24hGauge = new client.Gauge({
  name: 'backuppulse_failures_24h',
  help: 'Number of backup failures observed in the past 24 hours',
  registers: [register],
});

export const staleServersCountGauge = new client.Gauge({
  name: 'backuppulse_stale_servers_count',
  help: 'Count of active servers that have not reported a backup for over 26 hours (Dead Man\'s Snitch)',
  registers: [register],
});

export const activeApiKeysGauge = new client.Gauge({
  name: 'backuppulse_active_api_keys',
  help: 'Total number of active, non-revoked API keys provisioned',
  registers: [register],
});

/**
 * Record a newly ingested backup run into Prometheus metric collectors
 */
export function recordBackupMetrics(report: {
  status: string;
  projectName: string;
  serverId: string;
  backupType: string;
  backupSizeBytes: bigint | number;
  durationSeconds: number;
}) {
  try {
    backupRunsTotal.inc({
      status: report.status,
      project: report.projectName,
      server: report.serverId,
      backup_type: report.backupType,
    });

    backupSizeBytesGauge.set(
      { project: report.projectName, server: report.serverId },
      Number(report.backupSizeBytes)
    );

    backupDurationSecondsGauge.set(
      { project: report.projectName, server: report.serverId },
      report.durationSeconds
    );
  } catch (err: any) {
    console.warn('[METRICS] Error updating backup metrics:', err.message);
  }
}

/**
 * Refresh gauge snapshots right before Prometheus scrapes the /metrics endpoint
 */
export async function refreshDynamicMetrics(): Promise<void> {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failures24h = await prisma.backupReport.count({
      where: {
        createdAt: { gte: since24h },
        status: 'FAILED',
      },
    });
    backupFailures24hGauge.set(failures24h);

    const activeKeys = await prisma.apiKey.count({
      where: {
        isActive: true,
        revokedAt: null,
      },
    });
    activeApiKeysGauge.set(activeKeys);

    // Stale servers calculation (Dead Man's Snitch: >26h silent)
    const twentySixHoursAgo = new Date(Date.now() - 26 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const unmonitored = await prisma.serverConfig.findMany({
      where: { isMonitored: false },
      select: { serverId: true },
    });
    const unmonitoredSet = new Set(unmonitored.map((c) => c.serverId));

    const recentReports = await prisma.backupReport.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { serverId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const latestSeen = new Map<string, Date>();
    for (const r of recentReports) {
      if (!latestSeen.has(r.serverId)) {
        latestSeen.set(r.serverId, r.createdAt);
      }
    }

    let staleCount = 0;
    for (const [srvId, lastSeen] of latestSeen.entries()) {
      if (!unmonitoredSet.has(srvId) && lastSeen < twentySixHoursAgo) {
        staleCount++;
      }
    }
    staleServersCountGauge.set(staleCount);
  } catch (err: any) {
    console.warn('[METRICS] Error calculating dynamic metrics snapshot:', err.message);
  }
}
