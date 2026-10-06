import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { StatCards } from '../components/StatCards';
import { TrendChart } from '../components/TrendChart';
import { FilterBar } from '../components/FilterBar';
import { BackupTable } from '../components/BackupTable';
import { DetailModal } from '../components/DetailModal';
import { api } from '../services/api';
import { BackupFilters, BackupReport, DashboardStats, ProjectBreakdown, TrendItem, User } from '../types';
import { RefreshCw } from 'lucide-react';

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

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      <Navbar user={user} onLogout={onLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Production Backup Overview</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Live status, cron logs, and automated cloud sync reports across 100+ servers.
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

        {/* 1. Metric Cards */}
        <StatCards stats={stats} loading={loadingStats} />

        {/* 2. Visual Charts */}
        <TrendChart trends={trends} projects={projectBreakdown} loading={loadingStats} />

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

        {/* 4. Telemetry Records Table */}
        <BackupTable
          data={backups}
          loading={loadingBackups}
          pagination={pagination}
          onPageChange={handlePageChange}
          onSelectReport={(report) => setSelectedReport(report)}
        />
      </main>

      {/* 5. Detail Modal / Drawer */}
      <DetailModal report={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
};
