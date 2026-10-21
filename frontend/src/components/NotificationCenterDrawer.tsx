import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  ExternalLink,
  RefreshCw,
  Eye,
  Check,
  Send,
  Radio,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { BackupReport, NotificationLogItem } from '../types';
import { api } from '../services/api';
import { useTimezone } from '../context/TimezoneContext';

// Clean Web Audio API sound synthesizer
export function playChimeSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    // Pleasant two-tone bell chime: D5 (587 Hz) rising to A5 (880 Hz)
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (err) {
    console.warn('Audio chime playback failed:', err);
  }
}

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReport?: (report: BackupReport) => void;
  onOpenResolveModal?: (report: BackupReport) => void;
}

export const NotificationCenterDrawer: React.FC<NotificationCenterDrawerProps> = ({
  isOpen,
  onClose,
  onSelectReport,
  onOpenResolveModal,
}) => {
  const { formatTimestamp } = useTimezone();

  // State
  const [activeTab, setActiveTab] = useState<'all' | 'failures' | 'delivery'>('all');
  const [failures, setFailures] = useState<BackupReport[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<NotificationLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('backuppulse_audio_alerts') === 'true';
  });
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('backuppulse_read_alert_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Fetch recent alerts and deliveries
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const [failuresRes, deliveryRes] = await Promise.all([
        api.getBackups({ limit: 10, status: 'FAILED' }),
        api.getNotificationLogs({ limit: 15 }).catch(() => ({ data: [] })),
      ]);
      setFailures(failuresRes.data);
      setDeliveryLogs(deliveryRes.data || []);
    } catch (err) {
      console.error('Failed to load alert notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen, loadAlerts]);

  // Mark all as read
  const handleMarkAllRead = () => {
    const allIds = new Set<string>(readIds);
    failures.forEach((f) => allIds.add(f.id));
    deliveryLogs.forEach((d) => allIds.add(d.id));
    setReadIds(allIds);
    localStorage.setItem('backuppulse_read_alert_ids', JSON.stringify(Array.from(allIds)));
  };

  // Toggle sound
  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('backuppulse_audio_alerts', String(next));
    if (next) {
      playChimeSound();
    }
  };

  if (!isOpen) return null;

  const unreadFailures = failures.filter((f) => !readIds.has(f.id));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fadeIn select-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200">
          {/* 1. Header */}
          <div className="p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white tracking-tight">Notification Center</h2>
                  {unreadFailures.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {unreadFailures.length} New
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Live operational alerts & multi-channel receipts</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleToggleSound}
                className={`p-2 rounded-lg border transition-colors ${
                  soundEnabled
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}
                title={soundEnabled ? 'Audio Alerts: ON (Click to mute)' : 'Audio Alerts: MUTED'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* 2. Controls & Tabs Bar */}
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('failures')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'failures'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <span>Failures</span>
                {failures.length > 0 && (
                  <span className="text-[9px] px-1 rounded-full bg-rose-950 border border-rose-700">
                    {failures.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('delivery')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  activeTab === 'delivery'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Deliveries
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-slate-400 hover:text-white transition-colors"
                title="Mark all alerts as acknowledged"
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={loadAlerts}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                title="Refresh alerts"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* 3. Notification List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                <span>Loading latest notifications...</span>
              </div>
            ) : (
              <>
                {/* Critical Failures Section */}
                {(activeTab === 'all' || activeTab === 'failures') && failures.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5 px-1">
                      <AlertTriangle className="h-3 w-3" />
                      <span>Backup Incident Alerts ({failures.length})</span>
                    </div>

                    {failures.map((item) => {
                      const isUnread = !readIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isUnread
                              ? 'bg-rose-950/30 border-rose-600/50 shadow-md shadow-rose-950/20'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2">
                              <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                              <span className="font-bold text-xs text-white">{item.projectName}</span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {item.serverId}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono shrink-0">
                              {formatTimestamp(item.startTime)}
                            </span>
                          </div>

                          {item.errorMessage && (
                            <p className="mt-2 text-[11px] font-mono text-rose-300 bg-rose-950/60 p-2 rounded-lg border border-rose-900/40 truncate">
                              {item.errorMessage}
                            </p>
                          )}

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                            <span className="text-[10px] text-slate-500 uppercase font-mono">
                              Workload: {item.backupType}
                            </span>
                            <div className="flex items-center space-x-2">
                              {onSelectReport && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectReport(item);
                                    onClose();
                                  }}
                                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-[11px] font-medium transition-colors"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Inspect</span>
                                </button>
                              )}
                              {onOpenResolveModal && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenResolveModal(item);
                                    onClose();
                                  }}
                                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors"
                                >
                                  <Check className="h-3 w-3" />
                                  <span>Resolve</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multi-Channel Deliveries Section */}
                {(activeTab === 'all' || activeTab === 'delivery') && deliveryLogs.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5 px-1">
                      <Send className="h-3 w-3 text-indigo-400" />
                      <span>Delivery History ({deliveryLogs.length})</span>
                    </div>

                    {deliveryLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {log.channel}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300 font-medium truncate">
                          {log.message || log.eventType}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span className="truncate max-w-[200px]">{log.recipient || 'Webhook'}</span>
                          <span>{formatTimestamp(log.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {failures.length === 0 && deliveryLogs.length === 0 && (
                  <div className="py-20 text-center text-slate-500 text-xs flex flex-col items-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
                    <p className="font-semibold text-slate-300">All Systems Clear</p>
                    <p className="text-[11px] text-slate-500">
                      No active backup failure alerts or delivery errors.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 4. Footer */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] flex items-center space-x-1.5">
              <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
              <span>Real-time Ingestion Listener</span>
            </span>
            <button
              type="button"
              onClick={playChimeSound}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline decoration-indigo-700"
            >
              Test Chime Tone
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
