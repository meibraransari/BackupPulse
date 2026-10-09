import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Filter,
  X,
  Loader2,
  ChevronRight,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import { SlaHeatmapDayItem, SlaHeatmapResponse } from '../types';

interface SlaHeatmapProps {
  onSelectDate: (date: string) => void;
  selectedDate?: string;
  projectName?: string;
  serverId?: string;
}

export const SlaHeatmap: React.FC<SlaHeatmapProps> = ({
  onSelectDate,
  selectedDate,
  projectName,
  serverId,
}) => {
  const [daysRange, setDaysRange] = useState<30 | 90 | 365>(365);
  const [data, setData] = useState<SlaHeatmapResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoveredDay, setHoveredDay] = useState<SlaHeatmapDayItem | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .getSlaHeatmap(daysRange, projectName, serverId)
      .then((res) => {
        if (isMounted) {
          setData(res);
        }
      })
      .catch((err) => {
        console.error('Failed to load SLA heatmap data:', err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [daysRange, projectName, serverId]);

  // Group days into 7 rows (Sunday=0 to Saturday=6) across week columns
  const { weeks, monthLabels } = useMemo(() => {
    const rawItems = data?.heatmap || data?.days || [];
    if (!rawItems || rawItems.length === 0) {
      return { weeks: [], monthLabels: [] };
    }

    const items = rawItems.map((dayItem) => {
      const d = new Date(dayItem.date + 'T00:00:00Z');
      const dayOfWeek = typeof dayItem.dayOfWeek === 'number' ? dayItem.dayOfWeek : d.getUTCDay();
      const slaPercent = typeof dayItem.slaPercent === 'number' ? dayItem.slaPercent : (dayItem.successRate ?? 100);
      return {
        ...dayItem,
        dayOfWeek,
        slaPercent,
      };
    });

    const weekCols: (SlaHeatmapDayItem | null)[][] = [];
    const months: { label: string; weekIndex: number }[] = [];

    let currentWeek: (SlaHeatmapDayItem | null)[] = [];
    let lastMonth = '';

    // Pad first week if starting day is not Sunday (dayOfWeek 0)
    const firstDay = items[0];
    for (let i = 0; i < (firstDay.dayOfWeek ?? 0); i++) {
      currentWeek.push(null);
    }

    items.forEach((dayItem) => {
      currentWeek.push(dayItem);

      // Track month transitions
      const monthName = new Date(dayItem.date + 'T00:00:00Z').toLocaleString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      });
      if (monthName !== lastMonth) {
        months.push({ label: monthName, weekIndex: weekCols.length });
        lastMonth = monthName;
      }

      // If week is full (7 days), push to columns and start new week
      if (currentWeek.length === 7) {
        weekCols.push(currentWeek);
        currentWeek = [];
      }
    });

    // Push trailing week if any
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weekCols.push(currentWeek);
    }

    return { weeks: weekCols, monthLabels: months };
  }, [data]);

  const getSquareColor = (day: SlaHeatmapDayItem | null) => {
    if (!day) return 'bg-transparent border-transparent pointer-events-none';
    if (day.total === 0 || day.status === 'EMPTY' || day.status === 'NO_RUNS') {
      return 'bg-slate-900/80 border-slate-800/80 text-slate-600 hover:border-slate-700';
    }
    if (day.failed > 0 || day.status === 'FAILED' || day.status === 'CRITICAL_FAILED') {
      if (day.success > 0 || day.status === 'PARTIAL') {
        return 'bg-amber-500 border-amber-400 hover:bg-amber-400 text-white shadow-sm shadow-amber-950';
      }
      return 'bg-red-500 border-red-400 hover:bg-red-400 text-white shadow-sm shadow-red-950';
    }
    if (day.warning > 0 || day.status === 'WARNING' || day.status === 'PARTIAL') {
      return 'bg-amber-500 border-amber-400 hover:bg-amber-400 text-white shadow-sm shadow-amber-950';
    }
    return 'bg-emerald-500 border-emerald-400 hover:bg-emerald-400 text-white shadow-sm shadow-emerald-950';
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00Z');
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      return dateStr;
    }
  };

  const metrics = useMemo(() => {
    if (!data) return null;
    if (data.metrics) return data.metrics;
    if (data.summary) {
      const s = data.summary;
      return {
        overallSlaPercent: s.overallSla ?? 100,
        totalRuns: s.totalBackups ?? 0,
        perfectDays: s.perfectDays ?? 0,
        totalFailed: s.failedDays ?? 0,
        daysWithRuns: (s.daysTracked ?? 0) - (s.inactiveDays ?? 0),
      };
    }
    return null;
  }, [data]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 transition-all">
      {/* Header with Title, Range Switcher, & SLA Metric Pills */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Backup SLA Reliability Matrix & Calendar Heatmap
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700 font-mono">
                  {daysRange} Days
                </span>
              </div>
              <p className="text-xs text-slate-400">
                GitHub-style historical consistency view. Click any date square to filter telemetry logs below.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Range Selectors */}
        <div className="flex items-center space-x-2 self-start lg:self-auto">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDaysRange(30)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                daysRange === 30
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDaysRange(90)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                daysRange === 90
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              90 Days
            </button>
            <button
              onClick={() => setDaysRange(365)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                daysRange === 365
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              365 Days (1 Year)
            </button>
          </div>
        </div>
      </div>

      {/* SLA Executive Metric Badges */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block">Overall Fleet SLA</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span
                className={`text-lg font-bold font-mono ${
                  metrics.overallSlaPercent >= 99
                    ? 'text-emerald-400'
                    : metrics.overallSlaPercent >= 90
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {metrics.overallSlaPercent}%
              </span>
              <span className="text-[10px] text-slate-500">uptime</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block">Total Ingested Runs</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold font-mono text-white">
                {metrics.totalRuns.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500">backups</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block">100% Perfect Days</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-bold font-mono text-emerald-400">
                {metrics.perfectDays}
              </span>
              <span className="text-[10px] text-slate-500">/ {metrics.daysWithRuns} active</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] font-medium text-slate-400 block">Failed Run Incidents</span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span
                className={`text-lg font-bold font-mono ${
                  metrics.totalFailed > 0 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {metrics.totalFailed}
              </span>
              <span className="text-[10px] text-slate-500">unresolved</span>
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Grid Visual */}
      <div className="relative">
        {loading ? (
          <div className="h-36 flex flex-col items-center justify-center space-y-2 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
            <span className="text-xs">Generating SLA reliability matrix...</span>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
            <div className="inline-flex flex-col min-w-full">
              {/* Month Labels Row */}
              <div className="flex text-[10px] text-slate-500 font-mono mb-1.5 pl-7">
                {weeks.map((_, colIdx) => {
                  const m = monthLabels.find((m) => m.weekIndex === colIdx);
                  return (
                    <div key={`month-${colIdx}`} className="w-3.5 mr-1 text-left truncate">
                      {m ? m.label : ''}
                    </div>
                  );
                })}
              </div>

              {/* Grid: 7 Rows (Sun to Sat) x Week Columns */}
              <div className="flex">
                {/* Day of Week Labels (Sun, Tue, Thu, Sat) */}
                <div className="flex flex-col justify-between text-[9px] font-mono text-slate-500 pr-2 py-0.5 select-none">
                  <span className="h-3 leading-3">Sun</span>
                  <span className="h-3 leading-3 opacity-0">Mon</span>
                  <span className="h-3 leading-3">Tue</span>
                  <span className="h-3 leading-3 opacity-0">Wed</span>
                  <span className="h-3 leading-3">Thu</span>
                  <span className="h-3 leading-3 opacity-0">Fri</span>
                  <span className="h-3 leading-3">Sat</span>
                </div>

                {/* Week Columns */}
                <div className="flex space-x-1">
                  {weeks.map((week, weekIdx) => (
                    <div key={`week-${weekIdx}`} className="flex flex-col space-y-1">
                      {week.map((day, dayIdx) => {
                        const isSelected = selectedDate && day?.date === selectedDate;
                        return (
                          <button
                            key={`day-${weekIdx}-${dayIdx}`}
                            disabled={!day}
                            onClick={() => {
                              if (day) {
                                onSelectDate(day.date);
                              }
                            }}
                            onMouseEnter={() => day && setHoveredDay(day)}
                            onMouseLeave={() => setHoveredDay(null)}
                            title={
                              day
                                ? `${formatDateLabel(day.date)}: ${day.total} runs (${day.success} pass, ${day.failed} fail) - ${day.slaPercent}% SLA`
                                : undefined
                            }
                            className={`w-3 h-3 rounded-[3px] border transition-all cursor-pointer ${getSquareColor(
                              day
                            )} ${
                              isSelected
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10 scale-125'
                                : 'hover:scale-125 hover:z-10'
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Hover / Selection Detail Banner */}
      <div className="min-h-[38px] p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        {hoveredDay ? (
          <div className="flex items-center space-x-3 font-mono">
            <span className="font-semibold text-white">{formatDateLabel(hoveredDay.date)}</span>
            <span className="text-slate-400">
              Total: <strong className="text-white">{hoveredDay.total}</strong>
            </span>
            <span className="text-emerald-400">
              Passed: <strong>{hoveredDay.success}</strong>
            </span>
            {hoveredDay.failed > 0 && (
              <span className="text-red-400 font-bold">
                Failed: <strong>{hoveredDay.failed}</strong>
              </span>
            )}
            {hoveredDay.warning > 0 && (
              <span className="text-amber-400">
                Warning: <strong>{hoveredDay.warning}</strong>
              </span>
            )}
            <span
              className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                hoveredDay.slaPercent === 100
                  ? 'bg-emerald-950 text-emerald-300'
                  : hoveredDay.slaPercent > 0
                  ? 'bg-amber-950 text-amber-300'
                  : 'bg-red-950 text-red-300'
              }`}
            >
              SLA {hoveredDay.slaPercent}%
            </span>
            <span className="text-[10px] text-slate-500 italic hidden sm:inline">
              (Click to filter table)
            </span>
          </div>
        ) : selectedDate ? (
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-slate-300">
              Filtering table to: <strong className="text-emerald-400 font-mono">{selectedDate}</strong>
            </span>
            <button
              onClick={() => onSelectDate('')}
              className="ml-2 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center space-x-1 text-[11px] transition-colors"
            >
              <X className="h-3 w-3" />
              <span>Clear Filter</span>
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>Hover over any calendar cell to view run details, or click to isolate logs for that day.</span>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono ml-auto">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-900 border border-slate-800" title="No backup runs" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 border border-emerald-400" title="100% Passed" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500 border border-amber-400" title="Warning or Partial" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-red-500 border border-red-400" title="Failure" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
