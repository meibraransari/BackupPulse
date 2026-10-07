import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { StatCards } from '../components/StatCards';
import { TrendChart } from '../components/TrendChart';
import { FilterBar } from '../components/FilterBar';
import { BackupTable } from '../components/BackupTable';
import { DetailModal } from '../components/DetailModal';
import { ResolveModal } from '../components/ResolveModal';
import { FleetView } from '../components/FleetView';
import { NotificationLogsModal } from '../components/NotificationLogsModal';
import { HousekeepingModal } from '../components/HousekeepingModal';
import { api } from '../services/api';
import { BackupFilters, BackupReport, DashboardStats, ProjectBreakdown, TrendItem, User } from '../types';
import { RefreshCw, CheckCircle2, Server, Table } from 'lucide-react';

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
  startDate: '',
  endDate: '',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
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

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // View toggle & Modal states
  const [activeTab, setActiveTab] = useState<'telemetry' | 'fleet'>('telemetry');
  const [showNotificationLogs, setShowNotificationLogs] = useState<boolean>(false);
  const [showHousekeeping, setShowHousekeeping] = useState<boolean>(false);

  // Helper to smoothly scroll down to the data table
  const scrollToTable = () => {
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

  // Card click: filters by status and jumps smoothly down to table
  const handleCardClick = (status: string) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }));
    scrollToTable();
  };

  // Trend Chart bar click: filters by that date and jumps to table
  const handleDateClick = (date: string) => {
    setFilters((prev) => ({ ...prev, startDate: date, endDate: date, page: 1 }));
    scrollToTable();
  };

  // Top Projects list click: filters by that project and jumps to table
  const handleProjectClick = (projectName: string) => {
    setFilters((prev) => ({ ...prev, projectName, page: 1 }));
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Navbar
        user={user}
        onLogout={onLogout}
        onOpenNotificationLogs={() => setShowNotificationLogs(true)}
        onOpenHousekeeping={() => setShowHousekeeping(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Production Backup Overview</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Live status, cron logs, size anomaly guards, and automated cloud sync reports across 100+ servers.
            </p>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="self-start sm:self-auto flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {/* 1. Metric Cards (Clickable: Jumps and filters table) */}
        <StatCards stats={stats} loading={loadingStats} onSelectFilter={handleCardClick} />

        {/* 2. Visual Charts (Clickable: Jumps and filters by date / project) */}
        <TrendChart
          trends={trends}
          projects={projectBreakdown}
          loading={loadingStats}
          onSelectDate={handleDateClick}
          onSelectProject={handleProjectClick}
        />

        {/* Anchor section for smooth scroll jump */}
        <div id="telemetry-table-section" className="space-y-6 pt-2">
          {/* Main View Tabs Switcher: Telemetry Records vs Server Fleet */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2 bg-slate-900 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'telemetry'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table className="h-4 w-4" />
                <span>Backup Telemetry Records</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                  {pagination.total}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('fleet')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'fleet'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Server className="h-4 w-4" />
                <span>Server Fleet Inventory</span>
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                  100+
                </span>
              </button>
            </div>
          </div>

          {activeTab === 'telemetry' ? (
            <>
              {/* 3. Advanced Filtering Toolbar */}
              <FilterBar
                filters={filters}
                projects={projectsList}
                servers={serversList}
                onFilterChange={handleFilterChange}
                onReset={handleResetFilters}
                onExport={handleExport}
                exporting={exporting}
              />

              {/* 4. Telemetry Records Table (With professional resolve modal trigger) */}
              <BackupTable
                data={backups}
                loading={loadingBackups}
                pagination={pagination}
                onPageChange={handlePageChange}
                onSelectReport={(report) => setSelectedReport(report)}
                onMarkSuccess={handleOpenResolveModal}
              />
            </>
          ) : (
            /* 5. Server Fleet Inventory View */
            <FleetView
              onSelectServer={(serverId) => {
                setFilters((prev) => ({ ...prev, serverId, page: 1 }));
                setActiveTab('telemetry');
                scrollToTable();
              }}
            />
          )}
        </div>
      </main>

      {/* 5. Detail Modal / Drawer */}
      <DetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onMarkSuccess={handleOpenResolveModal}
      />

      {/* 6. Professional Incident Resolution Modal */}
      <ResolveModal
        report={resolvingReport}
        currentUser={user}
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
