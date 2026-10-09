import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Server,
  Terminal,
  Activity,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Database,
} from 'lucide-react';
import { api } from '../services/api';
import { BackupReport } from '../types';
import { useTimezone } from '../context/TimezoneContext';

interface DrillPulseViewProps {
  onSelectReport: (report: BackupReport) => void;
  onOpenDeployWizard: () => void;
}

export const DrillPulseView: React.FC<DrillPulseViewProps> = ({
  onSelectReport,
  onOpenDeployWizard,
}) => {
  const { formatTimestamp } = useTimezone();
  const [reports, setReports] = useState<BackupReport[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>('ALL');
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDrillData = async () => {
    try {
      const res = await api.getBackups({ limit: 100 });
      setReports(res.data);
    } catch (err) {
      console.error('Failed to load drill telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrillData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDrillData();
  };

  // Filter reports that have drill telemetry or match user filter
  const drillReports = useMemo(() => {
    return reports.filter((r) => {
      // Must have drill status or if search matches
      const hasDrill = !!r.restoreDrillStatus;
      if (!hasDrill && statusFilter !== 'ALL') return false;

      if (statusFilter !== 'ALL' && r.restoreDrillStatus !== statusFilter) {
        return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesProject = r.projectName.toLowerCase().includes(q);
        const matchesServer = r.serverId.toLowerCase().includes(q) || r.hostname.toLowerCase().includes(q);
        return matchesProject || matchesServer;
      }

      return true;
    });
  }, [reports, search, statusFilter]);

  // Telemetry metrics
  const stats = useMemo(() => {
    const executed = reports.filter((r) => !!r.restoreDrillStatus);
    const passed = executed.filter((r) => r.restoreDrillStatus === 'SUCCESS').length;
    const failed = executed.filter((r) => r.restoreDrillStatus === 'FAILED').length;
    const passRate = executed.length > 0 ? Math.round((passed / executed.length) * 100) : 100;
    const totalTables = executed.reduce((acc, r) => acc + (r.restoreDrillVerifiedTables || 0), 0);
    const avgDuration =
      executed.length > 0
        ? Math.round(executed.reduce((acc, r) => acc + (r.restoreDrillDurationSeconds || 0), 0) / executed.length)
        : 0;

    return {
      totalExecuted: executed.length,
      passed,
      failed,
      passRate,
      totalTables,
      avgDuration,
    };
  }, [reports]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-start space-x-3.5">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <span className="text-2xl">🧪</span>
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Disaster Recovery Verification Drills (DrillPulse)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                SOC2 / ISO 27001
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              &quot;A backup that has never been restored is just a hypothesis.&quot; DrillPulse automatically spawns ephemeral tmpfs container sandboxes, restores dumps, and validates public table counts before certifying backup archives.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={onOpenDeployWizard}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950/40"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Deploy DR Drill</span>
          </button>
        </div>
      </div>

      {/* DR KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>Total DR Drills Ingested</span>
          </span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {stats.totalExecuted}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {reports.length} total backup runs monitored
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center space-x-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>DR Verification Pass Rate</span>
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {stats.passRate}%
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            {stats.passed} passed • {stats.failed} failed
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Database className="h-3.5 w-3.5 text-blue-400" />
            <span>Verified Tables & Files</span>
          </span>
          <div className="text-2xl font-bold font-mono text-cyan-300 mt-1">
            {stats.totalTables.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Restored in sandbox tmpfs
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <span className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span>Avg Sandbox Verification Time</span>
          </span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {stats.avgDuration}s
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Ephemeral container execution
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search DR drills by project, server ID, or hostname..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs text-slate-400">Drill Status:</span>
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 space-x-1">
            {(['ALL', 'SUCCESS', 'FAILED', 'SKIPPED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === s
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {s === 'ALL' ? 'All Records' : s === 'SUCCESS' ? 'Passed' : s === 'FAILED' ? 'Failed' : 'Skipped'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drill Telemetry Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-white text-sm">Disaster Recovery Drill Records</span>
            <span className="text-xs text-slate-400 font-mono">({drillReports.length} results)</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            Loading restoration drill audit records...
          </div>
        ) : drillReports.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="text-3xl">🧪</div>
            <h3 className="text-sm font-semibold text-white">No Restoration Drills Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              No backup reports matched the selected filter. To test your backups automatically in an isolated ephemeral Docker container, check the <strong>Automated Restoration Drill (DrillPulse)</strong> box in the Deploy New Server Wizard.
            </p>
            <div className="pt-2">
              <button
                onClick={onOpenDeployWizard}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Open Deploy Wizard
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Drill Status</th>
                  <th className="py-3 px-4">Project & Server</th>
                  <th className="py-3 px-4">Engine</th>
                  <th className="py-3 px-4">Verified Tables / Files</th>
                  <th className="py-3 px-4">Sandbox Duration</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {drillReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => onSelectReport(report)}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {report.restoreDrillStatus === 'SUCCESS' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>PASSED</span>
                        </span>
                      ) : report.restoreDrillStatus === 'FAILED' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950 text-red-400 border border-red-800/60">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>FAILED</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <span>STANDARD RUN</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white truncate">{report.projectName}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {report.serverId} ({report.hostname})
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {report.backupType}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono">
                      {report.restoreDrillStatus ? (
                        <span className="text-emerald-400 font-semibold">
                          {report.restoreDrillVerifiedTables ?? 0} verified
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {report.restoreDrillDurationSeconds !== null && report.restoreDrillDurationSeconds !== undefined ? (
                        <span>{report.restoreDrillDurationSeconds}s</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {formatTimestamp(report.startTime)}
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectReport(report);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700 inline-flex items-center space-x-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Logs</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DR Architecture & Compliance Explainer Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">How DrillPulse Guarantees 100% DR Readiness</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-slate-400">
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="font-bold text-slate-200 block">1. Ephemeral Sandbox</span>
            <p className="text-[11px] leading-relaxed">
              Launches an isolated Docker container on in-memory <code className="text-slate-300">tmpfs</code> without consuming persistent disk.
            </p>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="font-bold text-slate-200 block">2. Database Dump Restore</span>
            <p className="text-[11px] leading-relaxed">
              Executes real <code className="text-slate-300">pg_restore</code> or MySQL import directly from the newly created backup archive.
            </p>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="font-bold text-slate-200 block">3. Table Verification</span>
            <p className="text-[11px] leading-relaxed">
              Queries <code className="text-slate-300">information_schema.tables</code> to verify table counts and validates schema integrity.
            </p>
          </div>
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-1">
            <span className="font-bold text-slate-200 block">4. Safe Auto-Cleanup</span>
            <p className="text-[11px] leading-relaxed">
              Destroys the ephemeral container and sends certified verification telemetry to BackupPulse.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
