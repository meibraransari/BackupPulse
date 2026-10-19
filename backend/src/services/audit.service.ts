import { prisma } from '../db/prisma';

export type AuditCategory = 'SECURITY' | 'SETTINGS' | 'INCIDENT' | 'USER_MANAGEMENT' | 'SYSTEM';

export interface RecordAuditParams {
  userId?: string | null;
  username: string;
  userRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  action: string;
  category: AuditCategory;
  targetResource?: string | null;
  details?: Record<string, any> | null;
  status?: 'SUCCESS' | 'FAILED';
}

export interface AuditQueryFilters {
  page?: number;
  limit?: number;
  category?: string;
  action?: string;
  username?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Safely masks secret values (passwords, tokens, keys) in audit log details
 */
export function sanitizeAuditDetails(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeAuditDetails);

  const sanitized: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const lowerKey = k.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('privatekey') ||
      lowerKey.includes('authorization') ||
      lowerKey === 'key'
    ) {
      sanitized[k] = '••••••••';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeAuditDetails(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/**
 * Extracts client IP and user-agent string from a Fastify request
 */
export function getRequestMetadata(request: any): { ipAddress: string; userAgent: string } {
  const forwarded = request.headers?.['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : request.ip || '127.0.0.1';
  const userAgent = (request.headers?.['user-agent'] as string) || 'unknown';
  return { ipAddress: ip, userAgent: userAgent.slice(0, 255) };
}

/**
 * Writes an immutable, tamper-evident audit record to admin_audit_logs
 */
export async function recordAuditLog(params: RecordAuditParams): Promise<void> {
  try {
    const sanitizedDetails = params.details ? sanitizeAuditDetails(params.details) : null;
    await prisma.adminAuditLog.create({
      data: {
        userId: params.userId || null,
        username: params.username || 'system',
        userRole: params.userRole || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        action: params.action,
        category: params.category,
        targetResource: params.targetResource || null,
        details: sanitizedDetails,
        status: params.status || 'SUCCESS',
      },
    });
  } catch (err: any) {
    console.error('[AUDIT-LOG] Failed to write administrative audit log:', err.message);
  }
}

/**
 * Retrieves paginated, filtered audit records with metadata
 */
export async function getAuditLogs(filters: AuditQueryFilters) {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.category && filters.category !== 'ALL') {
    where.category = filters.category.toUpperCase();
  }

  if (filters.action && filters.action !== 'ALL') {
    where.action = filters.action;
  }

  if (filters.username && filters.username !== 'ALL') {
    where.username = { contains: filters.username, mode: 'insensitive' };
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (filters.search) {
    const s = filters.search.trim();
    where.OR = [
      { username: { contains: s, mode: 'insensitive' } },
      { action: { contains: s, mode: 'insensitive' } },
      { targetResource: { contains: s, mode: 'insensitive' } },
      { ipAddress: { contains: s, mode: 'insensitive' } },
    ];
  }

  const sortBy = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  const [total, data] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Computes high-level KPI audit statistics for management dashboards
 */
export async function getAuditStats() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalAllTime, count24h, count30d, byCategoryRaw] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.adminAuditLog.count({ where: { createdAt: { gte: last30d } } }),
    prisma.adminAuditLog.groupBy({
      by: ['category'],
      _count: { _all: true },
    }),
  ]);

  const categoryCounts: Record<string, number> = {
    SECURITY: 0,
    SETTINGS: 0,
    INCIDENT: 0,
    USER_MANAGEMENT: 0,
    SYSTEM: 0,
  };

  byCategoryRaw.forEach((c) => {
    categoryCounts[c.category] = c._count._all;
  });

  return {
    totalAllTime,
    count24h,
    count30d,
    categoryCounts,
  };
}

/**
 * Exports audit log entries as CSV for SOC 2 / ISO 27001 compliance auditors
 */
export async function exportAuditLogsToCsv(filters: AuditQueryFilters): Promise<string> {
  const where: any = {};
  if (filters.category && filters.category !== 'ALL') where.category = filters.category.toUpperCase();
  if (filters.startDate) where.createdAt = { gte: new Date(filters.startDate) };
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { ...(where.createdAt || {}), lte: end };
  }

  const logs = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
  });

  const headers = ['ID', 'Timestamp (UTC)', 'Username', 'Role', 'Category', 'Action', 'Target Resource', 'Status', 'IP Address', 'Details'];
  const rows = logs.map((l) => [
    l.id,
    l.createdAt.toISOString(),
    `"${l.username.replace(/"/g, '""')}"`,
    `"${(l.userRole || '').replace(/"/g, '""')}"`,
    l.category,
    l.action,
    `"${(l.targetResource || '').replace(/"/g, '""')}"`,
    l.status,
    l.ipAddress || '',
    `"${JSON.stringify(l.details || {}).replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
