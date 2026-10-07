import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { formatBytes } from '../services/gchat.service';

export async function dashboardRoutes(fastify: FastifyInstance) {
  // Summary Stats
  fastify.get(
    '/api/v1/dashboard/stats',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get dashboard KPI statistics and summary metrics',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalAllTime,
        total24h,
        success24h,
        failed24h,
        uniqueServers,
        uniqueProjects,
        totalStorageAgg,
      ] = await Promise.all([
        prisma.backupReport.count(),
        prisma.backupReport.count({ where: { createdAt: { gte: last24h } } }),
        prisma.backupReport.count({ where: { createdAt: { gte: last24h }, status: 'SUCCESS' } }),
        prisma.backupReport.count({ where: { createdAt: { gte: last24h }, status: 'FAILED' } }),
        prisma.backupReport.findMany({ select: { serverId: true }, distinct: ['serverId'] }),
        prisma.backupReport.findMany({ select: { projectName: true }, distinct: ['projectName'] }),
        prisma.backupReport.aggregate({ _sum: { backupSizeBytes: true } }),
      ]);

      const successRate = total24h > 0 ? Math.round((success24h / total24h) * 100) : 100;
      const totalStorageBytes = totalStorageAgg._sum.backupSizeBytes || BigInt(0);

      return reply.send({
        totalAllTime,
        total24h,
        success24h,
        failed24h,
        successRate,
        totalStorageBytes: Number(totalStorageBytes),
        totalStorageHuman: formatBytes(totalStorageBytes),
        activeServersCount: uniqueServers.length,
        activeProjectsCount: uniqueProjects.length,
      });
    }
  );

  // Daily Trends for Charts (past 7 to 30 days)
  fastify.get(
    '/api/v1/dashboard/trends',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get historical backup trends for charting',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'integer', default: 7 },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      const days = Math.min(60, Math.max(3, parseInt(query.days || '7', 10)));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const reports = await prisma.backupReport.findMany({
        where: { createdAt: { gte: since } },
        select: {
          status: true,
          backupSizeBytes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Group by day YYYY-MM-DD
      const trendMap: { [date: string]: { date: string; success: number; failed: number; total: number; sizeBytes: number } } = {};

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().split('T')[0];
        trendMap[key] = { date: key, success: 0, failed: 0, total: 0, sizeBytes: 0 };
      }

      for (const r of reports) {
        const key = r.createdAt.toISOString().split('T')[0];
        if (trendMap[key]) {
          trendMap[key].total += 1;
          if (r.status === 'SUCCESS') trendMap[key].success += 1;
          else if (r.status === 'FAILED') trendMap[key].failed += 1;
          trendMap[key].sizeBytes += Number(r.backupSizeBytes);
        }
      }

      return reply.send(Object.values(trendMap));
    }
  );

  // Project breakdown
  fastify.get(
    '/api/v1/dashboard/projects',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get backup stats grouped by project',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const projects = await prisma.backupReport.groupBy({
        by: ['projectName'],
        _count: { id: true },
        _sum: { backupSizeBytes: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      });

      return reply.send(
        projects.map((p) => ({
          projectName: p.projectName,
          count: p._count.id,
          totalSizeBytes: Number(p._sum.backupSizeBytes || BigInt(0)),
          totalSizeHuman: formatBytes(p._sum.backupSizeBytes || BigInt(0)),
        }))
      );
    }
  );

  // 4. Server Fleet Inventory View (100+ Servers Aggregated Status)
  fastify.get(
    '/api/v1/dashboard/fleet',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get comprehensive server fleet health and inventory status across all 100+ servers',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Filter by serverId, hostname, or IP' },
            status: { type: 'string', description: 'Filter by status: HEALTHY, WARNING, FAILED, STALE, ALL' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      const search = query.search?.trim().toLowerCase();
      const statusFilter = query.status?.toUpperCase() || 'ALL';

      // Find all reports with server metadata
      const allReports = await prisma.backupReport.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          serverId: true,
          hostname: true,
          serverIp: true,
          projectName: true,
          status: true,
          isAnomaly: true,
          backupSizeBytes: true,
          createdAt: true,
        },
      });

      // Group by serverId
      const fleetMap: Record<
        string,
        {
          serverId: string;
          hostname: string;
          serverIp: string;
          lastSeenAt: string;
          hoursSinceLastBackup: number;
          totalBackups: number;
          successCount: number;
          failedCount: number;
          warningCount: number;
          anomalyCount: number;
          totalStorageBytes: number;
          projects: Set<string>;
          status: 'HEALTHY' | 'FAILED' | 'WARNING' | 'STALE';
        }
      > = {};

      const now = Date.now();
      const staleThresholdMs = 26 * 60 * 60 * 1000; // 26 hours without backup = stale

      for (const r of allReports) {
        if (!fleetMap[r.serverId]) {
          const hoursAgo = Math.max(0, Math.round((now - r.createdAt.getTime()) / (3600 * 1000)));
          fleetMap[r.serverId] = {
            serverId: r.serverId,
            hostname: r.hostname,
            serverIp: r.serverIp || '127.0.0.1',
            lastSeenAt: r.createdAt.toISOString(),
            hoursSinceLastBackup: hoursAgo,
            totalBackups: 0,
            successCount: 0,
            failedCount: 0,
            warningCount: 0,
            anomalyCount: 0,
            totalStorageBytes: 0,
            projects: new Set<string>(),
            status: 'HEALTHY',
          };
        }

        const entry = fleetMap[r.serverId];
        entry.totalBackups += 1;
        entry.projects.add(r.projectName);
        entry.totalStorageBytes += Number(r.backupSizeBytes);

        if (r.status === 'SUCCESS') entry.successCount += 1;
        else if (r.status === 'FAILED') entry.failedCount += 1;
        else if (r.status === 'WARNING') entry.warningCount += 1;

        if (r.isAnomaly) entry.anomalyCount += 1;
      }

      // Fetch server monitoring configurations
      const serverConfigs = await prisma.serverConfig.findMany();
      const configMap = new Map(serverConfigs.map((c) => [c.serverId, c]));

      // Calculate final statuses and convert to array
      let fleetList = Object.values(fleetMap).map((s) => {
        const timeDiff = now - new Date(s.lastSeenAt).getTime();
        let computedStatus: 'HEALTHY' | 'FAILED' | 'WARNING' | 'STALE' = 'HEALTHY';

        if (timeDiff > staleThresholdMs) {
          computedStatus = 'STALE';
        } else if (s.failedCount > 0) {
          computedStatus = 'FAILED';
        } else if (s.warningCount > 0 || s.anomalyCount > 0) {
          computedStatus = 'WARNING';
        }

        const successRate = s.totalBackups > 0 ? Math.round((s.successCount / s.totalBackups) * 100) : 100;
        const cfg = configMap.get(s.serverId);
        const isMonitored = cfg ? cfg.isMonitored : true;
        const muteReason = cfg ? cfg.muteReason : null;

        return {
          serverId: s.serverId,
          hostname: s.hostname,
          serverIp: s.serverIp,
          lastSeenAt: s.lastSeenAt,
          hoursSinceLastBackup: s.hoursSinceLastBackup,
          totalBackups: s.totalBackups,
          successCount: s.successCount,
          failedCount: s.failedCount,
          warningCount: s.warningCount,
          anomalyCount: s.anomalyCount,
          successRate,
          totalStorageBytes: s.totalStorageBytes,
          totalStorageHuman: formatBytes(s.totalStorageBytes),
          projects: Array.from(s.projects),
          status: computedStatus,
          isMonitored,
          muteReason,
        };
      });

      // Search filter
      if (search) {
        fleetList = fleetList.filter(
          (s) =>
            s.serverId.toLowerCase().includes(search) ||
            s.hostname.toLowerCase().includes(search) ||
            s.serverIp.toLowerCase().includes(search) ||
            s.projects.some((p) => p.toLowerCase().includes(search))
        );
      }

      // Status filter
      if (statusFilter && statusFilter !== 'ALL') {
        if (statusFilter === 'MUTED') {
          fleetList = fleetList.filter((s) => !s.isMonitored);
        } else {
          fleetList = fleetList.filter((s) => s.isMonitored && s.status === statusFilter);
        }
      }

      // Sort: FAILED first, then STALE, then WARNING, then HEALTHY, unmonitored at bottom
      const statusWeight: Record<string, number> = { FAILED: 1, STALE: 2, WARNING: 3, HEALTHY: 4 };
      fleetList.sort((a, b) => {
        if (!a.isMonitored && b.isMonitored) return 1;
        if (a.isMonitored && !b.isMonitored) return -1;
        return (statusWeight[a.status] || 5) - (statusWeight[b.status] || 5);
      });

      return reply.send({
        fleet: fleetList,
        summary: {
          totalServers: fleetList.length,
          healthy: fleetList.filter((s) => s.isMonitored && s.status === 'HEALTHY').length,
          failing: fleetList.filter((s) => s.isMonitored && s.status === 'FAILED').length,
          warning: fleetList.filter((s) => s.isMonitored && s.status === 'WARNING').length,
          stale: fleetList.filter((s) => s.isMonitored && s.status === 'STALE').length,
          muted: fleetList.filter((s) => !s.isMonitored).length,
        },
      });
    }
  );
}

