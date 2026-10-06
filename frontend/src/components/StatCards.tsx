import React from 'react';
import { CheckCircle2, AlertTriangle, HardDrive, Server, Activity, ShieldAlert } from 'lucide-react';
import { DashboardStats } from '../types';

interface StatCardsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export const StatCards: React.FC<StatCardsProps> = ({ stats, loading }) => {
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
      {/* Total Backups Today */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Backups (24h)</span>
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-white tracking-tight">{stats.total24h}</span>
          <span className="text-xs text-slate-500">All-time: {stats.totalAllTime}</span>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1">
          <span className="text-emerald-400 font-semibold">{stats.success24h} passed</span>
          <span>•</span>
          <span className="text-slate-400">{stats.activeServersCount} active hosts</span>
        </div>
      </div>

      {/* Success Rate */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Success Rate</span>
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className={`text-3xl font-extrabold tracking-tight ${successRateColor}`}>{stats.successRate}%</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
            Past 24h
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Target SLA: <span className="text-slate-300 font-medium">99.5%</span>
        </div>
      </div>

      {/* Failed Backups */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Failed Jobs</span>
          <div className={`p-2 rounded-xl ${stats.failed24h > 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className={`text-3xl font-extrabold tracking-tight ${stats.failed24h > 0 ? 'text-red-400' : 'text-white'}`}>
            {stats.failed24h}
          </span>
          {stats.failed24h > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-950/70 text-red-400 border border-red-800/50 font-semibold animate-pulse">
              Attention Needed
            </span>
          ) : (
            <span className="text-xs text-slate-500">Zero errors</span>
          )}
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {stats.failed24h > 0 ? 'Review failure logs below' : 'All cron scripts executed successfully'}
        </div>
      </div>

      {/* S3 Storage Consumed */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">S3 Vault Storage</span>
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
            <HardDrive className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-3xl font-extrabold text-white tracking-tight">{stats.totalStorageHuman}</span>
          <span className="text-xs text-slate-500">{stats.activeProjectsCount} Projects</span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Aggregated archive volume stored in S3
        </div>
      </div>
    </div>
  );
};
