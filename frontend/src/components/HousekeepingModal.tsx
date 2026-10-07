import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Database,
  Trash2,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  HardDrive,
  Calendar,
  Sparkles,
  Server,
} from 'lucide-react';
import { api } from '../services/api';
import { HousekeepingStatus } from '../types';

interface HousekeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCleanupComplete?: () => void;
}

export const HousekeepingModal: React.FC<HousekeepingModalProps> = ({
  isOpen,
  onClose,
  onCleanupComplete,
}) => {
  const [status, setStatus] = useState<HousekeepingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cleaning, setCleaning] = useState<boolean>(false);
  const [retentionDaysInput, setRetentionDaysInput] = useState<number>(365);
  const [confirmPrompt, setConfirmPrompt] = useState<boolean>(false);
  const [cleanupResult, setCleanupResult] = useState<{
    success: boolean;
    message: string;
    deletedBackupReports: number;
    deletedNotificationLogs: number;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.getHousekeepingStatus();
      setStatus(res);
      setRetentionDaysInput(res.retentionDays || 365);
    } catch (err) {
      console.error('Failed to query housekeeping status:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setCleanupResult(null);
      setConfirmPrompt(false);
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  const handleRunCleanup = async () => {
    setCleaning(true);
    setCleanupResult(null);
    try {
      const res = await api.triggerCleanup(retentionDaysInput);
      setCleanupResult(res);
      setConfirmPrompt(false);
      // Refresh current counts
      await fetchStatus();
      if (onCleanupComplete) {
        onCleanupComplete();
      }
    } catch (err: any) {
      setCleanupResult({
        success: false,
        message: err.message || 'Cleanup operation failed',
        deletedBackupReports: 0,
        deletedNotificationLogs: 0,
      });
    } finally {
      setCleaning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Database Storage & Housekeeping
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  {status?.retentionDays ?? 365} Days Retention
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated database hygiene, historical log purge, and storage capacity controls.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Storage Status"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-sm">Inspecting PostgreSQL storage metrics...</p>
            </div>
          ) : (
            <>
              {/* Storage KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Configured Retention</span>
                    <Clock className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2">
                    {status?.retentionDays} <span className="text-xs text-slate-400 font-normal">days</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                    <span>Cron:</span>
                    <code className="text-slate-300 font-mono">{status?.housekeepingCron || '0 3 * * *'}</code>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Backup Telemetry Records</span>
                    <HardDrive className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2">
                    {status?.backupReports.total.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Eligible for purge:{' '}
                    <strong className="text-amber-400">
                      {status?.backupReports.eligibleForCleanup.toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>Alert Delivery Logs</span>
                    <Sparkles className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="text-2xl font-bold text-white mt-2">
                    {status?.notificationLogs.total.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Eligible for purge:{' '}
                    <strong className="text-amber-400">
                      {status?.notificationLogs.eligibleForCleanup.toLocaleString()}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Cutoff Date Info Banner */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-slate-300">
                  <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    Historical cutoff date: Records older than{' '}
                    <strong className="text-white font-mono">{status?.cutoffDate}</strong> are safely archived or
                    eligible for cleanup.
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-700/40">
                  Auto-Purge Active
                </span>
              </div>

              {/* Cleanup Results Banner */}
              {cleanupResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                    cleanupResult.success
                      ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-200'
                      : 'bg-rose-950/40 border-rose-600/50 text-rose-200'
                  }`}
                >
                  {cleanupResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <strong className="block text-sm font-semibold mb-0.5">
                      {cleanupResult.success ? 'Housekeeping Succeeded' : 'Operation Error'}
                    </strong>
                    <p>{cleanupResult.message}</p>
                    {cleanupResult.success && (
                      <div className="mt-1 font-mono text-[11px] text-emerald-300">
                        Purged: {cleanupResult.deletedBackupReports} telemetry reports •{' '}
                        {cleanupResult.deletedNotificationLogs} alert logs
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Cleanup Action Box */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-white font-semibold text-sm">
                    <Trash2 className="h-4 w-4 text-rose-400" />
                    <span>Run On-Demand Database Housekeeping</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Manual Execution</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Permanently remove database telemetry records and notification audit logs older than the specified
                  retention threshold to reclaim PostgreSQL disk space.
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-xs text-slate-300 font-medium">Retention Window:</label>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        max="3650"
                        value={retentionDaysInput}
                        onChange={(e) => setRetentionDaysInput(Math.max(1, parseInt(e.target.value) || 365))}
                        className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white text-center focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-xs text-slate-400">days</span>
                    </div>
                  </div>

                  {!confirmPrompt ? (
                    <button
                      onClick={() => setConfirmPrompt(true)}
                      disabled={cleaning}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-200 bg-rose-950/80 hover:bg-rose-900 border border-rose-600/40 hover:text-white transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>Run Cleanup Now</span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2 animate-in fade-in">
                      <span className="text-xs text-rose-400 font-semibold">Confirm purge?</span>
                      <button
                        onClick={handleRunCleanup}
                        disabled={cleaning}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center space-x-1 shadow-md shadow-rose-700/30"
                      >
                        {cleaning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Yes, Purge</span>
                      </button>
                      <button
                        onClick={() => setConfirmPrompt(false)}
                        disabled={cleaning}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-500">
          <span>Configured via DB_RETENTION_DAYS & HOUSEKEEPING_CRON in .env</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
