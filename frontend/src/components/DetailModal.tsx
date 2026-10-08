import React, { useState } from 'react';
import { X, Copy, Check, Terminal, AlertCircle, HardDrive, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BackupReport } from '../types';

interface DetailModalProps {
  report: BackupReport | null;
  onClose: () => void;
  onMarkSuccess?: (report: BackupReport) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ report, onClose, onMarkSuccess }) => {
  const [copiedKey, setCopiedKey] = useState(false);

  if (!report) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                report.status === 'SUCCESS'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                  : 'bg-red-950 text-red-400 border border-red-800/50'
              }`}
            >
              {report.status}
            </span>
            {report.status !== 'FAILED' && (
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase flex items-center space-x-1.5 ${
                  report.isExpired || report.availabilityStatus === 'EXPIRED'
                    ? 'bg-red-950 text-red-400 border border-red-800/70'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    report.isExpired || report.availabilityStatus === 'EXPIRED' ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'
                  }`}
                />
                <span>{report.isExpired || report.availabilityStatus === 'EXPIRED' ? 'Expired' : 'Active'}</span>
              </span>
            )}
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{report.projectName}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">({report.zipFilename})</span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Failure Alert Banner (if failed) with Resolve Action */}
          {report.status === 'FAILED' && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 text-red-300 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-sm font-semibold text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Backup Failure Detected</span>
                </div>
                {onMarkSuccess && (
                  <button
                    onClick={() => onMarkSuccess(report)}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center space-x-1.5 shadow-md shadow-emerald-700/30"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Mark as Resolved (Convert to Success)</span>
                  </button>
                )}
              </div>
              {report.errorMessage && (
                <p className="text-xs font-mono bg-red-950/80 p-2.5 rounded-lg border border-red-900/50">
                  {report.errorMessage}
                </p>
              )}
            </div>
          )}

          {/* Anomaly Warning Banner (if size anomaly detected) */}
          {report.isAnomaly && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 space-y-1.5">
              <div className="flex items-center space-x-2 text-sm font-semibold text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Backup Size Anomaly Guard</span>
              </div>
              <p className="text-xs font-mono bg-amber-950/80 p-2.5 rounded-lg border border-amber-900/50 text-amber-300">
                {report.anomalyReason || 'Significant size drop (>70%) or zero-byte backup archive detected.'}
              </p>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Host / Server</span>
              <p className="text-xs font-mono font-medium text-slate-200 mt-0.5 truncate">{report.serverId}</p>
              <p className="text-[10px] text-slate-500 font-mono">{report.serverIp || report.hostname}</p>
            </div>

            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Archive Size</span>
              <p className="text-xs font-mono font-medium text-slate-200 mt-0.5">{report.backupSizeHuman || '0 B'}</p>
              <p className="text-[10px] text-slate-500 font-mono">{Number(report.backupSizeBytes).toLocaleString()} B</p>
            </div>

            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Execution Duration</span>
              <p className="text-xs font-mono font-medium text-slate-200 mt-0.5">{report.durationSeconds} seconds</p>
              <p className="text-[10px] text-slate-500 font-mono">Exit code: {report.exitCode}</p>
            </div>

            <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400">Backup Type</span>
              <p className="text-xs font-mono font-medium uppercase text-emerald-400 mt-0.5">{report.backupType}</p>
              <p className="text-[10px] text-slate-500 capitalize">{report.environment}</p>
            </div>
          </div>

          {/* S3 Details */}
          <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <HardDrive className="h-3.5 w-3.5 text-blue-400" />
                <span>AWS S3 Object Location</span>
              </span>
              {report.s3Url && (
                <button
                  onClick={() => copyToClipboard(report.s3Url!)}
                  className="flex items-center space-x-1 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy URI'}</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="text-slate-400 flex items-center">
                <span className="w-28 text-slate-500">Vault Status:</span>
                <span className="text-slate-200 flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      report.status === 'FAILED'
                        ? 'bg-slate-800 text-slate-400'
                        : report.isExpired || report.availabilityStatus === 'EXPIRED'
                        ? 'bg-red-950 text-red-400 border border-red-800/70'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    }`}
                  >
                    {report.status === 'FAILED'
                      ? 'N/A'
                      : report.isExpired || report.availabilityStatus === 'EXPIRED'
                      ? 'Expired'
                      : 'Active in Bucket'}
                  </span>
                  {report.expiresAt && (
                    <span className="text-[11px] text-slate-400">
                      ({report.isExpired || report.availabilityStatus === 'EXPIRED' ? 'Expired' : 'Expires'}: {new Date(report.expiresAt).toLocaleDateString()}
                      {report.daysRemaining !== null && report.daysRemaining !== undefined ? ` • ${report.daysRemaining}d left` : ''}
                      {report.daysAgoExpired !== null && report.daysAgoExpired !== undefined ? ` • ${report.daysAgoExpired}d ago` : ''})
                    </span>
                  )}
                </span>
              </div>
              <div className="text-slate-400 flex items-center">
                <span className="w-28 text-slate-500">Retention:</span>
                <span className="text-slate-200">
                  {report.retentionDays ? `${report.retentionDays} Days (S3 retention policy)` : 'Default / Not Specified'}
                </span>
              </div>
              <div className="text-slate-400 flex items-center">
                <span className="w-28 text-slate-500">S3 Bucket:</span>
                <span className="text-slate-200">{report.s3Bucket || 'N/A'}</span>
              </div>
              <div className="text-slate-400 flex items-center">
                <span className="w-28 text-slate-500">S3 Key:</span>
                <span className="text-slate-200 break-all">{report.s3Key || 'N/A'}</span>
              </div>
              {report.checksum && (
                <div className="text-slate-400 flex items-center">
                  <span className="w-28 text-slate-500">Checksum:</span>
                  <span className="text-slate-300 break-all">{report.checksum}</span>
                </div>
              )}
            </div>
          </div>

          {/* Execution Logs */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span>Shell Script Execution Logs</span>
            </div>

            {/* Stderr Log */}
            {report.stderrLog && (
              <div>
                <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wide">Error Log (stderr)</span>
                <pre className="mt-1 p-3.5 bg-black/80 rounded-xl border border-red-900/40 text-red-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-40">
                  {report.stderrLog}
                </pre>
              </div>
            )}

            {/* Stdout Log */}
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Output Log (stdout)</span>
              <pre className="mt-1 p-3.5 bg-black/80 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
                {report.stdoutLog || 'No standard output recorded.'}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>Started: {new Date(report.startTime).toLocaleString()}</span>
          <span>Finished: {new Date(report.endTime).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
