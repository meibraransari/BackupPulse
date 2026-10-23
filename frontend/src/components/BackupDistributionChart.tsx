import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Clock,
  Zap,
  CheckCircle,
  AlertTriangle,
  Flame,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../services/api';
import { useTimezone } from '../context/TimezoneContext';
import { HourlyDistributionResponse, HourlyDistributionItem } from '../types';

interface BackupDistributionChartProps {
  projectName?: string;
  serverId?: string;
  onNavigateToTelemetry?: (filters?: {
    search?: string;
    status?: string;
    hour?: number;
    period?: '24h' | '7d' | '30d';
  }) => void;
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

  // Calculate browser offset in minutes:
  // When timezone mode is UTC, offset is 0. When LOCAL, offset is new Date().getTimezoneOffset().
  const timezoneOffset = timezone === 'UTC' ? 0 : new Date().getTimezoneOffset();

  const handleNavigate = useCallback(
    (params?: { hour?: number; period?: '24h' | '7d' | '30d'; search?: string; status?: string }) => {
      if (onNavigateToTelemetry) {
        onNavigateToTelemetry(params);
      }
    },
    [onNavigateToTelemetry]
  );

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
              type="button"
              onClick={() => setPeriod('24h')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                period === '24h'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              24 Hours
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                period === '7d'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Past Week (7D)
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                period === '30d'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Past Month (30D)
            </button>
          </div>

          <button
            type="button"
            onClick={fetchDistribution}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh distribution data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Banner (All clickable to jump into Telemetry) */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Peak Hour Card (Clickable) */}
          <div
            onClick={() => handleNavigate({ hour: data.peakHour.hour, period })}
            className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/80 hover:bg-slate-950/90 transition-all cursor-pointer shadow-md hover:shadow-amber-500/10 hover:shadow-xl hover:-translate-y-0.5 select-none"
            title={`Click to view all ${data.peakHour.count} peak load hour records in Telemetry`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="group-hover:text-amber-300 transition-colors font-semibold">Peak Arrival Hour</span>
              <span className="p-1 rounded bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20">
                <Flame className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-amber-400 tracking-tight group-hover:scale-105 transition-transform origin-left">
                {data.peakHour.label}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                ({data.peakHour.count} runs • {data.peakHour.percentage}%)
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">
                Window: {data.peakHour.timeWindow} ({timezone})
              </span>
              <span className="text-amber-400 font-semibold flex items-center space-x-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <span>View records</span>
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </span>
            </div>
          </div>

          {/* Recommended Quiet Window (Clickable) */}
          <div
            onClick={() => {
              if (data.quietestHours && data.quietestHours.length > 0) {
                handleNavigate({ hour: data.quietestHours[0], period });
              } else {
                handleNavigate({ period });
              }
            }}
            className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/80 hover:bg-slate-950/90 transition-all cursor-pointer shadow-md hover:shadow-emerald-500/10 hover:shadow-xl hover:-translate-y-0.5 select-none"
            title="Click to inspect Quiet / Off-Peak window in Telemetry"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="group-hover:text-emerald-300 transition-colors font-semibold">Quiet / Off-Peak Window</span>
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                <CheckCircle className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-emerald-400 tracking-tight group-hover:scale-105 transition-transform origin-left">
                {data.quietWindow}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400/80">Recommended for scheduling</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <span>Inspect</span>
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </span>
            </div>
          </div>

          {/* Total & Hourly Average (Clickable) */}
          <div
            onClick={() => handleNavigate({ period })}
            className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 relative overflow-hidden group hover:border-blue-500/80 hover:bg-slate-950/90 transition-all cursor-pointer shadow-md hover:shadow-blue-500/10 hover:shadow-xl hover:-translate-y-0.5 select-none"
            title={`Click to view all ${data.totalBackups} records in Telemetry`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="group-hover:text-blue-300 transition-colors font-semibold">Total Backups Tracked</span>
              <span className="p-1 rounded bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                <Zap className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-black text-white tracking-tight group-hover:text-blue-300 transition-colors">
                {data.totalBackups}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                (~{data.hourlyAverage}/hr avg)
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">All monitored projects</span>
              <span className="text-blue-400 font-semibold flex items-center space-x-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                <span>View all</span>
                <ArrowRight className="h-3 w-3 ml-0.5" />
              </span>
            </div>
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
            type="button"
            onClick={fetchDistribution}
            className="px-3 py-1.5 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : data && data.distribution ? (
        <div className="space-y-4">
          {/* Interactive Legend with 1-click filter actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 px-1">
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Peak Load Hour Button */}
              <button
                type="button"
                onClick={() => handleNavigate({ hour: data.peakHour.hour, period })}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm group select-none"
                title={`Click to view all ${data.peakHour.count} Peak Load Hour records in Telemetry`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block animate-pulse shadow-sm shadow-amber-500/50" />
                <span>Peak Load Hour ({data.peakHour.label})</span>
                <ArrowRight className="h-3 w-3 ml-0.5 group-hover:translate-x-0.5 transition-transform opacity-70 group-hover:opacity-100" />
              </button>

              {/* 2. Active Backup Traffic Button */}
              <button
                type="button"
                onClick={() => handleNavigate({ period })}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm group select-none"
                title={`Click to view all Active Backup Traffic records in Telemetry (${data.totalBackups} runs)`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 inline-block shadow-sm shadow-sky-400/50" />
                <span>Active Backup Traffic ({data.totalBackups} runs)</span>
                <ArrowRight className="h-3 w-3 ml-0.5 group-hover:translate-x-0.5 transition-transform opacity-70 group-hover:opacity-100" />
              </button>

              {/* 3. Quiet / Off-Peak Button */}
              <button
                type="button"
                onClick={() => {
                  if (data.quietestHours && data.quietestHours.length > 0) {
                    handleNavigate({ hour: data.quietestHours[0], period });
                  } else {
                    handleNavigate({ period });
                  }
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm group select-none"
                title={`Click to inspect Quiet / Off-Peak window in Telemetry (${data.quietWindow})`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-slate-500 inline-block" />
                <span>Quiet / Off-Peak ({data.quietWindow})</span>
                <ArrowRight className="h-3 w-3 ml-0.5 group-hover:translate-x-0.5 transition-transform opacity-70 group-hover:opacity-100" />
              </button>
            </div>

            <span className="text-[11px] text-slate-400 font-medium">
              Click any bar, legend, or pill to drill down in Telemetry
            </span>
          </div>

          {/* Interactive Bar Chart */}
          <div className="h-64 w-full cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.distribution}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                onClick={(e: any) => {
                  if (!e) return;
                  if (e.activePayload && e.activePayload.length > 0) {
                    const item = e.activePayload[0].payload as HourlyDistributionItem;
                    if (item && typeof item.hour === 'number') {
                      handleNavigate({ hour: item.hour, period });
                      return;
                    }
                  }
                  if (typeof e.activeTooltipIndex === 'number' && data.distribution[e.activeTooltipIndex]) {
                    const item = data.distribution[e.activeTooltipIndex];
                    handleNavigate({ hour: item.hour, period });
                    return;
                  }
                  if (e.activeLabel) {
                    const item = data.distribution.find((d) => d.label === e.activeLabel);
                    if (item) {
                      handleNavigate({ hour: item.hour, period });
                    }
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
                  cursor={{ fill: 'rgba(255, 255, 255, 0.05)', pointerEvents: 'none' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload as HourlyDistributionItem;
                      const isPeak = item.count > 0 && item.count === data.peakHour.count;
                      return (
                        <div
                          className="bg-slate-950 border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-[220px] z-50 cursor-pointer"
                          onClick={() => handleNavigate({ hour: item.hour, period })}
                        >
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
                              <span>Highest Server Load Window</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigate({ hour: item.hour, period });
                            }}
                            className="w-full mt-2 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer select-none"
                          >
                            <span>Jump to Telemetry ({item.count} runs)</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  isAnimationActive={false}
                  cursor="pointer"
                  shape={(barProps: any) => {
                    const { x, y, width, height, payload } = barProps;
                    const fill = getBarColor(payload, data.peakHour.count);
                    const barHeight = Math.max(height || 0, payload.count > 0 ? 6 : 2);
                    const barY = Math.min(y || 0, 240 - barHeight);
                    return (
                      <g
                        className="cursor-pointer"
                        style={{ pointerEvents: 'all' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (payload && typeof payload.hour === 'number') {
                            handleNavigate({ hour: payload.hour, period });
                          }
                        }}
                      >
                        <rect
                          x={x}
                          y={barY}
                          width={width}
                          height={barHeight}
                          fill={fill}
                          rx={4}
                          ry={4}
                          cursor="pointer"
                          className="transition-all hover:opacity-75"
                        />
                      </g>
                    );
                  }}
                  onClick={(entryData: any) => {
                    const h = entryData?.hour ?? entryData?.payload?.hour;
                    if (typeof h === 'number') {
                      handleNavigate({ hour: h, period });
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick-Select Pills for every hour with backup runs */}
          {data.distribution && data.distribution.some((d) => d.count > 0) && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center space-x-1 mr-1">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
                <span>Jump to Hour:</span>
              </span>
              {data.distribution
                .filter((d) => d.count > 0)
                .map((d) => {
                  const isPeak = d.hour === data.peakHour.hour;
                  return (
                    <button
                      key={d.hour}
                      type="button"
                      onClick={() => handleNavigate({ hour: d.hour, period })}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-sm select-none ${
                        isPeak
                          ? 'bg-amber-500/25 text-amber-300 hover:bg-amber-500/35 border border-amber-500/60 shadow-amber-500/10'
                          : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600'
                      }`}
                      title={`Click to view ${d.count} backups from ${d.timeWindow} in Telemetry`}
                    >
                      {isPeak && <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />}
                      <span>{d.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                          isPeak
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {d.count}
                      </span>
                      <ArrowRight className="h-3 w-3 opacity-60" />
                    </button>
                  );
                })}
            </div>
          )}
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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {data.peakHour.count > 0 && (
              <button
                type="button"
                onClick={() => handleNavigate({ hour: data.peakHour.hour, period })}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-xs font-bold text-amber-300 hover:text-white border border-amber-500/40 transition-all shadow-md group select-none cursor-pointer"
                title={`View ${data.peakHour.count} peak load hour backup records in Telemetry`}
              >
                <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                <span>Peak Hour ({data.peakHour.label})</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNavigate({ period })}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-slate-800 transition-colors group cursor-pointer"
            >
              <span>Explore Telemetry Records</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
