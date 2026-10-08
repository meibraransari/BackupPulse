import React from 'react';
import { Search, Filter, Download, RotateCcw, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { BackupFilters } from '../types';

interface FilterBarProps {
  filters: BackupFilters;
  projects: string[];
  servers: { serverId: string; hostname: string }[];
  onFilterChange: (newFilters: Partial<BackupFilters>) => void;
  onReset: () => void;
  onExport: (format: 'csv' | 'json') => void;
  exporting: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  projects,
  servers,
  onFilterChange,
  onReset,
  onExport,
  exporting,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
      {/* Top row: Search input + Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by hostname, archive filename, or project..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Reset Filters */}
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-slate-200 transition-colors border border-slate-700"
            title="Reset all filters to default"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>

          {/* Anomaly Filter Toggle */}
          <button
            onClick={() => onFilterChange({ isAnomaly: filters.isAnomaly ? undefined : true, page: 1 })}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
              filters.isAnomaly
                ? 'bg-amber-950 text-amber-300 border-amber-600/60 shadow-sm'
                : 'text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-amber-400 border-slate-700'
            }`}
            title="Filter records flagged with size drops or zero-byte anomalies"
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${filters.isAnomaly ? 'text-amber-400' : 'text-slate-400'}`} />
            <span>Anomalies</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={() => onExport('csv')}
            disabled={exporting}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-300 bg-emerald-950 hover:bg-emerald-900 transition-colors border border-emerald-700/50"
            title="Export filtered reports as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={() => onExport('json')}
            disabled={exporting}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
            title="Export filtered reports as JSON"
          >
            <FileText className="h-3.5 w-3.5 text-blue-400" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Filter Selectors Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 pt-2 border-t border-slate-800/80">
        {/* Project Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Project</label>
          <select
            value={filters.projectName}
            onChange={(e) => onFilterChange({ projectName: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Projects</option>
            {projects.map((proj) => (
              <option key={proj} value={proj}>
                {proj}
              </option>
            ))}
          </select>
        </div>

        {/* Server Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Server / Host</label>
          <select
            value={filters.serverId}
            onChange={(e) => onFilterChange({ serverId: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Servers (100+)</option>
            {servers.map((s) => (
              <option key={s.serverId} value={s.serverId}>
                {s.serverId}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILED">Failed Only</option>
            <option value="WARNING">Warnings</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>
        </div>

        {/* Availability Filter (Active vs Expired) */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Active / Expired</label>
          <select
            value={filters.availability || 'ALL'}
            onChange={(e) => onFilterChange({ availability: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Availability</option>
            <option value="ACTIVE">Active (In S3)</option>
            <option value="EXPIRED">Expired (Pruned)</option>
          </select>
        </div>

        {/* Backup Type Filter */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">Backup Type</label>
          <select
            value={filters.backupType}
            onChange={(e) => onFilterChange({ backupType: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Types</option>
            <option value="db">Database Only</option>
            <option value="code">Code Only</option>
            <option value="full">Full (DB + Code)</option>
          </select>
        </div>

        {/* Date Start */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">From Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ startDate: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Date End */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1">To Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ endDate: e.target.value, page: 1 })}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>
    </div>
  );
};
