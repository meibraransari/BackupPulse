import { FastifyInstance } from 'fastify';
import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { formatBytes } from '../services/gchat.service';

export async function backupRoutes(fastify: FastifyInstance) {
  // Ingestion API from Shell Script
  fastify.post(
    '/api/v1/backups/report',
    {
      schema: {
        description: 'Ingest backup report from shell script running on client servers',
        tags: ['Backup Ingestion'],
        headers: {
          type: 'object',
          properties: {
            'x-api-key': { type: 'string', description: 'Server Ingestion API Key' },
          },
          required: ['x-api-key'],
        },
        body: {
          type: 'object',
          required: ['server_id', 'hostname', 'project_name', 'backup_type', 'status', 'start_time', 'end_time', 'zip_filename'],
          properties: {
            server_id: { type: 'string' },
            hostname: { type: 'string' },
            server_ip: { type: 'string' },
            project_name: { type: 'string' },
            environment: { type: 'string', default: 'production' },
            backup_type: { type: 'string', enum: ['db', 'code', 'full'] },
            status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'WARNING', 'IN_PROGRESS'] },
            start_time: { type: 'string' },
            end_time: { type: 'string' },
            duration_seconds: { type: 'integer' },
            backup_size_bytes: { type: 'integer' },
            backup_size_human: { type: 'string' },
            s3_bucket: { type: 'string' },
            s3_key: { type: 'string' },
            s3_url: { type: 'string' },
            checksum: { type: 'string' },
            zip_filename: { type: 'string' },
            exit_code: { type: 'integer', default: 0 },
            error_message: { type: 'string' },
            stdout_log: { type: 'string' },
            stderr_log: { type: 'string' },
            metadata: { type: 'object' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              id: { type: 'string' },
              message: { type: 'string' },
            },
          },
          401: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const apiKey = request.headers['x-api-key'] as string;

      if (!apiKey || apiKey !== config.INGESTION_API_KEY) {
        return reply.status(401).send({ error: 'Unauthorized: Invalid or missing API key' });
      }

      const body = request.body as any;

      const startTime = new Date(body.start_time);
      const endTime = new Date(body.end_time);
      const durationSeconds = body.duration_seconds !== undefined
        ? Number(body.duration_seconds)
        : Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

      const backupSizeBytes = BigInt(body.backup_size_bytes || 0);
      const backupSizeHuman = body.backup_size_human || formatBytes(backupSizeBytes);

      const report = await prisma.backupReport.create({
        data: {
          serverId: body.server_id,
          hostname: body.hostname,
          serverIp: body.server_ip || null,
          projectName: body.project_name,
          environment: body.environment || 'production',
          backupType: body.backup_type,
          status: body.status.toUpperCase(),
          startTime,
          endTime,
          durationSeconds,
          backupSizeBytes,
          backupSizeHuman,
          s3Bucket: body.s3_bucket || null,
          s3Key: body.s3_key || null,
          s3Url: body.s3_url || null,
          checksum: body.checksum || null,
          zipFilename: body.zip_filename,
          exitCode: body.exit_code !== undefined ? body.exit_code : 0,
          errorMessage: body.error_message || null,
          stdoutLog: body.stdout_log ? body.stdout_log.slice(0, 65535) : null,
          stderrLog: body.stderr_log ? body.stderr_log.slice(0, 65535) : null,
          metadata: body.metadata || null,
        },
      });

      return reply.status(201).send({
        success: true,
        id: report.id,
        message: 'Backup report received and stored successfully',
      });
    }
  );

  // Get paginated and filtered backups
  fastify.get(
    '/api/v1/backups',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Retrieve paginated backup records with advanced filters',
        tags: ['Backups'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            projectName: { type: 'string' },
            serverId: { type: 'string' },
            status: { type: 'string' },
            backupType: { type: 'string' },
            search: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            sortBy: { type: 'string', default: 'createdAt' },
            sortOrder: { type: 'string', default: 'desc' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      const page = Math.max(1, parseInt(query.page || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
      const skip = (page - 1) * limit;

      const where: any = {};

      if (query.projectName && query.projectName !== 'ALL') {
        where.projectName = query.projectName;
      }

      if (query.serverId && query.serverId !== 'ALL') {
        where.serverId = query.serverId;
      }

      if (query.status && query.status !== 'ALL') {
        where.status = query.status.toUpperCase();
      }

      if (query.backupType && query.backupType !== 'ALL') {
        where.backupType = query.backupType.toLowerCase();
      }

      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) where.createdAt.gte = new Date(query.startDate);
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      if (query.search) {
        const searchVal = query.search.trim();
        where.OR = [
          { projectName: { contains: searchVal, mode: 'insensitive' } },
          { serverId: { contains: searchVal, mode: 'insensitive' } },
          { hostname: { contains: searchVal, mode: 'insensitive' } },
          { zipFilename: { contains: searchVal, mode: 'insensitive' } },
          { s3Key: { contains: searchVal, mode: 'insensitive' } },
        ];
      }

      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

      const [total, data] = await Promise.all([
        prisma.backupReport.count({ where }),
        prisma.backupReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
      ]);

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );

  // Get backup by ID
  fastify.get(
    '/api/v1/backups/:id',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get detailed backup report by ID',
        tags: ['Backups'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const report = await prisma.backupReport.findUnique({
        where: { id },
      });

      if (!report) {
        return reply.status(404).send({ error: 'Backup report not found' });
      }

      return reply.send(report);
    }
  );

  // Manually update backup report status (e.g. resolve FAILED to SUCCESS)
  fastify.patch(
    '/api/v1/backups/:id/status',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Manually update backup report status (e.g. resolve FAILED to SUCCESS)',
        tags: ['Backups'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['SUCCESS', 'FAILED', 'WARNING', 'IN_PROGRESS'] },
            resolutionNote: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as any;
      const { status, resolutionNote } = request.body as any;
      const authUser = (request as any).user;

      const existing = await prisma.backupReport.findUnique({
        where: { id },
      });

      if (!existing) {
        return reply.status(404).send({ error: 'Backup report not found' });
      }

      const existingMeta = (existing.metadata as Record<string, any>) || {};
      const updatedMeta = {
        ...existingMeta,
        manually_resolved: status === 'SUCCESS',
        previous_status: existing.status,
        resolved_at: new Date().toISOString(),
        resolved_by: authUser?.username || 'admin',
        resolution_note: resolutionNote || 'Manually marked as SUCCESS by administrator',
      };

      const updated = await prisma.backupReport.update({
        where: { id },
        data: {
          status: status.toUpperCase(),
          metadata: updatedMeta,
          ...(status.toUpperCase() === 'SUCCESS' ? { exitCode: 0 } : {}),
        },
      });

      return reply.send(updated);
    }
  );

  // Unique Projects list for filter dropdown
  fastify.get(
    '/api/v1/backups/projects',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get list of unique project names for filtering',
        tags: ['Backups'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const projects = await prisma.backupReport.findMany({
        select: { projectName: true },
        distinct: ['projectName'],
        orderBy: { projectName: 'asc' },
      });
      return reply.send(projects.map((p) => p.projectName));
    }
  );

  // Unique Servers list for filter dropdown
  fastify.get(
    '/api/v1/backups/servers',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Get list of unique server IDs for filtering',
        tags: ['Backups'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request, reply) => {
      const servers = await prisma.backupReport.findMany({
        select: { serverId: true, hostname: true },
        distinct: ['serverId'],
        orderBy: { serverId: 'asc' },
      });
      return reply.send(servers);
    }
  );

  // Export Backups as CSV / JSON
  fastify.get(
    '/api/v1/backups/export',
    {
      preValidation: [(fastify as any).authenticate],
      schema: {
        description: 'Export filtered backup reports to CSV or JSON',
        tags: ['Backups'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'json'], default: 'csv' },
            projectName: { type: 'string' },
            serverId: { type: 'string' },
            status: { type: 'string' },
            backupType: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as any;
      const where: any = {};

      if (query.projectName && query.projectName !== 'ALL') where.projectName = query.projectName;
      if (query.serverId && query.serverId !== 'ALL') where.serverId = query.serverId;
      if (query.status && query.status !== 'ALL') where.status = query.status.toUpperCase();
      if (query.backupType && query.backupType !== 'ALL') where.backupType = query.backupType.toLowerCase();
      if (query.startDate || query.endDate) {
        where.createdAt = {};
        if (query.startDate) where.createdAt.gte = new Date(query.startDate);
        if (query.endDate) {
          const end = new Date(query.endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const reports = await prisma.backupReport.findMany({
        where,
        take: 5000,
        orderBy: { createdAt: 'desc' },
      });

      if (query.format === 'json') {
        reply.header('Content-Disposition', 'attachment; filename="backup_reports.json"');
        return reply.type('application/json').send(reports);
      }

      // Generate CSV
      const headers = [
        'ID',
        'Server ID',
        'Hostname',
        'Project',
        'Type',
        'Status',
        'Duration (sec)',
        'Size (Human)',
        'Size (Bytes)',
        'S3 Key',
        'Checksum',
        'Exit Code',
        'Error Message',
        'Created At',
      ];

      const csvRows = [
        headers.join(','),
        ...reports.map((r) =>
          [
            `"${r.id}"`,
            `"${r.serverId}"`,
            `"${r.hostname}"`,
            `"${r.projectName}"`,
            `"${r.backupType}"`,
            `"${r.status}"`,
            r.durationSeconds,
            `"${r.backupSizeHuman || ''}"`,
            r.backupSizeBytes.toString(),
            `"${(r.s3Key || '').replace(/"/g, '""')}"`,
            `"${r.checksum || ''}"`,
            r.exitCode,
            `"${(r.errorMessage || '').replace(/"/g, '""')}"`,
            `"${r.createdAt.toISOString()}"`,
          ].join(',')
        ),
      ];

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', 'attachment; filename="backup_reports.csv"');
      return reply.send(csvRows.join('\n'));
    }
  );
}
