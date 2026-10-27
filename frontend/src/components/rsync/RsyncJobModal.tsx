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
      setSourceServerId(job.sourceServerId || '');
      setDestServerId(job.destServerId || '');
      setSyncStrategy(job.syncStrategy || 'EXACT_MIRROR');
      setCronSchedule(job.cronSchedule || '');
      setBandwidthLimitKb(job.bandwidthLimitKb || '');
      setExcludePatterns(job.excludePatterns ? job.excludePatterns.join('\n') : '');
      setCustomArgs(job.customArgs || '');
      setPreservePermissions(job.preservePermissions ?? true);
      setPreserveOwner(job.preserveOwner ?? true);
      setPreserveTimes(job.preserveTimes ?? true);
      setEnableCompression(job.enableCompression ?? false);
      setDeleteExtraneous(job.deleteExtraneous ?? true);
      setIsActive(job.isActive ?? true);
    } else {
      setName('');
      setSourceRepoId(repositories.length > 0 ? repositories[0].id : '');
      setSourceSubpath('');
      setDestRepoId(repositories.length > 1 ? repositories[1].id : repositories.length > 0 ? repositories[0].id : '');
      setDestSubpath('');
      setSourceServerId('');
      setDestServerId('');
      setSyncStrategy('EXACT_MIRROR');
      setCronSchedule('0 2 * * *');
      setBandwidthLimitKb('');
      setExcludePatterns('.git\nnode_modules\n*.tmp\n.DS_Store');
      setCustomArgs('');
      setPreservePermissions(true);
      setPreserveOwner(true);
      setPreserveTimes(true);
      setEnableCompression(false);
      setDeleteExtraneous(true);
      setIsActive(true);
    }
    setError(null);
  }, [job, isOpen, repositories]);

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
        customArgs: customArgs.trim() || null,
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
              <h3 className="text-base font-bold text-white">
                {job ? 'Edit Rsync Mirror Job' : 'Configure New Rsync & Mirror Job'}
              </h3>
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
                  onChange={(e) => setSourceRepoId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Select Source Disk --</option>
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.path})
                    </option>
                  ))}
                </select>
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
                  onChange={(e) => setDestRepoId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Target Disk --</option>
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.path})
                    </option>
                  ))}
                </select>
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
              rows={5}
              placeholder=".git&#10;node_modules&#10;*.tmp&#10;*.log&#10;.DS_Store"
              value={excludePatterns}
              onChange={(e) => setExcludePatterns(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 min-h-[110px] resize-y"
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

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : job ? 'Update Sync Job' : 'Create Sync Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
