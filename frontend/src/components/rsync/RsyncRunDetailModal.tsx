import React, { useState } from 'react';
import {
  X,
  Terminal,
  Clock,
  HardDrive,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Zap,
} from 'lucide-react';
import { RsyncRun } from '../../types';
import { useTimezone } from '../../context/TimezoneContext';

interface RsyncRunDetailModalProps {
  run: RsyncRun | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RsyncRunDetailModal: React.FC<RsyncRunDetailModalProps> = ({
  run,
  isOpen,
  onClose,
}) => {
  const { formatTimestamp } = useTimezone();
  const [activeTab, setActiveTab] = useState<'stdout' | 'stderr' | 'summary'>('stdout');
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !run) return null;

  const handleCopyLogs = () => {
    const textToCopy =
      activeTab === 'stderr'
        ? run.stderrLog || run.errorMessage || 'No error log output'
        : run.stdoutLog || 'No stdout log output';
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSuccess = run.status === 'SUCCESS';
  const isFailed = run.status === 'FAILED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center space-x-3">
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center border ${
                isSuccess
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : isFailed
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  Rsync Execution Report: {run.job?.name || 'Sync Run'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide border ${
                    isSuccess
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : isFailed
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {run.status}
                </span>
                {run.runType === 'DRY_RUN' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    SIMULATION (DRY-RUN)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Run ID: <code className="font-mono text-slate-300">{run.id}</code> • Started:{' '}
                {formatTimestamp(run.startedAt)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/70 border-b border-slate-800 text-xs">
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Transferred Data</span>
            <span className="font-bold text-white text-sm">
              {run.bytesTransferredHuman || '0 B'}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Files (Copied / Total)</span>
            <span className="font-bold text-white text-sm">
              {run.transferredFiles.toLocaleString()} / {run.totalFiles.toLocaleString()}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Duration</span>
            <span className="font-bold text-white text-sm">
              {run.durationSeconds ? `${run.durationSeconds.toFixed(1)}s` : '—'}
            </span>
          </div>
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 block text-[11px]">Speedup Factor</span>
            <span className="font-bold text-emerald-400 text-sm">
              {run.speedupRatio ? `${run.speedupRatio.toFixed(2)}x` : '—'}
            </span>
          </div>
        </div>

        {/* Path Information */}
        <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-slate-300 truncate">
            <span className="font-semibold text-slate-400">Source:</span>
            <code className="text-amber-300 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate">
              {run.sourcePath}
            </code>
            <span className="font-semibold text-slate-400 ml-2">Target:</span>
            <code className="text-emerald-300 font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded border border-slate-800 truncate">
              {run.destinationPath}
            </code>
          </div>
          {run.deletedFiles > 0 && (
            <span className="text-rose-400 text-[11px] font-semibold shrink-0">
              ⚠️ {run.deletedFiles} extraneous files pruned
            </span>
          )}
        </div>

        {/* Tab Switcher & Copy Action */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('stdout')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'stdout'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Terminal Output (stdout)
            </button>
            <button
              onClick={() => setActiveTab('stderr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'stderr'
                  ? 'bg-slate-800 text-rose-300 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              Error Stream (stderr) {run.stderrLog && '⚠️'}
            </button>
          </div>

          <button
            onClick={handleCopyLogs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Logs</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal Body */}
        <div className="flex-1 p-4 overflow-y-auto max-h-[50vh] bg-slate-950 font-mono text-xs">
          {activeTab === 'stdout' ? (
            run.stdoutLog ? (
              <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                {run.stdoutLog}
              </pre>
            ) : (
              <p className="text-slate-500 italic">No stdout logs available for this execution.</p>
            )
          ) : (
            <div className="space-y-3">
              {run.errorMessage && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300">
                  <span className="font-bold block mb-1">Error Message:</span>
                  <p>{run.errorMessage}</p>
                </div>
              )}
              {run.stderrLog ? (
                <pre className="text-rose-400 whitespace-pre-wrap leading-relaxed">
                  {run.stderrLog}
                </pre>
              ) : (
                <p className="text-slate-500 italic">No stderr messages captured.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>Exit Code: {run.exitCode !== null ? run.exitCode : 'N/A'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
