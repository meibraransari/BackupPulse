import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  HardDrive,
  RefreshCw,
  Folder,
  ArrowRight,
  ShieldAlert,
  Loader2,
  LayoutGrid,
  List,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { FleetSummary, ServerFleetItem } from '../types';

interface FleetViewProps {
  onSelectServer?: (serverId: string) => void;
}

export const FleetView: React.FC<FleetViewProps> = ({ onSelectServer }) => {
  const [fleet, setFleet] = useState<ServerFleetItem[]>([]);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [displayMode, setDisplayMode] = useState<'grid' | 'table'>('grid');

  const fetchFleet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getFleetData({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });
      setFleet(res.fleet);
      setSummary(res.summary);
    } catch (err) {
      console.error('Failed to load fleet inventory:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchFleet();
  }, [fetchFleet]);

  const getStatusBadge = (status: ServerFleetItem['status']) => {
    switch (status) {
      case 'HEALTHY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
            <CheckCircle2 className="h-3 w-3" />
            <span>Healthy</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-700/50">
            <AlertCircle className="h-3 w-3" />
            <span>Failing</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/50">
            <AlertTriangle className="h-3 w-3" />
            <span>Warning</span>
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-950/80 text-orange-400 border border-orange-700/50">
            <Clock className="h-3 w-3" />
            <span>Stale (&gt;26h)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Fleet Health Summary Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Total Servers */}
        <div
          onClick={() => setStatusFilter('ALL')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Servers</span>
            <Server className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{summary?.totalServers ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Fleet-wide inventory</div>
        </div>

        {/* Healthy */}
        <div
          onClick={() => setStatusFilter('HEALTHY')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'HEALTHY'
              ? 'bg-slate-900 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Healthy</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5">{summary?.healthy ?? 0}</div>
          <div className="text-[10px] text-emerald-500/70 mt-0.5">All backups passed</div>
        </div>

        {/* Failing */}
        <div
          onClick={() => setStatusFilter('FAILED')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'FAILED'
              ? 'bg-slate-900 border-rose-500/80 shadow-lg shadow-rose-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Failing</span>
            <AlertCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1.5">{summary?.failing ?? 0}</div>
          <div className="text-[10px] text-rose-500/70 mt-0.5">Active backup failure</div>
        </div>

        {/* Warning / Anomaly */}
        <div
          onClick={() => setStatusFilter('WARNING')}
          className={`cursor-pointer p-4 rounded-2xl border transition-all ${
            statusFilter === 'WARNING'
              ? 'bg-slate-900 border-amber-500/80 shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Warnings</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1.5">{summary?.warning ?? 0}</div>
          <div className="text-[10px] text-amber-500/70 mt-0.5">Size drop / warning</div>
        </div>

        {/* Stale (>26h) */}
        <div
          onClick={() => setStatusFilter('STALE')}
          className={`cursor-pointer p-4 rounded-2xl border col-span-2 sm:col-span-1 transition-all ${
            statusFilter === 'STALE'
              ? 'bg-slate-900 border-orange-500/80 shadow-lg shadow-orange-500/10'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Stale (&gt;26h)</span>
            <Clock className="h-4 w-4 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400 mt-1.5">{summary?.stale ?? 0}</div>
          <div className="text-[10px] text-orange-500/70 mt-0.5">Missed expected cron</div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search across 100+ servers by ID, Hostname, IP, or Project..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Server Statuses</option>
            <option value="HEALTHY">Healthy Only</option>
            <option value="FAILED">Failing Only</option>
            <option value="WARNING">Warning / Anomaly</option>
            <option value="STALE">Stale (&gt;26h)</option>
          </select>

          {/* Grid vs Table toggle */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                displayMode === 'grid' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setDisplayMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                displayMode === 'table' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Dense Matrix Table View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={fetchFleet}
            disabled={loading}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            title="Refresh Fleet Inventory"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. Server Fleet Content */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm">Aggregating telemetry across 100+ servers...</p>
        </div>
      ) : fleet.length === 0 ? (
        <div className="py-20 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <h3 className="text-sm font-semibold text-slate-300">No Servers Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            No server matched your search query or filter selection.
          </p>
        </div>
      ) : displayMode === 'grid' ? (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fleet.map((server) => (
            <div
              key={server.serverId}
              className={`bg-slate-900 border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                server.status === 'FAILED'
                  ? 'border-rose-900/60 bg-rose-950/10'
                  : server.status === 'STALE'
                  ? 'border-orange-900/60 bg-orange-950/10'
                  : server.status === 'WARNING'
                  ? 'border-amber-900/60 bg-amber-950/10'
                  : 'border-slate-800'
              }`}
            >
              <div>
                {/* Server Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                      <Server className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm font-mono truncate max-w-[170px]" title={server.serverId}>
                        {server.serverId}
                      </h4>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                        {server.hostname} • {server.serverIp}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(server.status)}
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Success</span>
                    <strong className="text-slate-200">{server.successRate}%</strong>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {server.successCount}/{server.totalBackups}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Storage</span>
                    <strong className="text-slate-200">{server.totalStorageHuman}</strong>
                    <div className="text-[10px] text-slate-500">archived</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Last Seen</span>
                    <strong
                      className={
                        server.hoursSinceLastBackup > 26 ? 'text-orange-400 font-semibold' : 'text-slate-200'
                      }
                    >
                      {server.hoursSinceLastBackup === 0
                        ? '<1h ago'
                        : `${server.hoursSinceLastBackup}h ago`}
                    </strong>
                    <div className="text-[10px] text-slate-500">
                      {server.hoursSinceLastBackup > 26 ? 'STALE' : 'OK'}
                    </div>
                  </div>
                </div>

                {/* Size Anomaly Badge (if any) */}
                {server.anomalyCount > 0 && (
                  <div className="mt-3 p-2 rounded-xl bg-amber-950/60 border border-amber-700/50 flex items-center space-x-1.5 text-xs text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>{server.anomalyCount}</strong> size anomal{server.anomalyCount > 1 ? 'ies' : 'y'} detected
                    </span>
                  </div>
                )}

                {/* Hosted Projects Chips */}
                <div className="mt-3 pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase block mb-1.5">
                    Hosted Projects ({server.projects.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                    {server.projects.map((proj) => (
                      <span
                        key={proj}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-950 text-slate-300 border border-slate-800"
                      >
                        {proj}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              {onSelectServer && (
                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => onSelectServer(server.serverId)}
                    className="flex items-center space-x-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors group"
                  >
                    <span>Inspect Server Telemetry</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Dense Matrix Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300 border-collapse">
              <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Server ID</th>
                  <th className="py-3 px-4">Hostname & IP</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Success Rate</th>
                  <th className="py-3 px-4">Total Storage</th>
                  <th className="py-3 px-4">Last Telemetry</th>
                  <th className="py-3 px-4">Projects</th>
                  {onSelectServer && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {fleet.map((server) => (
                  <tr
                    key={server.serverId}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => onSelectServer && onSelectServer(server.serverId)}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-200 whitespace-nowrap">
                      {server.serverId}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="text-slate-300 font-medium">{server.hostname}</div>
                      <div className="text-[11px] font-mono text-slate-500">{server.serverIp}</div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(server.status)}</td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200">{server.successRate}%</span>
                        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              server.successRate > 90
                                ? 'bg-emerald-500'
                                : server.successRate > 70
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${server.successRate}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {server.successCount}/{server.totalBackups} passed
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                      {server.totalStorageHuman}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div
                        className={
                          server.hoursSinceLastBackup > 26 ? 'text-orange-400 font-semibold' : 'text-slate-300'
                        }
                      >
                        {server.hoursSinceLastBackup === 0
                          ? '<1h ago'
                          : `${server.hoursSinceLastBackup}h ago`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {new Date(server.lastSeenAt).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-[200px] truncate" title={server.projects.join(', ')}>
                      <div className="flex items-center space-x-1">
                        <Folder className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="truncate">{server.projects.join(', ')}</span>
                      </div>
                    </td>

                    {onSelectServer && (
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectServer(server.serverId);
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/40 transition-colors"
                        >
                          View Logs
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
