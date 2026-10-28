export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  avatar?: string;
  role: string; // admin, operator, viewer
  assignedProjects?: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserLoginLog {
  id: string;
  userId?: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILED';
  failureReason?: string;
  createdAt: string;
}

export interface BackupReport {
  id: string;
  serverId: string;
  hostname: string;
  serverIp?: string;
  projectName: string;
  environment: string;
  backupType: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'IN_PROGRESS';
  startTime: string;
  endTime: string;
  durationSeconds: number;
  backupSizeBytes: number;
  backupSizeHuman?: string;
  s3Bucket?: string;
  s3Key?: string;
  s3Url?: string;
  checksum?: string;
  zipFilename: string;
  exitCode: number;
  errorMessage?: string;
  stdoutLog?: string;
  stderrLog?: string;
  metadata?: Record<string, any>;
  isAnomaly?: boolean;
  anomalyReason?: string;
  retentionDays?: number | null;
  expiresAt?: string | null;
  availabilityStatus?: 'ACTIVE' | 'EXPIRED' | 'N/A';
  isExpired?: boolean;
  daysRemaining?: number | null;
  daysAgoExpired?: number | null;
  restoreDrillStatus?: 'SUCCESS' | 'FAILED' | 'SKIPPED' | null;
  restoreDrillDurationSeconds?: number | null;
  restoreDrillVerifiedTables?: number | null;
  restoreDrillLog?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalAllTime: number;
  total24h: number;
  success24h: number;
  failed24h: number;
  successRate: number;
  totalStorageBytes: number;
  totalStorageHuman: string;
  activeServersCount: number;
  activeProjectsCount: number;
}

export interface TrendItem {
  date: string;
  success: number;
  failed: number;
  total: number;
  sizeBytes: number;
}

export interface ProjectBreakdown {
  projectName: string;
  count: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
}

export interface BackupFilters {
  page: number;
  limit: number;
  projectName?: string;
  serverId?: string;
  status?: string;
  backupType?: string;
  search?: string;
  isAnomaly?: boolean;
  availability?: string; // 'ALL' | 'ACTIVE' | 'EXPIRED'
  startDate?: string;
  endDate?: string;
  hour?: number;
  period?: '24h' | '7d' | '30d';
  timezoneOffset?: number;
}

export interface NotificationLogItem {
  id: string;
  channel: string; // GOOGLE_CHAT, SMTP, SENDGRID, AWS_SES, SLACK, DISCORD, TELEGRAM
  eventType: string;
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  payload?: any;
  createdAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  serverId?: string | null;
  projectName?: string | null;
  createdBy?: string | null;
  isActive: boolean;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface ServerFleetItem {
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
  successRate: number;
  totalStorageBytes: number;
  totalStorageHuman: string;
  projects: string[];
  status: 'HEALTHY' | 'FAILED' | 'WARNING' | 'STALE';
  isMonitored?: boolean;
  muteReason?: string;
}

export interface FleetSummary {
  totalServers: number;
  healthy: number;
  failing: number;
  warning: number;
  stale: number;
  muted?: number;
}

export interface ServerConfigItem {
  id: string;
  serverId: string;
  hostname?: string;
  isMonitored: boolean;
  muteReason?: string;
  updatedAt: string;
}

export interface HousekeepingStatus {
  enabled: boolean;
  retentionDays: number;
  cutoffDate: string;
  housekeepingCron: string;
  backupReports: { total: number; eligibleForCleanup: number };
  notificationLogs: { total: number; eligibleForCleanup: number };
  userLoginLogs?: { total: number; eligibleForCleanup: number };
}

export interface SlaHeatmapDayItem {
  date: string;
  total: number;
  success: number;
  failed: number;
  warning: number;
  successRate: number;
  slaPercent?: number;
  dayOfWeek?: number;
  status: 'ALL_PASSED' | 'PARTIAL' | 'CRITICAL_FAILED' | 'NO_RUNS' | 'SUCCESS' | 'WARNING' | 'FAILED' | 'EMPTY';
}

export interface SlaHeatmapResponse {
  days: SlaHeatmapDayItem[];
  heatmap?: SlaHeatmapDayItem[];
  summary: {
    daysTracked: number;
    totalBackups: number;
    overallSla: number;
    perfectDays: number;
    partialDays: number;
    failedDays: number;
    inactiveDays: number;
  };
  metrics?: {
    overallSlaPercent: number;
    totalRuns: number;
    perfectDays: number;
    totalFailed: number;
    daysWithRuns: number;
  };
}

export interface SystemSettingItem {
  key: string;
  value: string;
  category: string;
  label: string;
  description: string;
  isEncrypted: boolean;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password';
  options?: string[];
  isConfigured: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface SystemSettingsCategory {
  id: string;
  name: string;
}

export interface SystemSettingsResponse {
  settings: SystemSettingItem[];
  categories: SystemSettingsCategory[];
}

export interface AdminAuditLogItem {
  id: string;
  userId?: string | null;
  username: string;
  userRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  action: string;
  category: 'SECURITY' | 'SETTINGS' | 'INCIDENT' | 'USER_MANAGEMENT' | 'SYSTEM' | string;
  targetResource?: string | null;
  details?: Record<string, any> | null;
  status: 'SUCCESS' | 'FAILED' | string;
  createdAt: string;
}

export interface AuditStats {
  totalAllTime: number;
  count24h: number;
  count30d: number;
  categoryCounts: {
    SECURITY: number;
    SETTINGS: number;
    INCIDENT: number;
    USER_MANAGEMENT: number;
    SYSTEM: number;
    [key: string]: number;
  };
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

export interface AuditLogsResponse {
  data: AdminAuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type NavigationTab = 'dashboard' | 'telemetry' | 'rsync' | 'drills' | 'fleet' | 'users' | 'settings' | 'audit';

export interface HourlyDistributionItem {
  hour: number;
  label: string;
  timeWindow: string;
  count: number;
  success: number;
  failed: number;
  warning: number;
  totalBytes: number;
  totalBytesHuman: string;
  avgDurationSeconds: number;
}

export interface HourlyDistributionResponse {
  period: '24h' | '7d' | '30d';
  totalBackups: number;
  peakHour: {
    hour: number;
    label: string;
    timeWindow: string;
    count: number;
    percentage: number;
  };
  quietWindow: string;
  quietestHours: number[];
  hourlyAverage: number;
  congestionLevel: 'OPTIMAL' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  loadAdvice: string;
  distribution: HourlyDistributionItem[];
}

// ============================================================================
// Disk Sync & Rsync Mirroring Frontend Types
// ============================================================================

export interface SshTestResult {
  status: 'ONLINE' | 'OFFLINE';
  latencyMs: number;
  message: string;
  logs: string;
  logLevel: 'info' | 'debug';
}

export interface RsyncServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'SSH_KEY' | 'PASSWORD' | 'LOCAL';
  password?: string | null;
  sshPrivateKey?: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNTESTED';
  lastCheckedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    repositories: number;
    jobsAsSource: number;
    jobsAsDest: number;
  };
}

export interface RsyncRepository {
  id: string;
  name: string;
  type: 'LOCAL_DISK' | 'REMOTE_SSH';
  serverId?: string | null;
  path: string;
  totalBytes?: string | number | null;
  usedBytes?: string | number | null;
  availableBytes?: string | number | null;
  totalHuman?: string;
  usedHuman?: string;
  availableHuman?: string;
  percentUsed?: number;
  isMounted: boolean;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  server?: {
    id: string;
    name: string;
    host: string;
    authType: string;
  } | null;
  _count?: {
    sourceJobs: number;
    destJobs: number;
  };
}

export interface RsyncJob {
  id: string;
  name: string;
  sourceRepoId: string;
  sourceSubpath?: string | null;
  destRepoId: string;
  destSubpath?: string | null;
  sourceServerId?: string | null;
  destServerId?: string | null;
  syncStrategy: 'EXACT_MIRROR' | 'HARDLINK_SNAPSHOT' | 'BACKUP_DIR';
  cronSchedule?: string | null;
  bandwidthLimitKb?: number | null;
  excludePatterns: string[];
  customArgs?: string | null;
  preservePermissions: boolean;
  preserveOwner: boolean;
  preserveTimes: boolean;
  enableCompression: boolean;
  deleteExtraneous: boolean;
  isActive: boolean;
  lastRunStatus?: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'DRY_RUN' | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceRepo?: { id: string; name: string; path: string; type: string };
  destRepo?: { id: string; name: string; path: string; type: string };
  sourceServer?: { id: string; name: string; host: string } | null;
  destServer?: { id: string; name: string; host: string } | null;
  _count?: { runs: number };
}

export interface RsyncRun {
  id: string;
  jobId: string;
  runType: 'MANUAL' | 'SCHEDULED' | 'DRY_RUN';
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | 'CANCELLED';
  sourcePath: string;
  destinationPath: string;
  totalFiles: number;
  transferredFiles: number;
  deletedFiles: number;
  bytesTransferred: string | number;
  totalSizeBytes: string | number;
  bytesTransferredHuman?: string;
  totalSizeHuman?: string;
  speedupRatio?: number | null;
  durationSeconds: number;
  exitCode?: number | null;
  stdoutLog?: string | null;
  stderrLog?: string | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  job?: {
    id: string;
    name: string;
    syncStrategy: string;
  };
}

export interface RsyncActivityLog {
  id: string;
  action: string;
  entityId?: string | null;
  entityType: string;
  username: string;
  details?: Record<string, any> | null;
  createdAt: string;
}

export interface RsyncDashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  totalSyncedBytes: string | number;
  totalSyncedBytesHuman: string;
  repositories: RsyncRepository[];
  recentRuns: RsyncRun[];
  totalServers?: number;
  onlineServers?: number;
  offlineServers?: number;
  servers?: Array<{
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: string;
    status: string;
    latencyMs?: number | null;
    lastTestedAt?: string | null;
    _count?: { repositories: number };
  }>;
  strategyBreakdown?: Record<string, number>;
  recentActivity?: RsyncActivityLog[];
  storageSummary?: {
    totalBytes: string | number;
    usedBytes: string | number;
    availableBytes: string | number;
    totalHuman: string;
    usedHuman: string;
    availableHuman: string;
    percentUsed: number;
  };
}


