export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
}

export interface BackupReport {
  id: string;
  serverId: string;
  hostname: string;
  serverIp?: string;
  projectName: string;
  environment: string;
  backupType: 'db' | 'code' | 'full';
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
  startDate?: string;
  endDate?: string;
}

export interface NotificationLogItem {
  id: string;
  channel: 'GOOGLE_CHAT' | 'SMTP';
  eventType: string;
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  payload?: any;
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
}

export interface FleetSummary {
  totalServers: number;
  healthy: number;
  failing: number;
  warning: number;
  stale: number;
}

export interface HousekeepingStatus {
  enabled: boolean;
  retentionDays: number;
  cutoffDate: string;
  housekeepingCron: string;
  backupReports: { total: number; eligibleForCleanup: number };
  notificationLogs: { total: number; eligibleForCleanup: number };
}
