import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, Server, FileArchive, Clock, ShieldAlert } from 'lucide-react';
import { BackupReport } from '../types';
import { useTimezone } from '../context/TimezoneContext';

interface DeleteBackupModalProps {
  report: BackupReport | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (report: BackupReport) => Promise<void>;
}

export const DeleteBackupModal: React.FC<DeleteBackupModalProps> = ({
  report,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { formatTimestamp } = useTimezone();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !report) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm(report);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete backup record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-rose-900/60 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-950/60 via-slate-950 to-slate-950 border-b border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">Delete Backup Record</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Permanent telemetry cleanup action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Warning Message */}
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-300">Are you sure you want to delete this telemetry record?</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                This will permanently remove the record from the database, metric charts, and reports. It is intended for cleaning up trial-and-error inventory setups and test entries.
              </p>
            </div>
          </div>

          {/* Record Details Card */}
          <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-500 font-sans text-xs font-semibold">Project</span>
              <span className="text-white font-bold">{report.projectName}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-500 font-sans text-xs">Server / Host</span>
              <span className="text-slate-300 truncate max-w-[260px]" title={`${report.serverId} (${report.hostname})`}>
                {report.serverId} ({report.hostname})
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-500 font-sans text-xs">Archive Filename</span>
              <span className="text-cyan-400 truncate max-w-[260px]" title={report.zipFilename}>
                {report.zipFilename}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-500 font-sans text-xs">Type & Status</span>
              <div className="flex items-center space-x-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                  {report.backupType}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    report.status === 'SUCCESS'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                      : 'bg-red-950 text-red-400 border border-red-800/50'
                  }`}
                >
                  {report.status}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans text-xs">Recorded At</span>
              <span className="text-slate-400">{formatTimestamp(report.createdAt)}</span>
            </div>
          </div>

          {/* Audit Notice */}
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 px-1">
            <span className="text-indigo-400">ℹ️</span>
            <span>A tamper-evident entry will be recorded in the Governance & Audit Log.</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-800/60 text-red-300 text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-all flex items-center space-x-2 shadow-lg shadow-rose-950/50 disabled:opacity-50"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Permanently Delete Record</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
