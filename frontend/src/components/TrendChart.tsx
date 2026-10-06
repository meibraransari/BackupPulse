import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';
import { TrendItem, ProjectBreakdown } from '../types';
import { BarChart3, FolderKanban } from 'lucide-react';

interface TrendChartProps {
  trends: TrendItem[];
  projects: ProjectBreakdown[];
  loading: boolean;
}

export const TrendChart: React.FC<TrendChartProps> = ({ trends, projects, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-80 animate-pulse" />
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-80 animate-pulse" />
      </div>
    );
  }

  // Format dates for chart labels
  const formattedTrends = trends.map((t) => {
    const parts = t.date.split('-');
    const label = parts.length === 3 ? `${parts[1]}/${parts[2]}` : t.date;
    return { ...t, shortDate: label };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Daily Activity Chart */}
      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-slate-200">Daily Backup Activity (Last 7 Days)</h3>
          </div>
          <span className="text-xs text-slate-500">Auto-aggregated</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formattedTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                }}
                labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                iconType="circle"
              />
              <Bar dataKey="success" name="Successful Backups" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="failed" name="Failed Backups" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Projects Distribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FolderKanban className="h-4 w-4 text-purple-400" />
            <h3 className="font-semibold text-sm text-slate-200">Top Projects by Storage</h3>
          </div>
          <span className="text-xs text-slate-500">S3 Vault</span>
        </div>

        <div className="space-y-3 flex-1 flex flex-col justify-center">
          {projects.length === 0 ? (
            <div className="text-center text-xs text-slate-500 py-6">No project telemetry yet</div>
          ) : (
            projects.slice(0, 5).map((p, idx) => (
              <div key={p.projectName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300 truncate max-w-[150px]">{p.projectName}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{p.totalSizeHuman}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(15, (p.totalSizeBytes / (projects[0]?.totalSizeBytes || 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
