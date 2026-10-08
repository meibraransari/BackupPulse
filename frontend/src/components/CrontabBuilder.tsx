import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Sparkles,
  Calendar,
  Check,
  Copy,
  Info,
  ChevronRight,
  HelpCircle,
  Terminal,
  Zap,
} from 'lucide-react';

export interface CrontabBuilderProps {
  value: string;
  onChange: (cron: string) => void;
  scriptPath: string;
}

// ==============================================================================
// Cron Syntax Parsing & Explanation Helpers
// ==============================================================================

export function explainCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Invalid cron expression (must contain exactly 5 space-separated fields)';
  }

  const [min, hr, dom, mon, dow] = parts;

  // Well-known exact combinations
  if (cron === '59 23 * * *') return 'At 23:59 (11:59 PM) every day';
  if (cron === '0 2 * * *') return 'At 02:00 (02:00 AM) every day';
  if (cron === '30 4 * * *') return 'At 04:30 (04:30 AM) every day';
  if (cron === '0 0 * * *') return 'At 00:00 (midnight) every day';
  if (cron === '0 * * * *') return 'At the start of every hour';
  if (cron === '*/15 * * * *') return 'Every 15 minutes';
  if (cron === '*/30 * * * *') return 'Every 30 minutes';
  if (cron === '0 */2 * * *') return 'At minute 0 past every 2nd hour';
  if (cron === '0 */4 * * *') return 'At minute 0 past every 4th hour';
  if (cron === '0 */6 * * *') return 'At minute 0 past every 6th hour';
  if (cron === '0 */12 * * *') return 'At minute 0 past every 12th hour';
  if (cron === '0 0 * * 0') return 'At 00:00 (midnight) on Sunday';
  if (cron === '0 2 * * 0') return 'At 02:00 AM on Sunday';
  if (cron === '0 0 * * 1-5') return 'At 00:00 on every weekday (Monday through Friday)';
  if (cron === '0 2 * * 1-5') return 'At 02:00 AM on every weekday (Monday through Friday)';
  if (cron === '0 0 1 * *') return 'At 00:00 on day 1 of every month';
  if (cron === '0 2 1 * *') return 'At 02:00 AM on day 1 of every month';

  // Dynamic sentence generation
  let timeStr = '';
  if (min === '*' && hr === '*') {
    timeStr = 'Every minute';
  } else if (min.startsWith('*/') && hr === '*') {
    timeStr = `Every ${min.slice(2)} minutes`;
  } else if (hr.startsWith('*/') && min !== '*') {
    timeStr = `At minute ${min} past every ${hr.slice(2)}th hour`;
  } else if (min !== '*' && hr === '*') {
    timeStr = `At minute ${min} of every hour`;
  } else if (min !== '*' && hr !== '*') {
    const isNumHr = !isNaN(Number(hr));
    const isNumMin = !isNaN(Number(min));
    if (isNumHr && isNumMin) {
      const h = Number(hr);
      const m = Number(min);
      const h24 = String(h).padStart(2, '0');
      const m24 = String(m).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      timeStr = `At ${h24}:${m24} (${h12}:${m24} ${ampm})`;
    } else {
      timeStr = `At minute ${min}, hour ${hr}`;
    }
  } else {
    timeStr = `At minute ${min}, hour ${hr}`;
  }

  // Day of month
  let domStr = '';
  if (dom !== '*') {
    domStr = ` on day ${dom} of the month`;
  }

  // Month
  let monStr = '';
  if (mon !== '*') {
    const monthNames = [
      '',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const mNum = Number(mon);
    monStr = monthNames[mNum] ? ` in ${monthNames[mNum]}` : ` in month ${mon}`;
  }

  // Day of week
  let dowStr = '';
  if (dow !== '*') {
    if (dow === '1-5') {
      dowStr = ' from Monday through Friday';
    } else if (dow === '0,6' || dow === '6,0') {
      dowStr = ' on Saturday and Sunday (weekends)';
    } else {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dNum = Number(dow);
      dowStr = dayNames[dNum] ? ` on ${dayNames[dNum]}` : ` on day-of-week ${dow}`;
    }
  }

  if (!domStr && !monStr && !dowStr) {
    if (!timeStr.includes('every')) {
      timeStr += ' every day';
    }
  }

  return `${timeStr}${domStr}${monStr}${dowStr}`;
}

// Calculation of next upcoming run timestamps
function matchesField(val: number, expr: string, offset: number = 0): boolean {
  if (expr === '*') return true;
  if (expr.startsWith('*/')) {
    const step = parseInt(expr.slice(2), 10);
    return !isNaN(step) && step > 0 && (val - offset) % step === 0;
  }
  if (expr.includes('-')) {
    const [start, end] = expr.split('-').map((x) => parseInt(x, 10));
    return val >= start && val <= end;
  }
  if (expr.includes(',')) {
    const items = expr.split(',').map((x) => parseInt(x, 10));
    return items.includes(val);
  }
  const num = parseInt(expr, 10);
  return val === num;
}

function matchesCron(d: Date, parts: string[]): boolean {
  if (parts.length !== 5) return false;
  const min = d.getMinutes();
  const hr = d.getHours();
  const dom = d.getDate();
  const mon = d.getMonth() + 1;
  const dow = d.getDay();

  if (!matchesField(min, parts[0], 0)) return false;
  if (!matchesField(hr, parts[1], 0)) return false;
  if (!matchesField(dom, parts[2], 1)) return false;
  if (!matchesField(mon, parts[3], 1)) return false;
  if (parts[4] === '7' && dow === 0) return true;
  if (!matchesField(dow, parts[4], 0)) return false;

  return true;
}

export function getNextCronRuns(cron: string, count: number = 3): Date[] {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return [];

  const results: Date[] = [];
  const now = new Date();
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);

  const maxIterations = 50400; // up to 35 days in minutes
  let iterations = 0;

  while (results.length < count && iterations < maxIterations) {
    if (matchesCron(current, parts)) {
      results.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + 1);
    iterations++;
  }

  return results;
}

// ==============================================================================
// Crontab Guru Builder Component
// ==============================================================================

const CRON_PRESETS = [
  { label: 'Daily (23:59)', cron: '59 23 * * *', desc: 'Late night backup' },
  { label: 'Daily (02:00 AM)', cron: '0 2 * * *', desc: 'Standard off-peak' },
  { label: 'Daily (04:30 AM)', cron: '30 4 * * *', desc: 'Early morning run' },
  { label: 'Every 6 Hours', cron: '0 */6 * * *', desc: '4 times daily' },
  { label: 'Every 2 Hours', cron: '0 */2 * * *', desc: 'Frequent snapshots' },
  { label: 'Every 1 Hour', cron: '0 * * * *', desc: 'Hourly run' },
  { label: 'Weekdays Midnight', cron: '0 0 * * 1-5', desc: 'Mon to Fri only' },
  { label: 'Weekly (Sun 02:00)', cron: '0 2 * * 0', desc: 'Weekly full backup' },
  { label: 'Monthly (1st at 02:00)', cron: '0 2 1 * *', desc: 'Monthly archive' },
];

export const CrontabBuilder: React.FC<CrontabBuilderProps> = ({ value, onChange, scriptPath }) => {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'interval' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Time picker state for daily / weekly / monthly
  const [pickedHour, setPickedHour] = useState<number>(23);
  const [pickedMinute, setPickedMinute] = useState<number>(59);
  const [pickedDayOfWeek, setPickedDayOfWeek] = useState<string>('0');
  const [pickedDayOfMonth, setPickedDayOfMonth] = useState<number>(1);
  const [pickedIntervalHours, setPickedIntervalHours] = useState<number>(6);

  // Parse current 5 fields
  const fields = useMemo(() => {
    const raw = value.trim().split(/\s+/);
    if (raw.length === 5) return raw;
    return ['59', '23', '*', '*', '*'];
  }, [value]);

  // Sync visual time picker from incoming cron if standard daily/weekly/interval
  useEffect(() => {
    const parts = value.trim().split(/\s+/);
    if (parts.length === 5) {
      const minNum = parseInt(parts[0], 10);
      const hrNum = parseInt(parts[1], 10);
      if (!isNaN(minNum) && minNum >= 0 && minNum <= 59) {
        setPickedMinute(minNum);
      }
      if (!isNaN(hrNum) && hrNum >= 0 && hrNum <= 23) {
        setPickedHour(hrNum);
      }
      if (parts[1].startsWith('*/')) {
        const step = parseInt(parts[1].slice(2), 10);
        if (!isNaN(step)) setPickedIntervalHours(step);
      }
      if (parts[4] !== '*') {
        setPickedDayOfWeek(parts[4]);
      }
      if (parts[2] !== '*') {
        const d = parseInt(parts[2], 10);
        if (!isNaN(d)) setPickedDayOfMonth(d);
      }
    }
  }, [value]);

  const humanExplanation = useMemo(() => explainCron(value), [value]);
  const nextRuns = useMemo(() => getNextCronRuns(value, 3), [value]);

  // Update a single slot in the 5-field expression
  const updateSlot = (index: number, newVal: string) => {
    const newFields = [...fields];
    newFields[index] = newVal.trim() || '*';
    onChange(newFields.join(' '));
  };

  const handleApplyDaily = (h: number, m: number) => {
    setPickedHour(h);
    setPickedMinute(m);
    onChange(`${m} ${h} * * *`);
  };

  const handleApplyInterval = (stepHours: number, minOffset: number = 0) => {
    setPickedIntervalHours(stepHours);
    setPickedMinute(minOffset);
    if (stepHours === 1) {
      onChange(`${minOffset} * * * *`);
    } else {
      onChange(`${minOffset} */${stepHours} * * *`);
    }
  };

  const handleApplyWeekly = (day: string, h: number, m: number) => {
    setPickedDayOfWeek(day);
    setPickedHour(h);
    setPickedMinute(m);
    onChange(`${m} ${h} * * ${day}`);
  };

  const handleApplyMonthly = (dom: number, h: number, m: number) => {
    setPickedDayOfMonth(dom);
    setPickedHour(h);
    setPickedMinute(m);
    onChange(`${m} ${h} ${dom} * *`);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const crontabLine = `${value} bash ${scriptPath} >> /var/log/backuppulse_cron.log 2>&1`;
  const autoInstallCommand = `(crontab -l 2>/dev/null; echo "${crontabLine}") | crontab -`;

  // Information about each slot
  const slotMeta = [
    { name: 'minute', range: '0 - 59', quick: ['0', '15', '30', '45', '59', '*', '*/5', '*/15', '*/30'] },
    { name: 'hour', range: '0 - 23', quick: ['0', '2', '4', '12', '23', '*', '*/2', '*/4', '*/6', '*/12'] },
    { name: 'day (month)', range: '1 - 31', quick: ['*', '1', '15', '28'] },
    { name: 'month', range: '1 - 12', quick: ['*', '1', '6', '12'] },
    { name: 'day (week)', range: '0 - 6 (Sun=0)', quick: ['*', '1-5', '0', '6', '0,6'] },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Crontab.guru Style 5-Part Interactive Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center justify-between">
          <span className="flex items-center space-x-1.5 text-indigo-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Cron Slots (Click any slot to edit)</span>
          </span>
          <span className="text-slate-500 font-mono text-[10px]">standard 5-part crontab syntax</span>
        </div>

        {/* 5 Slots Row */}
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {fields.map((fieldVal, idx) => {
            const isSelected = activeSlot === idx;
            return (
              <div
                key={idx}
                onClick={() => setActiveSlot(isSelected ? null : idx)}
                className={`cursor-pointer p-2.5 sm:p-3 rounded-xl border text-center transition-all ${
                  isSelected
                    ? 'bg-indigo-950/80 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[1.02]'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="text-lg sm:text-2xl font-bold font-mono text-white tracking-wider">
                  {fieldVal}
                </div>
                <div className="text-[10px] sm:text-xs font-semibold text-slate-300 mt-0.5 truncate capitalize">
                  {slotMeta[idx].name}
                </div>
                <div className="text-[9px] text-slate-500 font-mono">{slotMeta[idx].range}</div>
              </div>
            );
          })}
        </div>

        {/* Slot Quick Options Drawer if slot is active */}
        {activeSlot !== null && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-indigo-500/40 animate-in fade-in space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-indigo-300 font-semibold capitalize">
                Editing: {slotMeta[activeSlot].name} ({slotMeta[activeSlot].range})
              </span>
              <button
                type="button"
                onClick={() => setActiveSlot(null)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] text-slate-500 mr-1">Quick Values:</span>
              {slotMeta[activeSlot].quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => updateSlot(activeSlot, q)}
                  className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                    fields[activeSlot] === q
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {q}
                </button>
              ))}
              <div className="flex items-center space-x-1.5 ml-auto">
                <span className="text-[10px] text-slate-500">Custom:</span>
                <input
                  type="text"
                  value={fields[activeSlot]}
                  onChange={(e) => updateSlot(activeSlot, e.target.value)}
                  className="w-16 px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono text-center focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 2. Iconic crontab.guru Human-Readable Explanation Banner */}
        <div className="mt-3 p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-950 border border-indigo-500/30 flex items-start space-x-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-300">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
              Human-Readable Schedule
            </div>
            <div className="text-sm font-bold text-white mt-0.5 tracking-tight">
              “{humanExplanation}”
            </div>
          </div>
        </div>
      </div>

      {/* 3. Schedule Mode Tabs & Time Picker */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-4">
        {/* Mode Buttons */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('daily');
              handleApplyDaily(pickedHour, pickedMinute);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'daily' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Daily Time
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('interval');
              handleApplyInterval(pickedIntervalHours, 0);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'interval' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Intervals / Hourly
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('weekly');
              handleApplyWeekly(pickedDayOfWeek, pickedHour, pickedMinute);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'weekly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('monthly');
              handleApplyMonthly(pickedDayOfMonth, pickedHour, pickedMinute);
            }}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'monthly' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
              activeTab === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Direct Raw Expression
          </button>
        </div>

        {/* Tab 1: Daily Time Picker */}
        {activeTab === 'daily' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs text-slate-300 font-semibold flex items-center justify-between">
              <span>Choose Daily Execution Time</span>
              <span className="text-indigo-400 font-mono text-xs">
                {String(pickedHour).padStart(2, '0')}:{String(pickedMinute).padStart(2, '0')}{' '}
                ({pickedHour % 12 || 12}:{String(pickedMinute).padStart(2, '0')} {pickedHour >= 12 ? 'PM' : 'AM'})
              </span>
            </div>

            {/* Quick Time Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '23:59 (Late Night)', h: 23, m: 59 },
                { label: '02:00 AM (Off-peak)', h: 2, m: 0 },
                { label: '04:30 AM (Morning)', h: 4, m: 30 },
                { label: '12:00 PM (Noon)', h: 12, m: 0 },
              ].map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => handleApplyDaily(t.h, t.m)}
                  className={`p-2 rounded-xl border text-xs text-left transition-all ${
                    pickedHour === t.h && pickedMinute === t.m
                      ? 'bg-indigo-950 border-indigo-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Custom Hour / Minute Pickers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Hour (00 - 23)</label>
                <select
                  value={pickedHour}
                  onChange={(e) => handleApplyDaily(Number(e.target.value), pickedMinute)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 ({i % 12 || 12}:00 {i >= 12 ? 'PM' : 'AM'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Minute (00 - 59)</label>
                <select
                  value={pickedMinute}
                  onChange={(e) => handleApplyDaily(pickedHour, Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 59].map((m) => (
                    <option key={m} value={m}>
                      :{String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Interval / Hourly */}
        {activeTab === 'interval' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs text-slate-300 font-semibold">Choose Recurring Interval</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Every 15 Minutes', cron: '*/15 * * * *' },
                { label: 'Every 30 Minutes', cron: '*/30 * * * *' },
                { label: 'Every 1 Hour', cron: '0 * * * *' },
                { label: 'Every 2 Hours', cron: '0 */2 * * *' },
                { label: 'Every 4 Hours', cron: '0 */4 * * *' },
                { label: 'Every 6 Hours', cron: '0 */6 * * *' },
                { label: 'Every 8 Hours', cron: '0 */8 * * *' },
                { label: 'Every 12 Hours', cron: '0 */12 * * *' },
              ].map((int) => (
                <button
                  key={int.label}
                  type="button"
                  onClick={() => onChange(int.cron)}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                    value === int.cron
                      ? 'bg-indigo-950 border-indigo-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{int.label}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{int.cron}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Weekly */}
        {activeTab === 'weekly' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs text-slate-300 font-semibold">Select Day of Week & Time</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Sunday', val: '0' },
                { label: 'Monday', val: '1' },
                { label: 'Saturday', val: '6' },
                { label: 'Weekdays (Mon-Fri)', val: '1-5' },
              ].map((d) => (
                <button
                  key={d.val}
                  type="button"
                  onClick={() => handleApplyWeekly(d.val, pickedHour, pickedMinute)}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                    pickedDayOfWeek === d.val
                      ? 'bg-indigo-950 border-indigo-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{d.label}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Hour of Day</label>
                <select
                  value={pickedHour}
                  onChange={(e) => handleApplyWeekly(pickedDayOfWeek, Number(e.target.value), pickedMinute)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 ({i % 12 || 12}:00 {i >= 12 ? 'PM' : 'AM'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Minute</label>
                <select
                  value={pickedMinute}
                  onChange={(e) => handleApplyWeekly(pickedDayOfWeek, pickedHour, Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  {[0, 15, 30, 45, 59].map((m) => (
                    <option key={m} value={m}>
                      :{String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Monthly */}
        {activeTab === 'monthly' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs text-slate-300 font-semibold">Select Day of Month & Time</div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '1st of the month', val: 1 },
                { label: '15th of the month', val: 15 },
                { label: '28th of the month', val: 28 },
              ].map((d) => (
                <button
                  key={d.val}
                  type="button"
                  onClick={() => handleApplyMonthly(d.val, pickedHour, pickedMinute)}
                  className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                    pickedDayOfMonth === d.val
                      ? 'bg-indigo-950 border-indigo-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold">{d.label}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Hour of Day</label>
                <select
                  value={pickedHour}
                  onChange={(e) => handleApplyMonthly(pickedDayOfMonth, Number(e.target.value), pickedMinute)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}:00 ({i % 12 || 12}:00 {i >= 12 ? 'PM' : 'AM'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Minute</label>
                <select
                  value={pickedMinute}
                  onChange={(e) => handleApplyMonthly(pickedDayOfMonth, pickedHour, Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                >
                  {[0, 15, 30, 45, 59].map((m) => (
                    <option key={m} value={m}>
                      :{String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Direct Raw Expression */}
        {activeTab === 'custom' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="text-xs text-slate-300 font-semibold">Direct Crontab Expression</div>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="59 23 * * *"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 tracking-wider"
            />
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Crontab Special Operators:</div>
              <div><code className="text-indigo-400 font-bold">*</code> — any value (wildcard)</div>
              <div><code className="text-indigo-400 font-bold">,</code> — value list separator (e.g. <code>1,15,30</code>)</div>
              <div><code className="text-indigo-400 font-bold">-</code> — range of values (e.g. <code>1-5</code> for Mon to Fri)</div>
              <div><code className="text-indigo-400 font-bold">/</code> — step values (e.g. <code>*/6</code> for every 6 hours)</div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Quick Presets Bar */}
      <div>
        <label className="block text-[11px] text-slate-400 font-semibold mb-1.5">
          1-Click Popular Presets
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CRON_PRESETS.map((p) => (
            <button
              key={p.cron}
              type="button"
              onClick={() => onChange(p.cron)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                value === p.cron
                  ? 'bg-purple-950/80 border-purple-500 text-white font-bold shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{p.label}</span>
              <span className="text-[10px] text-slate-500 ml-1.5">({p.cron})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Next Execution Times Preview */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <div className="text-[11px] font-semibold text-slate-300 flex items-center space-x-1.5">
          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          <span>Upcoming Next 3 Executions (Simulated Local Time):</span>
        </div>
        {nextRuns.length > 0 ? (
          <div className="space-y-1 font-mono text-xs">
            {nextRuns.map((r, i) => (
              <div key={i} className="flex items-center space-x-2 text-slate-300">
                <span className="text-slate-500 text-[10px]">Run {i + 1}:</span>
                <span className="text-emerald-400 font-semibold">
                  {r.toLocaleDateString(undefined, {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  at{' '}
                  {r.toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Could not calculate next runs (check expression)</div>
        )}
      </div>

      {/* 6. Formatted Crontab Line & Auto-Install Command */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
          <span>Ready-to-Paste Crontab Entry (for crontab -e):</span>
          <button
            type="button"
            onClick={() => copyToClipboard(crontabLine, 'crontabLine')}
            className="flex items-center space-x-1 text-purple-400 hover:text-purple-300 transition-colors"
          >
            {copiedType === 'crontabLine' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied Entry!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Entry</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-purple-300 text-xs overflow-x-auto select-all font-mono">
          {crontabLine}
        </pre>

        {/* 1-Liner Shell Auto-Install Command */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold pt-1">
          <span className="flex items-center space-x-1">
            <Terminal className="h-3.5 w-3.5 text-cyan-400" />
            <span>1-Liner Server Command (Appends directly to crontab):</span>
          </span>
          <button
            type="button"
            onClick={() => copyToClipboard(autoInstallCommand, 'autoInstall')}
            className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {copiedType === 'autoInstall' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied 1-Liner!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy 1-Liner</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 text-xs overflow-x-auto select-all font-mono">
          {autoInstallCommand}
        </pre>
      </div>
    </div>
  );
};
