import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { DashboardOverview } from '../components/DashboardOverview';
import { StatCards } from '../components/StatCards';
import { TrendChart } from '../components/TrendChart';
import { FilterBar } from '../components/FilterBar';
import { BackupTable } from '../components/BackupTable';
import { DetailModal } from '../components/DetailModal';
import { ResolveModal } from '../components/ResolveModal';
import { FleetView } from '../components/FleetView';
import { NotificationLogsModal } from '../components/NotificationLogsModal';
import { HousekeepingModal } from '../components/HousekeepingModal';
import { UserProfileModal } from '../components/UserProfileModal';
import { UserManagementView } from '../components/UserManagementView';
import { ApiKeysModal } from '../components/ApiKeysModal';
import { DeployWizardModal } from '../components/DeployWizardModal';
import { SlaHeatmap } from '../components/SlaHeatmap';
import { DrillPulseView } from '../components/DrillPulseView';
import { SettingsView } from '../components/SettingsView';
import { AuditLogsView } from '../components/AuditLogsView';
import { RsyncView } from '../components/rsync/RsyncView';
import { CommandPaletteModal } from '../components/CommandPaletteModal';
import { NocWallboardModal } from '../components/NocWallboardModal';
import { NotificationCenterDrawer } from '../components/NotificationCenterDrawer';
import { DeleteBackupModal } from '../components/DeleteBackupModal';
import { useTimezone } from '../context/TimezoneContext';
import { api } from '../services/api';
import { BackupFilters, BackupReport, DashboardStats, ProjectBreakdown, TrendItem, User, NavigationTab } from '../types';
import {
  Home,
  RefreshCw,
  CheckCircle2,
  Server,
  Table,
  Users,
  Sparkles,
  Sliders,
  ShieldCheck,
  Bell,
  Tv,
  Search,
  LayoutDashboard,
  HardDrive,
} from 'lucide-react';

interface DashboardPageProps {
  user: User | null;
  onLogout: () => void;
}

const initialFilters: BackupFilters = {
  page: 1,
  limit: 15,
  projectName: 'ALL',
  serverId: 'ALL',
  status: 'ALL',
  backupType: 'ALL',
  search: '',
  availability: 'ALL',
  startDate: '',
  endDate: '',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
  // Current user state (updates in-place when profile changes)
  const [currentUser, setCurrentUser] = useState<User | null>(user);

  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [projectBreakdown, setProjectBreakdown] = useState<ProjectBreakdown[]>([]);
  const [backups, setBackups] = useState<BackupReport[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [serversList, setServersList] = useState<{ serverId: string; hostname: string }[]>([]);

  const [filters, setFilters] = useState<BackupFilters>(initialFilters);
  const [selectedReport, setSelectedReport] = useState<BackupReport | null>(null);
  const [resolvingReport, setResolvingReport] = useState<BackupReport | null>(null);
  const [backupToDelete, setBackupToDelete] = useState<BackupReport | null>(null);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const { timezone, toggleTimezone } = useTimezone();

  // View toggle & Modal states
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [showNotificationLogs, setShowNotificationLogs] = useState<boolean>(false);
  const [showHousekeeping, setShowHousekeeping] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState<boolean>(false);
  const [showDeployWizard, setShowDeployWizard] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showNocWallboard, setShowNocWallboard] = useState<boolean>(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState<boolean>(false);

  // Global Keyboard Shortcuts (Ctrl+K, Cmd+K, '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      } else if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        setShowCommandPalette(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to smoothly scroll down to the data table
  const scrollToTable = () => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTimeout(() => {
      document.getElementById('telemetry-table-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Load KPI stats and charts
  const loadDashboardData = useCallback(async () => {
    try {
      const [statsData, trendsData, breakdownData, projectsData, serversData] = await Promise.all([
        api.getDashboardStats(),
        api.getDashboardTrends(7),
        api.getProjectBreakdown(),
        api.getProjects(),
        api.getServers(),
      ]);
      setStats(statsData);
      setTrends(trendsData);
      setProjectBreakdown(breakdownData);
      setProjectsList(projectsData);
      setServersList(serversData);
    } catch (err) {
      console.error('Error fetching dashboard summary data:', err);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Load paginated & filtered backup reports
  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await api.getBackups(filters);
      setBackups(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Error loading backup records:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<BackupFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  // Card click: filters by status and navigates to Telemetry table
  const handleCardClick = (status: string) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
    setActiveTab('telemetry');
    scrollToTable();
  };

  // Trend Chart bar click: filters by that date and navigates to Telemetry table
  const handleDateClick = (date: string) => {
    setFilters((prev) => ({ ...prev, startDate: date, endDate: date, page: 1 }));
    setActiveTab('telemetry');
    scrollToTable();
  };

  // Top Projects list click: filters by that project and navigates to Telemetry table
  const handleProjectClick = (projectName: string) => {
    setFilters((prev) => ({ ...prev, projectName, page: 1 }));
    setActiveTab('telemetry');
    scrollToTable();
  };

  // Open the professional resolution modal
  const handleOpenResolveModal = (report: BackupReport) => {
    setResolvingReport(report);
  };

  // Confirm resolution from the professional modal
  const handleConfirmResolve = async (report: BackupReport, resolutionNote: string) => {
    try {
      const updated = await api.updateBackupStatus(
        report.id,
        'SUCCESS',
        resolutionNote
      );

      // If currently viewing in detail drawer, update it in place
      if (selectedReport && selectedReport.id === report.id) {
        setSelectedReport(updated);
      }

      // Show success notification toast
      setActionToast(`Backup for "${report.projectName}" marked as SUCCESS.`);
      setTimeout(() => setActionToast(null), 4000);

      // Refresh stats & table so it immediately disappears from Failed count!
      await Promise.all([loadDashboardData(), loadBackups()]);
    } catch (err: any) {
      alert(`Failed to update backup status: ${err.message}`);
      throw err;
    }
  };

  // Open the Delete Backup confirmation modal (Admin only)
  const handleOpenDeleteModal = (report: BackupReport) => {
    setBackupToDelete(report);
  };

  // Confirm permanent deletion of backup record
  const handleConfirmDelete = async (report: BackupReport) => {
    try {
      await api.deleteBackup(report.id);

      // If currently open in detail modal, close it
      if (selectedReport && selectedReport.id === report.id) {
        setSelectedReport(null);
      }

      // Show success notification toast
      setActionToast(`Backup record for "${report.projectName}" (${report.zipFilename}) permanently deleted.`);
      setTimeout(() => setActionToast(null), 4000);

      // Reload dashboard data & backups list immediately
      await Promise.all([loadDashboardData(), loadBackups()]);
    } catch (err: any) {
      console.error('Failed to delete backup:', err);
      alert(`Failed to delete backup record: ${err?.message || 'Unknown error'}`);
      throw err;
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    try {
      await api.downloadExport(filters, format);
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboardData(), loadBackups()]);
    setRefreshing(false);
  };

  // Dedicated Home Button action: resets filters, sets activeTab to 'dashboard', and reloads dashboard telemetry
  const handleGoHome = useCallback(async () => {
    setActiveTab('dashboard');
    setFilters(initialFilters);
    setSelectedReport(null);
    setResolvingReport(null);
    setRefreshing(true);
    try {
      await Promise.all([loadDashboardData(), loadBackups()]);
    } catch (err) {
      console.error('Error refreshing home data:', err);
    } finally {
      setRefreshing(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [loadDashboardData, loadBackups]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col lg:pl-64">
      {/* Persistent Enterprise Sidebar */}
      <Sidebar
        user={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onGoHome={handleGoHome}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenNotificationLogs={() => setShowNotificationLogs(true)}
        onOpenHousekeeping={() => setShowHousekeeping(true)}
        onOpenApiKeys={() => setShowApiKeysModal(true)}
        onOpenDeployWizard={() => setShowDeployWizard(true)}
        onOpenCommandPalette={() => setShowCommandPalette(true)}
        onOpenNocWallboard={() => setShowNocWallboard(true)}
        onLogout={onLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & View Switcher */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {activeTab === 'dashboard' && 'DevOps Fleet & Backup Dashboard'}
                {activeTab === 'telemetry' && 'Backup Telemetry Records'}
                {activeTab === 'rsync' && 'Disk Sync & Rsync Mirror Engine'}
                {activeTab === 'drills' && 'Disaster Recovery DrillPulse'}
                {activeTab === 'fleet' && 'Server Fleet Inventory'}
                {activeTab === 'users' && 'Access & User Directory'}
                {activeTab === 'settings' && 'System Configuration & Settings'}
                {activeTab === 'audit' && 'Governance & Change Audit Log'}
              </h1>
              {activeTab === 'settings' && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium tracking-wide bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  Zero-Restart
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {activeTab === 'dashboard' &&
                'Real-time health overview, 24-hour backup distribution heat, SLA trends, and fleet storage analytics.'}
              {activeTab === 'telemetry' &&
                'Live status, cron logs, size anomaly guards, and automated cloud sync reports across 100+ servers.'}
              {activeTab === 'rsync' &&
                'Local disk-to-disk 1:1 mirroring, time-machine hard-link snapshots, remote SSH nodes, and execution audit.'}
              {activeTab === 'drills' &&
                'Automated Disaster Recovery sandbox restore drills, row count validations, and SOC2 audit compliance logs.'}
              {activeTab === 'fleet' &&
                "100+ servers at-a-glance, Dead Man's Snitch stale server tracking, and alert mute controls."}
              {activeTab === 'users' &&
                'Team member profile administration, access roles, and real-time login audit logs.'}
              {activeTab === 'settings' &&
                'Database-backed configuration for alert channels, email routing, retention rules, and master keys.'}
              {activeTab === 'audit' &&
                'SOC 2 Type II / ISO 27001 tamper-evident management action history and compliance logs.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Switcher Tabs */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={handleGoHome}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Go to Dashboard Overview"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('telemetry')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'telemetry'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Go to Backup Telemetry Records"
              >
                <Table className="h-3.5 w-3.5" />
                <span>Telemetry</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                  {pagination.total}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('rsync')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'rsync'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950/40'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Go to Disk Sync & Rsync Mirror Engine"
              >
                <HardDrive className="h-3.5 w-3.5" />
                <span>Disk Mirror</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                  Rsync
                </span>
              </button>

              <button
                onClick={() => setActiveTab('drills')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'drills'
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>DrillPulse</span>
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'fleet'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Server className="h-3.5 w-3.5" />
                <span>Fleet</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                  100+
                </span>
              </button>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'users'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Users</span>
                {currentUser?.role === 'admin' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    Admin
                  </span>
                )}
              </button>

              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'settings'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Settings</span>
                </button>
              )}
            </div>

            {/* Global Command Palette Trigger Button */}
            <button
              type="button"
              onClick={() => setShowCommandPalette(true)}
              className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-xs transition-colors shadow-sm"
              title="Search projects, servers, actions (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-indigo-400" />
              <span>Search...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-950 text-[10px] font-mono text-slate-400 border border-slate-800">
                Ctrl K
              </kbd>
            </button>

            {/* Full-Screen NOC Operations Wallboard Button */}
            <button
              type="button"
              onClick={() => setShowNocWallboard(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 transition-colors shadow-sm"
              title="Open Full-Screen NOC Operations Center Wallboard (TV Display)"
            >
              <Tv className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">NOC Wallboard</span>
            </button>

            {/* Live Notification Center Drawer Bell Button */}
            <button
              type="button"
              onClick={() => setShowNotificationCenter(true)}
              className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors shadow-sm"
              title="Notification Center & Live Alerts"
            >
              <Bell className="h-4 w-4 text-slate-300" />
              {stats && stats.failed24h > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-600 text-[10px] font-bold text-white flex items-center justify-center border-2 border-slate-950 animate-pulse">
                  {stats.failed24h}
                </span>
              )}
            </button>

            {/* Deploy New Server Wizard Action Button */}
            <button
              onClick={() => setShowDeployWizard(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-teal-400 shadow-md shadow-emerald-950/40 transition-all select-none cursor-pointer"
              title="Open Deploy New Server & 1-Click Script Generator Wizard"
            >
              <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
              <span>Deploy New Server</span>
            </button>

            {(activeTab === 'dashboard' || activeTab === 'telemetry') && (
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
                <span>Refresh</span>
              </button>
            )}
          </div>
        </div>

        {activeTab === 'dashboard' ? (
          <DashboardOverview
            stats={stats}
            loadingStats={loadingStats}
            trends={trends}
            projectBreakdown={projectBreakdown}
            onSelectFilter={handleCardClick}
            onSelectDate={handleDateClick}
            onSelectProject={handleProjectClick}
            onViewFleet={() => setActiveTab('fleet')}
            onNavigateToTelemetry={(filterParams) => {
              try {
                const tzOffset = timezone === 'UTC' ? 0 : new Date().getTimezoneOffset();
                setFilters((prev) => ({
                  ...prev,
                  search: filterParams?.search !== undefined ? filterParams.search : '',
                  status: filterParams?.status !== undefined ? filterParams.status : 'ALL',
                  hour: filterParams?.hour !== undefined ? filterParams.hour : undefined,
                  period: filterParams?.period !== undefined ? filterParams.period : undefined,
                  startDate: '',
                  endDate: '',
                  timezoneOffset: tzOffset,
                  page: 1,
                }));
              } catch (err) {
                console.error('Error applying telemetry filters:', err);
              }
              setActiveTab('telemetry');
              try {
                window.scrollTo(0, 0);
              } catch (_) {}
            }}
            selectedDate={filters.startDate && filters.startDate === filters.endDate ? filters.startDate : undefined}
            projectName={filters.projectName !== 'ALL' ? filters.projectName : undefined}
            serverId={filters.serverId !== 'ALL' ? filters.serverId : undefined}
          />
        ) : activeTab === 'telemetry' ? (
          <div id="telemetry-table-section" className="space-y-6">
            {/* 1. Advanced Filtering Toolbar */}
            <FilterBar
              filters={filters}
              projects={projectsList}
              servers={serversList}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              onExport={handleExport}
              exporting={exporting}
            />

            {/* 2. Telemetry Records Table */}
            <BackupTable
              data={backups}
              loading={loadingBackups}
              pagination={pagination}
              onPageChange={handlePageChange}
              onSelectReport={(report) => setSelectedReport(report)}
              onMarkSuccess={handleOpenResolveModal}
              onDeleteBackup={handleOpenDeleteModal}
              currentUser={currentUser}
            />
          </div>
        ) : activeTab === 'rsync' ? (
          /* Disk Sync & Rsync Mirror Engine View */
          <RsyncView currentUser={currentUser} />
        ) : activeTab === 'drills' ? (
          /* Disaster Recovery Verification Drills (DrillPulse) View */
          <DrillPulseView
            onSelectReport={(report) => setSelectedReport(report)}
            onOpenDeployWizard={() => setShowDeployWizard(true)}
          />
        ) : activeTab === 'fleet' ? (
          /* Server Fleet Inventory View */
          <FleetView
            onSelectServer={(serverId) => {
              setFilters((prev) => ({ ...prev, serverId, page: 1 }));
              setActiveTab('telemetry');
              scrollToTable();
            }}
            onOpenDeployWizard={() => setShowDeployWizard(true)}
          />
        ) : activeTab === 'users' ? (
          /* Multi-User Directory & Login Tracker View */
          <UserManagementView currentUser={currentUser} />
        ) : activeTab === 'settings' ? (
          /* Dynamic System Settings & Zero-Restart Configuration View */
          <SettingsView
            onSettingsSaved={() => {
              loadDashboardData();
              loadBackups();
            }}
            onOpenHousekeeping={() => setShowHousekeeping(true)}
          />
        ) : (
          /* Administrative Governance & Change Audit Log View */
          <AuditLogsView />
        )}
      </main>

      {/* 5. Detail Modal / Drawer */}
      <DetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onMarkSuccess={handleOpenResolveModal}
        onDeleteBackup={handleOpenDeleteModal}
        isAdmin={currentUser?.role === 'admin'}
      />

      {/* 6. Professional Incident Resolution Modal */}
      <ResolveModal
        report={resolvingReport}
        currentUser={currentUser}
        isOpen={!!resolvingReport}
        onClose={() => setResolvingReport(null)}
        onConfirm={handleConfirmResolve}
      />

      {/* 7. Notification Delivery Audit Modal */}
      <NotificationLogsModal
        isOpen={showNotificationLogs}
        onClose={() => setShowNotificationLogs(false)}
      />

      {/* 8. Housekeeping & Retention Control Modal */}
      <HousekeepingModal
        isOpen={showHousekeeping}
        onClose={() => setShowHousekeeping(false)}
        onCleanupComplete={async () => {
          await Promise.all([loadDashboardData(), loadBackups()]);
          setActionToast('Database housekeeping executed successfully.');
          setTimeout(() => setActionToast(null), 4000);
        }}
      />

      {/* 9. Self-Service User Profile Modal */}
      <UserProfileModal
        user={currentUser}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdated={(updated) => {
          setCurrentUser(updated);
          setActionToast('Profile updated successfully.');
          setTimeout(() => setActionToast(null), 4000);
        }}
      />

      {/* 10. API Ingestion Tokens Management Modal */}
      <ApiKeysModal
        isOpen={showApiKeysModal}
        onClose={() => setShowApiKeysModal(false)}
        user={currentUser}
      />

      {/* 11. Deploy New Server & Script Generator Wizard Modal */}
      <DeployWizardModal
        isOpen={showDeployWizard}
        onClose={() => setShowDeployWizard(false)}
      />

      {/* 12. Global Command Palette Modal (Ctrl+K / Cmd+K) */}
      <CommandPaletteModal
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onOpenModal={(modal) => {
          if (modal === 'deploy') setShowDeployWizard(true);
          else if (modal === 'apikeys') setShowApiKeysModal(true);
          else if (modal === 'housekeeping') setShowHousekeeping(true);
          else if (modal === 'notifications') setShowNotificationLogs(true);
          else if (modal === 'profile') setShowProfileModal(true);
          else if (modal === 'wallboard') setShowNocWallboard(true);
        }}
        onSelectProject={(proj) => {
          setFilters((prev) => ({ ...prev, projectName: proj, page: 1 }));
          setActiveTab('telemetry');
          scrollToTable();
        }}
        onSelectServer={(srv) => {
          setFilters((prev) => ({ ...prev, serverId: srv, page: 1 }));
          setActiveTab('telemetry');
          scrollToTable();
        }}
        onToggleTimezone={toggleTimezone}
        onExportCsv={() => handleExport('csv')}
        onRefreshData={handleManualRefresh}
        projects={projectsList}
        servers={serversList}
      />

      {/* 13. Full-Screen NOC Operations Wallboard Modal (TV Display) */}
      <NocWallboardModal
        isOpen={showNocWallboard}
        onClose={() => setShowNocWallboard(false)}
        stats={stats}
        onSelectReport={(report) => setSelectedReport(report)}
      />

      {/* 14. Live Notification Center Drawer with Audio Alerts */}
      <NotificationCenterDrawer
        isOpen={showNotificationCenter}
        onClose={() => setShowNotificationCenter(false)}
        onSelectReport={(report) => setSelectedReport(report)}
        onOpenResolveModal={handleOpenResolveModal}
      />

      {/* 15. Delete Backup Confirmation Modal (Strictly Admin only) */}
      <DeleteBackupModal
        report={backupToDelete}
        isOpen={!!backupToDelete}
        onClose={() => setBackupToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Floating Action Toast */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-slate-900 border border-emerald-500/60 text-emerald-300 text-sm shadow-2xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{actionToast}</span>
          </div>
        </div>
      )}
    </div>
  );
};
