import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import { ApiKeyItem, User } from '../types';
import { useTimezone } from '../context/TimezoneContext';

interface ApiKeyColumnConfig {
  key: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  resizable: boolean;
  align?: 'left' | 'center' | 'right';
}

const API_KEY_COLUMNS: ApiKeyColumnConfig[] = [
  { key: 'name', label: 'Token Name', defaultWidth: 230, minWidth: 150, resizable: true },
  { key: 'prefix', label: 'Key Prefix', defaultWidth: 130, minWidth: 100, resizable: true },
  { key: 'server', label: 'Server Scope', defaultWidth: 125, minWidth: 90, resizable: true },
  { key: 'project', label: 'Project Scope', defaultWidth: 160, minWidth: 110, resizable: true },
  { key: 'status', label: 'Status', defaultWidth: 95, minWidth: 80, resizable: true },
  { key: 'lastUsed', label: 'Last Used', defaultWidth: 135, minWidth: 100, resizable: true },
  { key: 'expires', label: 'Expires', defaultWidth: 135, minWidth: 100, resizable: true },
  { key: 'actions', label: 'Actions', defaultWidth: 155, minWidth: 125, resizable: true, align: 'right' },
];

const DEFAULT_APIKEY_COL_WIDTHS: Record<string, number> = {
  name: 230,
  prefix: 130,
  server: 125,
  project: 160,
  status: 95,
  lastUsed: 135,
  expires: 135,
  actions: 155,
};

const STORAGE_KEY_APIKEY_COL_WIDTHS = 'backuppulse_apikey_col_widths_v1';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({ isOpen, onClose, user }) => {
  const { formatTimestamp } = useTimezone();
  const isAdmin = user?.role === 'admin';
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

  // Delete state (Strictly Admin only)
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Column Widths with LocalStorage persistence
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_APIKEY_COL_WIDTHS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const validated: Record<string, number> = {};
          for (const key of Object.keys(DEFAULT_APIKEY_COL_WIDTHS)) {
            const val = Number(parsed[key]);
            validated[key] = !isNaN(val) && val >= 50 ? val : DEFAULT_APIKEY_COL_WIDTHS[key];
          }
          return validated;
        }
      }
    } catch {}
    return DEFAULT_APIKEY_COL_WIDTHS;
  });

  const [resizingColKey, setResizingColKey] = useState<string | null>(null);

  // Total calculated table width for horizontal scroll and explicit table width
  const totalTableWidth = API_KEY_COLUMNS.reduce(
    (sum, col) => sum + (colWidths[col.key] || col.defaultWidth),
    0
  );

  // Save to localStorage whenever widths change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_APIKEY_COL_WIDTHS, JSON.stringify(colWidths));
    } catch {}
  }, [colWidths]);

  // Clean up cursor on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Synchronous mouse & touch drag handlers for instant, lag-free column resizing
  const handleStartResize = (
    colKey: string,
    e: React.MouseEvent | React.TouchEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startX = clientX;
    const startWidth = colWidths[colKey] || DEFAULT_APIKEY_COL_WIDTHS[colKey] || 120;
    const colConfig = API_KEY_COLUMNS.find((c) => c.key === colKey);
    const minW = colConfig ? colConfig.minWidth : 60;

    setResizingColKey(colKey);

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let latestWidth = startWidth;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }
      const curX =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientX
          : (moveEvent as MouseEvent).clientX;
      const deltaX = curX - startX;
      const newWidth = Math.max(minW, Math.round(startWidth + deltaX));

      if (newWidth !== latestWidth) {
        latestWidth = newWidth;
        setColWidths((prev) => ({
          ...prev,
          [colKey]: newWidth,
        }));
      }
    };

    const onEnd = () => {
      setResizingColKey(null);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onEnd, true);
      window.removeEventListener('touchmove', onMove, true);
      window.removeEventListener('touchend', onEnd, true);
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onEnd, true);
    window.addEventListener('touchmove', onMove, { capture: true, passive: false });
    window.addEventListener('touchend', onEnd, true);
  };

  const handleDoubleClickResetCol = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setColWidths((prev) => ({
      ...prev,
      [colKey]: DEFAULT_APIKEY_COL_WIDTHS[colKey] || 120,
    }));
  };

  const handleResetAllWidths = () => {
    setColWidths(DEFAULT_APIKEY_COL_WIDTHS);
    try {
      localStorage.removeItem(STORAGE_KEY_APIKEY_COL_WIDTHS);
    } catch {}
  };

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
      setKeyToDelete(null);
      setRevokeError(null);
      setDeleteError(null);
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

  const handleOpenDelete = (keyItem: ApiKeyItem) => {
    setKeyToDelete(keyItem);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!keyToDelete) return;
    setDeletingId(keyToDelete.id);
    setDeleteError(null);
    try {
      await api.deleteApiKey(keyToDelete.id);
      setKeyToDelete(null);
      await fetchKeys();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to permanently delete token');
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when search or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

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

  const totalPages = Math.max(1, Math.ceil(filteredKeys.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedKeys = filteredKeys.slice(startIndex, startIndex + pageSize);

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
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
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

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleResetAllWidths}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 transition-colors shadow-sm"
              title="Reset all column widths to default fitted size"
            >
              <RotateCcw className="h-3 w-3 text-slate-400" />
              <span>Reset Widths</span>
            </button>

            <div className="text-slate-400 text-xs">
              Showing <strong className="text-slate-200">{filteredKeys.length}</strong> of{' '}
              <strong className="text-slate-200">{keys.length}</strong> provisioned keys
            </div>
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
            <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950/40 shadow-inner">
              <table
                className="table-fixed text-left text-xs text-slate-300 border-collapse"
                style={{
                  width: `${totalTableWidth}px`,
                  minWidth: '100%',
                }}
              >
                <colgroup>
                  {API_KEY_COLUMNS.map((col) => {
                    const width = colWidths[col.key] || col.defaultWidth;
                    return (
                      <col
                        key={col.key}
                        style={{
                          width: `${width}px`,
                          minWidth: `${col.minWidth}px`,
                        }}
                      />
                    );
                  })}
                </colgroup>
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                  <tr>
                    {API_KEY_COLUMNS.map((col, idx) => {
                      const isLast = idx === API_KEY_COLUMNS.length - 1;
                      const isResizing = resizingColKey === col.key;
                      const width = colWidths[col.key] || col.defaultWidth;

                      return (
                        <th
                          key={col.key}
                          className={`relative py-3 px-4 font-semibold text-slate-400 group/th select-none border-r border-slate-800/60 last:border-r-0 ${
                            col.align === 'right' ? 'text-right' : 'text-left'
                          } ${isResizing ? 'bg-amber-500/10 text-amber-200' : ''}`}
                          style={{
                            width: `${width}px`,
                            minWidth: `${col.minWidth}px`,
                            maxWidth: `${width}px`,
                          }}
                        >
                          <div className="truncate pr-2">{col.label}</div>

                          {/* Column Mouse Resizer Handle */}
                          {col.resizable && (
                            <div
                              onMouseDown={(e) => handleStartResize(col.key, e)}
                              onTouchStart={(e) => handleStartResize(col.key, e)}
                              onDoubleClick={(e) => handleDoubleClickResetCol(col.key, e)}
                              className={`absolute ${
                                isLast ? 'right-0' : '-right-2'
                              } top-0 bottom-0 w-4 cursor-col-resize flex items-center justify-center z-30 select-none touch-none ${
                                isResizing
                                  ? 'bg-amber-500/25'
                                  : 'hover:bg-amber-500/15 active:bg-amber-500/30'
                              }`}
                              title="Drag to resize column width • Double-click to reset"
                            >
                              {/* Floating pixel indicator while actively dragging */}
                              {isResizing && (
                                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg shadow-amber-500/50 pointer-events-none whitespace-nowrap z-50 animate-in fade-in zoom-in-90">
                                  {width}px
                                </div>
                              )}

                              {/* Glowing Amber Feedback Bar */}
                              <div
                                className={`transition-all duration-150 rounded-full ${
                                  isResizing
                                    ? 'w-1 bg-amber-400 h-full shadow-[0_0_12px_rgba(251,191,36,1)] ring-2 ring-amber-400/60'
                                    : 'w-0.5 bg-slate-700 h-4 group-hover/th:bg-amber-400/90 group-hover/th:h-6 group-hover/th:w-1'
                                }`}
                              />
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {paginatedKeys.map((item) => {
                    const isRevoked = !item.isActive || !!item.revokedAt;
                    const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-200 overflow-hidden border-r border-slate-800/40 last:border-r-0">
                          <div className="truncate" title={item.name}>{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-normal truncate">
                            Created by {item.createdBy || 'Admin'} • {formatTimestamp(item.createdAt)}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400 overflow-hidden border-r border-slate-800/40 last:border-r-0">
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 inline-block truncate max-w-full">
                            {item.keyPrefix}
                          </span>
                        </td>

                        <td className="py-3 px-4 overflow-hidden border-r border-slate-800/40 last:border-r-0">
                          {item.serverId ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/80 text-sky-300 border border-sky-800/40 truncate max-w-full" title={item.serverId}>
                              <Server className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.serverId}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] whitespace-nowrap">All Servers</span>
                          )}
                        </td>

                        <td className="py-3 px-4 overflow-hidden border-r border-slate-800/40 last:border-r-0">
                          {item.projectName ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/40 truncate max-w-full" title={item.projectName}>
                              <FolderGit2 className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.projectName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px] whitespace-nowrap">All Projects</span>
                          )}
                        </td>

                        <td className="py-3 px-4 overflow-hidden whitespace-nowrap border-r border-slate-800/40 last:border-r-0">
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

                        <td className="py-3 px-4 text-slate-400 text-[11px] overflow-hidden whitespace-nowrap font-mono border-r border-slate-800/40 last:border-r-0">
                          {item.lastUsedAt ? formatTimestamp(item.lastUsedAt) : <span className="text-slate-600 font-sans">Never</span>}
                        </td>

                        <td className="py-3 px-4 text-slate-400 text-[11px] overflow-hidden whitespace-nowrap font-mono border-r border-slate-800/40 last:border-r-0">
                          {item.expiresAt ? formatTimestamp(item.expiresAt) : <span className="text-slate-600 font-sans">Never</span>}
                        </td>

                        <td className="py-3 px-4 text-right overflow-hidden whitespace-nowrap">
                          {isAdmin ? (
                            <div className="flex items-center justify-end space-x-1.5">
                              {!isRevoked && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRevoke(item)}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-rose-400 hover:text-rose-200 hover:bg-rose-950/50 rounded-lg transition-colors border border-rose-900/40 hover:border-rose-700/60 shadow-sm"
                                  title="Immediately revoke this token"
                                >
                                  Revoke
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(item)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-900 rounded-lg transition-all border border-rose-800/60 shadow-sm inline-flex items-center space-x-1 group/del"
                                title="Permanently delete this token (Admin only - trial & error cleanup)"
                              >
                                <Trash2 className="h-3 w-3 text-rose-400 group-hover/del:text-rose-200 transition-colors" />
                                <span>Delete</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px] italic">Read-only</span>
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

        {/* Modal Pagination Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
          <div className="flex items-center space-x-2 text-slate-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-amber-500 font-medium cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>per page</span>
            <span className="text-slate-600">|</span>
            <span>
              Showing <strong className="text-slate-200">{filteredKeys.length === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-slate-200">{Math.min(filteredKeys.length, startIndex + pageSize)}</strong> of{' '}
              <strong className="text-slate-200">{filteredKeys.length}</strong> tokens
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-xs mr-1">
              Page <strong className="text-slate-200">{currentPage}</strong> of{' '}
              <strong className="text-slate-200">{totalPages}</strong>
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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

      {/* ================= PERMANENT DELETE API TOKEN CONFIRMATION MODAL ================= */}
      {keyToDelete && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            if (!deletingId) setKeyToDelete(null);
          }}
        >
          <div
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-rose-500/40 rounded-3xl w-full max-w-md shadow-2xl shadow-rose-950/70 overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              onClick={() => {
                if (!deletingId) setKeyToDelete(null);
              }}
              disabled={Boolean(deletingId)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10 disabled:opacity-40"
              title="Cancel and close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-6 text-center space-y-4">
              {/* Trash Icon Badge */}
              <div className="relative mx-auto mt-1 mb-2">
                <div className="absolute -inset-1.5 rounded-2xl bg-rose-600 opacity-30 blur-lg animate-pulse" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-tr from-rose-950 via-slate-900 to-rose-900/60 border border-rose-500/50 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-950/50 mx-auto">
                  <Trash2 className="h-8 w-8 text-rose-400" />
                </div>
              </div>

              {/* Title & Badge */}
              <div>
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-rose-950/80 text-rose-300 border border-rose-800/60 mb-2">
                  <ShieldAlert className="h-3 w-3" />
                  <span>Admin Only Action</span>
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Permanently Delete Token?
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  This will completely remove this API token from the database. It is intended for cleaning up trial-and-error setups or decommissioned server keys.
                </p>
              </div>

              {/* Token Details Card */}
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-left space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate max-w-[200px]" title={keyToDelete.name}>
                    {keyToDelete.name}
                  </span>
                  <span className="font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                    {keyToDelete.keyPrefix}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Server Scope</span>
                    <span className="text-slate-300 font-mono truncate block" title={keyToDelete.serverId || 'All Servers'}>
                      {keyToDelete.serverId || '🌐 All Servers'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Project Scope</span>
                    <span className="text-slate-300 font-medium truncate block" title={keyToDelete.projectName || 'All Projects'}>
                      {keyToDelete.projectName || '📁 All Projects'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit notice */}
              <div className="text-[11px] text-slate-400 flex items-center justify-center space-x-1.5">
                <span className="text-indigo-400">ℹ️</span>
                <span>An audit record will be logged in Governance & Compliance.</span>
              </div>

              {/* Error feedback if any */}
              {deleteError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500 text-rose-200 text-xs flex items-center justify-between">
                  <span>{deleteError}</span>
                  <button onClick={() => setDeleteError(null)} className="text-rose-400 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={() => setKeyToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingId)}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-all flex items-center space-x-2 shadow-lg shadow-rose-950/50 disabled:opacity-50"
                >
                  {deletingId ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Permanently Delete</span>
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
