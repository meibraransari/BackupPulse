import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Activity,
  User,
  Clock,
  Terminal,
  FileCode,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { RsyncActivityLog } from '../../types';
import { useTimezone } from '../../context/TimezoneContext';

interface RsyncActivityDetailModalProps {
  log: RsyncActivityLog | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RsyncActivityDetailModal: React.FC<RsyncActivityDetailModalProps> = ({
  log,
  isOpen,
  onClose,
}) => {
  const { formatTimestamp } = useTimezone();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !log) return null;

  const handleCopyJson = () => {
    if (!log.details) return;
    navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFailed =
    log.action.includes('FAIL') ||
    log.details?.status === 'FAILED' ||
    Boolean(log.details?.error || log.details?.errorMessage);

  const isDeleted =
    log.action.includes('DELETED') || log.action.includes('DELETE');

  const isSuccess =
    log.action.includes('COMPLETED') ||
    log.action.includes('SUCCESS') ||
    log.details?.status === 'SUCCESS' ||
    log.details?.status === 'ONLINE';

  const isCreated = log.action.includes('CREATED');

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/40 via-slate-950 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl border ${
                isFailed
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : isDeleted
                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                  : isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : isCreated
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              {isFailed ? (
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              ) : isDeleted ? (
                <Trash2 className="h-5 w-5 text-red-400" />
              ) : isSuccess ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : isCreated ? (
                <PlusCircle className="h-5 w-5 text-cyan-400" />
              ) : (
                <Activity className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">Audit Log Inspection</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-800 text-slate-300 border-slate-700">
                  {log.entityType}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    isFailed
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : isDeleted
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : isSuccess
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isCreated
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {log.action}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">ID: {log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block flex items-center space-x-1">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>Timestamp</span>
              </span>
              <span className="font-mono text-slate-200 mt-1 block">
                {formatTimestamp(log.createdAt)}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block truncate mt-0.5">
                UTC: {new Date(log.createdAt).toISOString()}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block flex items-center space-x-1">
                <User className="h-3 w-3 text-slate-400" />
                <span>Triggered By</span>
              </span>
              <span className="font-bold text-white mt-1 block font-mono text-sm">
                {log.username}
              </span>
              <span className="text-[10px] text-slate-500 block">Operator identity</span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
              <span className="text-slate-500 text-[11px] block flex items-center space-x-1">
                <Terminal className="h-3 w-3 text-slate-400" />
                <span>Entity Target</span>
              </span>
              <span className="font-mono text-amber-300 mt-1 block truncate">
                {log.entityId ? log.entityId.slice(0, 14) + '...' : 'System Scope'}
              </span>
              <span className="text-[10px] text-slate-500 block">{log.entityType}</span>
            </div>
          </div>

          {/* Highlights Card (if details available) */}
          {log.details && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                <Info className="h-3.5 w-3.5 text-indigo-400" />
                <span>Structured Summary</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                {log.details.jobName && (
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Job Name:</span>
                    <span className="text-white font-semibold truncate max-w-[200px]" title={log.details.jobName}>
                      {log.details.jobName}
                    </span>
                  </div>
                )}
                {log.details.status && (
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Execution Status:</span>
                    <span
                      className={`font-bold ${
                        log.details.status === 'SUCCESS' || log.details.status === 'ONLINE'
                          ? 'text-emerald-400'
                          : log.details.status === 'FAILED' || log.details.status === 'OFFLINE'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {log.details.status}
                    </span>
                  </div>
                )}
                {log.details.latencyMs !== undefined && (
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Latency:</span>
                    <span className="text-amber-300 font-semibold">{log.details.latencyMs}ms</span>
                  </div>
                )}
                {log.details.jobId && (
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Job ID:</span>
                    <span className="text-slate-300 truncate max-w-[180px]" title={log.details.jobId}>
                      {log.details.jobId}
                    </span>
                  </div>
                )}
                {log.details.serverName && (
                  <div className="flex items-center justify-between bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Server:</span>
                    <span className="text-white font-semibold">{log.details.serverName}</span>
                  </div>
                )}
                {log.details.message && (
                  <div className="col-span-full bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                    <span className="text-slate-400 block text-[10px]">Message:</span>
                    <span>{log.details.message}</span>
                  </div>
                )}
                {log.details.error && (
                  <div className="col-span-full bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-800/60 text-rose-200">
                    <span className="text-rose-400 block text-[10px] font-bold">Error:</span>
                    <span>{log.details.error}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Formatted JSON Payload Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5 uppercase tracking-wider">
                <FileCode className="h-3.5 w-3.5 text-amber-400" />
                <span>Full JSON Payload</span>
              </span>
              {log.details && (
                <button
                  onClick={handleCopyJson}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700 text-[11px] font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] font-mono text-emerald-300/90 overflow-x-auto custom-scrollbar max-h-64 leading-relaxed whitespace-pre-wrap break-all">
              {log.details ? JSON.stringify(log.details, null, 2) : 'No details payload recorded.'}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
