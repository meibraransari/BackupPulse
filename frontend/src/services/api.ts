import {
  BackupFilters,
  BackupReport,
  DashboardStats,
  FleetSummary,
  HousekeepingStatus,
  NotificationLogItem,
  ProjectBreakdown,
  ServerFleetItem,
  ServerConfigItem,
  TrendItem,
  User,
  UserLoginLog,
} from '../types';

const TOKEN_KEY = 'backup_monitor_auth_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    authStorage.clearToken();
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.message) errorMsg = errJson.message;
      else if (errJson.error) errorMsg = errJson.error;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await request<{ token: string; user: User }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    authStorage.setToken(res.token);
    return res;
  },

  async getCurrentUser(): Promise<{ user: User }> {
    return request<{ user: User }>('/api/v1/auth/me');
  },

  async updateProfile(data: {
    fullName?: string;
    email?: string;
    avatar?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ success: boolean; message: string; user: User }> {
    return request('/api/v1/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getLoginLogs(params: { page?: number; limit?: number; status?: string; username?: string } = {}): Promise<{
    data: UserLoginLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.username) query.append('username', params.username);
    return request(`/api/v1/auth/logins?${query.toString()}`);
  },

  // User Management (Admin)
  async getUsers(): Promise<User[]> {
    return request<User[]>('/api/v1/users');
  },

  async createUser(data: {
    username: string;
    password: string;
    fullName?: string;
    email?: string;
    role?: string;
    avatar?: string;
    isActive?: boolean;
  }): Promise<{ success: boolean; user: User }> {
    return request('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      role?: string;
      avatar?: string;
      isActive?: boolean;
      newPassword?: string;
    }
  ): Promise<{ success: boolean; user: User }> {
    return request(`/api/v1/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/v1/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Server Monitoring Configs (Dead Man's Snitch Mute/Unmute)
  async getServerConfigs(): Promise<ServerConfigItem[]> {
    return request<ServerConfigItem[]>('/api/v1/servers/configs');
  },

  async updateServerMonitoring(
    serverId: string,
    isMonitored: boolean,
    muteReason?: string,
    hostname?: string
  ): Promise<{ success: boolean; message: string; config: ServerConfigItem }> {
    return request(`/api/v1/servers/${serverId}/monitor`, {
      method: 'PATCH',
      body: JSON.stringify({ isMonitored, muteReason, hostname }),
    });
  },

  logout() {
    authStorage.clearToken();
  },

  // Dashboard stats
  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/api/v1/dashboard/stats');
  },

  async getDashboardTrends(days = 7): Promise<TrendItem[]> {
    return request<TrendItem[]>(`/api/v1/dashboard/trends?days=${days}`);
  },

  async getProjectBreakdown(): Promise<ProjectBreakdown[]> {
    return request<ProjectBreakdown[]>('/api/v1/dashboard/projects');
  },

  async getFleetData(params: { search?: string; status?: string } = {}): Promise<{
    fleet: ServerFleetItem[];
    summary: FleetSummary;
  }> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    return request<{ fleet: ServerFleetItem[]; summary: FleetSummary }>(`/api/v1/dashboard/fleet?${query.toString()}`);
  },

  // Backups
  async getBackups(filters: Partial<BackupFilters>): Promise<{
    data: BackupReport[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.projectName) params.append('projectName', filters.projectName);
    if (filters.serverId) params.append('serverId', filters.serverId);
    if (filters.status) params.append('status', filters.status);
    if (filters.backupType) params.append('backupType', filters.backupType);
    if (filters.search) params.append('search', filters.search);
    if (filters.isAnomaly !== undefined) params.append('isAnomaly', String(filters.isAnomaly));
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    return request(`/api/v1/backups?${params.toString()}`);
  },

  async getBackupById(id: string): Promise<BackupReport> {
    return request<BackupReport>(`/api/v1/backups/${id}`);
  },

  async updateBackupStatus(id: string, status: string, resolutionNote?: string): Promise<BackupReport> {
    return request<BackupReport>(`/api/v1/backups/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, resolutionNote }),
    });
  },

  async getProjects(): Promise<string[]> {
    return request<string[]>('/api/v1/backups/projects');
  },

  async getServers(): Promise<{ serverId: string; hostname: string }[]> {
    return request<{ serverId: string; hostname: string }[]>('/api/v1/backups/servers');
  },

  // Notifications
  async testGoogleChat(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/api/v1/notifications/test-gchat', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async testSmtp(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/api/v1/notifications/test-smtp', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async getNotificationStatus(): Promise<{
    googleChat: { enabled: boolean; configured: boolean };
    smtp: { enabled: boolean; configured: boolean; host: string; port: number; from: string; to: string };
    cron: { expression: string; active: boolean };
  }> {
    return request('/api/v1/notifications/status');
  },

  async triggerDailyReport(): Promise<{
    success: boolean;
    message: string;
    channels?: {
      googleChat?: { success: boolean; message: string };
      smtp?: { success: boolean; message: string };
    };
  }> {
    return request<{
      success: boolean;
      message: string;
      channels?: {
        googleChat?: { success: boolean; message: string };
        smtp?: { success: boolean; message: string };
      };
    }>('/api/v1/notifications/trigger-daily-report', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async getNotificationLogs(params: { page?: number; limit?: number; channel?: string; status?: string; eventType?: string } = {}): Promise<{
    data: NotificationLogItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.channel && params.channel !== 'ALL') query.append('channel', params.channel);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.eventType && params.eventType !== 'ALL') query.append('eventType', params.eventType);
    return request(`/api/v1/notifications/logs?${query.toString()}`);
  },

  // Housekeeping & Retention
  async getHousekeepingStatus(): Promise<HousekeepingStatus> {
    return request<HousekeepingStatus>('/api/v1/system/housekeeping');
  },

  async triggerCleanup(days?: number): Promise<{
    success: boolean;
    message: string;
    retentionDays: number;
    cutoffDate?: string;
    deletedBackupReports: number;
    deletedNotificationLogs: number;
  }> {
    return request('/api/v1/system/cleanup', {
      method: 'POST',
      body: JSON.stringify(days ? { days } : {}),
    });
  },

  // Export CSV
  async downloadExport(filters: Partial<BackupFilters>, format: 'csv' | 'json' = 'csv') {
    const token = authStorage.getToken();
    const params = new URLSearchParams();
    params.append('format', format);
    if (filters.projectName) params.append('projectName', filters.projectName);
    if (filters.serverId) params.append('serverId', filters.serverId);
    if (filters.status) params.append('status', filters.status);
    if (filters.backupType) params.append('backupType', filters.backupType);
    if (filters.isAnomaly !== undefined) params.append('isAnomaly', String(filters.isAnomaly));
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await fetch(`/api/v1/backups/export?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to generate export file');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backups_export_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
};
