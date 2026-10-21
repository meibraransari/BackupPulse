import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HardDrive,
  Check,
  ShieldCheck,
  Copy,
  Terminal,
  Maximize2,
  Minimize2,
  Code,
  Server,
  ChevronsUpDown,
  RotateCcw,
  Columns,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { BackupReport, User } from '../types';
import { useTimezone } from '../context/TimezoneContext';

interface BackupTableProps {
  data: BackupReport[];
  loading: boolean;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  onPageChange: (newPage: number) => void;
  onSelectReport: (report: BackupReport) => void;
  onMarkSuccess?: (report: BackupReport) => void;
  onDeleteBackup?: (report: BackupReport) => void;
  currentUser?: User | null;
}

const STORAGE_KEY_COL_WIDTHS = 'backuppulse_table_col_widths_v1';
const STORAGE_KEY_COL_VISIBILITY = 'backuppulse_table_col_visibility_v1';
const STORAGE_KEY_DENSITY = 'backuppulse_table_density_v1';

// Default column widths in pixels (tuned to fit cleanly without horizontal scrolling)
const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  expand: 40,
  status: 110,
  availability: 95,
  project: 155,
  type: 65,
  size: 85,
  duration: 75,
  s3: 145,
  timestamp: 115,
  actions: 140,
};

interface ColumnConfig {
  key: string;
  label: string;
  minWidth: number;
  resizable: boolean;
  align?: 'left' | 'center' | 'right';
}

const COLUMN_CONFIGS: ColumnConfig[] = [
  { key: 'expand', label: '', minWidth: 40, resizable: false, align: 'center' },
  { key: 'status', label: 'Status & Action', minWidth: 95, resizable: true },
  { key: 'availability', label: 'Active,expired', minWidth: 95, resizable: true },
  { key: 'project', label: 'Project & Host', minWidth: 110, resizable: true },
  { key: 'type', label: 'Type', minWidth: 60, resizable: true },
  { key: 'size', label: 'Archive Size', minWidth: 70, resizable: true },
  { key: 'duration', label: 'Duration', minWidth: 65, resizable: true },
  { key: 's3', label: 'S3 Destination', minWidth: 80, resizable: true },
  { key: 'timestamp', label: 'Timestamp', minWidth: 85, resizable: true },
  { key: 'actions', label: 'Actions', minWidth: 90, resizable: true, align: 'right' },
];

export const BackupTable: React.FC<BackupTableProps> = ({
  data,
  loading,
  pagination,
  onPageChange,
  onSelectReport,
  onMarkSuccess,
  onDeleteBackup,
  currentUser,
}) => {
  const { formatTimestamp, formatDateOnly, formatTimeOnly } = useTimezone();
  const isAdmin = currentUser?.role === 'admin';

  // Column Widths with LocalStorage persistence
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COL_WIDTHS);
      if (saved) {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_COLUMN_WIDTHS;
  });

  // Resizing state
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; colKey: string } | null>(null);

  // Set of currently expanded row IDs
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  // Track field copied state for visual feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Log viewer height preference per row (true = full height, false = scrollable)
  const [fullHeightLogs, setFullHeightLogs] = useState<Record<string, boolean>>({});
  // Selected tab in expanded view: 'logs' | 'vault' | 'drill' | 'raw'
  const [activeTab, setActiveTab] = useState<Record<string, 'logs' | 'vault' | 'drill' | 'raw'>>({});

  // Display Density: 'compact' | 'normal' | 'comfortable'
  const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DENSITY);
      if (saved === 'compact' || saved === 'normal' || saved === 'comfortable') return saved;
    } catch {}
    return 'normal';
  });

  // Column Visibility state
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COL_VISIBILITY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      status: true,
      availability: true,
      project: true,
      type: true,
      size: true,
      duration: true,
      s3: true,
      timestamp: true,
    };
  });
  const [showColMenu, setShowColMenu] = useState(false);

  // Sync density and colVisibility to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DENSITY, density);
    } catch {}
  }, [density]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COL_VISIBILITY, JSON.stringify(colVisibility));
    } catch {}
  }, [colVisibility]);

  // Derived active columns
  const activeColumns = COLUMN_CONFIGS.filter(
    (col) => col.key === 'expand' || col.key === 'actions' || colVisibility[col.key] !== false
  );

  const isColVisible = (key: string) => {
    if (key === 'expand' || key === 'actions') return true;
    return colVisibility[key] !== false;
  };

  const toggleColumnVisibility = (key: string) => {
    setColVisibility((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  const resetColumnVisibility = () => {
    setColVisibility({
      status: true,
      availability: true,
      project: true,
      type: true,
      size: true,
      duration: true,
      s3: true,
      timestamp: true,
    });
  };

  // Cell padding based on density
  const cellPadding =
    density === 'compact'
      ? 'py-2 px-3 text-[11px]'
      : density === 'comfortable'
      ? 'py-4 px-4 text-xs'
      : 'py-3.5 px-3.5 text-xs';

  // Save column widths to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COL_WIDTHS, JSON.stringify(colWidths));
    } catch {}
  }, [colWidths]);

  // Drag and drop column resizing event listener
  useEffect(() => {
    if (!resizingColKey) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startWidth, colKey } = resizeRef.current;
      const colConfig = COLUMN_CONFIGS.find((c) => c.key === colKey);
      const minW = colConfig ? colConfig.minWidth : 50;
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(minW, startWidth + deltaX);

      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const onMouseUp = () => {
      setResizingColKey(null);
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizingColKey]);

  const handleStartResize = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColKey(colKey);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: colWidths[colKey] || DEFAULT_COLUMN_WIDTHS[colKey] || 100,
      colKey,
    };
  };

  const handleDoubleClickResetCol = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setColWidths((prev) => ({
      ...prev,
      [colKey]: DEFAULT_COLUMN_WIDTHS[colKey] || 120,
    }));
  };

  const handleResetAllWidths = () => {
    setColWidths(DEFAULT_COLUMN_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY_COL_WIDTHS);
    } catch {}
  };

  const toggleRowExpand = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    if (expandedRowIds.size === data.length && data.length > 0) {
      setExpandedRowIds(new Set());
    } else {
      setExpandedRowIds(new Set(data.map((r) => r.id)));
    }
  };

  const toggleFullHeightLog = (id: string) => {
    setFullHeightLogs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copyToClipboard = (text: string, fieldKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusBadge = (report: BackupReport) => {
    switch (report.status) {
      case 'SUCCESS':
        return (
          <div className="flex items-center space-x-1.5 truncate">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              <span>Success</span>
            </span>
            {report.metadata?.manually_resolved && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 font-mono shrink-0"
                title="Manually resolved by administrator"
              >
                Resolved
              </span>
            )}
          </div>
        );
      case 'FAILED':
        return (
          <div className="flex items-center space-x-1.5 truncate">
            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/50 shrink-0">
              <XCircle className="h-3 w-3" />
              <span>Failed</span>
            </span>
            {onMarkSuccess && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkSuccess(report);
                }}
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 transition-all flex items-center space-x-1 shadow-sm shrink-0"
                title="Mark this failed job as SUCCESS manually"
              >
                <Check className="h-3 w-3 text-emerald-400" />
                <span>Resolve</span>
              </button>
            )}
          </div>
        );
      case 'WARNING':
        return (
          <span
            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/50 shrink-0 cursor-help"
            title={report.anomalyReason || 'Warning: Potential backup issue detected'}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>{report.isAnomaly ? 'Anomaly' : 'Warning'}</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 shrink-0">
            <Clock className="h-3 w-3 animate-spin" />
            <span>{report.status}</span>
          </span>
        );
    }
  };

  const getAvailabilityBadge = (report: BackupReport) => {
    if (report.status === 'FAILED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60 shrink-0">
          <span>N/A</span>
        </span>
      );
    }

    const isExpired = report.isExpired ?? (report.availabilityStatus === 'EXPIRED');

    if (isExpired) {
      return (
        <span
          className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/70 shrink-0 shadow-sm"
          title={
            report.expiresAt
              ? `Expired on ${formatDateOnly(report.expiresAt)}${report.daysAgoExpired !== null && report.daysAgoExpired !== undefined ? ` (${report.daysAgoExpired}d ago)` : ''}`
              : 'Backup expired based on retention policy'
          }
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
          <span>Expired</span>
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shrink-0 shadow-sm"
        title={
          report.expiresAt
            ? `Active in S3 bucket. Expires on ${formatDateOnly(report.expiresAt)}${report.daysRemaining !== null && report.daysRemaining !== undefined ? ` (${report.daysRemaining}d left)` : ''}`
            : 'Active in S3 bucket'
        }
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>Active</span>
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const normalized = (type || 'db').toLowerCase();
    const colors: Record<string, string> = {
      db: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
      code: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/50',
      zip: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/50',
      full: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50',
      sftp: 'bg-teal-950/70 text-teal-300 border-teal-800/50',
      ftp: 'bg-sky-950/70 text-sky-300 border-sky-800/50',
      mongodb: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50',
      mongo: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50',
      redis: 'bg-rose-950/70 text-rose-300 border-rose-800/50',
      docker: 'bg-blue-950/70 text-blue-300 border-blue-800/50',
      sqlite: 'bg-amber-950/70 text-amber-300 border-amber-800/50',
      custom: 'bg-purple-950/70 text-purple-300 border-purple-800/50',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold border ${
          colors[normalized] || 'bg-purple-950/70 text-purple-300 border-purple-800/50'
        }`}
      >
        {type}
      </span>
    );
  };

  const getAnomalyBadgeText = (report: BackupReport) => {
    if (report.metadata?.anomaly?.drop_percent) {
      return `-${report.metadata.anomaly.drop_percent}% (7d)`;
    }
    const match = report.anomalyReason?.match(/-(\d+)%/);
    if (match) {
      return `-${match[1]}% (7d)`;
    }
    if (
      report.anomalyReason?.toLowerCase().includes('zero-byte') ||
      (report.backupSizeBytes !== undefined && Number(report.backupSizeBytes) <= 512)
    ) {
      return '0 B Truncated';
    }
    return 'Size Anomaly';
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const allExpanded = data.length > 0 && expandedRowIds.size === data.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
      {/* Table Header & Controls Bar */}
      <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-sm text-slate-200">Backup Telemetry Records</h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              Live
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Showing {data.length} of {pagination.total} records
          </span>
        </div>

        {/* Manual Adjust Controls: Column Customizer, Density Switcher, Resizer Reset & Expand / Collapse */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Display Density Switcher */}
          <div className="flex items-center space-x-0.5 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                density === 'compact'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Compact density (tight rows for high-density viewing)"
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setDensity('normal')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                density === 'normal'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Standard density"
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                density === 'comfortable'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Comfortable density (roomy rows)"
            >
              Roomy
            </button>
          </div>

          {/* Column Customizer Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColMenu(!showColMenu)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-colors shadow-sm"
              title="Choose visible table columns"
            >
              <Columns className="h-3 w-3 text-indigo-400" />
              <span>Columns</span>
              <span className="text-[10px] px-1 bg-slate-900 rounded text-slate-400 font-mono">
                {Object.values(colVisibility).filter(Boolean).length}/8
              </span>
            </button>

            {showColMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2.5 z-40 space-y-2 animate-in fade-in zoom-in-95"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[11px]">
                  <span className="font-semibold text-white">Visible Columns</span>
                  <button
                    type="button"
                    onClick={resetColumnVisibility}
                    className="text-indigo-400 hover:text-indigo-300 text-[10px]"
                  >
                    Reset All
                  </button>
                </div>
                <div className="space-y-1 text-xs text-slate-300 max-h-48 overflow-y-auto">
                  {[
                    { key: 'status', label: 'Status & Action' },
                    { key: 'availability', label: 'Active / Expired' },
                    { key: 'project', label: 'Project & Host' },
                    { key: 'type', label: 'Workload Type' },
                    { key: 'size', label: 'Archive Size' },
                    { key: 'duration', label: 'Duration' },
                    { key: 's3', label: 'Destination Path' },
                    { key: 'timestamp', label: 'Timestamp' },
                  ].map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center space-x-2 px-1.5 py-1 rounded hover:bg-slate-800/60 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={colVisibility[col.key] !== false}
                        onChange={() => toggleColumnVisibility(col.key)}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
                      />
                      <span className="text-[11px]">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reset Column Widths button */}
          <button
            onClick={handleResetAllWidths}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors shadow-sm"
            title="Reset all column widths to default fitted size"
          >
            <RotateCcw className="h-3 w-3 text-slate-400" />
            <span className="hidden md:inline">Reset Widths</span>
          </button>

          {/* Expand / Collapse All Rows */}
          {data.length > 0 && (
            <button
              onClick={handleToggleExpandAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shadow-sm"
              title={allExpanded ? 'Collapse all table rows' : 'Expand all table rows to inspect full details'}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
              <span className="text-[10px] ml-1 px-1.5 py-0.2 bg-slate-900 rounded text-slate-400 border border-slate-800">
                {expandedRowIds.size}/{data.length}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Table Content Container */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-left text-xs sm:text-sm border-collapse">
          {/* Defined ColGroup to enforce strict column resizing without spontaneous overflow */}
          <colgroup>
            {activeColumns.map((col) => (
              <col
                key={col.key}
                style={{
                  width: `${colWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 100}px`,
                }}
              />
            ))}
          </colgroup>

          <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800 select-none">
            <tr>
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  className={`relative ${
                    density === 'compact' ? 'py-2 px-3' : 'py-3 px-3.5'
                  } font-semibold text-slate-400 group/th ${
                    col.align === 'center'
                      ? 'text-center'
                      : col.align === 'right'
                      ? 'text-right'
                      : 'text-left'
                  }`}
                  style={{
                    width: `${colWidths[col.key] || DEFAULT_COLUMN_WIDTHS[col.key] || 100}px`,
                  }}
                >
                  <div className="truncate pr-2">{col.label}</div>

                  {/* Mouse Drag & Drop Column Resizer Handle */}
                  {col.resizable && (
                    <div
                      onMouseDown={(e) => handleStartResize(col.key, e)}
                      onDoubleClick={(e) => handleDoubleClickResetCol(col.key, e)}
                      className={`absolute right-0 top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center transition-colors z-10 select-none ${
                        resizingColKey === col.key
                          ? 'bg-emerald-500/30'
                          : 'hover:bg-slate-700/60 active:bg-emerald-500/40'
                      }`}
                      title="Drag to resize column width • Double-click to reset"
                    >
                      <div
                        className={`w-0.5 h-4 rounded-full transition-colors ${
                          resizingColKey === col.key
                            ? 'bg-emerald-400 h-full'
                            : 'bg-slate-700 group-hover/th:bg-emerald-400/80'
                        }`}
                      />
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={activeColumns.length} className="py-4 px-4 bg-slate-900/40 h-12" />
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length} className="py-12 text-center text-slate-500">
                  <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No backup records matching your filters.</p>
                </td>
              </tr>
            ) : (
              data.map((report) => {
                const isExpanded = expandedRowIds.has(report.id);
                const currentTab = activeTab[report.id] || 'logs';
                const isFullHeight = fullHeightLogs[report.id] || false;

                return (
                  <React.Fragment key={report.id}>
                    {/* Primary Data Row */}
                    <tr
                      className={`hover:bg-slate-800/40 transition-colors group cursor-pointer ${
                        isExpanded ? 'bg-slate-800/30' : ''
                      }`}
                      onClick={() => toggleRowExpand(report.id)}
                    >
                      {/* Expand / Collapse Chevron Toggle */}
                      {isColVisible('expand') && (
                        <td className={`text-center overflow-hidden ${cellPadding}`}>
                          <button
                            onClick={(e) => toggleRowExpand(report.id, e)}
                            className={`p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 transition-transform ${
                              isExpanded ? 'text-emerald-400 rotate-90' : ''
                            }`}
                            title={isExpanded ? 'Collapse row details' : 'Expand row to see full content'}
                          >
                            <ChevronRight className="h-4 w-4 transition-transform" />
                          </button>
                        </td>
                      )}

                      {/* Status & Resolve Button */}
                      {isColVisible('status') && (
                        <td className={`overflow-hidden ${cellPadding}`}>{getStatusBadge(report)}</td>
                      )}

                      {/* Active,expired Availability Badge */}
                      {isColVisible('availability') && (
                        <td className={`overflow-hidden ${cellPadding}`}>{getAvailabilityBadge(report)}</td>
                      )}

                      {/* Project & Server */}
                      {isColVisible('project') && (
                        <td className={`overflow-hidden ${cellPadding}`}>
                          <div className="font-medium text-slate-200 truncate" title={report.projectName}>
                            {report.projectName}
                          </div>
                          <div
                            className="text-[11px] text-slate-400 font-mono truncate"
                            title={`${report.serverId} (${report.hostname})`}
                          >
                            {report.serverId} ({report.hostname})
                          </div>
                        </td>
                      )}

                      {/* Type */}
                      {isColVisible('type') && (
                        <td className={`overflow-hidden ${cellPadding}`}>
                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                            {getTypeBadge(report.backupType)}
                            {report.restoreDrillStatus && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab((prev) => ({ ...prev, [report.id]: 'drill' }));
                                  setExpandedRowIds((prev) => new Set(prev).add(report.id));
                                }}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border cursor-pointer hover:scale-105 transition-all ${
                                  report.restoreDrillStatus === 'SUCCESS'
                                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/80 shadow-sm'
                                    : report.restoreDrillStatus === 'FAILED'
                                    ? 'bg-red-950/70 text-red-300 border-red-700/50 hover:bg-red-900/80 shadow-sm'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                }`}
                                title={`DrillPulse DR Drill: ${report.restoreDrillStatus} (${report.restoreDrillVerifiedTables ?? 0} entities verified in ${report.restoreDrillDurationSeconds ?? 0}s). Click to view sandbox drill logs.`}
                              >
                                🧪 {report.restoreDrillStatus === 'SUCCESS' ? 'DR Pass' : report.restoreDrillStatus === 'FAILED' ? 'DR Fail' : 'DR Skip'}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Size */}
                      {isColVisible('size') && (
                        <td className={`font-mono overflow-hidden truncate ${cellPadding}`}>
                          <div className="flex items-center space-x-1.5 truncate">
                            <span className={report.isAnomaly ? 'text-amber-300 font-semibold' : ''}>
                              {report.backupSizeHuman || '0 B'}
                            </span>
                            {report.isAnomaly && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-600/60 cursor-help shrink-0 flex items-center space-x-1"
                                title={report.anomalyReason || 'Anomaly: Backup size dropped sharply compared to 7-day average'}
                              >
                                <span>⚠️</span>
                                <span>{getAnomalyBadgeText(report)}</span>
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Duration */}
                      {isColVisible('duration') && (
                        <td className={`font-mono text-slate-400 overflow-hidden truncate ${cellPadding}`}>
                          {formatDuration(report.durationSeconds)}
                        </td>
                      )}

                      {/* S3 Destination */}
                      {isColVisible('s3') && (
                        <td className={`overflow-hidden ${cellPadding}`}>
                          <div
                            className="truncate text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                            title={report.s3Key || 'No S3 key assigned'}
                          >
                            {report.s3Key || '—'}
                          </div>
                        </td>
                      )}

                      {/* Timestamp */}
                      {isColVisible('timestamp') && (
                        <td className={`whitespace-nowrap text-slate-400 overflow-hidden font-mono text-[11px] ${cellPadding}`}>
                          {formatTimestamp(report.createdAt)}
                        </td>
                      )}

                      {/* Actions Column (View & Admin Delete) */}
                      {isColVisible('actions') && (
                        <td className={`text-right whitespace-nowrap overflow-hidden ${cellPadding}`}>
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectReport(report);
                              }}
                              className="px-2 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 inline-flex items-center space-x-1 shadow-sm"
                              title="Open detailed inspector modal"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">View</span>
                            </button>

                            {/* Delete Button (Strictly for Admin users only) */}
                            {isAdmin && onDeleteBackup && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteBackup(report);
                                }}
                                className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/70 hover:bg-rose-900/90 hover:text-white transition-all border border-rose-800/60 inline-flex items-center space-x-1 shadow-sm group/del"
                                title="Delete backup record (Admin only - trial & error entry cleanup)"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-400 group-hover/del:text-rose-200 transition-colors" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Inline Expanded Content Sub-Row */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70 border-b border-slate-800">
                        <td colSpan={activeColumns.length} className="p-0">
                          <div
                            className={`p-4 sm:p-6 border-l-4 space-y-5 bg-gradient-to-r from-slate-950 via-slate-900/60 to-slate-950 ${
                              report.status === 'FAILED'
                                ? 'border-l-red-500'
                                : report.status === 'WARNING'
                                ? 'border-l-amber-500'
                                : 'border-l-emerald-500'
                            }`}
                          >
                            {/* Expanded Row Sub-Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800/80">
                              <div className="flex items-center space-x-3">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                    report.status === 'SUCCESS'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                                      : 'bg-red-950 text-red-400 border border-red-800/50'
                                  }`}
                                >
                                  {report.status}
                                </span>
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-bold text-white text-sm">{report.projectName}</span>
                                    <span className="text-xs text-slate-400 font-mono">({report.zipFilename})</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                                    <span>
                                      Server: <strong className="text-slate-300 font-mono">{report.serverId}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      IP: <strong className="text-slate-300 font-mono">{report.serverIp || '127.0.0.1'}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Host: <strong className="text-slate-300">{report.hostname}</strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Tab Navigation for Inline View */}
                              <div className="flex items-center space-x-1.5 self-start sm:self-auto bg-slate-900 p-1 rounded-xl border border-slate-800">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab((prev) => ({ ...prev, [report.id]: 'logs' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                                    currentTab === 'logs'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <Terminal className="h-3 w-3" />
                                  <span>Execution Logs</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab((prev) => ({ ...prev, [report.id]: 'vault' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                                    currentTab === 'vault'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <HardDrive className="h-3 w-3" />
                                  <span>Storage Vault</span>
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab((prev) => ({ ...prev, [report.id]: 'drill' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                                    currentTab === 'drill'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <span>🧪</span>
                                  <span>DR Drill</span>
                                  {report.restoreDrillStatus && (
                                    <span
                                      className={`px-1 py-0.2 rounded text-[9px] font-mono font-bold ${
                                        report.restoreDrillStatus === 'SUCCESS'
                                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                          : 'bg-red-950 text-red-300 border border-red-700/60'
                                      }`}
                                    >
                                      {report.restoreDrillStatus === 'SUCCESS' ? 'PASS' : 'FAIL'}
                                    </span>
                                  )}
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab((prev) => ({ ...prev, [report.id]: 'raw' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center space-x-1 ${
                                    currentTab === 'raw'
                                      ? 'bg-emerald-600 text-white shadow-sm'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <Code className="h-3 w-3" />
                                  <span>Raw JSON</span>
                                </button>

                                {/* Admin Delete Button */}
                                {isAdmin && onDeleteBackup && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteBackup(report);
                                    }}
                                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-300 bg-rose-950/70 hover:bg-rose-900 hover:text-white transition-colors border border-rose-800/60 inline-flex items-center space-x-1 shadow-sm ml-1"
                                    title="Permanently delete this backup record (Admin only)"
                                  >
                                    <Trash2 className="h-3 w-3 text-rose-400" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Anomaly Alert Banner (if size anomaly detected) */}
                            {report.isAnomaly && (
                              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-1.5">
                                <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>Backup Size Anomaly Guard Flagged This Job</span>
                                </div>
                                <p className="text-xs text-amber-300 font-mono">
                                  {report.anomalyReason || 'Significant backup size drop (>70%) or zero-byte archive detected.'}
                                </p>
                              </div>
                            )}

                            {/* Failure Alert Banner (if failed) */}
                            {report.status === 'FAILED' && (
                              <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2 text-xs font-semibold text-red-400">
                                    <XCircle className="h-4 w-4 shrink-0" />
                                    <span>Failure Reason & Error Details (Exit Code: {report.exitCode})</span>
                                  </div>
                                  {onMarkSuccess && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onMarkSuccess(report);
                                      }}
                                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center space-x-1.5 shadow-sm"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Mark as Resolved</span>
                                    </button>
                                  )}
                                </div>
                                {report.errorMessage && (
                                  <p className="text-xs font-mono bg-red-950/80 p-2.5 rounded-lg border border-red-900/50 break-all">
                                    {report.errorMessage}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Resolution Audit Trail (if manually resolved) */}
                            {report.metadata?.manually_resolved && (
                              <div className="p-3 rounded-xl bg-blue-950/30 border border-blue-800/40 text-blue-300 text-xs flex items-start space-x-2">
                                <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium text-blue-200">
                                    Manually resolved by{' '}
                                    <span className="font-semibold">{report.metadata?.resolved_by || 'Admin'}</span> on{' '}
                                    {formatTimestamp(report.metadata?.resolved_at || report.createdAt)}
                                  </p>
                                  {report.metadata?.notes && (
                                    <p className="text-blue-300/80 mt-1 italic">
                                      &quot;{report.metadata.notes}&quot;
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Summary Metadata Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80">
                                <span className="text-[11px] text-slate-400">Archive Size</span>
                                <p className="text-xs font-mono font-medium text-slate-200 mt-0.5">
                                  {report.backupSizeHuman || '0 B'}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {Number(report.backupSizeBytes).toLocaleString()} Bytes
                                </p>
                              </div>

                              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80">
                                <span className="text-[11px] text-slate-400">Duration & Exit</span>
                                <p className="text-xs font-mono font-medium text-slate-200 mt-0.5">
                                  {report.durationSeconds} seconds
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono">Exit Code: {report.exitCode}</p>
                              </div>

                              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80">
                                <span className="text-[11px] text-slate-400">Execution Window</span>
                                <p className="text-[11px] font-mono text-slate-300 mt-0.5">
                                  {formatTimeOnly(report.startTime)} → {formatTimeOnly(report.endTime)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {formatDateOnly(report.startTime)}
                                </p>
                              </div>

                              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800/80">
                                <span className="text-[11px] text-slate-400">Environment & OS</span>
                                <p className="text-xs font-medium capitalize text-emerald-400 mt-0.5">
                                  {report.environment} ({report.backupType} backup)
                                </p>
                                <p className="text-[10px] text-slate-500 font-mono truncate">
                                  {report.metadata?.os || 'Linux'} {report.metadata?.kernel || ''}
                                </p>
                              </div>
                            </div>

                            {/* TAB 1: EXECUTION LOGS (WITH ADJUSTABLE HEIGHT) */}
                            {currentTab === 'logs' && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                                    <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                                    <span>Console Output & Error Traces</span>
                                  </span>

                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleFullHeightLog(report.id);
                                      }}
                                      className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 transition-colors"
                                      title={isFullHeight ? 'Switch to compact scrollable view' : 'Expand full log height'}
                                    >
                                      {isFullHeight ? (
                                        <>
                                          <Minimize2 className="h-3 w-3 text-amber-400" />
                                          <span>Compact Height</span>
                                        </>
                                      ) : (
                                        <>
                                          <Maximize2 className="h-3 w-3 text-emerald-400" />
                                          <span>Full Height</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      onClick={(e) =>
                                        copyToClipboard(
                                          `${report.stderrLog ? `[STDERR]\n${report.stderrLog}\n\n` : ''}[STDOUT]\n${report.stdoutLog || ''}`,
                                          `logs_${report.id}`,
                                          e
                                        )
                                      }
                                      className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/60 border border-slate-700/60 transition-colors"
                                    >
                                      {copiedField === `logs_${report.id}` ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                      <span>{copiedField === `logs_${report.id}` ? 'Copied' : 'Copy Logs'}</span>
                                    </button>
                                  </div>
                                </div>

                                {report.stderrLog && (
                                  <div>
                                    <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">
                                      Standard Error (stderr)
                                    </span>
                                    <pre
                                      className={`mt-1 p-3.5 bg-black/90 rounded-xl border border-red-900/50 text-red-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap select-text ${
                                        isFullHeight ? 'max-h-none' : 'max-h-48'
                                      }`}
                                    >
                                      {report.stderrLog}
                                    </pre>
                                  </div>
                                )}

                                <div>
                                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                                    Standard Output (stdout)
                                  </span>
                                  <pre
                                    className={`mt-1 p-3.5 bg-black/90 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap select-text ${
                                      isFullHeight ? 'max-h-none' : 'max-h-60'
                                    }`}
                                  >
                                    {report.stdoutLog || 'No stdout log recorded.'}
                                  </pre>
                                </div>
                              </div>
                            )}

                            {/* TAB 2: STORAGE VAULT DETAILS */}
                            {currentTab === 'vault' && (
                              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                                    <HardDrive className="h-3.5 w-3.5 text-blue-400" />
                                    <span>Storage Vault & Checksum Verification</span>
                                  </span>

                                  {report.s3Url && (
                                    <button
                                      onClick={(e) => copyToClipboard(report.s3Url!, `s3_${report.id}`, e)}
                                      className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 transition-colors"
                                    >
                                      {copiedField === `s3_${report.id}` ? (
                                        <Check className="h-3 w-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                      <span>{copiedField === `s3_${report.id}` ? 'Copied' : 'Copy S3 URI'}</span>
                                    </button>
                                  )}
                                </div>

                                <div className="space-y-2 text-xs font-mono">
                                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center">
                                    <span className="w-28 text-slate-500 font-medium">Availability:</span>
                                    <div className="flex items-center space-x-2">
                                      {getAvailabilityBadge(report)}
                                      {report.expiresAt && (
                                        <span className="text-xs text-slate-400">
                                          ({report.isExpired ? 'Expired' : 'Expires'}: {formatDateOnly(report.expiresAt)}
                                          {report.daysRemaining !== null && report.daysRemaining !== undefined ? ` • ${report.daysRemaining}d remaining` : ''}
                                          {report.daysAgoExpired !== null && report.daysAgoExpired !== undefined ? ` • ${report.daysAgoExpired}d ago` : ''})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center">
                                    <span className="w-28 text-slate-500 font-medium">Retention:</span>
                                    <span className="text-slate-200">
                                      {report.retentionDays ? `${report.retentionDays} Days (S3 Retention Window)` : 'Default / Not Specified'}
                                    </span>
                                  </div>

                                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center">
                                    <span className="w-28 text-slate-500 font-medium">S3 Bucket:</span>
                                    <span className="text-slate-200">{report.s3Bucket || 'N/A'}</span>
                                  </div>

                                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center">
                                    <span className="w-28 text-slate-500 font-medium">S3 Key Path:</span>
                                    <span className="text-slate-200 break-all">{report.s3Key || 'N/A'}</span>
                                  </div>

                                  <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center">
                                    <span className="w-28 text-slate-500 font-medium">S3 Full URI:</span>
                                    <span className="text-blue-300 break-all">{report.s3Url || 'N/A'}</span>
                                  </div>

                                  {report.checksum && (
                                    <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between">
                                      <div className="flex flex-col sm:flex-row sm:items-center">
                                        <span className="w-28 text-slate-500 font-medium">SHA256:</span>
                                        <span className="text-emerald-400 break-all">{report.checksum}</span>
                                      </div>
                                      <button
                                        onClick={(e) => copyToClipboard(report.checksum!, `chk_${report.id}`, e)}
                                        className="text-xs text-slate-400 hover:text-white mt-1 sm:mt-0"
                                      >
                                        {copiedField === `chk_${report.id}` ? (
                                          <Check className="h-3 w-3 text-emerald-400 inline" />
                                        ) : (
                                          <Copy className="h-3 w-3 inline" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* TAB: DISASTER RECOVERY DRILL (DRILLPULSE) */}
                            {currentTab === 'drill' && (
                              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                                    <span>🧪</span>
                                    <span>Disaster Recovery Restoration Drill (DrillPulse)</span>
                                  </span>

                                  {report.restoreDrillStatus && (
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                        report.restoreDrillStatus === 'SUCCESS'
                                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                          : report.restoreDrillStatus === 'FAILED'
                                          ? 'bg-red-950 text-red-400 border border-red-800/60'
                                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                                      }`}
                                    >
                                      {report.restoreDrillStatus}
                                    </span>
                                  )}
                                </div>

                                {report.restoreDrillStatus ? (
                                  <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                                        <span className="text-[10px] text-slate-500 block">Verified Entities:</span>
                                        <span className="text-emerald-400 font-semibold">{report.restoreDrillVerifiedTables ?? 0} tables / files</span>
                                      </div>
                                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                                        <span className="text-[10px] text-slate-500 block">Drill Duration:</span>
                                        <span className="text-slate-200 font-semibold">{report.restoreDrillDurationSeconds ?? 0}s</span>
                                      </div>
                                      <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
                                        <span className="text-[10px] text-slate-500 block">Verification Result:</span>
                                        <span className={report.restoreDrillStatus === 'SUCCESS' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                          {report.restoreDrillStatus === 'SUCCESS' ? 'Dump Validated in Sandbox' : 'Sandbox Verification Failed'}
                                        </span>
                                      </div>
                                    </div>

                                    {report.restoreDrillLog && (
                                      <div>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Drill Log Output</span>
                                          <button
                                            onClick={(e) => copyToClipboard(report.restoreDrillLog || '', `drill_${report.id}`, e)}
                                            className="text-xs text-slate-400 hover:text-white"
                                          >
                                            {copiedField === `drill_${report.id}` ? (
                                              <Check className="h-3 w-3 text-emerald-400 inline mr-1" />
                                            ) : (
                                              <Copy className="h-3 w-3 inline mr-1" />
                                            )}
                                            <span>{copiedField === `drill_${report.id}` ? 'Copied' : 'Copy Drill Log'}</span>
                                          </button>
                                        </div>
                                        <pre className="p-3 bg-black/90 rounded-lg border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-56 whitespace-pre-wrap select-text">
                                          {report.restoreDrillLog}
                                        </pre>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs space-y-2">
                                    <p className="font-semibold text-slate-300">
                                      Standard Backup Execution (No Automated Restoration Drill)
                                    </p>
                                    <p className="text-[11px] leading-relaxed">
                                      This backup run was archived successfully without an ephemeral Docker sandbox restoration test. To verify future backups automatically, enable the <strong>🧪 Automated Restoration Drill (DrillPulse)</strong> checkbox in the Deploy New Server Wizard.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* TAB 3: RAW TELEMETRY JSON */}
                            {currentTab === 'raw' && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                                    <Code className="h-3.5 w-3.5 text-purple-400" />
                                    <span>Raw Telemetry Payload JSON</span>
                                  </span>

                                  <button
                                    onClick={(e) =>
                                      copyToClipboard(JSON.stringify(report, null, 2), `raw_${report.id}`, e)
                                    }
                                    className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 border border-slate-700 transition-colors"
                                  >
                                    {copiedField === `raw_${report.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                    <span>{copiedField === `raw_${report.id}` ? 'Copied' : 'Copy JSON'}</span>
                                  </button>
                                </div>

                                <pre className="p-3.5 bg-black/90 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-72 select-text">
                                  {JSON.stringify(report, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="px-6 py-3.5 bg-slate-950/40 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Page <span className="font-medium text-slate-200">{pagination.page}</span> of{' '}
            <span className="font-medium text-slate-200">{pagination.totalPages}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
