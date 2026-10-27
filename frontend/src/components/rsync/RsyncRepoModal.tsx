import React, { useState, useEffect } from 'react';
import { X, HardDrive, Server, Folder, AlertTriangle } from 'lucide-react';
import { RsyncRepository, RsyncServer } from '../../types';
import { api } from '../../services/api';

interface RsyncRepoModalProps {
  repo: RsyncRepository | null;
  servers: RsyncServer[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RsyncRepoModal: React.FC<RsyncRepoModalProps> = ({
  repo,
  servers,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'LOCAL_DISK' | 'REMOTE_SSH'>('LOCAL_DISK');
  const [serverId, setServerId] = useState<string>('');
  const [path, setPath] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (repo) {
      setName(repo.name || '');
      setType(repo.type || 'LOCAL_DISK');
      setServerId(repo.serverId || '');
      setPath(repo.path || '');
      setDescription(repo.description || '');
    } else {
      setName('');
      setType('LOCAL_DISK');
      setServerId(servers.length > 0 ? servers[0].id : '');
      setPath('/data/disk1');
      setDescription('');
    }
    setError(null);
  }, [repo, isOpen, servers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) {
      setError('Please provide repository name and file path.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data: Partial<RsyncRepository> = {
        name: name.trim(),
        type,
        serverId: type === 'REMOTE_SSH' && serverId ? serverId : null,
        path: path.trim(),
        description: description?.trim() || null,
      };

      if (repo) {
        await api.updateRsyncRepository(repo.id, data);
      } else {
        await api.createRsyncRepository(data);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save repository definition');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {repo ? 'Edit Storage Repository' : 'Define Storage Repository / Physical Disk'}
              </h3>
              <p className="text-xs text-slate-400">
                Register a local mounted disk or remote directory endpoint
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Repository Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Local NVMe Disk 1 or SATA Backup Pool Disk 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Storage Location Type</label>
              <select
                value={type}
                onChange={(e: any) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="LOCAL_DISK">Local Host / Docker Mount</option>
                <option value="REMOTE_SSH">Remote Server over SSH</option>
              </select>
            </div>

            {type === 'REMOTE_SSH' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Remote Server <span className="text-rose-400">*</span>
                </label>
                <select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Select Remote Server --</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.host})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
              <span>Directory / Mount Path <span className="text-rose-400">*</span></span>
              <span className="text-[11px] text-slate-500 font-mono">e.g. /data/disk1 or /mnt/storage</span>
            </label>
            <div className="relative">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="/data/disk1"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {type === 'LOCAL_DISK'
                ? 'Matches physical path mounted in docker-compose.yml (e.g. /data/disk1 or /data/disk2)'
                : 'Absolute filesystem path on the remote SSH server.'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Primary 2TB NVMe SSD containing production databases"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
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
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all cursor-pointer"
            >
              {saving ? 'Saving...' : repo ? 'Update Repository' : 'Save Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
