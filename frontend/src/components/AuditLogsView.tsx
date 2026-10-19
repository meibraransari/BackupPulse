import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Shield,
  Key,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Download,
  Calendar,
  Filter,
  Eye,
  X,
  Copy,
  Check,
  Clock,
  Globe,
  User as UserIcon,
  Laptop,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Terminal,
  Activity,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { AdminAuditLogItem, AuditStats, AuditQueryFilters } from '../types';
import { useTimezone } from '../context/TimezoneContext';

const CATEGORY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SECURITY: {
    label: 'Security & Auth',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    icon: Key,
  },
  SETTINGS: {
    label: 'Config & Settings',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    icon: Sliders,
  },
  INCIDENT: {
    label: 'Incident Resolution',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    icon: ShieldAlert,
  },
  USER_MANAGEMENT: {
    label: 'User Management',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    icon: UserIcon,
  },
  SYSTEM: {
    label: 'System Operations',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
    icon: Activity,
  },
};

const ACTION_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  API_KEY_CREATED: { label: 'API Key Created', icon: Key },
  API_KEY_REVOKED: { label: 'API Key Revoked', icon: AlertCircle },
  SETTINGS_UPDATED: { label: 'Settings Modified', icon: Sliders },
  INCIDENT_RESOLVED: { label: 'Incident Resolved', icon: CheckCircle2 },
  USER_CREATED: { label: 'User Created', icon: UserIcon },
  USER_UPDATED: { label: 'User Updated', icon: UserIcon },
  USER_DELETED: { label: 'User Deleted', icon: AlertCircle },
};

function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date().getTime();
    const past = new Date(dateString).getTime();
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 30)}mo ago`;
  } catch {
    return '';
  }
}

export const AuditLogsView: React.FC = () => {
  const { formatTimestamp } = useTimezone();

  // State
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'all' | '24h' | '7d' | '30d'>('all');

  // Selected Log Modal
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogItem | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  // Compute dates based on preset
  const getDateRange = (preset: 'all' | '24h' | '7d' | '30d') => {
    if (preset === 'all') return { startDate: undefined, endDate: undefined };
    const now = new Date();
    const endDate = now.toISOString();
    let startDate: string;

    if (preset === '24h') {
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    } else if (preset === '7d') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    return { startDate, endDate };
  };

  // Load audit logs
  const loadLogs = useCallback(
    async (pageNumber = 1) => {
      setLoading(true);
      try {
        const { startDate, endDate } = getDateRange(datePreset);
        const filters: Partial<AuditQueryFilters> = {
          page: pageNumber,
          limit: 15,
          category: categoryFilter,
          action: actionFilter,
          search: searchQuery.trim() || undefined,
          startDate,
          endDate,
        };

        const [res, statsData] = await Promise.all([
          api.getAuditLogs(filters),
          api.getAuditStats().catch(() => null),
        ]);

        setLogs(res.data);
        setPagination(res.pagination);
        if (statsData) setStats(statsData);
      } catch (err) {
        console.error('Failed to load audit logs:', err);
      } finally {
        setLoading(false);
      }
    },
    [categoryFilter, actionFilter, searchQuery, datePreset]
  );

  useEffect(() => {
    loadLogs(1);
  }, [loadLogs]);

  // Handle CSV export
  const handleExport = async () => {
    setExporting(true);
    try {
      const { startDate, endDate } = getDateRange(datePreset);
      await api.exportAuditLogs({
        category: categoryFilter,
        action: actionFilter,
        search: searchQuery.trim() || undefined,
        startDate,
        endDate,
      });
    } catch (err) {
      console.error('Failed to export audit logs:', err);
      alert('Failed to export audit log CSV file.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyPayload = (details: any) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(details, null, 2));
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const resetFilters = () => {
    setCategoryFilter('ALL');
    setActionFilter('ALL');
    setSearchQuery('');
    setDatePreset('all');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-white tracking-tight">Administrative Governance & Audit Trail</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  SOC 2 / ISO 27001 Ready
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  Tamper-Evident
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Immutable record of administrative actions: API key lifecycles, configuration changes, incident resolutions, and user access.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3 relative z-10 shrink-0">
          <button
            type="button"
            onClick={() => loadLogs(pagination.page)}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-all shadow-sm active:scale-95"
            title="Refresh logs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
          >
            {exporting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export Audit Trail (CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Governance Events */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Audit Events</span>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-white">{stats?.totalAllTime.toLocaleString() ?? '—'}</span>
            <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              +{stats?.count24h ?? 0} in 24h
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{stats?.count30d ?? 0} events recorded in last 30 days</p>
        </div>

        {/* Security & Auth */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Security & Keys</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Key className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-white">
              {stats?.categoryCounts?.SECURITY?.toLocaleString() ?? 0}
            </span>
            <span className="text-[11px] font-medium text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
              Tokens & Auth
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Ingestion key generations & revocations</p>
        </div>

        {/* System Settings & Policy */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Configuration Changes</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sliders className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-white">
              {stats?.categoryCounts?.SETTINGS?.toLocaleString() ?? 0}
            </span>
            <span className="text-[11px] font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
              Live Config
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Webhook routing, retention & SLA updates</p>
        </div>

        {/* Incident Resolutions */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl shadow-lg relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Incident Resolutions</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-2xl font-black text-white">
              {stats?.categoryCounts?.INCIDENT?.toLocaleString() ?? 0}
            </span>
            <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
              Audited Overrides
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Manually acknowledged & justified failures</p>
        </div>
      </div>

      {/* 3. Filter & Search Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left: Category & Action Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-400">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setActionFilter('ALL');
                }}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                <option value="SECURITY">🔑 Security & Auth</option>
                <option value="SETTINGS">⚙️ Config & Settings</option>
                <option value="INCIDENT">🛡️ Incident Resolutions</option>
                <option value="USER_MANAGEMENT">👥 User Management</option>
                <option value="SYSTEM">⚡ System Operations</option>
              </select>
            </div>

            {/* Action Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-slate-400">Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="ALL">All Actions</option>
                <option value="API_KEY_CREATED">API Key Created</option>
                <option value="API_KEY_REVOKED">API Key Revoked</option>
                <option value="SETTINGS_UPDATED">Settings Modified</option>
                <option value="INCIDENT_RESOLVED">Incident Resolved</option>
                <option value="USER_CREATED">User Created</option>
                <option value="USER_UPDATED">User Updated</option>
                <option value="USER_DELETED">User Deleted</option>
              </select>
            </div>

            {/* Date Preset Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
              {(['all', '24h', '7d', '30d'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDatePreset(preset)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    datePreset === preset
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {preset === 'all'
                    ? 'All Time'
                    : preset === '24h'
                    ? 'Last 24h'
                    : preset === '7d'
                    ? 'Last 7d'
                    : 'Last 30d'}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Search Box & Reset */}
          <div className="flex items-center space-x-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search action, user, IP, or resource..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') loadLogs(1);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {(categoryFilter !== 'ALL' || actionFilter !== 'ALL' || searchQuery !== '' || datePreset !== 'all') && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Audit Trail Interactive Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target Resource</th>
                <th className="px-4 py-3">Client IP & Agent</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                      <span>Loading governance audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="h-8 w-8 text-slate-600 mb-1" />
                      <p className="font-medium text-slate-400">No governance audit records found</p>
                      <p className="text-[11px] text-slate-500">
                        Try modifying category, action, or date filters to see older events.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const catCfg = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.SYSTEM;
                  const actionMeta = ACTION_LABELS[log.action] || { label: log.action, icon: Activity };
                  const ActionIcon = actionMeta.icon;
                  const relativeTime = formatRelativeTime(log.createdAt);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-slate-200 text-[11px]" title={log.createdAt}>
                            {formatTimestamp(log.createdAt)}
                          </span>
                          {relativeTime && (
                            <span className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                              <Clock className="h-2.5 w-2.5 inline" />
                              <span>{relativeTime}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Operator */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <div className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[10px] text-indigo-300 shrink-0">
                            {log.username.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-200">{log.username}</span>
                            <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
                              {log.userRole || 'admin'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catCfg.bg} ${catCfg.text} ${catCfg.border}`}
                        >
                          <span>{catCfg.label}</span>
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5 font-medium text-slate-200">
                          <ActionIcon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span>{actionMeta.label}</span>
                        </div>
                      </td>

                      {/* Target Resource */}
                      <td className="px-4 py-3.5">
                        <div className="max-w-[220px] truncate font-mono text-[11px] text-slate-300" title={log.targetResource || '—'}>
                          {log.targetResource || '—'}
                        </div>
                      </td>

                      {/* Client IP & Agent */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-[11px] text-slate-300 flex items-center space-x-1">
                            <Globe className="h-2.5 w-2.5 text-slate-500" />
                            <span>{log.ipAddress || '127.0.0.1'}</span>
                          </span>
                          {log.userAgent && (
                            <span
                              className="text-[10px] text-slate-500 max-w-[150px] truncate"
                              title={log.userAgent}
                            >
                              {log.userAgent}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          ) : (
                            <AlertCircle className="h-2.5 w-2.5" />
                          )}
                          <span>{log.status}</span>
                        </span>
                      </td>

                      {/* Details Button */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 text-[11px] font-medium transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/60 text-xs text-slate-400">
            <div>
              Showing <span className="font-semibold text-slate-200">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-semibold text-slate-200">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold text-slate-200">{pagination.total}</span> audit records
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => loadLogs(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-slate-300 font-semibold px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => loadLogs(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Detailed Audit Event Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Audit Event Details</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        selectedLog.status === 'SUCCESS'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {selectedLog.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedLog.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300">
              {/* Event Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 block">Operator Account</span>
                  <span className="font-semibold text-slate-200">
                    {selectedLog.username}{' '}
                    <span className="text-[10px] text-slate-400">({selectedLog.userRole || 'admin'})</span>
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Event Timestamp</span>
                  <span className="font-mono text-slate-200">{formatTimestamp(selectedLog.createdAt)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Action Code</span>
                  <span className="font-mono text-indigo-300 font-medium">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Governance Category</span>
                  <span className="font-medium text-slate-200">{selectedLog.category}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Target Resource</span>
                  <span className="font-mono text-slate-200 truncate block">
                    {selectedLog.targetResource || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block">Client IP Address</span>
                  <span className="font-mono text-slate-200">{selectedLog.ipAddress || '127.0.0.1'}</span>
                </div>
              </div>

              {/* Special Highlight for Incident Resolution Notes */}
              {selectedLog.details && selectedLog.details.resolutionNote && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-400 text-xs">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Incident Resolution Justification:</span>
                  </div>
                  <p className="text-xs text-amber-100 italic pl-5">
                    "{selectedLog.details.resolutionNote}"
                  </p>
                  {selectedLog.details.resolvedBy && (
                    <div className="text-[10px] text-amber-400/80 pl-5 pt-1">
                      Marked Resolved by Operator: <span className="font-bold">{selectedLog.details.resolvedBy}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Special Highlight for Settings Update Keys */}
              {selectedLog.details && selectedLog.details.updatedKeys && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-blue-400 text-xs">
                    <Sliders className="h-4 w-4" />
                    <span>Configuration Parameters Modified:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(selectedLog.details.updatedKeys as string[]).map((key) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px] border border-blue-500/30"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* User-Agent string if available */}
              {selectedLog.userAgent && (
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">User Agent Header:</span>
                  <div className="p-2.5 rounded-lg bg-slate-950 font-mono text-[10px] text-slate-400 border border-slate-800 break-all">
                    {selectedLog.userAgent}
                  </div>
                </div>
              )}

              {/* Full JSON Audit Payload */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-400">Sanitized Event Payload:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyPayload(selectedLog.details)}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[10px]"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-56 leading-relaxed">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-800 flex justify-end bg-slate-800/40">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
