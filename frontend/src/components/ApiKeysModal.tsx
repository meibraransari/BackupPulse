import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Server,
  FolderGit2,
  Clock,
  ShieldAlert,
  Loader2,
  Search,
  CheckCircle2,
  Calendar,
  Ban,
} from 'lucide-react';
import { api } from '../services/api';
import { ApiKeyItem, User } from '../types';
import { useTimezone } from '../context/TimezoneContext';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({ isOpen, onClose, user }) => {
  const { formatTimestamp } = useTimezone();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState<boolean>(false);

  // Creation form state
  const [name, setName] = useState<string>('');
  const [serverId, setServerId] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [expiryDays, setExpiryDays] = useState<string>('0');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Created key display banner
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ token: string; name: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Revoke state
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.getApiKeys();
      setKeys(res.data);
    } catch (err: any) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
      setShowCreateForm(false);
      setNewlyCreatedKey(null);
      setKeyToRevoke(null);
      setRevokeError(null);
      setFormError(null);
    }
  }, [isOpen, fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Token description name is required.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const res = await api.createApiKey({
        name: name.trim(),
        serverId: serverId.trim() || undefined,
        projectName: projectName.trim() || undefined,
        expiresInDays: Number(expiryDays) > 0 ? Number(expiryDays) : undefined,
      });

      setNewlyCreatedKey({ token: res.key, name: res.apiKey.name });
      setShowCreateForm(false);
      setName('');
      setServerId('');
      setProjectName('');
      setExpiryDays('0');
      fetchKeys();
    } catch (err: any) {
      setFormError(err.message || 'Failed to generate API token');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRevoke = (keyItem: ApiKeyItem) => {
    setKeyToRevoke(keyItem);
    setRevokeError(null);
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;
    setRevokingId(keyToRevoke.id);
    setRevokeError(null);
    try {
      await api.revokeApiKey(keyToRevoke.id);
      setKeyToRevoke(null);
      await fetchKeys();
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to revoke token');
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  if (!isOpen) return null;

  const filteredKeys = keys.filter((k) => {
    const q = search.toLowerCase();
    return (
      k.name.toLowerCase().includes(q) ||
      k.keyPrefix.toLowerCase().includes(q) ||
      (k.serverId && k.serverId.toLowerCase().includes(q)) ||
      (k.projectName && k.projectName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Key className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">API Token Management</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  {keys.filter((k) => k.isActive).length} Active Tokens
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Provision scoped ingestion tokens per server or project with 1-click revocation
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-md shadow-emerald-900/30"
              >
                <Plus className="h-4 w-4" />
                <span>Generate Token</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Newly Generated Key Alert Banner */}
        {newlyCreatedKey && (
          <div className="px-6 py-4 bg-emerald-950/40 border-b border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span>New Token Created: &ldquo;{newlyCreatedKey.name}&rdquo;</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Copy this secret key now. For security purposes, <strong className="text-amber-400">it will NEVER be shown again!</strong>
              </p>
              <div className="font-mono text-xs text-emerald-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-emerald-600/40 select-all break-all max-w-xl">
                {newlyCreatedKey.token}
              </div>
            </div>
            <button
              onClick={() => copyToClipboard(newlyCreatedKey.token)}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex-shrink-0"
            >
              {copiedToken ? (
                <>
                  <Check className="h-4 w-4 text-white" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 text-white" />
                  <span>Copy Secret Token</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Generate Token Form (Collapsible) */}
        {showCreateForm && (
          <form
            onSubmit={handleCreate}
            className="p-6 bg-slate-950/60 border-b border-slate-800 space-y-4 animate-in slide-in-from-top-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Provision New API Ingestion Key
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Token Name / Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. srv-us-east-01 Daily Ingestion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Server Scope (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 15.206.222.190 or hostname (or blank for any)"
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Matches server_id, hostname, or IP. Leave empty to allow any server.
                </p>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Project Name Scope (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. ecommerce-core (or blank for any)"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Matches project_name. Leave empty to allow any project.
                </p>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Token Expiration</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="0">Never Expires</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="180">180 Days</option>
                  <option value="365">1 Year (365 Days)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-md disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Generate Key</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter and Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-3 text-xs">
          <div className="relative w-full max-w-sm">
            <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search tokens by name, server, or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="text-slate-400 text-xs">
            Showing <strong className="text-slate-200">{filteredKeys.length}</strong> of{' '}
            <strong className="text-slate-200">{keys.length}</strong> provisioned keys
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <p className="text-sm">Loading provisioned tokens...</p>
            </div>
          ) : filteredKeys.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <h3 className="text-sm font-semibold text-slate-300">No API Tokens Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                {search ? 'No tokens matching search filter.' : 'Generate a new per-server token to begin.'}
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-3 px-4">Token Name</th>
                    <th className="py-3 px-4">Key Prefix</th>
                    <th className="py-3 px-4">Server Scope</th>
                    <th className="py-3 px-4">Project Scope</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Last Used</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredKeys.map((item) => {
                    const isRevoked = !item.isActive || !!item.revokedAt;
                    const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-200">
                          <div>{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            Created by {item.createdBy || 'Admin'} • {formatTimestamp(item.createdAt)}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                            {item.keyPrefix}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {item.serverId ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/80 text-sky-300 border border-sky-800/40">
                              <Server className="h-3 w-3" />
                              <span>{item.serverId}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">All Servers</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {item.projectName ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/40">
                              <FolderGit2 className="h-3 w-3" />
                              <span>{item.projectName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">All Projects</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          {isRevoked ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/50">
                              Revoked
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/50">
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                              Active
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {item.lastUsedAt ? formatTimestamp(item.lastUsedAt) : <span className="text-slate-600">Never</span>}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {item.expiresAt ? formatTimestamp(item.expiresAt) : <span className="text-slate-600">Never</span>}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {!isRevoked && (
                            <button
                              onClick={() => handleOpenRevoke(item)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition-colors border border-rose-900/40 hover:border-rose-700/60 shadow-sm"
                              title="Immediately revoke this token"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ================= FANCY REVOKE TOKEN CONFIRMATION MODAL ================= */}
      {keyToRevoke && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            if (!revokingId) setKeyToRevoke(null);
          }}
        >
          <div
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-rose-500/30 rounded-3xl w-full max-w-md shadow-2xl shadow-rose-950/60 overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Close Button */}
            <button
              onClick={() => {
                if (!revokingId) setKeyToRevoke(null);
              }}
              disabled={Boolean(revokingId)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10 disabled:opacity-40"
              title="Cancel and close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 text-center space-y-4">
              {/* Glowing Shield Icon */}
              <div className="relative mx-auto mt-1 mb-2">
                <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 opacity-30 blur-lg animate-pulse" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-tr from-rose-950 via-slate-900 to-rose-900/60 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/50 mx-auto">
                  <ShieldAlert className="h-8 w-8 text-rose-400 animate-pulse" />
                </div>
              </div>

              {/* Title & Badge */}
              <div>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-rose-950/80 text-rose-300 border border-rose-800/60 mb-2">
                  <Ban className="h-3 w-3" />
                  <span>Immediate Access Revocation</span>
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Revoke Ingestion Token?
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  You are about to permanently deactivate this token. Any client backup scripts using this key will immediately be blocked.
                </p>
              </div>

              {/* Token Details Card */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Key className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-white truncate" title={keyToRevoke.name}>
                      {keyToRevoke.name}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                    {keyToRevoke.keyPrefix}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Server Scope</span>
                    <span className="text-slate-300 font-mono truncate block" title={keyToRevoke.serverId || 'All Servers'}>
                      {keyToRevoke.serverId || '🌐 All Servers'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Project Scope</span>
                    <span className="text-slate-300 font-medium truncate block" title={keyToRevoke.projectName || 'All Projects'}>
                      {keyToRevoke.projectName || '📁 All Projects'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Critical Warning Callout */}
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 text-left flex items-start space-x-2.5 text-xs text-rose-300">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="text-rose-200">Irreversible Action:</strong> Once revoked, this token can never be restored. You will need to provision and deploy a new token to resume telemetry ingestion.
                </div>
              </div>

              {/* Error feedback if any */}
              {revokeError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center justify-between">
                  <span>{revokeError}</span>
                  <button onClick={() => setRevokeError(null)} className="text-rose-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  disabled={Boolean(revokingId)}
                  onClick={() => setKeyToRevoke(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Cancel, Keep Token
                </button>
                <button
                  type="button"
                  disabled={Boolean(revokingId)}
                  onClick={handleConfirmRevoke}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 via-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-lg shadow-rose-600/30 hover:shadow-rose-600/50 transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {revokingId ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Revoking Access...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Yes, Revoke Token</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
