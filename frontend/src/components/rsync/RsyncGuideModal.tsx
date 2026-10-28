import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Server,
  HardDrive,
  Zap,
  Play,
  Terminal,
  Shield,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Key,
  FileCode,
  FolderTree,
  ExternalLink,
  ChevronRight,
  Check,
} from 'lucide-react';

interface RsyncGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'dashboard' | 'jobs' | 'servers' | 'repositories' | 'history' | 'activity') => void;
  onOpenAddServer?: () => void;
  onOpenAddRepo?: () => void;
  onOpenAddJob?: () => void;
}

export const RsyncGuideModal: React.FC<RsyncGuideModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenAddServer,
  onOpenAddRepo,
  onOpenAddJob,
}) => {
  const [activeTab, setActiveTab] = useState<'steps' | 'strategies' | 'tips'>('steps');

  if (!isOpen) return null;

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/50 via-slate-950 to-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Rsync Operations & Architecture Guide
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Step-by-Step
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete workflow for local disk mirroring, cross-server SSH tunnels, and automated snapshots
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

        {/* Sub-Tab Navigation inside Guide */}
        <div className="flex items-center space-x-2 px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('steps')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'steps'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>1. Quick-Start Workflow</span>
          </button>
          <button
            onClick={() => setActiveTab('strategies')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'strategies'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>2. Mirroring Strategies</span>
          </button>
          <button
            onClick={() => setActiveTab('tips')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'tips'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            <span>3. Best Practices & Pro-Tips</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-xs text-slate-300">
          {/* TAB 1: STEP-BY-STEP WORKFLOW */}
          {activeTab === 'steps' && (
            <div className="space-y-6">
              {/* Visual Workflow Steps Roadmap */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Operation Flow Roadmap
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
                  <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/50">
                    <span className="font-mono text-indigo-400 font-bold block">STEP 1</span>
                    <span className="text-white font-medium">Add Servers</span>
                    <span className="text-[10px] text-slate-500 block">(If remote SSH)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50">
                    <span className="font-mono text-emerald-400 font-bold block">STEP 2</span>
                    <span className="text-white font-medium">Mount Repos</span>
                    <span className="text-[10px] text-slate-500 block">Source & Dest paths</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50">
                    <span className="font-mono text-amber-400 font-bold block">STEP 3</span>
                    <span className="text-white font-medium">Create Job</span>
                    <span className="text-[10px] text-slate-500 block">Strategy & Cron</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/50">
                    <span className="font-mono text-purple-400 font-bold block">STEP 4</span>
                    <span className="text-white font-medium">Dry Run</span>
                    <span className="text-[10px] text-slate-500 block">Safe simulation</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/50 col-span-2 sm:col-span-1">
                    <span className="font-mono text-blue-400 font-bold block">STEP 5</span>
                    <span className="text-white font-medium">Run & Monitor</span>
                    <span className="text-[10px] text-slate-500 block">Logs & Audits</span>
                  </div>
                </div>
              </div>

              {/* Step 1 Detail */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold font-mono shrink-0">
                    1
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-white text-sm">Connect Remote SSH Servers (Optional for Remote Sync)</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Remote Servers
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      If either your source files or destination backups live on another server, register its SSH credentials first.
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                      <li>Enter target server IP address, SSH port (default <code className="text-amber-300">22</code>), and SSH username (e.g. <code className="text-amber-300">root</code> or regular user).</li>
                      <li>Select authentication mode: <strong className="text-slate-200">Password</strong> (stored encrypted and injected via <code className="text-amber-300">sshpass</code>) or <strong className="text-slate-200">SSH Private Key</strong>.</li>
                      <li>Click <strong className="text-emerald-400">"Test Connection"</strong> to run a live TCP socket probe and OpenSSH handshake before saving.</li>
                    </ul>
                    <p className="text-[11px] text-slate-500 italic">
                      * If you are only copying between local disks or partitions on the BackupPulse server, you can skip this step!
                    </p>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center gap-2 shrink-0">
                  {onOpenAddServer && (
                    <button
                      onClick={() => handleAction(onOpenAddServer)}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors whitespace-nowrap shadow-md shadow-indigo-950/50"
                    >
                      + Add Server
                    </button>
                  )}
                  {onNavigateTab && (
                    <button
                      onClick={() => handleAction(() => onNavigateTab('servers'))}
                      className="px-3 py-1.5 rounded-xl font-semibold text-[11px] text-indigo-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
                    >
                      View Servers →
                    </button>
                  )}
                </div>
              </div>

              {/* Step 2 Detail */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold font-mono shrink-0">
                    2
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-white text-sm">Mount Storage Repositories & Disks</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Repositories & Disks
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Register the exact folders or disk partitions you want to sync from (Source) and sync to (Destination).
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                      <li>Choose <strong className="text-slate-200">Local Disk</strong> (directories on the BackupPulse host like <code className="text-amber-300">/mnt/storage/</code>) or select a <strong className="text-slate-200">Remote SSH Server</strong>.</li>
                      <li>Specify the absolute filesystem path (e.g. <code className="text-amber-300">/var/www/html/</code> or <code className="text-amber-300">/backup/mysql/</code>).</li>
                      <li>BackupPulse automatically queries filesystem disk usage (<code className="text-amber-300">df -B1</code>) to track free space and prevent disk overfilling.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center gap-2 shrink-0">
                  {onOpenAddRepo && (
                    <button
                      onClick={() => handleAction(onOpenAddRepo)}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors whitespace-nowrap shadow-md shadow-emerald-950/50"
                    >
                      + Mount Disk
                    </button>
                  )}
                  {onNavigateTab && (
                    <button
                      onClick={() => handleAction(() => onNavigateTab('repositories'))}
                      className="px-3 py-1.5 rounded-xl font-semibold text-[11px] text-emerald-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
                    >
                      View Repos →
                    </button>
                  )}
                </div>
              </div>

              {/* Step 3 Detail */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold font-mono shrink-0">
                    3
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-white text-sm">Create Sync Job & Configure Mirroring</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        Sync Jobs
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Tie your source and destination repositories together with a sync strategy and automated schedule.
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                      <li>Select your <strong className="text-slate-200">Source Repository</strong> and <strong className="text-slate-200">Destination Repository</strong>.</li>
                      <li>Choose a strategy: <strong className="text-amber-300">1:1 Exact Mirror</strong> (deletes extraneous target files), <strong className="text-amber-300">Hard-link Snapshots</strong> (time-machine), or <strong className="text-amber-300">Incremental Delta</strong>.</li>
                      <li>Configure an automated Cron schedule (e.g. <code className="text-amber-300">0 2 * * *</code> for daily 2:00 AM) or leave blank for manual-only execution.</li>
                      <li>Optional: Add bandwidth throttling (KB/s) and exclusion patterns (e.g. <code className="text-amber-300">*.log, node_modules/, cache/</code>).</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center gap-2 shrink-0">
                  {onOpenAddJob && (
                    <button
                      onClick={() => handleAction(onOpenAddJob)}
                      className="px-3 py-1.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap shadow-md shadow-amber-950/50"
                    >
                      + Create Job
                    </button>
                  )}
                  {onNavigateTab && (
                    <button
                      onClick={() => handleAction(() => onNavigateTab('jobs'))}
                      className="px-3 py-1.5 rounded-xl font-semibold text-[11px] text-amber-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
                    >
                      View Jobs →
                    </button>
                  )}
                </div>
              </div>

              {/* Step 4 Detail */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold font-mono shrink-0">
                    4
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-white text-sm">Dry-Run Simulation (Recommended Before Running Live)</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Zero Risk
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Always simulate a new or modified sync job before executing it live.
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                      <li>Click the <strong className="text-purple-300">"Dry Run"</strong> button on your job card.</li>
                      <li>Rsync executes with <code className="text-amber-300">--dry-run</code> without modifying, writing, or deleting a single file on the target disk.</li>
                      <li>Review the captured terminal output to verify target paths, permissions, and file lists.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  {onNavigateTab && (
                    <button
                      onClick={() => handleAction(() => onNavigateTab('jobs'))}
                      className="px-3 py-1.5 rounded-xl font-semibold text-[11px] text-purple-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
                    >
                      Go to Jobs →
                    </button>
                  )}
                </div>
              </div>

              {/* Step 5 Detail */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex items-start space-x-3.5">
                  <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold font-mono shrink-0">
                    5
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-white text-sm">Trigger Execution, Monitor History & Audit Trail</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        History & Audit
                      </span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      Run the job manually via <strong className="text-white">"Run Now"</strong> or let the automated cron worker trigger it.
                    </p>
                    <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                      <li>Track real-time transfer stats in <strong className="text-blue-300">Execution History</strong>: bytes synced, transfer speed, duration, and terminal logs.</li>
                      <li>Inspect the tamper-evident <strong className="text-blue-300">Activity Log</strong> to verify who triggered runs, created jobs, or modified configurations.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center gap-2 shrink-0">
                  {onNavigateTab && (
                    <>
                      <button
                        onClick={() => handleAction(() => onNavigateTab('history'))}
                        className="px-3 py-1.5 rounded-xl font-semibold text-[11px] text-blue-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
                      >
                        Run History →
                      </button>
                      <button
                        onClick={() => handleAction(() => onNavigateTab('activity'))}
                        className="px-3 py-1.5 rounded-xl font-semibold text-[11px] text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap"
                      >
                        Audit Log →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MIRRORING STRATEGIES */}
          {activeTab === 'strategies' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
                <h4 className="text-sm font-bold text-white">Understanding Mirroring Strategies</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the appropriate strategy depending on whether you need a strict 1:1 replica, point-in-time snapshots, or safe archiving.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* EXACT_MIRROR */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300 text-xs flex items-center space-x-1.5">
                      <Zap className="h-4 w-4" />
                      <span>Exact 1:1 Mirror (EXACT_MIRROR)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      --delete
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Maintains an exact, identical replica of the source on the destination. Files deleted from the source will be deleted from the destination.
                  </p>
                  <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <strong className="text-slate-200">Ideal for:</strong> Web server root mirroring, warm standby DR replicas, and live data parity.
                  </div>
                </div>

                {/* HARDLINK_SNAPSHOT */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-indigo-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 text-xs flex items-center space-x-1.5">
                      <FolderTree className="h-4 w-4" />
                      <span>Hard-Link Snapshots (HARDLINK_SNAPSHOT)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      --link-dest
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Time-machine style point-in-time snapshots. Unchanged files share physical filesystem inodes, consuming 0 extra bytes of storage.
                  </p>
                  <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <strong className="text-slate-200">Ideal for:</strong> Daily/hourly retention snapshots, anti-ransomware rollback, and long-term history.
                  </div>
                </div>

                {/* BACKUP_DIR */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 text-xs flex items-center space-x-1.5">
                      <Clock className="h-4 w-4" />
                      <span>Incremental Delta (BACKUP_DIR)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      --backup-dir
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Overwritten or deleted destination files are moved into a dated incremental archive subfolder instead of being permanently removed.
                  </p>
                  <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <strong className="text-slate-200">Ideal for:</strong> Safe backups where accidental user file deletions must remain recoverable.
                  </div>
                </div>

                {/* TWO_WAY_SYNC */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-purple-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 text-xs flex items-center space-x-1.5">
                      <Layers className="h-4 w-4" />
                      <span>Two-Way Sync (TWO_WAY_SYNC)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      --update
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Propagates updates in both directions based on modification timestamps, keeping two independent directories in bidirectional sync.
                  </p>
                  <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                    <strong className="text-slate-200">Ideal for:</strong> Shared collaboration folders across multi-office teams or distributed dev setups.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BEST PRACTICES & TIPS */}
          {activeTab === 'tips' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                <h4 className="text-sm font-bold text-white">Operator Best Practices & Production Guidelines</h4>
                <p className="text-xs text-slate-400">
                  Follow these essential tips to avoid common pitfalls with OpenSSH, permissions, and bandwidth.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start space-x-3">
                  <Key className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-white text-xs">Destination Directory Permissions</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      When pushing to a non-root remote user account (e.g. <code className="text-amber-300">user@host</code>), ensure the remote user owns the destination directory (<code className="text-amber-300">chmod 755 /path && chown -R user:user /path</code>).
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start space-x-3">
                  <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-white text-xs">Non-Root Attribute Preservation</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      BackupPulse automatically applies <code className="text-amber-300">--no-owner --no-group --omit-dir-times</code> when pushing to non-root accounts to prevent <code className="text-rose-400">Operation not permitted (code 23)</code> errors.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start space-x-3">
                  <FileCode className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-white text-xs">Trailing Slashes in Paths</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      In rsync, <code className="text-amber-300">/source/</code> with a trailing slash syncs the <em>contents</em> of the directory into the target, whereas <code className="text-amber-300">/source</code> without a slash copies the directory itself.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start space-x-3">
                  <Clock className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-white text-xs">Bandwidth Throttling During Business Hours</h5>
                    <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                      If syncing large files over internet WAN connections, set a Bandwidth Limit (KB/s) in the Job settings to ensure your main network traffic is never saturated.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>OpenSSH and native Rsync 3.5.0 engine fully configured</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
