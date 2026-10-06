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
  projectName: string;
  serverId: string;
  status: string;
  backupType: string;
  search: string;
  startDate: string;
  endDate: string;
}
