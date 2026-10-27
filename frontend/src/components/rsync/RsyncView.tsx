import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  HardDrive,
  Zap,
  Server,
  Clock,
  Activity,
  Plus,
  Search,
  RefreshCw,
  Play,
  RotateCcw,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Terminal,
  Shield,
  FileText,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  ArrowRight,
  Wifi,
  ExternalLink,
} from 'lucide-react';
import {
  User,
  RsyncDashboardStats,
  RsyncJob,
  RsyncServer,
  RsyncRepository,
  RsyncRun,
  RsyncActivityLog,
} from '../../types';
import { api } from '../../services/api';
import { useTimezone } from '../../context/TimezoneContext';
import { RsyncJobModal } from './RsyncJobModal';
import { RsyncServerModal } from './RsyncServerModal';
import { RsyncRepoModal } from './RsyncRepoModal';
import { RsyncRunDetailModal } from './RsyncRunDetailModal';

interface RsyncViewProps {
  currentUser: User | null;
}

export const RsyncView: React.FC<RsyncViewProps> = ({ currentUser }) => {
  const { timezone, formatTimestamp } = useTimezone();
  const isAdmin = currentUser?.role === 'admin';

  // Sub-tab navigation
  const [activeSubTab, setActiveSubTab] = useState<
    'dashboard' | 'jobs' | 'servers' | 'repositories' | 'history' | 'activity'
  >('dashboard');

  // Loading & Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [dashboardStats, setDashboardStats] = useState<RsyncDashboardStats | null>(null);
  const [jobs, setJobs] = useState<RsyncJob[]>([]);
  const [servers, setServers] = useState<RsyncServer[]>([]);
  const [repositories, setRepositories] = useState<RsyncRepository[]>([]);
  const [runs, setRuns] = useState<RsyncRun[]>([]);
  const [activityLogs, setActivityLogs] = useState<RsyncActivityLog[]>([]);

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [strategyFilter, setStrategyFilter] = useState('ALL');

  // Pagination states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Selection states for Bulk Operations
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([]);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);

  // Modal states
  const [editingJob, setEditingJob] = useState<RsyncJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);

  const [editingServer, setEditingServer] = useState<RsyncServer | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);

  const [editingRepo, setEditingRepo] = useState<RsyncRepository | null>(null);
  const [showRepoModal, setShowRepoModal] = useState(false);

  const [selectedRunReport, setSelectedRunReport] = useState<RsyncRun | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ============================================================================
  // Data Fetching
  // ============================================================================
  const loadDashboard = useCallback(async () => {
    try {
      const stats = await api.getRsyncDashboard();
      setDashboardStats(stats);
    } catch (err: any) {
      console.error('Error loading rsync dashboard stats:', err);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.getRsyncJobs({
        search: searchTerm,
        status: statusFilter,
        strategy: strategyFilter,
        page,
        limit,
      });
      setJobs(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Error loading rsync jobs:', err);
    }
  }, [searchTerm, statusFilter, strategyFilter, page, limit]);

  const loadServers = useCallback(async () => {
    try {
      const list = await api.getRsyncServers();
      setServers(list);
    } catch (err: any) {
      console.error('Error loading rsync servers:', err);
    }
  }, []);

  const loadRepositories = useCallback(async () => {
    try {
      const list = await api.getRsyncRepositories();
      setRepositories(list);
    } catch (err: any) {
      console.error('Error loading rsync repositories:', err);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const res = await api.getRsyncRuns({
        status: statusFilter,
        search: searchTerm,
        page,
        limit,
      });
      setRuns(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Error loading rsync runs:', err);
    }
  }, [statusFilter, searchTerm, page, limit]);

  const loadActivityLogs = useCallback(async () => {
    try {
      const res = await api.getRsyncActivityLogs({ page, limit });
      setActivityLogs(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Error loading rsync activity logs:', err);
    }
  }, [page, limit]);

  const refreshCurrentTab = useCallback(async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'dashboard') {
        await Promise.all([loadDashboard(), loadRepositories()]);
      } else if (activeSubTab === 'jobs') {
        await Promise.all([loadJobs(), loadRepositories(), loadServers()]);
      } else if (activeSubTab === 'servers') {
        await loadServers();
      } else if (activeSubTab === 'repositories') {
        await Promise.all([loadRepositories(), loadServers()]);
      } else if (activeSubTab === 'history') {
        await loadRuns();
      } else if (activeSubTab === 'activity') {
        await loadActivityLogs();
      }
    } finally {
      setLoading(false);
    }
  }, [activeSubTab, loadDashboard, loadJobs, loadServers, loadRepositories, loadRuns, loadActivityLogs]);

  useEffect(() => {
    refreshCurrentTab();
  }, [refreshCurrentTab]);

  // Reset page & selection when switching tabs
  const handleTabChange = (tab: typeof activeSubTab) => {
    setActiveSubTab(tab);
    setPage(1);
    setSelectedJobIds([]);
    setSelectedServerIds([]);
    setSelectedRepoIds([]);
    setSelectedRunIds([]);
    setSearchTerm('');
    setStatusFilter('ALL');
  };

  // ============================================================================
  // Actions: Jobs
  // ============================================================================
  const handleRunJob = async (jobId: string, jobName: string) => {
    if (!isAdmin) return;
    setActionLoading(`run-${jobId}`);
    try {
      showToast(`Triggered execution for "${jobName}"...`);
      const run = await api.runRsyncJob(jobId);
      showToast(`Execution finished with status: ${run.status}`);
      await refreshCurrentTab();
    } catch (err: any) {
      alert(`Run failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDryRunJob = async (jobId: string, jobName: string) => {
    if (!isAdmin) return;
    setActionLoading(`dry-${jobId}`);
    try {
      showToast(`Simulating dry-run for "${jobName}"...`);
      const run = await api.dryRunRsyncJob(jobId);
      setSelectedRunReport(run);
      showToast(`Dry-run simulation completed.`);
      await refreshCurrentTab();
    } catch (err: any) {
      alert(`Dry run simulation failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Are you sure you want to permanently delete job "${name}"?`)) return;
    try {
      await api.deleteRsyncJob(id);
      showToast(`Job "${name}" deleted.`);
      await refreshCurrentTab();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleBulkDeleteJobs = async () => {
    if (!isAdmin || selectedJobIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedJobIds.length} selected job(s)?`)) return;
    try {
      await api.bulkDeleteRsyncJobs(selectedJobIds);
      setSelectedJobIds([]);
      showToast('Selected jobs deleted successfully.');
      await refreshCurrentTab();
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  // ============================================================================
  // Actions: Servers
  // ============================================================================
  const handleTestServer = async (id: string, name: string) => {
    if (!isAdmin) return;
    setActionLoading(`test-${id}`);
    try {
      const res = await api.testRsyncServer(id);
      showToast(`Server "${name}" is ${res.status} (${res.latencyMs}ms): ${res.message}`);
      await loadServers();
    } catch (err: any) {
      alert(`Connection test failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteServer = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Delete server "${name}"?`)) return;
    try {
      await api.deleteRsyncServer(id);
      showToast(`Server "${name}" deleted.`);
      await loadServers();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleBulkDeleteServers = async () => {
    if (!isAdmin || selectedServerIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedServerIds.length} server(s)?`)) return;
    try {
      await api.bulkDeleteRsyncServers(selectedServerIds);
      setSelectedServerIds([]);
      showToast('Selected servers deleted.');
      await loadServers();
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  // ============================================================================
  // Actions: Repositories
  // ============================================================================
  const handleRefreshSpace = async (id: string) => {
    if (!isAdmin) return;
    setActionLoading(`space-${id}`);
    try {
      await api.refreshRsyncRepoSpace(id);
      showToast('Disk space refreshed.');
      await loadRepositories();
    } catch (err: any) {
      alert(`Failed to refresh disk space: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRepo = async (id: string, name: string) => {
    if (!isAdmin) return;
    if (!confirm(`Delete repository "${name}"?`)) return;
    try {
      await api.deleteRsyncRepository(id);
      showToast(`Repository "${name}" deleted.`);
      await loadRepositories();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleBulkDeleteRepos = async () => {
    if (!isAdmin || selectedRepoIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedRepoIds.length} repository(ies)?`)) return;
    try {
      await api.bulkDeleteRsyncRepositories(selectedRepoIds);
      setSelectedRepoIds([]);
      showToast('Selected repositories deleted.');
      await loadRepositories();
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  // ============================================================================
  // Actions: Runs & Logs
  // ============================================================================
  const handleDeleteRun = async (id: string) => {
    if (!isAdmin) return;
    try {
      await api.deleteRsyncRun(id);
      showToast('Run log deleted.');
      await loadRuns();
    } catch (err: any) {
      alert(`Failed to delete run: ${err.message}`);
    }
  };

  const handleBulkDeleteRuns = async () => {
    if (!isAdmin || selectedRunIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedRunIds.length} execution run(s)?`)) return;
    try {
      await api.bulkDeleteRsyncRuns(selectedRunIds);
      setSelectedRunIds([]);
      showToast('Selected run logs deleted.');
      await loadRuns();
    } catch (err: any) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-bold animate-bounce">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner & Sub-Tabs Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-orange-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <HardDrive className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Disk Sync & Rsync Mirroring Engine
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Physical Disks & Remote SSH
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Local disk-to-disk 1:1 mirroring, hard-link incremental snapshots, remote server tunnels, and audit logs.
              </p>
            </div>
          </div>

          {/* Refresh Action */}
          <div className="flex items-center space-x-2 self-start md:self-center">
            <button
              onClick={refreshCurrentTab}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Navigation Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => handleTabChange('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'dashboard'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => handleTabChange('jobs')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'jobs'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Sync Jobs</span>
            {jobs.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/60 font-mono">
                {jobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('servers')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'servers'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Remote Servers</span>
            {servers.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/60 font-mono">
                {servers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('repositories')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'repositories'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Repositories & Disks</span>
            {repositories.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/60 font-mono">
                {repositories.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Execution History</span>
          </button>

          <button
            onClick={() => handleTabChange('activity')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSubTab === 'activity'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Activity Log</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 1. Dashboard Sub-Tab */}
      {/* ==================================================================== */}
      {activeSubTab === 'dashboard' && dashboardStats && (
        <div className="space-y-6">
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400">Total Sync Jobs</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-white">{dashboardStats.totalJobs}</span>
                <span className="text-xs text-emerald-400 font-semibold">
                  ({dashboardStats.activeJobs} active)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Configured disk mirrors</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400">Total Transferred Data</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-amber-400">
                  {dashboardStats.totalSyncedBytesHuman}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Cumulative literal bytes synced</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400">Success Rate</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-emerald-400">
                  {dashboardStats.successRate}%
                </span>
                <span className="text-xs text-slate-400">
                  ({dashboardStats.successfulRuns} / {dashboardStats.totalRuns})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Based on exit code 0</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <span className="text-xs font-semibold text-slate-400">Active Repositories</span>
              <div className="mt-2 flex items-baseline space-x-2">
                <span className="text-3xl font-black text-indigo-400">
                  {dashboardStats.repositories.length}
                </span>
                <span className="text-xs text-slate-400">Disks</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Local and remote targets</p>
            </div>
          </div>

          {/* Physical Disks & Storage Utilization */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Physical Disks & Storage Pools Utilization
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Probed directly from filesystem via df -B1
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingRepo(null);
                    setShowRepoModal(true);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Mount New Disk</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {dashboardStats.repositories.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-xs text-slate-500 italic">
                  No physical disks or storage repositories registered yet.
                </div>
              ) : (
                dashboardStats.repositories.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <HardDrive className="h-4 w-4 text-emerald-400" />
                        <span className="font-bold text-white">{repo.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-900 text-slate-400 border border-slate-800">
                          {repo.type === 'LOCAL_DISK' ? 'Local Mount' : repo.server?.name || 'Remote'}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {repo.usedHuman} / {repo.totalHuman} ({repo.percentUsed || 0}%)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (repo.percentUsed || 0) > 90
                            ? 'bg-rose-500'
                            : (repo.percentUsed || 0) > 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(repo.percentUsed || 0, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <code className="font-mono text-slate-300 text-[10px]">{repo.path}</code>
                      <span>Free: {repo.availableHuman}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Sync Runs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Recent Synchronization Runs</h3>
                <p className="text-xs text-slate-400 mt-0.5">Latest 5 executions across all jobs</p>
              </div>
              <button
                onClick={() => handleTabChange('history')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
              >
                <span>View Full History</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {dashboardStats.recentRuns.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-4">No recent executions recorded yet.</p>
              ) : (
                dashboardStats.recentRuns.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRunReport(r)}
                    className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/70 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                          r.status === 'SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : r.status === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                      <span className="font-bold text-white">{r.job?.name || 'Sync Run'}</span>
                      <span className="text-[11px] text-slate-400">
                        {r.runType === 'DRY_RUN' ? 'Simulation' : r.runType}
                      </span>
                    </div>

                    <div className="flex items-center space-x-4 text-slate-400 text-[11px]">
                      <span>{formatTimestamp(r.startedAt)}</span>
                      <span>{r.durationSeconds ? `${r.durationSeconds.toFixed(1)}s` : '—'}</span>
                      <Eye className="h-3.5 w-3.5 text-slate-400 hover:text-white" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. Jobs Management Sub-Tab */}
      {/* ==================================================================== */}
      {activeSubTab === 'jobs' && (
        <div className="space-y-4">
          {/* Actions Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center space-x-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search jobs by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={strategyFilter}
                onChange={(e) => setStrategyFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Strategies</option>
                <option value="EXACT_MIRROR">Exact 1:1 Mirror</option>
                <option value="HARDLINK_SNAPSHOT">Time-Machine Snapshots</option>
                <option value="BACKUP_DIR">Mirror + Recycle Bin</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {isAdmin && selectedJobIds.length > 0 && (
                <button
                  onClick={handleBulkDeleteJobs}
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedJobIds.length})</span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingJob(null);
                    setShowJobModal(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Sync Job</span>
                </button>
              )}
            </div>
          </div>

          {/* Jobs Table with Horizontal Scroll */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    {isAdmin && (
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={jobs.length > 0 && selectedJobIds.length === jobs.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedJobIds(jobs.map((j) => j.id));
                            else setSelectedJobIds([]);
                          }}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                      </th>
                    )}
                    <th className="p-3.5 min-w-[200px]">Job Name</th>
                    <th className="p-3.5 min-w-[160px]">Strategy</th>
                    <th className="p-3.5 min-w-[220px]">Source & Destination</th>
                    <th className="p-3.5 min-w-[130px]">Schedule</th>
                    <th className="p-3.5 min-w-[120px]">Last Status</th>
                    <th className="p-3.5 text-right min-w-[180px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                        No sync jobs found. Create your first job using the button above.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((j) => (
                      <tr key={j.id} className="hover:bg-slate-950/40 transition-colors">
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.includes(j.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedJobIds((prev) => [...prev, j.id]);
                                else setSelectedJobIds((prev) => prev.filter((id) => id !== j.id));
                              }}
                              className="rounded border-slate-700 text-amber-500 focus:ring-0"
                            />
                          </td>
                        )}
                        <td className="p-3.5">
                          <span className="font-bold text-white block">{j.name}</span>
                          <span className="text-[11px] text-slate-400">
                            {j.isActive ? (
                              <span className="text-emerald-400 font-semibold">Active</span>
                            ) : (
                              <span className="text-slate-500">Disabled</span>
                            )}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-950 border border-slate-800 text-slate-300">
                            {j.syncStrategy === 'HARDLINK_SNAPSHOT'
                              ? '📸 Snapshots'
                              : j.syncStrategy === 'BACKUP_DIR'
                              ? '📦 Recycle Bin'
                              : '🪞 1:1 Mirror'}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                          <div>
                            <span className="text-amber-400">Src:</span> {j.sourceRepo?.name || 'Local'}
                            {j.sourceSubpath && `/${j.sourceSubpath}`}
                          </div>
                          <div>
                            <span className="text-emerald-400">Dst:</span> {j.destRepo?.name || 'Target'}
                            {j.destSubpath && `/${j.destSubpath}`}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-slate-300 text-[11px]">
                          {j.cronSchedule || <span className="text-slate-500 italic">Manual only</span>}
                        </td>
                        <td className="p-3.5">
                          {j.lastRunStatus ? (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                j.lastRunStatus === 'SUCCESS'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : j.lastRunStatus === 'FAILED'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {j.lastRunStatus}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] italic">Not executed</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleDryRunJob(j.id, j.name)}
                                disabled={actionLoading === `dry-${j.id}`}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 transition-colors"
                                title="Dry-Run (Simulate without changing files)"
                              >
                                {actionLoading === `dry-${j.id}` ? 'Simulating...' : 'Dry Run'}
                              </button>
                              <button
                                onClick={() => handleRunJob(j.id, j.name)}
                                disabled={actionLoading === `run-${j.id}`}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm transition-all"
                                title="Run this job now"
                              >
                                {actionLoading === `run-${j.id}` ? 'Syncing...' : 'Run Now'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingJob(j);
                                  setShowJobModal(true);
                                }}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="Edit Job"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteJob(j.id, j.name)}
                                className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                                title="Delete Job"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span>Show</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>per page • Total: {pagination.total} jobs</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. Remote Servers Sub-Tab */}
      {/* ==================================================================== */}
      {activeSubTab === 'servers' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Remote SSH Servers Inventory</h3>
              <p className="text-xs text-slate-400">
                Credentials and SSH connection tunnels for remote cross-server rsync sync
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isAdmin && selectedServerIds.length > 0 && (
                <button
                  onClick={handleBulkDeleteServers}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60"
                >
                  Delete Selected ({selectedServerIds.length})
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingServer(null);
                    setShowServerModal(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Remote Server</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    {isAdmin && (
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={servers.length > 0 && selectedServerIds.length === servers.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedServerIds(servers.map((s) => s.id));
                            else setSelectedServerIds([]);
                          }}
                          className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                        />
                      </th>
                    )}
                    <th className="p-3.5 min-w-[160px]">Server Name</th>
                    <th className="p-3.5 min-w-[160px]">Host & Port</th>
                    <th className="p-3.5 min-w-[140px]">Auth Mode</th>
                    <th className="p-3.5 min-w-[120px]">Status</th>
                    <th className="p-3.5 min-w-[160px]">Last Checked</th>
                    <th className="p-3.5 text-right min-w-[160px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {servers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                        No remote SSH servers added yet. Add one to enable cross-server mirroring.
                      </td>
                    </tr>
                  ) : (
                    servers.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-950/40 transition-colors">
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedServerIds.includes(s.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedServerIds((prev) => [...prev, s.id]);
                                else setSelectedServerIds((prev) => prev.filter((id) => id !== s.id));
                              }}
                              className="rounded border-slate-700 text-indigo-500 focus:ring-0"
                            />
                          </td>
                        )}
                        <td className="p-3.5">
                          <span className="font-bold text-white block">{s.name}</span>
                          <span className="text-[11px] text-slate-500">{s.notes || 'No description'}</span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">
                          {s.username}@{s.host}:{s.port}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300">
                            {s.authType}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              s.status === 'ONLINE'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : s.status === 'OFFLINE'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {s.lastCheckedAt ? formatTimestamp(s.lastCheckedAt) : 'Never'}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleTestServer(s.id, s.name)}
                                disabled={actionLoading === `test-${s.id}`}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                              >
                                {actionLoading === `test-${s.id}` ? 'Testing...' : 'Test Connection'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingServer(s);
                                  setShowServerModal(true);
                                }}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteServer(s.id, s.name)}
                                className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. Repositories Sub-Tab */}
      {/* ==================================================================== */}
      {activeSubTab === 'repositories' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Storage Repositories & Physical Disks</h3>
              <p className="text-xs text-slate-400">
                Local directory mount points and remote disk storage paths
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {isAdmin && selectedRepoIds.length > 0 && (
                <button
                  onClick={handleBulkDeleteRepos}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60"
                >
                  Delete Selected ({selectedRepoIds.length})
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingRepo(null);
                    setShowRepoModal(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Mount New Repository</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    {isAdmin && (
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={repositories.length > 0 && selectedRepoIds.length === repositories.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRepoIds(repositories.map((r) => r.id));
                            else setSelectedRepoIds([]);
                          }}
                          className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                        />
                      </th>
                    )}
                    <th className="p-3.5 min-w-[180px]">Repository</th>
                    <th className="p-3.5 min-w-[120px]">Type</th>
                    <th className="p-3.5 min-w-[220px]">Filesystem Path</th>
                    <th className="p-3.5 min-w-[180px]">Capacity & Usage</th>
                    <th className="p-3.5 text-right min-w-[160px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {repositories.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 italic">
                        No repositories mounted yet.
                      </td>
                    </tr>
                  ) : (
                    repositories.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-950/40 transition-colors">
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRepoIds.includes(r.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedRepoIds((prev) => [...prev, r.id]);
                                else setSelectedRepoIds((prev) => prev.filter((id) => id !== r.id));
                              }}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                            />
                          </td>
                        )}
                        <td className="p-3.5">
                          <span className="font-bold text-white block">{r.name}</span>
                          <span className="text-[11px] text-slate-500">{r.description || '—'}</span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300">
                            {r.type === 'LOCAL_DISK' ? 'Local Host' : r.server?.name || 'Remote SSH'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-300 text-[11px]">
                          {r.path}
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            <span className="text-[11px] text-slate-300 font-mono block">
                              {r.usedHuman || '—'} / {r.totalHuman || '—'} ({r.percentUsed || 0}%)
                            </span>
                            <div className="w-32 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(r.percentUsed || 0, 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleRefreshSpace(r.id)}
                                disabled={actionLoading === `space-${r.id}`}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                              >
                                {actionLoading === `space-${r.id}` ? 'Probing...' : 'Refresh Space'}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingRepo(r);
                                  setShowRepoModal(true);
                                }}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRepo(r.id, r.name)}
                                className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. Execution History & Logs Sub-Tab */}
      {/* ==================================================================== */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 items-center space-x-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search execution runs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUCCESS">Success Only</option>
                <option value="FAILED">Failed Only</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DRY_RUN">Dry Runs</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              {isAdmin && selectedRunIds.length > 0 && (
                <button
                  onClick={handleBulkDeleteRuns}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60"
                >
                  Delete Selected ({selectedRunIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Runs Table with Horizontal Scroll */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    {isAdmin && (
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={runs.length > 0 && selectedRunIds.length === runs.length}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedRunIds(runs.map((r) => r.id));
                            else setSelectedRunIds([]);
                          }}
                          className="rounded border-slate-700 text-amber-500 focus:ring-0"
                        />
                      </th>
                    )}
                    <th className="p-3.5 min-w-[110px]">Status</th>
                    <th className="p-3.5 min-w-[180px]">Job Name</th>
                    <th className="p-3.5 min-w-[110px]">Mode</th>
                    <th className="p-3.5 min-w-[130px]">Transferred</th>
                    <th className="p-3.5 min-w-[120px]">Files Copied</th>
                    <th className="p-3.5 min-w-[90px]">Duration</th>
                    <th className="p-3.5 min-w-[160px]">Executed At</th>
                    <th className="p-3.5 text-right min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500 italic">
                        No execution records found.
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-950/40 transition-colors">
                        {isAdmin && (
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRunIds.includes(r.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedRunIds((prev) => [...prev, r.id]);
                                else setSelectedRunIds((prev) => prev.filter((id) => id !== r.id));
                              }}
                              className="rounded border-slate-700 text-amber-500 focus:ring-0"
                            />
                          </td>
                        )}
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                              r.status === 'SUCCESS'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : r.status === 'FAILED'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-bold text-white block truncate max-w-[200px]">
                            {r.job?.name || 'Sync Run'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {r.id.slice(0, 8)}...
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-950 border border-slate-800 text-slate-300">
                            {r.runType}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-white">
                          {r.bytesTransferredHuman || '0 B'}
                        </td>
                        <td className="p-3.5 text-slate-300 font-mono text-[11px]">
                          {r.transferredFiles.toLocaleString()} / {r.totalFiles.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-slate-300">
                          {r.durationSeconds ? `${r.durationSeconds.toFixed(1)}s` : '—'}
                        </td>
                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {formatTimestamp(r.startedAt)}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            onClick={() => setSelectedRunReport(r)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                          >
                            View Terminal
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteRun(r.id)}
                              className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="px-4 py-3 bg-slate-950/50 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center space-x-2">
                <span>Show</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>per page • Total: {pagination.total} records</span>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2">
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. Activity & Governance Audit Log */}
      {/* ==================================================================== */}
      {activeSubTab === 'activity' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 bg-slate-950/40">
            <h3 className="text-sm font-bold text-white">Rsync Operations & Change Audit Trail</h3>
            <p className="text-xs text-slate-400">
              Tamper-evident logs of job creations, executions, dry-runs, and deletions
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3.5 min-w-[160px]">Timestamp</th>
                  <th className="p-3.5 min-w-[140px]">Action</th>
                  <th className="p-3.5 min-w-[120px]">Entity</th>
                  <th className="p-3.5 min-w-[120px]">Triggered By</th>
                  <th className="p-3.5 min-w-[250px]">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                      No activity logs recorded.
                    </td>
                  </tr>
                ) : (
                  activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                        {formatTimestamp(log.createdAt)}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-950 border border-slate-800 text-amber-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300">{log.entityType}</td>
                      <td className="p-3.5 font-bold text-white">{log.username}</td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px] truncate max-w-md">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <RsyncJobModal
        job={editingJob}
        repositories={repositories}
        servers={servers}
        isOpen={showJobModal}
        onClose={() => {
          setShowJobModal(false);
          setEditingJob(null);
        }}
        onSaved={async () => {
          showToast('Sync job saved successfully.');
          await refreshCurrentTab();
          setEditingJob(null);
        }}
      />

      <RsyncServerModal
        server={editingServer}
        isOpen={showServerModal}
        onClose={() => {
          setShowServerModal(false);
          setEditingServer(null);
        }}
        onSaved={async () => {
          showToast('Server configuration saved successfully.');
          await loadServers();
          setEditingServer(null);
        }}
      />

      <RsyncRepoModal
        repo={editingRepo}
        servers={servers}
        isOpen={showRepoModal}
        onClose={() => {
          setShowRepoModal(false);
          setEditingRepo(null);
        }}
        onSaved={async () => {
          showToast('Repository saved successfully.');
          await refreshCurrentTab();
          setEditingRepo(null);
        }}
      />

      <RsyncRunDetailModal
        run={selectedRunReport}
        isOpen={!!selectedRunReport}
        onClose={() => setSelectedRunReport(null)}
      />
    </div>
  );
};
