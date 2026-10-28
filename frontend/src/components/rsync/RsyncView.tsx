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
  ChevronDown,
  ChevronUp,
  Eye,
  ArrowRight,
  Wifi,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Filter,
  WrapText,
  Database,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Info,
  HelpCircle,
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
import { RsyncConfirmModal, RsyncConfirmModalConfig } from './RsyncConfirmModal';
import { RsyncActivityDetailModal } from './RsyncActivityDetailModal';
import { RsyncGuideModal } from './RsyncGuideModal';

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
  const [confirmModal, setConfirmModal] = useState<RsyncConfirmModalConfig | null>(null);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Activity Log states (Filters, Resizing & Expansion)
  const [activityActionFilter, setActivityActionFilter] = useState('ALL');
  const [activityEntityFilter, setActivityEntityFilter] = useState('ALL');
  const [activityColWidths, setActivityColWidths] = useState<{ [key: string]: number }>({
    timestamp: 170,
    action: 160,
    entity: 100,
    username: 120,
    details: 520,
    actions: 90,
  });
  const [resizingCol, setResizingCol] = useState<{
    colKey: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [wrapDetails, setWrapDetails] = useState<boolean>(false);
  const [selectedActivityLog, setSelectedActivityLog] = useState<RsyncActivityLog | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Column Resizing Mouse Listeners
  useEffect(() => {
    if (!resizingCol) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingCol.startX;
      const minWidthMap: { [k: string]: number } = {
        timestamp: 120,
        action: 110,
        entity: 80,
        username: 90,
        details: 240,
        actions: 70,
      };
      const minW = minWidthMap[resizingCol.colKey] || 70;
      const newWidth = Math.max(minW, resizingCol.startWidth + deltaX);
      setActivityColWidths((prev) => ({
        ...prev,
        [resizingCol.colKey]: newWidth,
      }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingCol]);

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
      const res = await api.getRsyncActivityLogs({
        page,
        limit,
        search: searchTerm,
        action: activityActionFilter,
        entityType: activityEntityFilter,
      });
      setActivityLogs(res.data);
      setPagination(res.pagination);
    } catch (err: any) {
      console.error('Error loading rsync activity logs:', err);
    }
  }, [page, limit, searchTerm, activityActionFilter, activityEntityFilter]);

  const refreshCurrentTab = useCallback(async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'dashboard') {
        await Promise.all([loadDashboard(), loadRepositories(), loadServers(), loadJobs()]);
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
    setActivityActionFilter('ALL');
    setActivityEntityFilter('ALL');
  };

  // Activity Log Helpers (Resizing, Expanding & Filtering)
  const totalActivityTableWidth = useMemo(() => {
    return 40 + Object.values(activityColWidths).reduce((sum, w) => sum + w, 0);
  }, [activityColWidths]);

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol({
      colKey,
      startX: e.clientX,
      startWidth: activityColWidths[colKey] || 150,
    });
  };

  const resetActivityColWidths = () => {
    setActivityColWidths({
      timestamp: 170,
      action: 160,
      entity: 100,
      username: 120,
      details: 520,
      actions: 90,
    });
    showToast('Column widths reset to default.');
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAllLogs = () => {
    if (expandedLogIds.size > 0) {
      setExpandedLogIds(new Set());
    } else {
      setExpandedLogIds(new Set(activityLogs.map((l) => l.id)));
    }
  };

  const handleCopyLogJson = (log: RsyncActivityLog, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!log.details) return;
    navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 2000);
    showToast('Log payload copied to clipboard.');
  };

  const availableActivityActions = useMemo(() => {
    const common = [
      'JOB_STARTED',
      'JOB_COMPLETED',
      'JOB_FAILED',
      'DRY_RUN_TRIGGERED',
      'SERVER_TESTED',
      'SERVER_UPDATED',
      'RSYNC_SERVER_CREATED',
      'JOB_CREATED',
      'JOB_UPDATED',
      'JOB_DELETED',
      'REPO_CREATED',
    ];
    const fromLogs = activityLogs.map((l) => l.action);
    return Array.from(new Set([...common, ...fromLogs])).sort();
  }, [activityLogs]);

  const availableActivityEntities = useMemo(() => {
    const common = ['RUN', 'SERVER', 'REPOSITORY', 'JOB'];
    const fromLogs = activityLogs.map((l) => l.entityType);
    return Array.from(new Set([...common, ...fromLogs])).sort();
  }, [activityLogs]);

  const filteredActivityLogs = useMemo(() => {
    let list = activityLogs;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter((log) => {
        if (log.action.toLowerCase().includes(term)) return true;
        if (log.entityType.toLowerCase().includes(term)) return true;
        if (log.username.toLowerCase().includes(term)) return true;
        if (log.details && JSON.stringify(log.details).toLowerCase().includes(term)) return true;
        return false;
      });
    }
    if (activityActionFilter !== 'ALL') {
      list = list.filter((log) => log.action === activityActionFilter);
    }
    if (activityEntityFilter !== 'ALL') {
      list = list.filter((log) => log.entityType === activityEntityFilter);
    }
    return list;
  }, [activityLogs, searchTerm, activityActionFilter, activityEntityFilter]);

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
      showToast(`Run failed: ${err.message}`, 'error');
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
      showToast(`Dry run simulation failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJob = (job: RsyncJob) => {
    if (!isAdmin) return;
    setConfirmModal({
      title: 'Delete Sync Job',
      subtitle: `Job ID: ${job.id.slice(0, 8)}...`,
      description: `Are you sure you want to permanently delete sync job "${job.name}"? All scheduled synchronization triggers and parameters for this job will be removed.`,
      confirmText: 'Delete Job',
      isDestructive: true,
      itemDetails: [
        { label: 'Job Name', value: job.name },
        { label: 'Strategy', value: job.strategy },
        { label: 'Source', value: job.sourceRepository?.name || 'Custom Path' },
        { label: 'Destination', value: job.destRepository?.name || 'Custom Path' },
        { label: 'Schedule', value: job.cronSchedule || 'Manual Run Only' },
      ],
      onConfirm: async () => {
        try {
          await api.deleteRsyncJob(job.id);
          showToast(`Job "${job.name}" deleted successfully.`);
          await refreshCurrentTab();
        } catch (err: any) {
          showToast(`Delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  const handleBulkDeleteJobs = () => {
    if (!isAdmin || selectedJobIds.length === 0) return;
    const count = selectedJobIds.length;
    const selectedNames = jobs
      .filter((j) => selectedJobIds.includes(j.id))
      .map((j) => j.name);
    const previewText =
      selectedNames.slice(0, 3).join(', ') +
      (selectedNames.length > 3 ? ` and ${selectedNames.length - 3} more` : '');

    setConfirmModal({
      title: 'Delete Selected Sync Jobs',
      subtitle: `Bulk Action: ${count} job(s) selected`,
      description: `Are you sure you want to permanently delete these ${count} selected sync jobs? All associated schedules and configuration settings will be lost.`,
      confirmText: `Delete ${count} Jobs`,
      isDestructive: true,
      itemDetails: [
        { label: 'Total Selected', value: `${count} jobs` },
        { label: 'Jobs Included', value: previewText || `${count} selected` },
      ],
      onConfirm: async () => {
        try {
          await api.bulkDeleteRsyncJobs(selectedJobIds);
          setSelectedJobIds([]);
          showToast(`${count} sync jobs deleted successfully.`);
          await refreshCurrentTab();
        } catch (err: any) {
          showToast(`Bulk delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  // ============================================================================
  // Actions: Servers
  // ============================================================================
  const handleTestServer = async (id: string, name: string) => {
    if (!isAdmin) return;
    setActionLoading(`test-${id}`);
    try {
      const res = await api.testRsyncServer(id);
      if (res.status === 'ONLINE') {
        showToast(`Server "${name}" is ONLINE (${res.latencyMs}ms): ${res.message}`);
      } else {
        showToast(`Server "${name}" status: ${res.status}. ${res.message}`, 'error');
      }
      await loadServers();
    } catch (err: any) {
      showToast(`Connection test failed: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteServer = (server: RsyncServer) => {
    if (!isAdmin) return;
    setConfirmModal({
      title: 'Delete Remote Rsync Node',
      subtitle: `Node: ${server.host}:${server.port}`,
      description: `Are you sure you want to delete remote server "${server.name}"? Repositories and sync jobs pointing to this node may no longer be able to establish SSH connections.`,
      confirmText: 'Delete Server',
      isDestructive: true,
      itemDetails: [
        { label: 'Server Name', value: server.name },
        { label: 'Host & Port', value: `${server.username}@${server.host}:${server.port}` },
        { label: 'Auth Method', value: server.authType },
        { label: 'Linked Repos', value: `${server._count?.repositories ?? 0} repositories` },
      ],
      onConfirm: async () => {
        try {
          await api.deleteRsyncServer(server.id);
          showToast(`Server "${server.name}" deleted successfully.`);
          await loadServers();
        } catch (err: any) {
          showToast(`Delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  const handleBulkDeleteServers = () => {
    if (!isAdmin || selectedServerIds.length === 0) return;
    const count = selectedServerIds.length;
    const selectedNames = servers
      .filter((s) => selectedServerIds.includes(s.id))
      .map((s) => s.name);
    const previewText =
      selectedNames.slice(0, 3).join(', ') +
      (selectedNames.length > 3 ? ` and ${selectedNames.length - 3} more` : '');

    setConfirmModal({
      title: 'Delete Selected Remote Servers',
      subtitle: `Bulk Action: ${count} server(s) selected`,
      description: `Are you sure you want to permanently delete these ${count} remote server connection profiles?`,
      confirmText: `Delete ${count} Servers`,
      isDestructive: true,
      itemDetails: [
        { label: 'Total Selected', value: `${count} servers` },
        { label: 'Servers Included', value: previewText || `${count} selected` },
      ],
      onConfirm: async () => {
        try {
          await api.bulkDeleteRsyncServers(selectedServerIds);
          setSelectedServerIds([]);
          showToast(`${count} remote servers deleted successfully.`);
          await loadServers();
        } catch (err: any) {
          showToast(`Bulk delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
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
      showToast(`Failed to refresh disk space: ${err.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRepo = (repo: RsyncRepository) => {
    if (!isAdmin) return;
    setConfirmModal({
      title: 'Delete Storage Repository',
      subtitle: `Repository: ${repo.name}`,
      description: `Are you sure you want to remove repository "${repo.name}" from the inventory? Physical files on the target disk will not be deleted, but sync jobs linked to this repository will be disrupted.`,
      confirmText: 'Delete Repository',
      isDestructive: true,
      itemDetails: [
        { label: 'Repository Name', value: repo.name },
        { label: 'Storage Node', value: repo.server ? `${repo.server.name} (${repo.server.host})` : 'Local Host / BackupPulse Server' },
        { label: 'Path', value: repo.path },
        { label: 'Capacity', value: repo.totalSpaceHuman || 'Unknown' },
      ],
      onConfirm: async () => {
        try {
          await api.deleteRsyncRepository(repo.id);
          showToast(`Repository "${repo.name}" deleted successfully.`);
          await loadRepositories();
        } catch (err: any) {
          showToast(`Delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  const handleBulkDeleteRepos = () => {
    if (!isAdmin || selectedRepoIds.length === 0) return;
    const count = selectedRepoIds.length;
    const selectedNames = repositories
      .filter((r) => selectedRepoIds.includes(r.id))
      .map((r) => r.name);
    const previewText =
      selectedNames.slice(0, 3).join(', ') +
      (selectedNames.length > 3 ? ` and ${selectedNames.length - 3} more` : '');

    setConfirmModal({
      title: 'Delete Selected Storage Repositories',
      subtitle: `Bulk Action: ${count} repository(ies) selected`,
      description: `Are you sure you want to remove these ${count} repositories from the inventory? Physical disk data will remain untouched.`,
      confirmText: `Delete ${count} Repositories`,
      isDestructive: true,
      itemDetails: [
        { label: 'Total Selected', value: `${count} repositories` },
        { label: 'Repositories Included', value: previewText || `${count} selected` },
      ],
      onConfirm: async () => {
        try {
          await api.bulkDeleteRsyncRepositories(selectedRepoIds);
          setSelectedRepoIds([]);
          showToast(`${count} repositories deleted successfully.`);
          await loadRepositories();
        } catch (err: any) {
          showToast(`Bulk delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  // ============================================================================
  // Actions: Runs & Logs
  // ============================================================================
  const handleDeleteRun = (run: RsyncRun) => {
    if (!isAdmin) return;
    setConfirmModal({
      title: 'Delete Execution Run Log',
      subtitle: `Run ID: ${run.id.slice(0, 8)}...`,
      description: `Are you sure you want to permanently delete this execution run record and its captured rsync terminal logs? This operation cannot be undone.`,
      confirmText: 'Delete Run Record',
      isDestructive: true,
      itemDetails: [
        { label: 'Sync Job', value: run.job?.name || 'Manual / Ad-hoc Sync' },
        { label: 'Status', value: run.status },
        { label: 'Execution Type', value: run.runType },
        { label: 'Started At', value: formatTimestamp(run.startedAt) },
        { label: 'Transferred', value: `${run.bytesTransferredHuman || '0 B'} (${run.transferredFiles.toLocaleString()} files)` },
      ],
      onConfirm: async () => {
        try {
          await api.deleteRsyncRun(run.id);
          showToast('Execution run record deleted successfully.');
          await loadRuns();
        } catch (err: any) {
          showToast(`Failed to delete run: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  const handleBulkDeleteRuns = () => {
    if (!isAdmin || selectedRunIds.length === 0) return;
    const count = selectedRunIds.length;

    setConfirmModal({
      title: 'Purge Selected Execution Run Logs',
      subtitle: `Bulk Action: ${count} run record(s) selected`,
      description: `Are you sure you want to permanently purge these ${count} execution run records and their associated rsync output logs? This operation is irreversible.`,
      confirmText: `Purge ${count} Run Logs`,
      isDestructive: true,
      itemDetails: [
        { label: 'Total Selected', value: `${count} run records` },
      ],
      onConfirm: async () => {
        try {
          await api.bulkDeleteRsyncRuns(selectedRunIds);
          setSelectedRunIds([]);
          showToast(`${count} execution run logs purged successfully.`);
          await loadRuns();
        } catch (err: any) {
          showToast(`Bulk delete failed: ${err.message}`, 'error');
          throw err;
        }
      },
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2.5 text-xs font-bold border transition-all animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-rose-950/95 border-rose-800 text-rose-200 shadow-rose-950/50'
              : 'bg-emerald-950/95 border-emerald-800 text-emerald-200 shadow-emerald-950/50'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span className="max-w-md break-words">{toast.message}</span>
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

          {/* Header Action Buttons: Guide & Refresh */}
          <div className="flex items-center space-x-2 self-start md:self-center">
            <button
              onClick={() => setShowGuideModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 transition-colors shadow-sm cursor-pointer"
              title="Step-by-step guide: How rsync operations work"
            >
              <Info className="h-3.5 w-3.5 text-amber-400" />
              <span>How It Works</span>
            </button>

            <button
              onClick={refreshCurrentTab}
              disabled={loading}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
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
      {/* 1. Dashboard Sub-Tab (High-Density, Comprehensive & Fully Clickable) */}
      {/* ==================================================================== */}
      {activeSubTab === 'dashboard' && dashboardStats && (
        <div className="space-y-6">
          {/* Top 5 Interactive KPI Cards (All Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Sync Jobs */}
            <div
              onClick={() => handleTabChange('jobs')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-lg transition-all duration-200 cursor-pointer group hover:bg-slate-900/90 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                  Total Sync Jobs
                </span>
                <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform">
                  <Zap className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-black text-white">{dashboardStats.totalJobs}</span>
                <span className="text-xs text-emerald-400 font-semibold font-mono">
                  ({dashboardStats.activeJobs} active)
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-amber-300 transition-colors">
                <span>Manage Sync Jobs</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Remote SSH Nodes */}
            <div
              onClick={() => handleTabChange('servers')}
              className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 sm:p-5 shadow-lg transition-all duration-200 cursor-pointer group hover:bg-slate-900/90 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                  Remote SSH Nodes
                </span>
                <div className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-110 transition-transform">
                  <Server className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-black text-indigo-400">
                  {dashboardStats.totalServers ?? servers.length}
                </span>
                <span className="text-[11px] text-emerald-400 font-semibold font-mono">
                  {dashboardStats.onlineServers ?? servers.filter((s) => s.status === 'ONLINE').length} Online
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-indigo-300 transition-colors">
                <span>Manage SSH Nodes</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Storage Repositories & Disks */}
            <div
              onClick={() => handleTabChange('repositories')}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-lg transition-all duration-200 cursor-pointer group hover:bg-slate-900/90 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                  Storage Pools
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                  <HardDrive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {dashboardStats.repositories.length}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {dashboardStats.storageSummary?.percentUsed ?? 0}% Fleet Used
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-emerald-300 transition-colors">
                <span>Inspect Disk Mounts</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Success Rate */}
            <div
              onClick={() => handleTabChange('history')}
              className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 shadow-lg transition-all duration-200 cursor-pointer group hover:bg-slate-900/90 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                  Success Rate
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {dashboardStats.successRate}%
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ({dashboardStats.successfulRuns}/{dashboardStats.totalRuns})
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-emerald-300 transition-colors">
                <span>View Run History</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Total Transferred Bandwidth */}
            <div
              onClick={() => handleTabChange('history')}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 sm:p-5 shadow-lg transition-all duration-200 cursor-pointer group hover:bg-slate-900/90 relative overflow-hidden flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-300 transition-colors">
                  Transferred Data
                </span>
                <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 group-hover:scale-110 transition-transform">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-2">
                <span className="text-2xl sm:text-3xl font-black text-amber-400 truncate">
                  {dashboardStats.totalSyncedBytesHuman}
                </span>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 group-hover:text-amber-300 transition-colors">
                <span>Bandwidth History</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Remote SSH Infrastructure & Connection Fleet Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Server className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Remote SSH Nodes & Connection Tunnels
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-slate-300">
                    {(dashboardStats.servers || servers).length} Nodes Connected
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Live connectivity state, SSH key tunnels, and cross-server endpoints
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingServer(null);
                      setShowServerModal(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-950/40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Remote Node</span>
                  </button>
                )}
                <button
                  onClick={() => handleTabChange('servers')}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors"
                >
                  <span>View All Servers</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Servers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
              {(dashboardStats.servers || servers).length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60">
                  No remote SSH nodes configured yet. Connect remote nodes for cross-server rsync mirroring.
                </div>
              ) : (
                (dashboardStats.servers || servers).map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleTabChange('servers')}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/50 transition-all cursor-pointer group flex flex-col justify-between space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-xs group-hover:text-indigo-300 transition-colors truncate max-w-[170px]" title={s.name}>
                            {s.name}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold font-mono border ${
                              s.status === 'ONLINE'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70'
                                : 'bg-rose-950/80 text-rose-300 border-rose-800/70'
                            }`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 block truncate mt-0.5" title={`${s.username}@${s.host}:${s.port}`}>
                          {s.username}@{s.host}:{s.port}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {s.authType}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                      <span>{s.latencyMs !== null && s.latencyMs !== undefined ? `${s.latencyMs}ms latency` : 'Tunnel ready'}</span>
                      <span className="text-indigo-400 group-hover:underline flex items-center space-x-0.5">
                        <span>Details</span>
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Physical Disks & Storage Pools Utilization Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Physical Disks & Storage Pools Utilization
                  </h3>
                  {dashboardStats.storageSummary && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-emerald-300">
                      {dashboardStats.storageSummary.usedHuman} / {dashboardStats.storageSummary.totalHuman} (
                      {dashboardStats.storageSummary.percentUsed}%)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Probed directly from filesystem via df -B1 across local mount points and remote hosts
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {isAdmin && (
                  <button
                    onClick={() => {
                      setEditingRepo(null);
                      setShowRepoModal(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-950/40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Mount New Disk</span>
                  </button>
                )}
                <button
                  onClick={() => handleTabChange('repositories')}
                  className="flex items-center space-x-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors"
                >
                  <span>View All Disks</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Repositories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {dashboardStats.repositories.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60">
                  No storage repositories mounted yet. Register local paths or remote disk mounts.
                </div>
              ) : (
                dashboardStats.repositories.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => handleTabChange('repositories')}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/50 transition-all cursor-pointer group space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <HardDrive className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span className="font-bold text-white group-hover:text-emerald-300 transition-colors truncate" title={repo.name}>
                          {repo.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-900 text-slate-400 border border-slate-800 shrink-0">
                          {repo.type === 'LOCAL_DISK' ? 'Local' : repo.server?.name || 'Remote'}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-300 shrink-0">
                        {repo.percentUsed || 0}%
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
                      <code className="font-mono text-slate-300 text-[10px] truncate max-w-[180px]" title={repo.path}>
                        {repo.path}
                      </code>
                      <span className="font-mono text-[10px] text-slate-400">Free: {repo.availableHuman}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sync Strategies (Left) & Operations Command Center (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Sync Strategy Architecture (Clickable) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white tracking-tight">Sync Strategy Distribution</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Click any strategy to view filtered sync jobs</p>
                </div>
                <button
                  onClick={() => handleTabChange('jobs')}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                >
                  <span>All Jobs</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* 1:1 Mirror */}
                <div
                  onClick={() => {
                    handleTabChange('jobs');
                    setStrategyFilter('EXACT_MIRROR');
                  }}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-amber-500/50 transition-all cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Exact 1:1 Mirror
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {dashboardStats.strategyBreakdown?.['EXACT_MIRROR'] ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Deletes unreferenced targets to maintain identical replicas.
                  </p>
                </div>

                {/* Hardlink Snapshot */}
                <div
                  onClick={() => {
                    handleTabChange('jobs');
                    setStrategyFilter('HARDLINK_SNAPSHOT');
                  }}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/50 transition-all cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Hard-Link Snapshots
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-400">
                      {dashboardStats.strategyBreakdown?.['HARDLINK_SNAPSHOT'] ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Zero-overhead incremental snapshots using filesystem inodes.
                  </p>
                </div>

                {/* Backup Dir */}
                <div
                  onClick={() => {
                    handleTabChange('jobs');
                    setStrategyFilter('BACKUP_DIR');
                  }}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-emerald-500/50 transition-all cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Incremental Delta
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {dashboardStats.strategyBreakdown?.['BACKUP_DIR'] ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Moves modified / deleted files into dated differential folders.
                  </p>
                </div>

                {/* Two Way Sync */}
                <div
                  onClick={() => {
                    handleTabChange('jobs');
                    setStrategyFilter('TWO_WAY_SYNC');
                  }}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-purple-500/50 transition-all cursor-pointer group space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                      Two-Way Sync
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-400">
                      {dashboardStats.strategyBreakdown?.['TWO_WAY_SYNC'] ?? 0}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Bi-directional sync updates across distributed nodes.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Operations Command Hub (Clickable Actions) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">Operations Command Hub</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Quick triggers for rsync infrastructure management</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {/* Create Sync Job Action */}
                <div
                  onClick={() => {
                    setEditingJob(null);
                    setShowJobModal(true);
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-br from-amber-950/30 via-slate-950 to-slate-950 border border-amber-900/30 hover:border-amber-500/60 transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Create Sync Job
                    </span>
                    <Plus className="h-4 w-4 text-amber-400 group-hover:scale-125 transition-transform" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Configure scheduled 1:1 mirroring, snapshot triggers, and schedules.
                  </p>
                </div>

                {/* Add Remote Server Action */}
                <div
                  onClick={() => {
                    setEditingServer(null);
                    setShowServerModal(true);
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/30 via-slate-950 to-slate-950 border border-indigo-900/30 hover:border-indigo-500/60 transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Add Remote Node
                    </span>
                    <Server className="h-4 w-4 text-indigo-400 group-hover:scale-125 transition-transform" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Set up an OpenSSH connection tunnel with password or private key.
                  </p>
                </div>

                {/* Mount Storage Disk Action */}
                <div
                  onClick={() => {
                    setEditingRepo(null);
                    setShowRepoModal(true);
                  }}
                  className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/30 via-slate-950 to-slate-950 border border-emerald-900/30 hover:border-emerald-500/60 transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Mount Disk Pool
                    </span>
                    <HardDrive className="h-4 w-4 text-emerald-400 group-hover:scale-125 transition-transform" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Register a physical disk partition, local folder, or remote mount path.
                  </p>
                </div>

                {/* View Execution History Action */}
                <div
                  onClick={() => handleTabChange('history')}
                  className="p-3.5 rounded-xl bg-gradient-to-br from-purple-950/30 via-slate-950 to-slate-950 border border-purple-900/30 hover:border-purple-500/60 transition-all cursor-pointer group flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors">
                      Execution History
                    </span>
                    <Terminal className="h-4 w-4 text-purple-400 group-hover:scale-125 transition-transform" />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Access all historical sync logs, stdout outputs, and rsync terminal runs.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Governance & Audit Activity Feed (Replaces Recent Runs) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Recent Governance & System Audit Activity
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Latest system audit entries, execution triggers, server tests, and configuration changes
                </p>
              </div>

              <button
                onClick={() => handleTabChange('activity')}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
              >
                <span>Explore Full Audit Trail</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(dashboardStats.recentActivity || activityLogs.slice(0, 5)).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-950/40 rounded-xl border border-slate-800/60">
                  No audit trail events recorded yet.
                </div>
              ) : (
                (dashboardStats.recentActivity || activityLogs.slice(0, 5)).map((log) => {
                  const isFailed =
                    log.action.includes('FAIL') ||
                    log.details?.status === 'FAILED' ||
                    Boolean(log.details?.error || log.details?.errorMessage);
                  const isSuccess =
                    log.action.includes('COMPLETED') ||
                    log.action.includes('SUCCESS') ||
                    log.details?.status === 'SUCCESS' ||
                    log.details?.status === 'ONLINE';

                  return (
                    <div
                      key={log.id}
                      onClick={() => handleTabChange('activity')}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                            isFailed
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800/70'
                              : isSuccess
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70'
                              : 'bg-amber-950/80 text-amber-300 border-amber-800/70'
                          }`}
                        >
                          {log.action}
                        </span>

                        <span className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                          {log.details?.jobName || log.details?.serverName || log.entityType}
                        </span>

                        <span className="text-[11px] text-slate-500 font-mono">
                          by <span className="text-slate-300">{log.username}</span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
                        {log.details?.message && (
                          <span className="text-slate-500 truncate max-w-xs hidden md:inline">
                            {log.details.message}
                          </span>
                        )}
                        <span className="font-mono text-slate-500">{formatTimestamp(log.createdAt)}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Engine Protocol & Readiness Banner */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-slate-300">Rsync 3.5.0 Engine:</span>
              <span className="text-emerald-400 font-mono">Active & Operational</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              <span className="font-semibold text-slate-300">OpenSSH Tunnels:</span>
              <span className="text-indigo-400 font-mono">Encrypted (Ed25519 & RSA)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-slate-300">Audit Trail:</span>
              <span className="text-amber-400 font-mono">Tamper-Evident Ledger Active</span>
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
                                onClick={() => handleDeleteJob(j)}
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
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedServerIds.length})</span>
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
                                onClick={() => handleDeleteServer(s)}
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
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedRepoIds.length})</span>
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
                                onClick={() => handleDeleteRepo(r)}
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
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Selected ({selectedRunIds.length})</span>
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
                              onClick={() => handleDeleteRun(r)}
                              className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400"
                              title="Delete Execution Run"
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
        <div className="space-y-4">
          {/* Audit Controls & Filter Toolbar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xl">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">Rsync Operations & Change Audit Trail</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-300">
                  {pagination.total} Total
                </span>
                {filteredActivityLogs.length !== activityLogs.length && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    {filteredActivityLogs.length} Filtered
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Tamper-evident logs of job creations, executions, dry-runs, and deletions
              </p>
            </div>

            {/* Quick View Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={toggleExpandAllLogs}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                title={expandedLogIds.size > 0 ? 'Collapse all log details' : 'Expand all log details'}
              >
                {expandedLogIds.size > 0 ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 text-amber-400" />
                    <span>Collapse All</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    <span>Expand All Logs</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setWrapDetails(!wrapDetails)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  wrapDetails
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Toggle text wrapping in Details column"
              >
                <WrapText className="h-3.5 w-3.5" />
                <span>{wrapDetails ? 'Wrap: ON' : 'Wrap: OFF'}</span>
              </button>

              <button
                onClick={resetActivityColWidths}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                title="Reset column widths to default"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Search & Filters Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by action, user, entity, or JSON details..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Action Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 shrink-0 font-medium">Action:</span>
              <select
                value={activityActionFilter}
                onChange={(e) => {
                  setActivityActionFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Actions ({activityLogs.length})</option>
                {availableActivityActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Filter */}
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 shrink-0 font-medium">Entity:</span>
              <select
                value={activityEntityFilter}
                onChange={(e) => {
                  setActivityEntityFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">All Entities</option>
                {availableActivityEntities.map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear All Filters button */}
            {(searchTerm || activityActionFilter !== 'ALL' || activityEntityFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActivityActionFilter('ALL');
                  setActivityEntityFilter('ALL');
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* Activity Logs Table Card with Horizontal Scrollbar & Resizable Columns */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div
              className={`overflow-x-auto ${resizingCol ? 'select-none' : ''}`}
              style={{ scrollbarWidth: 'thin' }}
            >
              <table
                className="text-left text-xs border-collapse w-full"
                style={{
                  minWidth: `${Math.max(1050, totalActivityTableWidth)}px`,
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col style={{ width: `${activityColWidths.timestamp}px` }} />
                  <col style={{ width: `${activityColWidths.action}px` }} />
                  <col style={{ width: `${activityColWidths.entity}px` }} />
                  <col style={{ width: `${activityColWidths.username}px` }} />
                  <col style={{ width: `${activityColWidths.details}px` }} />
                  <col style={{ width: `${activityColWidths.actions}px` }} />
                </colgroup>
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5 w-10 text-center select-none">
                      <span className="sr-only">Expand</span>
                    </th>

                    {/* Timestamp Header */}
                    <th
                      style={{ width: `${activityColWidths.timestamp}px` }}
                      className="relative p-3.5 select-none overflow-hidden"
                    >
                      <span className="truncate block pr-2">Timestamp</span>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'timestamp')}
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 flex items-center justify-center group z-10"
                        title="Drag to resize Timestamp column"
                      >
                        <div className="w-[1.5px] h-4 bg-slate-700 group-hover:bg-amber-400 group-hover:h-full transition-all" />
                      </div>
                    </th>

                    {/* Action Header */}
                    <th
                      style={{ width: `${activityColWidths.action}px` }}
                      className="relative p-3.5 select-none overflow-hidden"
                    >
                      <span className="truncate block pr-2">Action</span>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'action')}
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 flex items-center justify-center group z-10"
                        title="Drag to resize Action column"
                      >
                        <div className="w-[1.5px] h-4 bg-slate-700 group-hover:bg-amber-400 group-hover:h-full transition-all" />
                      </div>
                    </th>

                    {/* Entity Header */}
                    <th
                      style={{ width: `${activityColWidths.entity}px` }}
                      className="relative p-3.5 select-none overflow-hidden"
                    >
                      <span className="truncate block pr-2">Entity</span>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'entity')}
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 flex items-center justify-center group z-10"
                        title="Drag to resize Entity column"
                      >
                        <div className="w-[1.5px] h-4 bg-slate-700 group-hover:bg-amber-400 group-hover:h-full transition-all" />
                      </div>
                    </th>

                    {/* Triggered By Header */}
                    <th
                      style={{ width: `${activityColWidths.username}px` }}
                      className="relative p-3.5 select-none overflow-hidden"
                    >
                      <span className="truncate block pr-2">Triggered By</span>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'username')}
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 flex items-center justify-center group z-10"
                        title="Drag to resize Triggered By column"
                      >
                        <div className="w-[1.5px] h-4 bg-slate-700 group-hover:bg-amber-400 group-hover:h-full transition-all" />
                      </div>
                    </th>

                    {/* Details Header */}
                    <th
                      style={{ width: `${activityColWidths.details}px` }}
                      className="relative p-3.5 select-none overflow-hidden"
                    >
                      <div className="flex items-center space-x-1.5 truncate pr-2">
                        <span>Details & Log Payload</span>
                        <span className="text-[10px] text-slate-500 font-mono">(Resizable)</span>
                      </div>
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'details')}
                        className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-amber-500/30 active:bg-amber-500/50 flex items-center justify-center group z-10"
                        title="Drag to resize Details column"
                      >
                        <div className="w-[1.5px] h-4 bg-slate-700 group-hover:bg-amber-400 group-hover:h-full transition-all" />
                      </div>
                    </th>

                    {/* Actions Header */}
                    <th
                      style={{ width: `${activityColWidths.actions}px` }}
                      className="p-3.5 text-right select-none font-semibold text-slate-400"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredActivityLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-500 italic">
                        No activity audit logs matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredActivityLogs.map((log) => {
                      const isExpanded = expandedLogIds.has(log.id);
                      const isFailed =
                        log.action.includes('FAIL') ||
                        log.details?.status === 'FAILED' ||
                        Boolean(log.details?.error || log.details?.errorMessage);
                      const isSuccess =
                        log.action.includes('COMPLETED') ||
                        log.action.includes('SUCCESS') ||
                        log.details?.status === 'SUCCESS' ||
                        log.details?.status === 'ONLINE';

                      return (
                        <React.Fragment key={log.id}>
                          <tr
                            className={`hover:bg-slate-950/60 transition-colors ${
                              isExpanded ? 'bg-slate-950/40' : ''
                            }`}
                          >
                            {/* Expand Row Toggle Button */}
                            <td className="p-3.5 text-center">
                              <button
                                onClick={() => toggleExpandLog(log.id)}
                                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title={isExpanded ? 'Collapse log details' : 'Expand log details'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-amber-400" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </td>

                            {/* Timestamp */}
                            <td className="p-3.5 text-slate-400 font-mono text-[11px] truncate">
                              {formatTimestamp(log.createdAt)}
                            </td>

                            {/* Action Badge */}
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border inline-block truncate max-w-full ${
                                  isFailed
                                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                                    : isSuccess
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                    : log.action.includes('STARTED') || log.action.includes('TESTED')
                                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                                    : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                                }`}
                              >
                                {log.action}
                              </span>
                            </td>

                            {/* Entity */}
                            <td className="p-3.5 text-slate-300 font-mono text-[11px] truncate">
                              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                                {log.entityType}
                              </span>
                            </td>

                            {/* Triggered By */}
                            <td className="p-3.5 font-bold text-white truncate">{log.username}</td>

                            {/* Details Payload Cell */}
                            <td
                              onClick={() => toggleExpandLog(log.id)}
                              className={`p-3.5 text-slate-400 font-mono text-[11px] cursor-pointer hover:text-slate-200 transition-colors ${
                                wrapDetails ? 'whitespace-pre-wrap break-all leading-relaxed' : 'truncate'
                              }`}
                              title="Click to expand log details"
                            >
                              {log.details ? JSON.stringify(log.details) : '—'}
                            </td>

                            {/* Actions Column */}
                            <td className="p-3.5 text-right space-x-1 whitespace-nowrap">
                              <button
                                onClick={(e) => handleCopyLogJson(log, e)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                title="Copy JSON Payload"
                              >
                                {copiedLogId === log.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setSelectedActivityLog(log)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                                title="Inspect Full Audit Record"
                              >
                                <Maximize2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>

                          {/* Accordion Expanded Log Row */}
                          {isExpanded && (
                            <tr className="bg-slate-950/80 border-b border-slate-800/80 animate-in fade-in duration-150">
                              <td colSpan={7} className="p-4 pl-12 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                      Payload Details:
                                    </span>
                                    {log.details?.jobName && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-white font-semibold">
                                        Job: {log.details.jobName}
                                      </span>
                                    )}
                                    {log.details?.status && (
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                          log.details.status === 'SUCCESS' || log.details.status === 'ONLINE'
                                            ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                                            : log.details.status === 'FAILED' || log.details.status === 'OFFLINE'
                                            ? 'bg-rose-950/80 text-rose-300 border-rose-800/60'
                                            : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                                        }`}
                                      >
                                        Status: {log.details.status}
                                      </span>
                                    )}
                                    {log.details?.latencyMs !== undefined && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-amber-300">
                                        Latency: {log.details.latencyMs}ms
                                      </span>
                                    )}
                                    {log.details?.jobId && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400">
                                        Job ID: {log.details.jobId.slice(0, 8)}...
                                      </span>
                                    )}
                                    {log.details?.serverName && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-indigo-300">
                                        Node: {log.details.serverName}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={(e) => handleCopyLogJson(log, e)}
                                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] font-semibold transition-colors"
                                    >
                                      {copiedLogId === log.id ? (
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
                                    <button
                                      onClick={() => setSelectedActivityLog(log)}
                                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-[11px] font-semibold transition-colors"
                                    >
                                      <Maximize2 className="h-3 w-3" />
                                      <span>Inspect</span>
                                    </button>
                                    <button
                                      onClick={() => toggleExpandLog(log.id)}
                                      className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-[11px] border border-slate-800 transition-colors"
                                    >
                                      Collapse
                                    </button>
                                  </div>
                                </div>

                                {/* Banner for Message or Error */}
                                {log.details?.message && (
                                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-slate-300 text-xs font-mono">
                                    <span className="text-slate-500 font-sans text-[10px] block uppercase font-bold">
                                      Message:
                                    </span>
                                    {log.details.message}
                                  </div>
                                )}
                                {log.details?.error && (
                                  <div className="bg-rose-950/50 border border-rose-800/70 rounded-lg p-2.5 text-rose-200 text-xs font-mono">
                                    <span className="text-rose-400 font-sans text-[10px] block uppercase font-bold">
                                      Error Details:
                                    </span>
                                    {log.details.error}
                                  </div>
                                )}

                                {/* Formatted JSON Payload */}
                                <pre className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-3.5 text-[11px] font-mono text-emerald-300/90 overflow-x-auto custom-scrollbar max-h-72 leading-relaxed whitespace-pre-wrap break-all select-text">
                                  {log.details ? JSON.stringify(log.details, null, 2) : 'No details payload recorded.'}
                                </pre>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
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
                  className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
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
                  Page {page} of {pagination.totalPages || 1}
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

      {/* Confirmation Modal */}
      <RsyncConfirmModal
        config={confirmModal}
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
      />

      {/* Activity Log Full Inspection Modal */}
      <RsyncActivityDetailModal
        log={selectedActivityLog}
        isOpen={!!selectedActivityLog}
        onClose={() => setSelectedActivityLog(null)}
      />

      {/* Rsync Operations Step-by-Step Guide Modal */}
      <RsyncGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        onNavigateTab={handleTabChange}
        onOpenAddServer={() => {
          setEditingServer(null);
          setShowServerModal(true);
        }}
        onOpenAddRepo={() => {
          setEditingRepo(null);
          setShowRepoModal(true);
        }}
        onOpenAddJob={() => {
          setEditingJob(null);
          setShowJobModal(true);
        }}
      />
    </div>
  );
};
