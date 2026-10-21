import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tv,
  Maximize2,
  Minimize2,
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  HardDrive,
  Activity,
  Volume2,
  VolumeX,
  Clock,
  ShieldCheck,
  Database,
  Terminal,
} from 'lucide-react';
import { DashboardStats, BackupReport, FleetSummary } from '../types';
import { api } from '../services/api';
import { useTimezone } from '../context/TimezoneContext';

interface NocWallboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: DashboardStats | null;
  onSelectReport?: (report: BackupReport) => void;
}

export const NocWallboardModal: React.FC<NocWallboardModalProps> = ({
  isOpen,
  onClose,
  stats,
  onSelectReport,
}) => {
  const { formatTimestamp } = useTimezone();

  // State
  const [liveBackups, setLiveBackups] = useState<BackupReport[]>([]);
  const [liveStats, setLiveStats] = useState<DashboardStats | null>(stats);
  const [fleetSummary, setFleetSummary] = useState<FleetSummary | null>(null);
  const [countdown, setCountdown] = useState<number>(30);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('backuppulse_noc_sound') === 'true';
  });
  const [currentTime, setCurrentTime] = useState<string>('');

  // Clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live telemetry stream
  const refreshWallboard = useCallback(async () => {
    try {
      const [backupsRes, statsRes, fleetRes] = await Promise.all([
        api.getBackups({ limit: 12, page: 1 }),
        api.getDashboardStats(),
        api.getFleetSummary().catch(() => null),
      ]);
      setLiveBackups(backupsRes.data);
      setLiveStats(statsRes);
      if (fleetRes) setFleetSummary(fleetRes);
      setCountdown(30);
    } catch (err) {
      console.error('Failed to refresh NOC Wallboard:', err);
    }
  }, []);

  // Refresh interval countdown
  useEffect(() => {
    if (!isOpen) return;
    refreshWallboard();

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refreshWallboard();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, refreshWallboard]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Sound toggle
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('backuppulse_noc_sound', String(next));
  };

  // Keyboard shortcut: Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentStats = liveStats || stats;
  const hasFailures = currentStats ? currentStats.failed24h > 0 : false;
  const successRate = currentStats ? currentStats.successRate : 100;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-y-auto select-none animate-fadeIn">
      {/* 1. NOC Top Header Bar */}
      <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Tv className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="font-black text-lg tracking-wider uppercase text-white">
                BackupPulse Operations Center (NOC)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                Live TV Feed
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              24/7 Production Fleet Monitoring Wallboard • 100+ Nodes
            </p>
          </div>
        </div>

        {/* Live Clock, Countdown & Controls */}
        <div className="flex items-center space-x-4">
          {/* Real-time Clock */}
          <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm font-bold text-slate-200 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-emerald-400" />
            <span>{currentTime}</span>
          </div>

          {/* Countdown to Next Auto-Refresh */}
          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
            <RefreshCw className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
            <span>Sync in {countdown}s</span>
          </div>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
            title={soundEnabled ? 'Audio alerts enabled' : 'Audio alerts muted'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
            title="Toggle Browser Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Exit Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all"
          >
            <X className="h-4 w-4" />
            <span>Exit (Esc)</span>
          </button>
        </div>
      </div>

      {/* 2. Real-time Status Banner */}
      <div className="px-6 py-3 border-b border-slate-800">
        {hasFailures ? (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-600/60 flex items-center justify-between text-rose-200 shadow-lg shadow-rose-950/30 animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-rose-600 text-white font-bold">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-wide uppercase text-rose-300">
                  ⚠️ Critical Attention Required: {currentStats?.failed24h} Backup Incident(s) in last 24h
                </span>
                <p className="text-xs text-rose-400">
                  Engineers on duty: Verify failure logs and trigger remediation procedures.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-900/60 text-white border border-rose-500">
              ACTION NEEDED
            </span>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-600/40 flex items-center justify-between text-emerald-200 shadow-lg shadow-emerald-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-600 text-white font-bold">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-wide uppercase text-emerald-300">
                  🟢 All Fleet Systems Operational — 100% Backup Reliability
                </span>
                <p className="text-xs text-emerald-400/80">
                  Zero critical failures across 100+ production nodes in the active reporting window.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-500/40">
              FLEET OPTIMAL
            </span>
          </div>
        )}
      </div>

      {/* 3. Main Dashboard Body: Big Gauges & Real-time Live Feed */}
      <div className="flex-1 p-6 space-y-6">
        {/* Giant 4-Card Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* SLA / 24h Success Rate */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                24-Hour Success Rate
              </span>
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="my-4">
              <div className="text-5xl font-black tracking-tight text-white flex items-baseline space-x-2">
                <span
                  className={
                    successRate >= 98
                      ? 'text-emerald-400'
                      : successRate >= 90
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                >
                  {successRate.toFixed(1)}%
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {currentStats?.success24h ?? 0} successful / {currentStats?.total24h ?? 0} runs
              </p>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  successRate >= 98
                    ? 'bg-emerald-500'
                    : successRate >= 90
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, successRate)}%` }}
              />
            </div>
          </div>

          {/* Protected Data Volume */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Protected Storage Footprint
              </span>
              <HardDrive className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="my-4">
              <div className="text-5xl font-black tracking-tight text-white">
                {currentStats?.totalStorageHuman || '0 B'}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Across {currentStats?.totalAllTime?.toLocaleString() ?? 0} total archive artifacts
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 self-start">
              Multi-Cloud Vault Sync
            </span>
          </div>

          {/* Monitored Server Fleet */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Monitored Server Fleet
              </span>
              <Server className="h-5 w-5 text-teal-400" />
            </div>
            <div className="my-4">
              <div className="text-5xl font-black tracking-tight text-white">
                {fleetSummary ? fleetSummary.totalServers : currentStats?.activeServersCount ?? 100}+
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {fleetSummary?.healthy ?? currentStats?.activeServersCount ?? 100} active healthy nodes
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-emerald-400">● {fleetSummary?.healthy ?? 0} OK</span>
              <span className="text-amber-400">● {fleetSummary?.stale ?? 0} Stale</span>
              <span className="text-rose-400">● {fleetSummary?.failing ?? 0} Fail</span>
            </div>
          </div>

          {/* Active Incidents */}
          <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                24h Failures & Incidents
              </span>
              <AlertTriangle className="h-5 w-5 text-rose-400" />
            </div>
            <div className="my-4">
              <div
                className={`text-5xl font-black tracking-tight ${
                  hasFailures ? 'text-rose-400 animate-pulse' : 'text-slate-300'
                }`}
              >
                {currentStats?.failed24h ?? 0}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {hasFailures ? 'Requires engineer acknowledgment' : 'Zero active failures recorded'}
              </p>
            </div>
            <span
              className={`text-xs font-mono px-2.5 py-1 rounded-lg border self-start ${
                hasFailures
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {hasFailures ? 'Unresolved Incidents' : 'No Critical Alarms'}
            </span>
          </div>
        </div>

        {/* Live Telemetry Real-time Stream Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <Activity className="h-5 w-5 text-emerald-400 animate-pulse" />
              <h2 className="text-base font-bold text-white tracking-wide uppercase">
                Real-Time Telemetry Stream (Latest Backups)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Auto-polling active (30s)</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Host / Server</th>
                  <th className="py-2.5 px-3">Workload</th>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                {liveBackups.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onSelectReport && onSelectReport(item)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'SUCCESS'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        }`}
                      >
                        {item.status === 'SUCCESS' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        <span>{item.status}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                      {item.projectName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {item.serverId} ({item.serverIp || item.hostname})
                    </td>
                    <td className="py-2.5 px-3 text-indigo-300 uppercase text-[11px]">
                      {item.backupType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                      {item.backupSizeHuman || `${(item.backupSizeBytes / (1024 * 1024)).toFixed(1)} MB`}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                      {item.durationSeconds}s
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-[200px]">
                      {item.s3Bucket || 'Local / S3'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400 whitespace-nowrap">
                      {formatTimestamp(item.startTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
