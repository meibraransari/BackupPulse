import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Eye, ChevronLeft, ChevronRight, HardDrive, Check, ShieldCheck } from 'lucide-react';
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
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/40 font-mono" title="Manually resolved by administrator">
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
      <span className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-semibold border ${colors[type] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
      {/* Table Header / Counter */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
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

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-950/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
            <tr>
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
                  <td colSpan={8} className="py-4 px-4 bg-slate-900/40 h-12" />
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500">
                  <HardDrive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No backup records matching your filters.</p>
                </td>
              </tr>
            ) : (
              data.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onSelectReport(report)}
                >
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
                    >
                      <Eye className="h-3.5 w-3.5 inline mr-1" />
                      Details
                    </button>
                  </td>
                </tr>
              ))
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
