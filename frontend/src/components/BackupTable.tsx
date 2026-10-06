import React, { useState } from 'react';
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
} from 'lucide-react';
import { BackupReport } from '../types';

interface BackupTableProps {
  data: BackupReport[];
  loading: boolean;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  onPageChange: (newPage: number) => void;
  onSelectReport: (report: BackupReport) => void;
  onMarkSuccess?: (report: BackupReport) => void;
}

export const BackupTable: React.FC<BackupTableProps> = ({
  data,
  loading,
  pagination,
  onPageChange,
  onSelectReport,
  onMarkSuccess,
}) => {
  // Set of currently expanded row IDs
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  // Track field copied state for visual feedback
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Log viewer height preference per row (true = full height, false = scrollable)
  const [fullHeightLogs, setFullHeightLogs] = useState<Record<string, boolean>>({});
  // Selected tab in expanded view: 'logs' | 'vault' | 'raw'
  const [activeTab, setActiveTab] = useState<Record<string, 'logs' | 'vault' | 'raw'>>({});

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
          <div className="flex items-center space-x-1.5">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
              <CheckCircle2 className="h-3 w-3" />
              <span>Success</span>
            </span>
            {report.metadata?.manually_resolved && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 font-mono"
                title="Manually resolved by administrator"
              >
                Resolved
              </span>
            )}
          </div>
        );
      case 'FAILED':
        return (
          <div className="flex items-center space-x-1.5">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800/50">
              <XCircle className="h-3 w-3" />
              <span>Failed</span>
            </span>
            {onMarkSuccess && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkSuccess(report);
                }}
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 transition-all flex items-center space-x-1 shadow-sm"
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
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/80 text-amber-400 border border-amber-800/50">
            <AlertTriangle className="h-3 w-3" />
            <span>Warning</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
            <Clock className="h-3 w-3 animate-spin" />
            <span>{report.status}</span>
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      db: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50',
      code: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/50',
      full: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/50',
    };
    return (
      <span
        className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold border ${
          colors[type] || 'bg-slate-800 text-slate-300 border-slate-700'
        }`}
      >
        {type}
      </span>
    );
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

        {/* Manual Adjust Controls: Expand / Collapse All Rows */}
        {data.length > 0 && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleToggleExpandAll}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shadow-sm"
              title={allExpanded ? 'Collapse all table rows' : 'Expand all table rows to inspect full details'}
            >
              <ChevronsUpDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>{allExpanded ? 'Collapse All Rows' : 'Expand All Rows'}</span>
              <span className="text-[10px] ml-1 px-1.5 py-0.2 bg-slate-900 rounded text-slate-400 border border-slate-800">
                {expandedRowIds.size}/{data.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800 select-none">
            <tr>
              <th className="py-3 px-3 w-10 text-center font-semibold">
                <span className="sr-only">Expand</span>
              </th>
              <th className="py-3 px-4 font-semibold">Status & Action</th>
              <th className="py-3 px-4 font-semibold">Project & Host</th>
              <th className="py-3 px-4 font-semibold">Type</th>
              <th className="py-3 px-4 font-semibold">Archive Size</th>
              <th className="py-3 px-4 font-semibold">Duration</th>
              <th className="py-3 px-4 font-semibold">S3 Destination</th>
              <th className="py-3 px-4 font-semibold">Timestamp</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="py-4 px-4 bg-slate-900/40 h-12" />
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-500">
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
                    {/* Primary Row */}
                    <tr
                      className={`hover:bg-slate-800/40 transition-colors group cursor-pointer ${
                        isExpanded ? 'bg-slate-800/30' : ''
                      }`}
                      onClick={() => toggleRowExpand(report.id)}
                    >
                      {/* Expand / Collapse Chevron Toggle */}
                      <td className="py-3.5 px-3 text-center">
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

                      {/* Status & Resolve Button */}
                      <td className="py-3.5 px-4">{getStatusBadge(report)}</td>

                      {/* Project & Server */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{report.projectName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {report.serverId} ({report.hostname})
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4">{getTypeBadge(report.backupType)}</td>

                      {/* Size */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {report.backupSizeHuman || '0 B'}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                        {formatDuration(report.durationSeconds)}
                      </td>

                      {/* S3 Key */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate text-xs font-mono text-slate-400" title={report.s3Key || ''}>
                          {report.s3Key || '—'}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                        {new Date(report.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {report.status === 'FAILED' && onMarkSuccess && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onMarkSuccess(report);
                            }}
                            className="mr-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/80 hover:bg-emerald-900 hover:text-white transition-colors border border-emerald-600/50 inline-flex items-center space-x-1 shadow-sm"
                            title="Mark this failed job as SUCCESS manually"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Mark Success</span>
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(report);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                          title="Open detailed inspector modal"
                        >
                          <Eye className="h-3.5 w-3.5 inline mr-1" />
                          Modal
                        </button>
                      </td>
                    </tr>

                    {/* Manually Adjustable Inline Expanded Content Row */}
                    {isExpanded && (
                      <tr className="bg-slate-950/70 border-b border-slate-800">
                        <td colSpan={9} className="p-0">
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
                                    <span>Server: <strong className="text-slate-300 font-mono">{report.serverId}</strong></span>
                                    <span>•</span>
                                    <span>IP: <strong className="text-slate-300 font-mono">{report.serverIp || '127.0.0.1'}</strong></span>
                                    <span>•</span>
                                    <span>Host: <strong className="text-slate-300">{report.hostname}</strong></span>
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
                                  <span>S3 Vault</span>
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
                              </div>
                            </div>

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
                                    {new Date(report.metadata?.resolved_at || report.createdAt).toLocaleString()}
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
                                  {new Date(report.startTime).toLocaleTimeString()} →{' '}
                                  {new Date(report.endTime).toLocaleTimeString()}
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {new Date(report.startTime).toLocaleDateString()}
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

                            {/* TAB 2: S3 VAULT DETAILS */}
                            {currentTab === 'vault' && (
                              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                                    <HardDrive className="h-3.5 w-3.5 text-blue-400" />
                                    <span>Cloud Storage & Checksum Verification</span>
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
