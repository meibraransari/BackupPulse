import { FastifyInstance } from 'fastify';
import { getAuditLogs, getAuditStats, exportAuditLogsToCsv } from '../services/audit.service';

export async function auditRoutes(fastify: FastifyInstance) {
  // 1. List paginated & filtered audit logs (Admin only)
  fastify.get(
    '/api/v1/audit-logs',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get paginated, filtered administrative audit logs for governance & compliance',
        tags: ['Audit & Governance'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            category: { type: 'string' },
            action: { type: 'string' },
            username: { type: 'string' },
            search: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            sortBy: { type: 'string', default: 'createdAt' },
            sortOrder: { type: 'string', default: 'desc' },
          },
        },
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin access required for governance audit logs.' });
      }

      const result = await getAuditLogs(request.query);
      return reply.send(result);
    }
  );

  // 2. Summary KPI stats for management cards
  fastify.get(
    '/api/v1/audit-logs/stats',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get high-level summary counts and category breakdown for audit governance dashboard',
        tags: ['Audit & Governance'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin access required.' });
      }

      const stats = await getAuditStats();
      return reply.send(stats);
    }
  );

  // 3. Export audit logs as CSV for SOC 2 / ISO 27001 auditors
  fastify.get(
    '/api/v1/audit-logs/export',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Export administrative governance audit logs as CSV file for compliance auditors',
        tags: ['Audit & Governance'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: any) => {
      const user = request.user;
      if (user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Forbidden: Admin access required.' });
      }

      const csv = await exportAuditLogsToCsv(request.query);
      const filename = `backuppulse-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;

      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(csv);
    }
  );
}
