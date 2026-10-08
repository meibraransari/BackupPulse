import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { prisma } from '../db/prisma';
import { config } from '../config/env';
import { formatBytes } from '../services/gchat.service';
import { recordBackupMetrics } from '../services/metrics.service';
import { dispatchInstantFailureAlert } from '../services/alert-dispatcher.service';

export async function backupRoutes(fastify: FastifyInstance) {
  // Ingestion API from Shell Script (Rate limited to 120 per minute to prevent accidental spam)
  fastify.post(
    '/api/v1/backups/report',
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
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
            retention_days: { type: 'integer', description: 'Days to retain backup archive in S3 bucket before deletion' },
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
      if (!apiKey) {
        return reply.status(401).send({ error: 'Unauthorized: Missing x-api-key header' });
      }

      const body = request.body as any;

      // Master Ingestion Key Check
      if (apiKey !== config.INGESTION_API_KEY) {
        // Per-Server / Per-Project API Key Database Validation
        const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
        const keyRecord = await prisma.apiKey.findUnique({
          where: { keyHash: hash },
        });

        if (!keyRecord || !keyRecord.isActive || keyRecord.revokedAt) {
          return reply.status(401).send({ error: 'Unauthorized: Invalid or revoked API key' });
        }

        if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
          return reply.status(401).send({ error: 'Unauthorized: API key has expired' });
        }

        // Validate server / project scope constraints
        if (keyRecord.serverId && keyRecord.serverId !== body.server_id) {
          return reply.status(403).send({
            error: `Forbidden: API key is restricted to server '${keyRecord.serverId}', but report is from '${body.server_id}'`,
          });
        }

        if (keyRecord.projectName && keyRecord.projectName !== body.project_name) {
          return reply.status(403).send({
            error: `Forbidden: API key is restricted to project '${keyRecord.projectName}', but report is for '${body.project_name}'`,
          });
        }

        // Asynchronously touch lastUsedAt without slowing ingestion response
        prisma.apiKey
          .update({
            where: { id: keyRecord.id },
            data: { lastUsedAt: new Date() },
          })
          .catch((err) => console.warn('[API-KEY] Error updating lastUsedAt:', err.message));
      }

      const startTime = new Date(body.start_time);
      const endTime = new Date(body.end_time);
      const durationSeconds = body.duration_seconds !== undefined
        ? Number(body.duration_seconds)
        : Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 1000));

      const backupSizeBytes = BigInt(body.backup_size_bytes || 0);
      const backupSizeHuman = body.backup_size_human || formatBytes(backupSizeBytes);

      let isAnomaly = false;
      let anomalyReason: string | null = null;
      let reportStatus = body.status.toUpperCase();

      // Anomaly Check 1: Zero-byte or near-empty archive on supposedly successful backup
      if (reportStatus === 'SUCCESS' && backupSizeBytes <= BigInt(512)) {
        isAnomaly = true;
        anomalyReason = `Zero-byte or near-empty archive detected (${formatBytes(backupSizeBytes)}). Potential truncation or missing database dump.`;
        reportStatus = 'WARNING';
      } else if (reportStatus === 'SUCCESS' && backupSizeBytes > BigInt(0)) {
        // Anomaly Check 2: Significant size plummet compared to recent successful runs
        try {
          const recentReports = await prisma.backupReport.findMany({
            where: {
              projectName: body.project_name,
              backupType: body.backup_type,
              status: 'SUCCESS',
              backupSizeBytes: { gt: BigInt(1024 * 1024) }, // At least 1MB to avoid skewing
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { backupSizeBytes: true },
          });

          if (recentReports.length >= 2) {
            const sumBytes = recentReports.reduce((acc, r) => acc + Number(r.backupSizeBytes), 0);
            const avgBytes = sumBytes / recentReports.length;
            const currentSize = Number(backupSizeBytes);

            // If current backup is less than 30% of average (>70% drop)
            if (avgBytes > 5 * 1024 * 1024 && currentSize < avgBytes * 0.3) {
              const dropPercent = Math.round(((avgBytes - currentSize) / avgBytes) * 100);
              isAnomaly = true;
              anomalyReason = `Significant backup size drop detected: ${formatBytes(backupSizeBytes)} is ${dropPercent}% smaller than historical average (${formatBytes(avgBytes)}). Possible data loss or partial dump.`;
              reportStatus = 'WARNING';
            }
          }
        } catch (err: any) {
          console.warn('[ANOMALY] Error calculating size average:', err.message);
        }
      }

      const retentionDays = body.retention_days !== undefined
        ? Number(body.retention_days)
        : (body.metadata?.retention_days !== undefined ? Number(body.metadata.retention_days) : null);

      const expiresAt = retentionDays !== null && retentionDays > 0
        ? new Date(startTime.getTime() + retentionDays * 24 * 60 * 60 * 1000)
        : null;

      const mergedMetadata = {
        ...(body.metadata || {}),
        ...(retentionDays !== null ? { retention_days: retentionDays } : {}),
        ...(expiresAt ? { expires_at: expiresAt.toISOString() } : {}),
        ...(isAnomaly ? { anomaly: { detected: true, reason: anomalyReason } } : {}),
      };

      const report = await prisma.backupReport.create({
        data: {
          serverId: body.server_id,
          hostname: body.hostname,
          serverIp: body.server_ip || null,
          projectName: body.project_name,
          environment: body.environment || 'production',
          backupType: body.backup_type,
          status: reportStatus,
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
          errorMessage: body.error_message || (isAnomaly ? anomalyReason : null),
          stdoutLog: body.stdout_log ? body.stdout_log.slice(0, 65535) : null,
          stderrLog: body.stderr_log ? body.stderr_log.slice(0, 65535) : null,
          metadata: mergedMetadata,
          isAnomaly,
          anomalyReason,
          retentionDays,
          expiresAt,
        },
      });

      // Record Prometheus Metrics
      recordBackupMetrics({
        status: report.status,
        projectName: report.projectName,
        serverId: report.serverId,
        backupType: report.backupType,
        backupSizeBytes: report.backupSizeBytes,
        durationSeconds: report.durationSeconds,
      });

      // Real-Time Instant Failure Alert Dispatch (Google Chat, Email, Slack, Discord, Telegram)
      if (report.status === 'FAILED' || report.isAnomaly) {
        dispatchInstantFailureAlert({
          projectName: report.projectName,
          serverId: report.serverId,
          hostname: report.hostname,
          backupType: report.backupType,
          status: report.status,
          durationSeconds: report.durationSeconds,
          backupSizeBytes: report.backupSizeBytes,
          errorMessage: report.errorMessage,
          anomalyReason: report.anomalyReason,
          isAnomaly: report.isAnomaly,
        }).catch((err) => {
          console.error('[INSTANT-ALERT] Background dispatch error:', err.message);
        });
      }

      return reply.status(201).send({
        success: true,
        id: report.id,
        isAnomaly,
        anomalyReason,
        message: isAnomaly ? `Backup ingested with ANOMALY warning: ${anomalyReason}` : 'Backup report received and stored successfully',
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
            isAnomaly: { type: 'boolean', description: 'Filter only anomalous/truncated backups' },
            availability: { type: 'string', description: 'Filter by availability: ALL, ACTIVE, or EXPIRED' },
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

      if (query.isAnomaly !== undefined && query.isAnomaly !== '') {
        where.isAnomaly = query.isAnomaly === 'true' || query.isAnomaly === true;
      }

      if (query.availability && query.availability !== 'ALL') {
        const availUpper = query.availability.toUpperCase();
        const now = new Date();
        if (availUpper === 'ACTIVE') {
          where.status = { not: 'FAILED' };
          where.OR = [
            { expiresAt: { gt: now } },
            { expiresAt: null },
          ];
        } else if (availUpper === 'EXPIRED') {
          where.expiresAt = { lte: now };
        }
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

      const [total, rawData] = await Promise.all([
        prisma.backupReport.count({ where }),
        prisma.backupReport.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
      ]);

      const now = new Date();
      const data = rawData.map((report) => {
        let isExpired = false;
        let daysRemaining: number | null = null;
        let daysAgoExpired: number | null = null;

        if (report.expiresAt) {
          const expiryDate = new Date(report.expiresAt);
          isExpired = now.getTime() > expiryDate.getTime();
          const diffDays = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (isExpired) {
            daysAgoExpired = Math.abs(diffDays);
          } else {
            daysRemaining = diffDays;
          }
        } else if (report.retentionDays && report.retentionDays > 0) {
          const calculatedExpiry = new Date(new Date(report.startTime).getTime() + report.retentionDays * 86400000);
          isExpired = now.getTime() > calculatedExpiry.getTime();
          const diffDays = Math.round((calculatedExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (isExpired) {
            daysAgoExpired = Math.abs(diffDays);
          } else {
            daysRemaining = diffDays;
          }
        }

        let availabilityStatus: 'ACTIVE' | 'EXPIRED' | 'N/A' = 'ACTIVE';
        if (report.status === 'FAILED') {
          availabilityStatus = 'N/A';
        } else if (isExpired) {
          availabilityStatus = 'EXPIRED';
        }

        return {
          ...report,
          availabilityStatus,
          isExpired,
          daysRemaining,
          daysAgoExpired,
        };
      });

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

      const now = new Date();
      let isExpired = false;
      let daysRemaining: number | null = null;
      let daysAgoExpired: number | null = null;

      if (report.expiresAt) {
        const expiryDate = new Date(report.expiresAt);
        isExpired = now.getTime() > expiryDate.getTime();
        const diffDays = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (isExpired) {
          daysAgoExpired = Math.abs(diffDays);
        } else {
          daysRemaining = diffDays;
        }
      } else if (report.retentionDays && report.retentionDays > 0) {
        const calculatedExpiry = new Date(new Date(report.startTime).getTime() + report.retentionDays * 86400000);
        isExpired = now.getTime() > calculatedExpiry.getTime();
        const diffDays = Math.round((calculatedExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (isExpired) {
          daysAgoExpired = Math.abs(diffDays);
        } else {
          daysRemaining = diffDays;
        }
      }

      let availabilityStatus: 'ACTIVE' | 'EXPIRED' | 'N/A' = 'ACTIVE';
      if (report.status === 'FAILED') {
        availabilityStatus = 'N/A';
      } else if (isExpired) {
        availabilityStatus = 'EXPIRED';
      }

      return reply.send({
        ...report,
        availabilityStatus,
        isExpired,
        daysRemaining,
        daysAgoExpired,
      });
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
            availability: { type: 'string' },
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

      if (query.availability && query.availability !== 'ALL') {
        const availUpper = query.availability.toUpperCase();
        const now = new Date();
        if (availUpper === 'ACTIVE') {
          where.status = { not: 'FAILED' };
          where.OR = [
            { expiresAt: { gt: now } },
            { expiresAt: null },
          ];
        } else if (availUpper === 'EXPIRED') {
          where.expiresAt = { lte: now };
        }
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

      const rawReports = await prisma.backupReport.findMany({
        where,
        take: 5000,
        orderBy: { createdAt: 'desc' },
      });

      const now = new Date();
      const reports = rawReports.map((r) => {
        let isExpired = false;
        if (r.expiresAt) {
          isExpired = now > new Date(r.expiresAt);
        } else if (r.retentionDays && r.retentionDays > 0) {
          const calculatedExpiry = new Date(new Date(r.startTime).getTime() + r.retentionDays * 86400000);
          isExpired = now > calculatedExpiry;
        }

        let availabilityStatus = 'Active';
        if (r.status === 'FAILED') {
          availabilityStatus = 'N/A';
        } else if (isExpired) {
          availabilityStatus = 'Expired';
        }

        return {
          ...r,
          isExpired,
          availabilityStatus,
        };
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
        'Availability',
        'Retention (Days)',
        'Expires At',
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
            `"${r.availabilityStatus}"`,
            r.retentionDays ? r.retentionDays : '',
            r.expiresAt ? `"${r.expiresAt.toISOString()}"` : '""',
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
