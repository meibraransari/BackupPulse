import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  ArrowRight,
  HardDrive,
  Clock,
  Sliders,
  Shield,
  Layers,
  Archive,
  RefreshCw,
  AlertTriangle,
  Server,
  Terminal,
  Code2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Cpu,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  HelpCircle,
  FileCode,
} from 'lucide-react';
import { RsyncJob, RsyncRepository, RsyncServer } from '../../types';
import { api } from '../../services/api';

interface RsyncJobModalProps {
  job: RsyncJob | null;
  repositories: RsyncRepository[];
  servers: RsyncServer[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RsyncJobModal: React.FC<RsyncJobModalProps> = ({
  job,
  repositories,
  servers,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [sourceRepoId, setSourceRepoId] = useState('');
  const [sourceSubpath, setSourceSubpath] = useState('');
  const [destRepoId, setDestRepoId] = useState('');
  const [destSubpath, setDestSubpath] = useState('');
  const [sourceServerId, setSourceServerId] = useState('');
  const [destServerId, setDestServerId] = useState('');
  const [syncStrategy, setSyncStrategy] = useState<'EXACT_MIRROR' | 'HARDLINK_SNAPSHOT' | 'BACKUP_DIR'>('EXACT_MIRROR');
  const [cronSchedule, setCronSchedule] = useState('');
  const [bandwidthLimitKb, setBandwidthLimitKb] = useState<number | ''>('');
  const [excludePatterns, setExcludePatterns] = useState<string>('.git\nnode_modules\n*.tmp\n.DS_Store');
  const [customArgs, setCustomArgs] = useState('');
  const [commandMode, setCommandMode] = useState<'SYSTEM' | 'USER'>('SYSTEM');
  const [showCommandBox, setShowCommandBox] = useState(false);
  const [copied, setCopied] = useState(false);

  const [preservePermissions, setPreservePermissions] = useState(true);
  const [preserveOwner, setPreserveOwner] = useState(true);
  const [preserveTimes, setPreserveTimes] = useState(true);
  const [enableCompression, setEnableCompression] = useState(false);
  const [deleteExtraneous, setDeleteExtraneous] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (job) {
      setName(job.name || '');
      setSourceRepoId(job.sourceRepoId || '');
      setSourceSubpath(job.sourceSubpath || '');
      setDestRepoId(job.destRepoId || '');
      setDestSubpath(job.destSubpath || '');
      const sRepo = repositories.find((r) => r.id === job.sourceRepoId);
      const dRepo = repositories.find((r) => r.id === job.destRepoId);
      setSourceServerId(job.sourceServerId || sRepo?.serverId || '');
      setDestServerId(job.destServerId || dRepo?.serverId || '');
      setSyncStrategy(job.syncStrategy || 'EXACT_MIRROR');
      setCronSchedule(job.cronSchedule || '');
      setBandwidthLimitKb(job.bandwidthLimitKb || '');
      setExcludePatterns(job.excludePatterns ? job.excludePatterns.join('\n') : '');
      setCustomArgs(job.customArgs || '');
      setCommandMode(job.commandMode || (job.customArgs?.trim() ? 'USER' : 'SYSTEM'));
      setShowCommandBox(false);
      setPreservePermissions(job.preservePermissions ?? true);
      setPreserveOwner(job.preserveOwner ?? true);
      setPreserveTimes(job.preserveTimes ?? true);
      setEnableCompression(job.enableCompression ?? false);
      setDeleteExtraneous(job.deleteExtraneous ?? true);
      setIsActive(job.isActive ?? true);
    } else {
      setName('');
      const firstRepo = repositories.length > 0 ? repositories[0] : null;
      const secondRepo = repositories.length > 1 ? repositories[1] : firstRepo;
      setSourceRepoId(firstRepo ? firstRepo.id : '');
      setSourceServerId(firstRepo?.serverId || '');
      setSourceSubpath('');
      setDestRepoId(secondRepo ? secondRepo.id : '');
      setDestServerId(secondRepo?.serverId || '');
      setDestSubpath('');
      setSyncStrategy('EXACT_MIRROR');
      setCronSchedule('0 2 * * *');
      setBandwidthLimitKb('');
      setExcludePatterns('.git\nnode_modules\n*.tmp\n.DS_Store');
      setCustomArgs('');
      setCommandMode('SYSTEM');
      setShowCommandBox(false);
      setPreservePermissions(true);
      setPreserveOwner(true);
      setPreserveTimes(true);
      setEnableCompression(false);
      setDeleteExtraneous(true);
      setIsActive(true);
    }
    setError(null);
  }, [job, isOpen, repositories]);

  const selectedSourceRepo = repositories.find((r) => r.id === sourceRepoId);
  const selectedDestRepo = repositories.find((r) => r.id === destRepoId);
  const sourceServerObj = servers.find((s) => s.id === (sourceServerId || selectedSourceRepo?.serverId)) || selectedSourceRepo?.server;
  const destServerObj = servers.find((s) => s.id === (destServerId || selectedDestRepo?.serverId)) || selectedDestRepo?.server;

  const handleSourceRepoChange = (id: string) => {
    setSourceRepoId(id);
    const r = repositories.find((x) => x.id === id);
    setSourceServerId(r?.serverId || '');
  };

  const handleDestRepoChange = (id: string) => {
    setDestRepoId(id);
    const r = repositories.find((x) => x.id === id);
    setDestServerId(r?.serverId || '');
  };

  const EXPERT_PRESETS = [
    { flag: '--partial', label: 'Keep Partial (--partial)', desc: 'Resume interrupted transfers without starting over' },
    { flag: '--inplace', label: 'In-Place Write (--inplace)', desc: 'Update destination files directly without temp copy' },
    { flag: '--sparse', label: 'Sparse Files (-S)', desc: 'Handle sparse files efficiently to save disk blocks' },
    { flag: '--numeric-ids', label: 'Numeric IDs (--numeric-ids)', desc: 'Preserve numeric UID/GID without username mapping' },
    { flag: '--hard-links', label: 'Hard Links (-H)', desc: 'Preserve physical hard links on destination' },
    { flag: '--copy-links', label: 'Copy Links (-L)', desc: 'Transform symlink into referent file/directory' },
    { flag: '--safe-links', label: 'Safe Links', desc: 'Ignore symlinks pointing outside tree' },
    { flag: '--timeout=60', label: 'Timeout 60s (--timeout=60)', desc: 'Prevent rsync hang on unresponsive I/O' },
    { flag: '--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r', label: 'Chmod Standard', desc: 'Enforce standard 755/644 directory/file permissions' },
    { flag: '--prune-empty-dirs', label: 'Prune Empty (-m)', desc: 'Prune empty directory chains from file-list' },
  ];

  const handleTogglePreset = (flag: string) => {
    if (commandMode !== 'USER') {
      setCommandMode('USER');
    }
    const current = customArgs.trim();
    if (current.includes(flag)) {
      const updated = current
        .split(/\s+/)
        .filter((f) => f !== flag)
        .join(' ');
      setCustomArgs(updated);
    } else {
      setCustomArgs(current ? `${current} ${flag}` : flag);
    }
  };

  const generateCommandPreview = () => {
    const isSourceRemote = !!(
      sourceServerObj &&
      sourceServerObj.authType !== 'LOCAL' &&
      sourceServerObj.host !== 'localhost' &&
      sourceServerObj.host !== '127.0.0.1'
    );
    const isDestRemote = !!(
      destServerObj &&
      destServerObj.authType !== 'LOCAL' &&
      destServerObj.host !== 'localhost' &&
      destServerObj.host !== '127.0.0.1'
    );

    const sPath = selectedSourceRepo?.path || '/source/data';
    const sSub = sourceSubpath.trim() ? `/${sourceSubpath.trim().replace(/^\/+/, '')}` : '';
    let src = `${sPath}${sSub}`;
    if (!src.endsWith('/')) src += '/';

    const dPath = selectedDestRepo?.path || '/backup/destination';
    const dSub = destSubpath.trim() ? `/${destSubpath.trim().replace(/^\/+/, '')}` : '';
    let dst = `${dPath}${dSub}`;
    if (!dst.endsWith('/')) dst += '/';

    const args: string[] = ['-av', '--stats'];

    if (!preserveOwner || (destServerObj && destServerObj.username !== 'root')) {
      args.push('--no-owner', '--no-group');
    }
    if (destServerObj && isDestRemote) {
      args.push('--omit-dir-times');
    }
    if (preservePermissions) args.push('-p');
    if (preserveTimes) args.push('-t');
    if (enableCompression) args.push('-z');
    if (deleteExtraneous) args.push('--delete');
    if (bandwidthLimitKb && Number(bandwidthLimitKb) > 0) {
      args.push(`--bwlimit=${bandwidthLimitKb}`);
    }

    const patterns = excludePatterns
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    for (const pat of patterns) {
      args.push(`--exclude='${pat}'`);
    }

    // In USER mode, append custom arguments
    if (commandMode === 'USER' && customArgs.trim()) {
      args.push(customArgs.trim());
    }

    let strategyNote = '';
    if (syncStrategy === 'HARDLINK_SNAPSHOT') {
      args.push('--link-dest=../latest');
      strategyNote = ' # [Strategy: Hardlinked Snapshot]';
      dst = `${dst.replace(/\/+$/, '')}/snapshot_$(date +%Y%m%d_%H%M%S)/`;
    } else if (syncStrategy === 'BACKUP_DIR') {
      const base = dst.replace(/\/+$/, '');
      args.push(`--backup --backup-dir=${base}/recycle_bin/$(date +%Y%m%d_%H%M%S)`);
      strategyNote = ' # [Strategy: Mirror with Recycle Bin]';
      dst = `${base}/current/`;
    }

    const isSameRemote = isSourceRemote && isDestRemote && sourceServerObj?.host === destServerObj?.host;
    const isCrossRemote = isSourceRemote && isDestRemote && sourceServerObj?.host !== destServerObj?.host;

    if (isCrossRemote) {
      const transit = `/tmp/backuppulse_transit_${job?.id ? job.id.slice(0, 8) : 'buf'}/`;
      const srcUserHost = `${sourceServerObj?.username || 'user'}@${sourceServerObj?.host}`;
      const dstUserHost = `${destServerObj?.username || 'user'}@${destServerObj?.host}`;
      const sshFlagSrc = `-e "ssh -p ${sourceServerObj?.port || 22} -o StrictHostKeyChecking=no"`;
      const sshFlagDst = `-e "ssh -p ${destServerObj?.port || 22} -o StrictHostKeyChecking=no"`;

      return `# [BACKUPPULSE BRIDGE] Cross-Server Two-Stage Delta Synchronization${strategyNote}\n` +
        `# Phase 1: Pull delta from remote source into transit buffer\n` +
        `rsync ${args.join(' ')} ${sshFlagSrc} ${srcUserHost}:${src} ${transit}\n\n` +
        `# Phase 2: Push transit buffer delta to remote destination\n` +
        `rsync ${args.join(' ')} ${sshFlagDst} ${transit} ${dstUserHost}:${dst}`;
    }

    if (isSameRemote) {
      const srv = destServerObj || sourceServerObj;
      const userHost = `${srv?.username || 'user'}@${srv?.host}`;
      const sshCmd = `ssh -p ${srv?.port || 22} -o StrictHostKeyChecking=no ${userHost}`;
      return `# Direct Native Remote Execution via SSH tunnel (Local drive bus speed)${strategyNote}\n` +
        `${sshCmd} "mkdir -p '${dst}' && rsync ${args.join(' ')} '${src}' '${dst}'"`;
    }

    let srcEp = src;
    let dstEp = dst;
    let sshFlag = '';

    if (isSourceRemote && sourceServerObj) {
      srcEp = `${sourceServerObj.username || 'user'}@${sourceServerObj.host}:${src}`;
      sshFlag = `-e "ssh -p ${sourceServerObj.port || 22} -o StrictHostKeyChecking=no" `;
    } else if (isDestRemote && destServerObj) {
      dstEp = `${destServerObj.username || 'user'}@${destServerObj.host}:${dst}`;
      sshFlag = `-e "ssh -p ${destServerObj.port || 22} -o StrictHostKeyChecking=no" `;
    }

    return `rsync ${args.join(' ')} ${sshFlag}${srcEp} ${dstEp}${strategyNote}`.trim();
  };

  const handleCopyCommand = () => {
    const cmd = generateCommandPreview();
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sourceRepoId || !destRepoId) {
      setError('Please provide job name, source repository, and destination repository.');
      return;
    }

    if (sourceRepoId === destRepoId && (!sourceSubpath || sourceSubpath === destSubpath)) {
      setError('Source and Destination repositories cannot point to the exact same folder.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const patterns = excludePatterns
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const payload: Partial<RsyncJob> = {
        name: name.trim(),
        sourceRepoId,
        sourceSubpath: sourceSubpath.trim() || null,
        destRepoId,
        destSubpath: destSubpath.trim() || null,
        sourceServerId: sourceServerId || null,
        destServerId: destServerId || null,
        syncStrategy,
        cronSchedule: cronSchedule.trim() || null,
        bandwidthLimitKb: bandwidthLimitKb !== '' ? Number(bandwidthLimitKb) : null,
        excludePatterns: patterns,
        customArgs: commandMode === 'USER' && customArgs.trim() ? customArgs.trim() : null,
        commandMode,
        preservePermissions,
        preserveOwner,
        preserveTimes,
        enableCompression,
        deleteExtraneous,
        isActive,
      };

      if (job) {
        await api.updateRsyncJob(job.id, payload);
      } else {
        await api.createRsyncJob(payload);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save rsync job');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white">
                  {job ? 'Edit Rsync Mirror Job' : 'Configure New Rsync & Mirror Job'}
                </h3>
                {commandMode === 'USER' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                    <Terminal className="h-3 w-3" />
                    <span>User Managed</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center space-x-1">
                    <Cpu className="h-3 w-3" />
                    <span>System Managed</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Setup automated 1:1 disk mirroring, incremental snapshots, and bandwidth controls
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Job Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Job Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Daily NVMe SSD to SATA Storage Pool Mirror"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Source and Destination Repositories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
            {/* Source */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                <HardDrive className="h-4 w-4" />
                <span>Source (Disk 1)</span>
              </span>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Repository / Disk</label>
                <select
                  value={sourceRepoId}
                  onChange={(e) => handleSourceRepoChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Select Source Disk --</option>
                  {repositories.map((r) => {
                    const s = servers.find((srv) => srv.id === r.serverId) || r.server;
                    return (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.path}) {s ? `— [Remote: ${s.name} (${s.host})]` : '— [Local Disk]'}
                      </option>
                    );
                  })}
                </select>
                {selectedSourceRepo && (
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-1.5">
                    <span className="text-slate-500 font-medium">Node:</span>
                    {sourceServerObj ? (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 flex items-center space-x-1">
                        <Server className="h-3 w-3" />
                        <span>Remote: {sourceServerObj.name} ({sourceServerObj.host})</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 flex items-center space-x-1">
                        <HardDrive className="h-3 w-3" />
                        <span>Local Host Disk</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Sub-folder (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. mysql_data or www"
                  value={sourceSubpath}
                  onChange={(e) => setSourceSubpath(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Destination */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
                <HardDrive className="h-4 w-4" />
                <span>Destination (Disk 2 / Mirror)</span>
              </span>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Repository / Disk</label>
                <select
                  value={destRepoId}
                  onChange={(e) => handleDestRepoChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Target Disk --</option>
                  {repositories.map((r) => {
                    const s = servers.find((srv) => srv.id === r.serverId) || r.server;
                    return (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.path}) {s ? `— [Remote: ${s.name} (${s.host})]` : '— [Local Disk]'}
                      </option>
                    );
                  })}
                </select>
                {selectedDestRepo && (
                  <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-1.5">
                    <span className="text-slate-500 font-medium">Node:</span>
                    {destServerObj ? (
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 flex items-center space-x-1">
                        <Server className="h-3 w-3" />
                        <span>Remote: {destServerObj.name} ({destServerObj.host})</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 flex items-center space-x-1">
                        <HardDrive className="h-3 w-3" />
                        <span>Local Host Disk</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Sub-folder (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. mirrors/mysql_data"
                  value={destSubpath}
                  onChange={(e) => setDestSubpath(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sync Topology Banner */}
            <div className="md:col-span-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-300 flex items-center space-x-2">
              <Zap className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                {sourceServerObj && destServerObj && sourceServerObj.host === destServerObj.host ? (
                  <>
                    <strong className="text-cyan-300">Direct Remote Execution:</strong> Both folders reside on remote host <code className="text-amber-300 px-1 py-0.5 rounded bg-slate-950 border border-slate-800">{sourceServerObj.host}</code>. Rsync will execute natively on that server via SSH at local drive bus speed.
                  </>
                ) : sourceServerObj && destServerObj && sourceServerObj.host !== destServerObj.host ? (
                  <>
                    <strong className="text-indigo-300">Cross-Server Sync Bridge:</strong> Transferring across two remote servers (<code className="text-amber-300 px-1 py-0.5 rounded bg-slate-950 border border-slate-800">{sourceServerObj.host}</code> ➔ <code className="text-emerald-300 px-1 py-0.5 rounded bg-slate-950 border border-slate-800">{destServerObj.host}</code>) orchestrated via BackupPulse delta bridge.
                  </>
                ) : (sourceServerObj && !destServerObj) || (!sourceServerObj && destServerObj) ? (
                  <>
                    <strong className="text-emerald-300">Remote Sync Tunnel:</strong> Syncing between local host and remote node <code className="text-amber-300 px-1 py-0.5 rounded bg-slate-950 border border-slate-800">{sourceServerObj?.host || destServerObj?.host}</code> over SSH.
                  </>
                ) : (
                  <>
                    <strong className="text-amber-300">Local Disk Mirror:</strong> Direct 1:1 disk transfer on local host storage pool.
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Sync Strategy Cards */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Synchronization & Versioning Strategy
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Strategy 1: Exact Mirror */}
              <div
                onClick={() => setSyncStrategy('EXACT_MIRROR')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  syncStrategy === 'EXACT_MIRROR'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">Exact 1:1 Mirror</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 font-mono">--delete</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Disk 2 is an exact clone of Disk 1. Minimal space used; deletes synced.
                </p>
              </div>

              {/* Strategy 2: Time-Machine Hardlink Snapshots */}
              <div
                onClick={() => setSyncStrategy('HARDLINK_SNAPSHOT')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  syncStrategy === 'HARDLINK_SNAPSHOT'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">Time-Machine Snapshots</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 font-mono">--link-dest</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Creates dated snapshot folders using hardlinks. Zero space for unchanged files!
                </p>
              </div>

              {/* Strategy 3: Mirror with Safe Recycle Bin */}
              <div
                onClick={() => setSyncStrategy('BACKUP_DIR')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  syncStrategy === 'BACKUP_DIR'
                    ? 'bg-purple-500/15 border-purple-500 text-white shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-white">Mirror + Recycle Bin</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 font-mono">--backup-dir</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Latest mirror in /current, but modified/deleted files moved to /recycle_bin/DATE.
                </p>
              </div>
            </div>
          </div>

          {/* Schedule & Throttling */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Automated Cron Schedule</span>
              </label>
              <input
                type="text"
                placeholder="0 2 * * * (Leave empty for manual only)"
                value={cronSchedule}
                onChange={(e) => setCronSchedule(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Standard 5-part cron syntax (e.g. "0 2 * * *" = Daily at 2 AM)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Bandwidth Limit (KB/s)
              </label>
              <input
                type="number"
                placeholder="Unlimited (e.g. 50000 = 50 MB/s)"
                value={bandwidthLimitKb}
                onChange={(e) => setBandwidthLimitKb(e.target.value ? parseInt(e.target.value, 10) : '')}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Prevents saturation of physical disk bus or network bandwidth
              </span>
            </div>
          </div>

          {/* Exclude Patterns */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Exclude Patterns (one per line)</span>
              <span className="text-[10px] text-slate-500 font-mono">--exclude</span>
            </label>
            <textarea
              rows={4}
              placeholder=".git&#10;node_modules&#10;*.tmp&#10;*.log&#10;.DS_Store"
              value={excludePatterns}
              onChange={(e) => setExcludePatterns(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 min-h-[90px] resize-y"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preservePermissions}
                onChange={(e) => setPreservePermissions(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-slate-300">Preserve Permissions (-p)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveOwner}
                onChange={(e) => setPreserveOwner(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-slate-300">Preserve Owner/Group (-o -g)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveTimes}
                onChange={(e) => setPreserveTimes(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-slate-300">Preserve Times (-t)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableCompression}
                onChange={(e) => setEnableCompression(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-slate-300">Compress Data (-z)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deleteExtraneous}
                onChange={(e) => setDeleteExtraneous(e.target.checked)}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <span className="text-slate-300">Prune Deleted Files (--delete)</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span className="text-emerald-400 font-semibold">Enable Schedule</span>
            </label>
          </div>

          {/* ========================================================================= */}
          {/* RSYNC COMMAND BEHIND THE SCENES - INSPECTOR & CUSTOMIZER */}
          {/* ========================================================================= */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            {/* The Trigger Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 gap-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-xl border flex items-center justify-center shrink-0 ${
                  commandMode === 'USER'
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                }`}>
                  <Terminal className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white">Underlying Rsync Command</span>
                    {commandMode === 'USER' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>User Managed</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-900 text-slate-300 border border-slate-800 flex items-center space-x-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>System Managed</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {commandMode === 'USER'
                      ? 'Custom Linux parameters and flags are actively overriding default execution'
                      : 'Automatically computed behind the scenes based on your configuration'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCommandBox(!showCommandBox)}
                className={`flex items-center justify-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer ${
                  showCommandBox
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                }`}
              >
                <Code2 className="h-3.5 w-3.5 text-amber-400" />
                <span>{showCommandBox ? 'Close Command Console' : 'View / Modify Rsync Command'}</span>
                {showCommandBox ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Expanded Box / Drawer */}
            {showCommandBox && (
              <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-4 animate-fadeIn">
                {/* Mode Selector Cards */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                    <span>Command Management Mode:</span>
                    <span className="text-[10px] text-slate-500">Choose between automated construction or manual expert overrides</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* System Managed Option */}
                    <div
                      onClick={() => setCommandMode('SYSTEM')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        commandMode === 'SYSTEM'
                          ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-md'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <Cpu className={`h-4 w-4 ${commandMode === 'SYSTEM' ? 'text-cyan-400' : 'text-slate-400'}`} />
                          <span className="font-bold text-xs text-white">System Managed</span>
                        </div>
                        {commandMode === 'SYSTEM' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        BackupPulse automatically generates and computes optimal flags, security wrappers, and topology bridges.
                      </p>
                    </div>

                    {/* User Managed Option */}
                    <div
                      onClick={() => setCommandMode('USER')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        commandMode === 'USER'
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <Terminal className={`h-4 w-4 ${commandMode === 'USER' ? 'text-amber-400' : 'text-slate-400'}`} />
                          <span className="font-bold text-xs text-white">User Managed (Linux Expert)</span>
                        </div>
                        {commandMode === 'USER' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Linux expert freedom. Specify custom parameters, tuning arguments, and overrides directly. Flagged as User Managed.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Command Preview Terminal */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-mono flex items-center space-x-1.5">
                      <Terminal className="h-3.5 w-3.5 text-amber-400" />
                      <span>Live Rsync Execution Shell</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCommand}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-semibold transition-colors cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-400" />
                          <span>Copy Command</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto shadow-inner whitespace-pre-wrap select-all selection:bg-amber-500/30 selection:text-white">
                    <span className="text-emerald-400 font-bold">$ </span>
                    {generateCommandPreview()}
                  </div>
                </div>

                {/* User Managed Parameters Editor */}
                {commandMode === 'USER' && (
                  <div className="space-y-3 pt-3 border-t border-slate-800/80 animate-fadeIn">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
                          <Sliders className="h-3.5 w-3.5" />
                          <span>Custom Linux Rsync Parameters:</span>
                        </label>
                        {customArgs.trim() && (
                          <button
                            type="button"
                            onClick={() => setCustomArgs('')}
                            className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center space-x-1 transition-colors"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Clear Custom Args</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. --partial --inplace --sparse --numeric-ids --hard-links --timeout=60"
                        value={customArgs}
                        onChange={(e) => setCustomArgs(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400 shadow-inner"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        These arguments will be appended directly to the rsync command during sync and dry runs.
                      </span>
                    </div>

                    {/* Quick Linux Expert Preset Chips */}
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                        Quick Preset Flags (Click to toggle):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {EXPERT_PRESETS.map((preset) => {
                          const isApplied = customArgs.split(/\s+/).includes(preset.flag);
                          return (
                            <button
                              key={preset.flag}
                              type="button"
                              onClick={() => handleTogglePreset(preset.flag)}
                              title={preset.desc}
                              className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all flex items-center space-x-1 cursor-pointer ${
                                isApplied
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                              }`}
                            >
                              <span>{isApplied ? '✓' : '+'}</span>
                              <span>{preset.flag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reset Button */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCommandMode('SYSTEM');
                          setCustomArgs('');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-[11px] font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Revert to System Managed Default</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>{saving ? 'Saving...' : job ? 'Update Sync Job' : 'Create Sync Job'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
