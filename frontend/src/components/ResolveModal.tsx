import React, { useState } from 'react';
import {
  CheckCircle2,
  X,
  ShieldCheck,
  AlertTriangle,
  Server,
  Folder,
  Calendar,
  Loader2,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { BackupReport, User } from '../types';

interface ResolveModalProps {
  report: BackupReport | null;
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (report: BackupReport, note: string) => Promise<void>;
}

const PRESET_REASONS = [
  'Manual backup executed and archive verified in S3',
  'Disk space cleared; local database snapshot re-taken',
  'Transient network timeout; verified cloud object availability',
  'False positive alarm; checked integrity checksum manually',
  'Custom note (write below)',
];

export const ResolveModal: React.FC<ResolveModalProps> = ({
  report,
  currentUser,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_REASONS[0]);
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen || !report) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const finalNote =
        selectedPreset === 'Custom note (write below)'
          ? customNote.trim() || 'Manual resolution confirmed by operator'
          : customNote.trim()
          ? `${selectedPreset} — ${customNote.trim()}`
          : selectedPreset;

      await onConfirm(report, finalNote);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col transform transition-all scale-100">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">Resolve Backup Incident</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  Convert to Success
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Marking this job as SUCCESS will clear it from failed telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Target Backup Overview Card */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
                <Folder className="h-3.5 w-3.5 text-blue-400" />
                <span>{report.projectName}</span>
                <span className="text-slate-500">•</span>
                <span className="font-mono text-slate-400">{report.backupType.toUpperCase()}</span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-red-950/80 text-red-400 border border-red-800/40 font-semibold">
                Current: FAILED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-900">
              <div className="flex items-center space-x-1.5 truncate">
                <Server className="h-3 w-3 text-slate-500" />
                <span>Host: {report.serverId}</span>
              </div>
              <div className="flex items-center space-x-1.5 justify-end">
                <Calendar className="h-3 w-3 text-slate-500" />
                <span>{new Date(report.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Error snippet if present */}
            {report.errorMessage && (
              <div className="p-2.5 rounded-xl bg-red-950/30 border border-red-900/30 text-red-300/90 text-xs font-mono break-words flex items-start space-x-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{report.errorMessage}</span>
              </div>
            )}
          </div>

          {/* Preset Reason Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Resolution Justification
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              {PRESET_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>

          {/* Optional Resolution Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300 uppercase tracking-wider">
                Auditor Note <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <span className="text-[11px] text-slate-500">Recorded in audit metadata</span>
            </div>
            <textarea
              rows={2}
              placeholder="e.g. S3 object manually verified via AWS Console, size 1.4GB."
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
            />
          </div>

          {/* Audit Stamp Preview */}
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center space-x-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                Auditor:{' '}
                <strong className="text-slate-200 font-medium">
                  {currentUser?.username || 'admin'}
                </strong>
              </span>
            </div>
            <span className="text-slate-500">Exit code will reset to 0</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-200 transition-colors border border-slate-700"
          >
            Cancel / Keep Failed
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 transition-all flex items-center space-x-2 shadow-lg shadow-emerald-600/20 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-white" />
                <span>Confirm & Mark as Success</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
