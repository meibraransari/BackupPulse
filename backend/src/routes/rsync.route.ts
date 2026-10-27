import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db/prisma';
import { rsyncService } from '../services/rsync.service';
import { rsyncSchedulerService } from '../services/rsync-scheduler.service';
import { recordAuditLog, getRequestMetadata } from '../services/audit.service';

function serializeBigInt<T>(obj: T): any {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
  );
}

function formatBytes(bytes: bigint | number): string {
  const b = typeof bytes === 'bigint' ? Number(bytes) : bytes;
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function rsyncRoutes(fastify: FastifyInstance): Promise<void> {
  const authPreValidation = [(fastify as any).authenticate];

  // ============================================================================
  // 1. Rsync Dashboard Overview Metrics
  // ============================================================================
  fastify.get(
    '/api/v1/rsync/dashboard',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Get Rsync & Disk Mirror overview metrics',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [totalJobs, activeJobs, totalRuns, successfulRuns, failedRuns, repos, recentRuns] =
          await Promise.all([
            prisma.rsyncJob.count(),
            prisma.rsyncJob.count({ where: { isActive: true } }),
            prisma.rsyncRun.count(),
            prisma.rsyncRun.count({ where: { status: 'SUCCESS' } }),
            prisma.rsyncRun.count({ where: { status: 'FAILED' } }),
            prisma.rsyncRepository.findMany({
              include: { server: { select: { name: true, host: true } } },
              orderBy: { createdAt: 'desc' },
            }),
            prisma.rsyncRun.findMany({
              take: 5,
              orderBy: { startedAt: 'desc' },
              include: { job: { select: { name: true, syncStrategy: true } } },
            }),
          ]);

        // Calculate total transferred bytes
        const sumResult = await prisma.rsyncRun.aggregate({
          _sum: {
            bytesTransferred: true,
          },
        });
        const totalBytes = sumResult._sum.bytesTransferred || BigInt(0);

        const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;

        return reply.send(
          serializeBigInt({
            totalJobs,
            activeJobs,
            totalRuns,
            successfulRuns,
            failedRuns,
            successRate,
            totalSyncedBytes: totalBytes,
            totalSyncedBytesHuman: formatBytes(totalBytes),
            repositories: repos.map((r) => {
              const total = r.totalBytes ? Number(r.totalBytes) : 0;
              const used = r.usedBytes ? Number(r.usedBytes) : 0;
              const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;
              return {
                ...r,
                totalHuman: formatBytes(r.totalBytes || 0),
                usedHuman: formatBytes(r.usedBytes || 0),
                availableHuman: formatBytes(r.availableBytes || 0),
                percentUsed,
              };
            }),
            recentRuns,
          })
        );
      } catch (err: any) {
        console.error('[RSYNC] Error fetching dashboard stats:', err);
        return reply.status(500).send({ error: err.message || 'Failed to load rsync dashboard stats' });
      }
    }
  );

  // ============================================================================
  // 2. Server Management (Remote hosts & SSH keys)
  // ============================================================================
  fastify.get(
    '/api/v1/rsync/servers',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'List all configured rsync servers',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const servers = await prisma.rsyncServer.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { repositories: true, jobsAsSource: true, jobsAsDest: true },
          },
        },
      });

      // Mask passwords and private keys in response
      const masked = servers.map((s) => ({
        ...s,
        password: s.password ? '••••••••' : null,
        sshPrivateKey: s.sshPrivateKey ? '•••• (Configured SSH Key)' : null,
      }));

      return reply.send(serializeBigInt(masked));
    }
  );

  fastify.post(
    '/api/v1/rsync/servers',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Create a new remote rsync server endpoint',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { name, host, port, username, authType, password, sshPrivateKey, notes } = request.body || {};
      if (!name || !host) {
        return reply.status(400).send({ error: 'Server name and host are required' });
      }

      const server = await prisma.rsyncServer.create({
        data: {
          name: name.trim(),
          host: host.trim(),
          port: port ? parseInt(port, 10) : 22,
          username: (username || 'root').trim(),
          authType: authType || 'SSH_KEY',
          password: password ? password.trim() : null,
          sshPrivateKey: sshPrivateKey ? sshPrivateKey.trim() : null,
          notes: notes?.trim() || null,
        },
      });

      await recordAuditLog({
        ...getRequestMetadata(request),
        userId: request.user.id,
        username: request.user.username,
        userRole: request.user.role,
        action: 'RSYNC_SERVER_CREATED',
        category: 'SETTINGS',
        targetResource: server.name,
        details: { serverId: server.id, host: server.host },
      });

      return reply.status(201).send(serializeBigInt(server));
    }
  );

  fastify.put(
    '/api/v1/rsync/servers/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Update an rsync server configuration',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const { name, host, port, username, authType, password, sshPrivateKey, notes } = request.body || {};

      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (host) updateData.host = host.trim();
      if (port) updateData.port = parseInt(port, 10);
      if (username) updateData.username = username.trim();
      if (authType) updateData.authType = authType;
      if (password !== undefined && password !== '••••••••') updateData.password = password ? password.trim() : null;
      if (sshPrivateKey !== undefined && !sshPrivateKey.startsWith('••••')) updateData.sshPrivateKey = sshPrivateKey ? sshPrivateKey.trim() : null;
      if (notes !== undefined) updateData.notes = notes?.trim() || null;

      const updated = await prisma.rsyncServer.update({
        where: { id },
        data: updateData,
      });

      return reply.send(serializeBigInt(updated));
    }
  );

  fastify.delete(
    '/api/v1/rsync/servers/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Delete an rsync server',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      await prisma.rsyncServer.delete({ where: { id } });
      return reply.send({ success: true, message: 'Server deleted successfully' });
    }
  );

  fastify.post(
    '/api/v1/rsync/servers/bulk-delete',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Bulk delete rsync servers',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { ids } = request.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ error: 'ids array is required' });
      }

      const deleted = await prisma.rsyncServer.deleteMany({
        where: { id: { in: ids } },
      });

      return reply.send({ success: true, count: deleted.count });
    }
  );

  fastify.post(
    '/api/v1/rsync/servers/:id/test',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Test connectivity to an rsync server',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const result = await rsyncService.testServerConnection(id);
      return reply.send(result);
    }
  );

  // ============================================================================
  // 3. Storage Repository Management (Local Disks & Remote Mounts)
  // ============================================================================
  fastify.get(
    '/api/v1/rsync/repositories',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'List all storage repositories and disks',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const repos = await prisma.rsyncRepository.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          server: { select: { id: true, name: true, host: true, authType: true } },
          _count: { select: { sourceJobs: true, destJobs: true } },
        },
      });

      const formatted = repos.map((r) => {
        const total = r.totalBytes ? Number(r.totalBytes) : 0;
        const used = r.usedBytes ? Number(r.usedBytes) : 0;
        const percentUsed = total > 0 ? Math.round((used / total) * 100) : 0;
        return {
          ...r,
          totalHuman: formatBytes(r.totalBytes || 0),
          usedHuman: formatBytes(r.usedBytes || 0),
          availableHuman: formatBytes(r.availableBytes || 0),
          percentUsed,
        };
      });

      return reply.send(serializeBigInt(formatted));
    }
  );

  fastify.post(
    '/api/v1/rsync/repositories',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Create a new storage repository / physical disk definition',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { name, type, serverId, path, description } = request.body || {};
      if (!name || !path) {
        return reply.status(400).send({ error: 'Repository name and path are required' });
      }

      const repo = await prisma.rsyncRepository.create({
        data: {
          name: name.trim(),
          type: type || 'LOCAL_DISK',
          serverId: serverId || null,
          path: path.trim(),
          description: description?.trim() || null,
        },
      });

      // Automatically probe disk space
      rsyncService.probeRepositoryDiskSpace(repo.id).catch(() => {});

      return reply.status(201).send(serializeBigInt(repo));
    }
  );

  fastify.put(
    '/api/v1/rsync/repositories/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Update repository details',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const { name, type, serverId, path, description } = request.body || {};

      const updated = await prisma.rsyncRepository.update({
        where: { id },
        data: {
          name: name ? name.trim() : undefined,
          type: type || undefined,
          serverId: serverId !== undefined ? (serverId || null) : undefined,
          path: path ? path.trim() : undefined,
          description: description !== undefined ? (description?.trim() || null) : undefined,
        },
      });

      rsyncService.probeRepositoryDiskSpace(updated.id).catch(() => {});

      return reply.send(serializeBigInt(updated));
    }
  );

  fastify.delete(
    '/api/v1/rsync/repositories/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Delete a storage repository',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      await prisma.rsyncRepository.delete({ where: { id } });
      return reply.send({ success: true, message: 'Repository deleted successfully' });
    }
  );

  fastify.post(
    '/api/v1/rsync/repositories/bulk-delete',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Bulk delete repositories',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { ids } = request.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ error: 'ids array is required' });
      }

      const deleted = await prisma.rsyncRepository.deleteMany({
        where: { id: { in: ids } },
      });

      return reply.send({ success: true, count: deleted.count });
    }
  );

  fastify.post(
    '/api/v1/rsync/repositories/:id/refresh-space',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Probe and refresh physical disk space metrics',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const space = await rsyncService.probeRepositoryDiskSpace(id);
      return reply.send(
        serializeBigInt({
          ...space,
          totalHuman: formatBytes(space.totalBytes),
          usedHuman: formatBytes(space.usedBytes),
          availableHuman: formatBytes(space.availableBytes),
        })
      );
    }
  );

  // ============================================================================
  // 4. Rsync Job Definitions & Execution Controls
  // ============================================================================
  fastify.get(
    '/api/v1/rsync/jobs',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'List rsync jobs with pagination and filters',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      const { search, status, strategy, page = '1', limit = '25' } = request.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 25);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }
      if (status && status !== 'ALL') {
        if (status === 'ACTIVE') where.isActive = true;
        else if (status === 'INACTIVE') where.isActive = false;
        else where.lastRunStatus = status;
      }
      if (strategy && strategy !== 'ALL') {
        where.syncStrategy = strategy;
      }

      const [total, items] = await Promise.all([
        prisma.rsyncJob.count({ where }),
        prisma.rsyncJob.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            sourceRepo: { select: { id: true, name: true, path: true, type: true } },
            destRepo: { select: { id: true, name: true, path: true, type: true } },
            sourceServer: { select: { id: true, name: true, host: true } },
            destServer: { select: { id: true, name: true, host: true } },
            _count: { select: { runs: true } },
          },
        }),
      ]);

      return reply.send(
        serializeBigInt({
          data: items,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        })
      );
    }
  );

  fastify.post(
    '/api/v1/rsync/jobs',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Create a new rsync mirror job',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const body = request.body || {};
      if (!body.name || !body.sourceRepoId || !body.destRepoId) {
        return reply.status(400).send({ error: 'Job name, sourceRepoId, and destRepoId are required' });
      }

      const job = await prisma.rsyncJob.create({
        data: {
          name: body.name.trim(),
          sourceRepoId: body.sourceRepoId,
          sourceSubpath: body.sourceSubpath?.trim() || null,
          destRepoId: body.destRepoId,
          destSubpath: body.destSubpath?.trim() || null,
          sourceServerId: body.sourceServerId || null,
          destServerId: body.destServerId || null,
          syncStrategy: body.syncStrategy || 'EXACT_MIRROR',
          cronSchedule: body.cronSchedule?.trim() || null,
          bandwidthLimitKb: body.bandwidthLimitKb ? parseInt(body.bandwidthLimitKb, 10) : null,
          excludePatterns: Array.isArray(body.excludePatterns) ? body.excludePatterns : [],
          customArgs: body.customArgs?.trim() || null,
          preservePermissions: body.preservePermissions ?? true,
          preserveOwner: body.preserveOwner ?? true,
          preserveTimes: body.preserveTimes ?? true,
          enableCompression: body.enableCompression ?? false,
          deleteExtraneous: body.deleteExtraneous ?? true,
          isActive: body.isActive ?? true,
        },
      });

      // If active with cronSchedule, schedule immediately (Zero-Restart)
      if (job.isActive && job.cronSchedule) {
        rsyncSchedulerService.scheduleJob(job.id, job.cronSchedule, job.name);
      }

      return reply.status(201).send(serializeBigInt(job));
    }
  );

  fastify.put(
    '/api/v1/rsync/jobs/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Update rsync job configuration',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const body = request.body || {};

      const updated = await prisma.rsyncJob.update({
        where: { id },
        data: {
          name: body.name?.trim(),
          sourceRepoId: body.sourceRepoId,
          sourceSubpath: body.sourceSubpath !== undefined ? (body.sourceSubpath?.trim() || null) : undefined,
          destRepoId: body.destRepoId,
          destSubpath: body.destSubpath !== undefined ? (body.destSubpath?.trim() || null) : undefined,
          sourceServerId: body.sourceServerId !== undefined ? (body.sourceServerId || null) : undefined,
          destServerId: body.destServerId !== undefined ? (body.destServerId || null) : undefined,
          syncStrategy: body.syncStrategy,
          cronSchedule: body.cronSchedule !== undefined ? (body.cronSchedule?.trim() || null) : undefined,
          bandwidthLimitKb: body.bandwidthLimitKb !== undefined ? (body.bandwidthLimitKb ? parseInt(body.bandwidthLimitKb, 10) : null) : undefined,
          excludePatterns: Array.isArray(body.excludePatterns) ? body.excludePatterns : undefined,
          customArgs: body.customArgs !== undefined ? (body.customArgs?.trim() || null) : undefined,
          preservePermissions: body.preservePermissions,
          preserveOwner: body.preserveOwner,
          preserveTimes: body.preserveTimes,
          enableCompression: body.enableCompression,
          deleteExtraneous: body.deleteExtraneous,
          isActive: body.isActive,
        },
      });

      // Update scheduler
      if (updated.isActive && updated.cronSchedule) {
        rsyncSchedulerService.scheduleJob(updated.id, updated.cronSchedule, updated.name);
      } else {
        rsyncSchedulerService.unscheduleJob(updated.id);
      }

      return reply.send(serializeBigInt(updated));
    }
  );

  fastify.delete(
    '/api/v1/rsync/jobs/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Delete an rsync job and its history',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      rsyncSchedulerService.unscheduleJob(id);
      await prisma.rsyncJob.delete({ where: { id } });
      return reply.send({ success: true, message: 'Job deleted successfully' });
    }
  );

  fastify.post(
    '/api/v1/rsync/jobs/bulk-delete',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Bulk delete rsync jobs',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { ids } = request.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ error: 'ids array is required' });
      }

      for (const id of ids) {
        rsyncSchedulerService.unscheduleJob(id);
      }

      const deleted = await prisma.rsyncJob.deleteMany({
        where: { id: { in: ids } },
      });

      return reply.send({ success: true, count: deleted.count });
    }
  );

  // Manual Trigger: Run Now
  fastify.post(
    '/api/v1/rsync/jobs/:id/run',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Trigger an immediate run of an rsync job',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const username = request.user?.username || 'admin';

      // Execute in background or await? Start execution and return run handle
      const runResult = await rsyncService.executeJob(id, 'MANUAL', username);
      return reply.send(serializeBigInt(runResult));
    }
  );

  // Manual Trigger: Dry Run (Simulation)
  fastify.post(
    '/api/v1/rsync/jobs/:id/dry-run',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Trigger a dry-run simulation of an rsync job without modifying target files',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      const username = request.user?.username || 'admin';

      const runResult = await rsyncService.executeJob(id, 'DRY_RUN', username);
      return reply.send(serializeBigInt(runResult));
    }
  );

  // ============================================================================
  // 5. Execution History & Logs (Paginated 25 / 50 / 100 per page)
  // ============================================================================
  fastify.get(
    '/api/v1/rsync/runs',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Get paginated rsync execution run logs',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      const { jobId, status, runType, search, page = '1', limit = '25' } = request.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 25);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};
      if (jobId) where.jobId = jobId;
      if (status && status !== 'ALL') where.status = status;
      if (runType && runType !== 'ALL') where.runType = runType;
      if (search) {
        where.OR = [
          { sourcePath: { contains: search, mode: 'insensitive' } },
          { destinationPath: { contains: search, mode: 'insensitive' } },
          { job: { name: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [total, runs] = await Promise.all([
        prisma.rsyncRun.count({ where }),
        prisma.rsyncRun.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { startedAt: 'desc' },
          include: {
            job: {
              select: { id: true, name: true, syncStrategy: true },
            },
          },
        }),
      ]);

      const formatted = runs.map((r) => ({
        ...r,
        bytesTransferredHuman: formatBytes(r.bytesTransferred),
        totalSizeHuman: formatBytes(r.totalSizeBytes),
      }));

      return reply.send(
        serializeBigInt({
          data: formatted,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        })
      );
    }
  );

  fastify.get(
    '/api/v1/rsync/runs/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Get details and full terminal output of a run',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      const { id } = request.params;
      const run = await prisma.rsyncRun.findUnique({
        where: { id },
        include: {
          job: {
            include: {
              sourceRepo: true,
              destRepo: true,
              sourceServer: true,
              destServer: true,
            },
          },
        },
      });

      if (!run) {
        return reply.status(404).send({ error: 'Run report not found' });
      }

      return reply.send(
        serializeBigInt({
          ...run,
          bytesTransferredHuman: formatBytes(run.bytesTransferred),
          totalSizeHuman: formatBytes(run.totalSizeBytes),
        })
      );
    }
  );

  fastify.delete(
    '/api/v1/rsync/runs/:id',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Delete a single run log',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { id } = request.params;
      await prisma.rsyncRun.delete({ where: { id } });
      return reply.send({ success: true, message: 'Run log deleted' });
    }
  );

  fastify.post(
    '/api/v1/rsync/runs/bulk-delete',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Bulk delete run logs',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      if (request.user?.role !== 'admin') {
        return reply.status(403).send({ error: 'Admin permission required' });
      }

      const { ids } = request.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ error: 'ids array is required' });
      }

      const deleted = await prisma.rsyncRun.deleteMany({
        where: { id: { in: ids } },
      });

      return reply.send({ success: true, count: deleted.count });
    }
  );

  // ============================================================================
  // 6. Rsync Activity & Audit Trail
  // ============================================================================
  fastify.get(
    '/api/v1/rsync/activity-logs',
    {
      preValidation: authPreValidation,
      schema: {
        description: 'Get Rsync change and execution audit logs',
        tags: ['Rsync Mirror'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: any, reply: FastifyReply) => {
      const { page = '1', limit = '50' } = request.query || {};
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.max(1, parseInt(limit, 10) || 50);
      const skip = (pageNum - 1) * limitNum;

      const [total, logs] = await Promise.all([
        prisma.rsyncActivityLog.count(),
        prisma.rsyncActivityLog.findMany({
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return reply.send(
        serializeBigInt({
          data: logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum) || 1,
          },
        })
      );
    }
  );
}
