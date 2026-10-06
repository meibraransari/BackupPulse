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
}
