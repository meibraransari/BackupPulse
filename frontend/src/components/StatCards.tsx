import React from 'react';
import { CheckCircle2, AlertTriangle, HardDrive, Activity, ArrowDownRight } from 'lucide-react';
import { DashboardStats } from '../types';

interface StatCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
  onSelectFilter?: (status: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, loading, onSelectFilter }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  const successRateColor =
    stats.successRate >= 95 ? 'text-emerald-400' : stats.successRate >= 85 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Backups (Clickable -> View All) */}
      <div
        onClick={() => onSelectFilter?.('ALL')}
        className="bg-slate-900 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/90 rounded-2xl p-5 relative overflow-hidden group transition-all duration-200 shadow-md cursor-pointer hover:shadow-blue-500/10 hover:shadow-xl hover:-translate-y-0.5"
        title="Click to view all backup records"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Backups (24h)</span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-500/20 transition-colors">
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-white tracking-tight">{stats.total24h}</span>
          <span className="text-xs text-slate-500">All-time: {stats.totalAllTime}</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>{stats.success24h} passed • {stats.activeServersCount} hosts</span>
          <span className="text-[10px] text-blue-400/80 group-hover:text-blue-300 flex items-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View table <ArrowDownRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>
      </div>

      {/* 2. Success Rate (Clickable -> Filter SUCCESS) */}
      <div
        onClick={() => onSelectFilter?.('SUCCESS')}
        className="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/90 rounded-2xl p-5 relative overflow-hidden group transition-all duration-200 shadow-md cursor-pointer hover:shadow-emerald-500/10 hover:shadow-xl hover:-translate-y-0.5"
        title="Click to view all SUCCESSFUL backups"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Success Rate</span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className={`text-3xl font-extrabold tracking-tight ${successRateColor}`}>{stats.successRate}%</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            Past 24h
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Target SLA: <span className="text-slate-300 font-medium">99.5%</span></span>
          <span className="text-[10px] text-emerald-400/80 group-hover:text-emerald-300 flex items-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            Filter passed <ArrowDownRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>
      </div>

      {/* 3. Failed Backups (Clickable -> Filter FAILED) */}
      <div
        onClick={() => onSelectFilter?.('FAILED')}
        className={`bg-slate-900 border ${
          stats.failed24h > 0 ? 'border-red-500/40 hover:border-red-500 bg-red-950/10' : 'border-slate-800 hover:border-slate-700'
        } hover:bg-slate-900/90 rounded-2xl p-5 relative overflow-hidden group transition-all duration-200 shadow-md cursor-pointer hover:shadow-red-500/10 hover:shadow-xl hover:-translate-y-0.5`}
        title="Click to jump directly to FAILED jobs"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Failed Jobs</span>
          <div className={`p-2 rounded-xl transition-colors ${stats.failed24h > 0 ? 'bg-red-500/20 text-red-400 group-hover:bg-red-500/30' : 'bg-slate-800 text-slate-400'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className={`text-3xl font-extrabold tracking-tight ${stats.failed24h > 0 ? 'text-red-400' : 'text-white'}`}>
            {stats.failed24h}
          </span>
          {stats.failed24h > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60 font-semibold animate-pulse">
              Attention Needed
            </span>
          ) : (
            <span className="text-xs text-slate-500">Zero errors</span>
          )}
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>{stats.failed24h > 0 ? 'Click to inspect & resolve' : 'All cron scripts executed ok'}</span>
          <span className="text-[10px] text-red-400 group-hover:text-red-300 flex items-center font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
            View failed <ArrowDownRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>
      </div>

      {/* 4. Total Fleet Storage Consumed (Clickable -> View Table) */}
      <div
        onClick={() => onSelectFilter?.('ALL')}
        className="bg-slate-900 border border-slate-800 hover:border-purple-500/60 hover:bg-slate-900/90 rounded-2xl p-5 relative overflow-hidden group transition-all duration-200 shadow-md cursor-pointer hover:shadow-purple-500/10 hover:shadow-xl hover:-translate-y-0.5"
        title="Click to view all storage records"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Fleet Storage</span>
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl group-hover:bg-purple-500/20 transition-colors">
            <HardDrive className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-white tracking-tight">{stats.totalStorageHuman}</span>
          <span className="text-xs text-slate-500">{stats.activeProjectsCount} Projects • {stats.activeServersCount} Hosts</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
          <span>Multi-cloud & local volume</span>
          <span className="text-[10px] text-purple-400/80 group-hover:text-purple-300 flex items-center font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View table <ArrowDownRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
};
