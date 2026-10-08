import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X, RotateCcw } from 'lucide-react';

interface CustomDatePickerProps {
  label: string;
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  compareDate?: string; // Other end of range to highlight interval
  isStartDate?: boolean;
  align?: 'left' | 'right';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Safe Date Parsing & Formatting Helpers (Resilient against UTC timezone skew)
export const parseYMD = (ymd: string): Date | null => {
  if (!ymd) return null;
  const parts = ymd.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
};

export const formatYMD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDisplayDate = (ymd: string): string => {
  const d = parseYMD(ymd);
  if (!d) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Select date...',
  minDate,
  maxDate,
  compareDate,
  isStartDate,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Current month displayed in the calendar
  const initialDate = parseYMD(value) || (compareDate ? parseYMD(compareDate) : null) || new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth());

  // Update view when value changes from external reset/preset
  useEffect(() => {
    if (value) {
      const parsed = parseYMD(value);
      if (parsed) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    }
  }, [value]);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
    } else {
      setViewMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
    } else {
      setViewMonth((prev) => prev + 1);
    }
  };

  const handleSelectDay = (ymd: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(ymd);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const todayStr = formatYMD(new Date());
    onChange(todayStr);
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsOpen(false);
  };

  const handleSelectYesterday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yestStr = formatYMD(d);
    onChange(yestStr);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsOpen(false);
  };

  // Build grid days for the month view
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);

    const daysCount = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();

    const days: {
      ymd: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isSelected: boolean;
      isToday: boolean;
      isInRange: boolean;
      isDisabled: boolean;
    }[] = [];

    const todayStr = formatYMD(new Date());

    // Leading days from previous month
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
      const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(prevYear, prevMonth, dayNum);
      const ymd = formatYMD(prevDate);

      const isSelected = value === ymd;
      const isToday = ymd === todayStr;

      let isInRange = false;
      if (value && compareDate) {
        const start = isStartDate ? value : compareDate;
        const end = isStartDate ? compareDate : value;
        if (start && end && ymd > start && ymd < end) isInRange = true;
      }

      let isDisabled = false;
      if (minDate && ymd < minDate) isDisabled = true;
      if (maxDate && ymd > maxDate) isDisabled = true;

      days.push({
        ymd,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isSelected,
        isToday,
        isInRange,
        isDisabled,
      });
    }

    // Days of current month
    for (let d = 1; d <= daysCount; d++) {
      const curDate = new Date(viewYear, viewMonth, d);
      const ymd = formatYMD(curDate);

      const isSelected = value === ymd;
      const isToday = ymd === todayStr;

      let isInRange = false;
      if (value && compareDate) {
        const start = isStartDate ? value : compareDate;
        const end = isStartDate ? compareDate : value;
        if (start && end && ymd > start && ymd < end) isInRange = true;
      }

      let isDisabled = false;
      if (minDate && ymd < minDate) isDisabled = true;
      if (maxDate && ymd > maxDate) isDisabled = true;

      days.push({
        ymd,
        dayNumber: d,
        isCurrentMonth: true,
        isSelected,
        isToday,
        isInRange,
        isDisabled,
      });
    }

    // Trailing days from next month to fill grid to 35 or 42 cells
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
      const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
      const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextDate = new Date(nextYear, nextMonth, i);
      const ymd = formatYMD(nextDate);

      const isSelected = value === ymd;
      const isToday = ymd === todayStr;

      let isInRange = false;
      if (value && compareDate) {
        const start = isStartDate ? value : compareDate;
        const end = isStartDate ? compareDate : value;
        if (start && end && ymd > start && ymd < end) isInRange = true;
      }

      let isDisabled = false;
      if (minDate && ymd < minDate) isDisabled = true;
      if (maxDate && ymd > maxDate) isDisabled = true;

      days.push({
        ymd,
        dayNumber: i,
        isCurrentMonth: false,
        isSelected,
        isToday,
        isInRange,
        isDisabled,
      });
    }

    return days;
  }, [viewYear, viewMonth, value, compareDate, minDate, maxDate, isStartDate]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center space-x-0.5"
            title="Clear date"
          >
            <span>Clear</span>
          </button>
        )}
      </label>

      {/* Interactive Trigger Button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full px-2.5 py-1.5 bg-slate-950 border rounded-lg text-xs text-slate-200 flex items-center justify-between cursor-pointer select-none transition-all shadow-sm ${
          isOpen
            ? 'border-emerald-500 ring-1 ring-emerald-500/40'
            : value
            ? 'border-slate-700 bg-slate-950/90 text-slate-100 hover:border-slate-600'
            : 'border-slate-800 hover:border-slate-700 text-slate-400'
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          <CalendarIcon
            className={`h-3.5 w-3.5 shrink-0 ${value ? 'text-emerald-400' : 'text-slate-500'}`}
          />
          <span className="truncate font-mono">
            {value ? formatDisplayDate(value) : placeholder}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0 ml-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-slate-800 text-slate-500 hover:text-red-400 transition-colors"
              title="Clear date"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          <ChevronDown
            className={`h-3 w-3 text-slate-500 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-emerald-400' : ''
            }`}
          />
        </div>
      </div>

      {/* Floating Calendar Popover */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 z-50 w-72 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ minWidth: '280px' }}
        >
          {/* Calendar Header with Navigation */}
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800/80">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="text-xs font-semibold text-slate-200">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {DAYS_SHORT.map((day) => (
              <span
                key={day}
                className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
              >
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((item, idx) => {
              const { ymd, dayNumber, isCurrentMonth, isSelected, isToday, isInRange, isDisabled } = item;

              return (
                <button
                  key={`${ymd}-${idx}`}
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => !isDisabled && handleSelectDay(ymd, e)}
                  className={`h-8 w-8 mx-auto rounded-lg text-xs flex items-center justify-center transition-all relative ${
                    isDisabled
                      ? 'opacity-20 cursor-not-allowed text-slate-600'
                      : isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-700/40 z-10 scale-105'
                      : isInRange
                      ? 'bg-emerald-950/60 text-emerald-300 font-medium'
                      : isToday
                      ? 'border border-emerald-500/70 text-emerald-300 font-semibold hover:bg-emerald-950/40'
                      : isCurrentMonth
                      ? 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800/40'
                  }`}
                  title={ymd}
                >
                  <span>{dayNumber}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 bg-emerald-400 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Presets & Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors font-medium"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSelectYesterday}
                className="px-2 py-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                Yesterday
              </button>
            </div>

            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="px-2 py-1 rounded-md text-red-400 hover:bg-red-950/50 hover:text-red-300 transition-colors flex items-center space-x-1"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
