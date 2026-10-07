import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Bell,
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Code,
  Calendar,
  Send,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationLogItem } from '../types';

interface NotificationLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationLogsModal: React.FC<NotificationLogsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState<boolean>(true);
  const [channel, setChannel] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [selectedLog, setSelectedLog] = useState<NotificationLogItem | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  const fetchLogs = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.getNotificationLogs({
        page,
        limit: 12,
        channel,
        status,
      });
      setLogs(res.data);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to fetch notification logs:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, channel, status]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Reset page when filter changes
  const handleChannelChange = (c: string) => {
    setChannel(c);
    setPage(1);
  };

  const handleStatusChange = (s: string) => {
    setStatus(s);
    setPage(1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Send className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Notification Delivery Audit</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                  {pagination.total} Records
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Audit trail for automated Google Chat webhooks and SMTP email dispatches.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Refresh Audit Logs"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Close Audit Drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Channel filter tabs */}
            <span className="text-slate-400 font-medium">Channel:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => handleChannelChange('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  channel === 'ALL' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Channels
              </button>
              <button
                onClick={() => handleChannelChange('GOOGLE_CHAT')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center space-x-1.5 ${
                  channel === 'GOOGLE_CHAT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bell className="h-3 w-3" />
                <span>Google Chat</span>
              </button>
              <button
                onClick={() => handleChannelChange('SMTP')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center space-x-1.5 ${
                  channel === 'SMTP' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mail className="h-3 w-3" />
                <span>SMTP Email</span>
              </button>
            </div>

            {/* Status filter tabs */}
            <span className="text-slate-400 font-medium ml-2">Status:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => handleStatusChange('ALL')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  status === 'ALL' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => handleStatusChange('SUCCESS')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  status === 'SUCCESS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Success
              </button>
              <button
                onClick={() => handleStatusChange('FAILED')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  status === 'FAILED' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-rose-400'
                }`}
              >
                Failed
              </button>
            </div>
          </div>

          <div className="text-slate-400">
            Showing <strong className="text-slate-200">{logs.length}</strong> of{' '}
            <strong className="text-slate-200">{pagination.total}</strong> events
          </div>
        </div>

        {/* Modal Body & Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
              <p className="text-sm">Querying notification dispatch telemetry...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <h3 className="text-sm font-semibold text-slate-300">No Notification Records Found</h3>
              <p className="text-xs text-slate-500 mt-1">
                No delivery attempts recorded for the selected filter criteria.
              </p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300 border-collapse">
                <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Recipient / Target</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Message Summary</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(item)}
                    >
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.channel === 'GOOGLE_CHAT' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                            <Bell className="h-3 w-3 text-emerald-400" />
                            <span>Google Chat</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                            <Mail className="h-3 w-3 text-indigo-400" />
                            <span>SMTP Mail</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {item.eventType}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-[180px] truncate font-mono text-[11px] text-slate-400" title={item.recipient}>
                        {item.recipient}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-600/40">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>SUCCESS</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-600/40">
                            <AlertCircle className="h-3 w-3" />
                            <span>FAILED</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 max-w-[220px] truncate text-slate-300" title={item.message}>
                        {item.message}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(item);
                          }}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium text-sky-300 bg-sky-950/70 hover:bg-sky-900 border border-sky-700/40 transition-colors inline-flex items-center space-x-1"
                        >
                          <Code className="h-3 w-3" />
                          <span>Payload</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Pagination Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div>
            Page <strong className="text-slate-200">{pagination.page}</strong> of{' '}
            <strong className="text-slate-200">{pagination.totalPages || 1}</strong>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Payload Details Drawer Sub-Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4 text-sky-400" />
                <h3 className="font-semibold text-sm text-white">
                  {selectedLog.channel} Dispatch Payload Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Channel</span>
                  <strong className="text-white">{selectedLog.channel}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Event Type</span>
                  <strong className="text-white">{selectedLog.eventType}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Status</span>
                  <span className={selectedLog.status === 'SUCCESS' ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {selectedLog.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Timestamp</span>
                  <span className="text-slate-300 font-mono">{new Date(selectedLog.createdAt).toISOString()}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase">Recipient Endpoint</span>
                  <span className="text-slate-300 font-mono break-all">{selectedLog.recipient}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase mb-1">Status Message</span>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-200">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.payload && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-400 text-[10px] uppercase">JSON Payload</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedLog.payload, null, 2))}
                      className="flex items-center space-x-1 text-slate-400 hover:text-white text-[11px]"
                    >
                      {copiedPayload ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedPayload ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-950 text-sky-300 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto max-h-60">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
