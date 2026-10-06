import { BackupFilters, BackupReport, DashboardStats, ProjectBreakdown, TrendItem, User } from '../types';

const TOKEN_KEY = 'backup_monitor_auth_token';

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
      if (errJson.error) errorMsg = errJson.error;
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
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    return request(`/api/v1/backups?${params.toString()}`);
  },

  async getBackupById(id: string): Promise<BackupReport> {
    return request<BackupReport>(`/api/v1/backups/${id}`);
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
    });
  },

  async triggerDailyReport(): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>('/api/v1/notifications/trigger-daily-report', {
      method: 'POST',
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
