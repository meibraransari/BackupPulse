import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Clock,
  Zap,
  ShieldAlert,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Flame,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
} from 'lucide-react';
import { api } from '../services/api';
import { useTimezone } from '../context/TimezoneContext';
import { HourlyDistributionResponse, HourlyDistributionItem } from '../types';

interface BackupDistributionChartProps {
  projectName?: string;
  serverId?: string;
  onNavigateToTelemetry?: (filters?: { search?: string; status?: string }) => void;
}

export const BackupDistributionChart: React.FC<BackupDistributionChartProps> = ({
  projectName,
  serverId,
  onNavigateToTelemetry,
}) => {
  const { timezone } = useTimezone();
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h');
  const [data, setData] = useState<HourlyDistributionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<HourlyDistributionItem | null>(null);

  // Calculate browser offset in minutes:
  // When timezone mode is UTC, offset is 0. When LOCAL, offset is new Date().getTimezoneOffset().
  const timezoneOffset = timezone === 'UTC' ? 0 : new Date().getTimezoneOffset();

  const fetchDistribution = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getHourlyDistribution({
        period,
        timezoneOffset,
        projectName,
        serverId,
      });
      setData(res);
      // Default selected hour to peak hour if available
      if (res.distribution && res.distribution.length > 0) {
        const peak = res.distribution.find((d) => d.hour === res.peakHour.hour) || res.distribution[0];
        setSelectedHour(peak);
      }
    } catch (err: any) {
      console.error('Failed to load backup hourly distribution:', err);
      setError(err?.message || 'Failed to load distribution metrics');
    } finally {
      setLoading(false);
    }
  }, [period, timezoneOffset, projectName, serverId]);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  // Color helper based on load relative to peak
  const getBarColor = (item: HourlyDistributionItem, peakCount: number) => {
    if (item.count === 0) return '#1e293b'; // slate-800
    if (peakCount > 0 && item.count === peakCount) return '#f59e0b'; // Amber peak
    if (peakCount > 0 && item.count >= peakCount * 0.7) return '#fb923c'; // Orange high
    if (peakCount > 0 && item.count >= peakCount * 0.4) return '#38bdf8'; // Sky blue moderate
    return '#10b981'; // Emerald low/normal
  };

  const getCongestionBadge = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Flame className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
            <span>High Collision Risk</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>Moderate Clustering</span>
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Zap className="h-3.5 w-3.5 text-blue-400" />
            <span>Noticeable Activity</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            <span>Optimal Distribution</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Backup Arrival Time & Server Load Distribution
                </h3>
                {data && getCongestionBadge(data.congestionLevel)}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Analyzes cron execution hours across 24 hours to help balance server workload and avoid network congestion.
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Tabs & Refresh */}
        <div className="flex items-center space-x-3 self-start lg:self-center">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setPeriod('24h')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === '24h'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              24 Hours
            </button>
            <button
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === '7d'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Past Week (7D)
            </button>
            <button
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                period === '30d'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Past Month (30D)
            </button>
          </div>

          <button
            onClick={fetchDistribution}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh distribution data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Banner */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Peak Hour */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Peak Arrival Hour</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400">
                <Flame className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-amber-400 tracking-tight">
                {data.peakHour.label}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                ({data.peakHour.count} runs • {data.peakHour.percentage}%)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Window: {data.peakHour.timeWindow} ({timezone})
            </p>
          </div>

          {/* Recommended Quiet Window */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Quiet / Off-Peak Window</span>
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-emerald-400 tracking-tight">
                {data.quietWindow}
              </span>
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-1">
              Recommended slot for scheduling new cron jobs
            </p>
          </div>

          {/* Total & Hourly Average */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Total Backups Tracked</span>
              <span className="p-1 rounded bg-blue-500/10 text-blue-400">
                <Zap className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white tracking-tight">
                {data.totalBackups}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                (~{data.hourlyAverage}/hr avg)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Across all monitored production projects
            </p>
          </div>

          {/* Active Timezone Mode */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Timezone Context</span>
              <span className="p-1 rounded bg-cyan-500/10 text-cyan-400">
                <Clock className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-cyan-400 tracking-tight">
                {timezone === 'UTC' ? 'UTC (GMT+0)' : 'Local Time'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Switch in sidebar to toggle Local vs UTC
            </p>
          </div>
        </div>
      )}

      {/* 3. Bar Chart Area */}
      {loading ? (
        <div className="h-72 w-full flex flex-col items-center justify-center bg-slate-950/40 rounded-xl border border-slate-800/60 animate-pulse space-y-3">
          <RefreshCw className="h-8 w-8 text-amber-500 animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Computing 24-hour backup distribution across fleet...</p>
        </div>
      ) : error ? (
        <div className="h-64 w-full flex flex-col items-center justify-center bg-rose-950/20 rounded-xl border border-rose-900/40 text-rose-300 p-6 space-y-2">
          <AlertTriangle className="h-8 w-8 text-rose-400" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchDistribution}
            className="px-3 py-1.5 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
          >
            Retry Loading
          </button>
        </div>
      ) : data && data.distribution ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-amber-500 inline-block" />
                <span>Peak Load Hour</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-sky-400 inline-block" />
                <span>Active Backup Traffic</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="h-3 w-3 rounded bg-slate-800 inline-block" />
                <span>Quiet / Off-Peak (0-1 Runs)</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500">
              Hover over or click any hour bar for details
            </span>
          </div>

          <div className="h-64 w-full cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.distribution}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const item = e.activePayload[0].payload as HourlyDistributionItem;
                    setSelectedHour(item);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as HourlyDistributionItem;
                      const isPeak = item.count > 0 && item.count === data.peakHour.count;
                      return (
                        <div className="bg-slate-950 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-[210px] z-50">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="font-bold text-white flex items-center space-x-1.5">
                              <Clock className="h-3.5 w-3.5 text-amber-400" />
                              <span>{item.timeWindow}</span>
                            </span>
                            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                              {timezone}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between">
                            <span className="text-slate-400">Total Backups:</span>
                            <span className="font-extrabold text-white text-sm">{item.count}</span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                            <div className="flex items-center justify-between bg-emerald-950/30 px-2 py-1 rounded border border-emerald-900/40 text-emerald-300">
                              <span>Success:</span>
                              <span className="font-bold">{item.success}</span>
                            </div>
                            <div className="flex items-center justify-between bg-rose-950/30 px-2 py-1 rounded border border-rose-900/40 text-rose-300">
                              <span>Failed:</span>
                              <span className="font-bold">{item.failed}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                            <span>Protected Size:</span>
                            <span className="font-medium text-slate-200">{item.totalBytesHuman}</span>
                          </div>

                          {isPeak && (
                            <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center space-x-1 text-[11px] text-amber-400 font-semibold">
                              <Flame className="h-3.5 w-3.5 text-amber-400" />
                              <span>Highest Server Load of Day</span>
                            </div>
                          )}
                          {item.count === 0 && (
                            <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center space-x-1 text-[11px] text-emerald-400">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span>Ideal Staggering Window</span>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={800}
                >
                  {data.distribution.map((entry) => (
                    <Cell
                      key={`cell-${entry.hour}`}
                      fill={getBarColor(entry, data.peakHour.count)}
                      className="transition-all hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* 4. Actionable DevOps Guidance & Load Balancing Recommendations */}
      {data && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                DevOps Scheduling Recommendation
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 max-w-3xl leading-relaxed">
                {data.loadAdvice}
              </p>
            </div>
          </div>

          {onNavigateToTelemetry && (
            <button
              onClick={() => onNavigateToTelemetry()}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-slate-800 shrink-0 transition-colors group"
            >
              <span>Explore Telemetry Records</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
