import React from 'react';
import { StatCards } from './StatCards';
import { BackupDistributionChart } from './BackupDistributionChart';
import { TrendChart } from './TrendChart';
import { SlaHeatmap } from './SlaHeatmap';
import { DashboardStats, TrendItem, ProjectBreakdown } from '../types';
import { ArrowRight, LayoutDashboard, ShieldCheck, Sparkles, Activity } from 'lucide-react';

interface DashboardOverviewProps {
  stats: DashboardStats | null;
  loadingStats: boolean;
  trends: TrendItem[];
  projectBreakdown: ProjectBreakdown[];
  onSelectFilter: (status: string) => void;
  onSelectDate: (date: string) => void;
  onSelectProject: (projectName: string) => void;
  onViewFleet: () => void;
  onNavigateToTelemetry: (filters?: {
    search?: string;
    status?: string;
    hour?: number;
    period?: '24h' | '7d' | '30d';
  }) => void;
  selectedDate?: string;
  projectName?: string;
  serverId?: string;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  loadingStats,
  trends,
  projectBreakdown,
  onSelectFilter,
  onSelectDate,
  onSelectProject,
  onViewFleet,
  onNavigateToTelemetry,
  selectedDate,
  projectName,
  serverId,
}) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Primary Metric KPI Cards */}
      <StatCards
        stats={stats}
        loading={loadingStats}
        onSelectFilter={onSelectFilter}
        onViewFleet={onViewFleet}
      />

      {/* 2. New 24-Hour / Week / Month Arrival Time & Server Load Distribution Chart */}
      <BackupDistributionChart
        projectName={projectName}
        serverId={serverId}
        onNavigateToTelemetry={onNavigateToTelemetry}
      />

      {/* 3. Daily Activity Trends & Project Volume Breakdown */}
      <TrendChart
        trends={trends}
        projects={projectBreakdown}
        loading={loadingStats}
        onSelectDate={onSelectDate}
        onSelectProject={onSelectProject}
      />

      {/* 4. 365-Day Backup SLA Contribution Heatmap & Calendar Matrix */}
      <SlaHeatmap
        onSelectDate={(date) => {
          if (date) {
            onSelectDate(date);
          } else {
            onNavigateToTelemetry();
          }
        }}
        selectedDate={selectedDate}
        projectName={projectName !== 'ALL' ? projectName : undefined}
        serverId={serverId !== 'ALL' ? serverId : undefined}
      />

      {/* 5. Quick Telemetry Navigation Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Need granular cron execution logs and audit details?</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Access full search, custom date filters, AWS S3 payload links, stdout/stderr logs, and resolve actions in Backup Telemetry.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigateToTelemetry()}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/50 transition-all shrink-0 select-none group"
        >
          <span>Open Backup Telemetry Records</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
