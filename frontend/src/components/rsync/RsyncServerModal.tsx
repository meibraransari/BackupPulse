import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Key,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Wifi,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Bug,
} from 'lucide-react';
import { RsyncServer, SshTestResult } from '../../types';
import { api } from '../../services/api';

interface RsyncServerModalProps {
  server: RsyncServer | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const RsyncServerModal: React.FC<RsyncServerModalProps> = ({
  server,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<'SSH_KEY' | 'PASSWORD' | 'LOCAL'>('SSH_KEY');
  const [password, setPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [logLevel, setLogLevel] = useState<'info' | 'debug'>('info');
  const [testResult, setTestResult] = useState<SshTestResult | null>(null);
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (server) {
      setName(server.name || '');
      setHost(server.host || '');
      setPort(server.port || 22);
      setUsername(server.username || 'root');
      setAuthType(server.authType || 'SSH_KEY');
      // Keep password/key input blank so placeholder indicates existing credentials
      setPassword('');
      setSshPrivateKey('');
      setNotes(server.notes || '');
    } else {
      setName('');
      setHost('');
      setPort(22);
      setUsername('root');
      setAuthType('SSH_KEY');
      setPassword('');
      setSshPrivateKey('');
      setNotes('');
    }
    setError(null);
    setTestResult(null);
    setCopiedLogs(false);
  }, [server, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim()) {
      setError('Please provide server name and host address.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        host: host.trim(),
        port,
        username: username.trim() || 'root',
        authType,
        notes: notes?.trim() || null,
      };

      if (authType === 'PASSWORD') {
        if (password.trim()) {
          payload.password = password.trim();
        }
      } else if (authType === 'SSH_KEY') {
        if (sshPrivateKey.trim() && !sshPrivateKey.startsWith('••••')) {
          payload.sshPrivateKey = sshPrivateKey.trim();
        }
      }

      if (server) {
        await api.updateRsyncServer(server.id, payload);
      } else {
        await api.createRsyncServer(payload);
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save server credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNow = async (selectedLevel: 'info' | 'debug' = logLevel) => {
    if (!host.trim()) {
      setError('Please provide the Host / IP address before testing connection.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    setCopiedLogs(false);
    try {
      const res = await api.testRsyncConnection({
        serverId: server?.id,
        host: host.trim(),
        port,
        username: username.trim() || 'root',
        authType,
        password: password.trim() || undefined,
        sshPrivateKey: sshPrivateKey.trim() && !sshPrivateKey.startsWith('••••') ? sshPrivateKey.trim() : undefined,
        logLevel: selectedLevel,
      });
      setTestResult(res);
      setShowLogs(true);
    } catch (err: any) {
      setTestResult({
        status: 'OFFLINE',
        latencyMs: 0,
        message: err.message || 'Connection failed',
        logs: `[ERROR] ${err.message || 'Connection failed'}`,
        logLevel: selectedLevel,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyLogs = () => {
    if (!testResult?.logs) return;
    navigator.clipboard.writeText(testResult.logs);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {server ? 'Edit Rsync Remote Server' : 'Add New Remote Rsync Node'}
              </h3>
              <p className="text-xs text-slate-400">
                Configure SSH connection credentials for remote disk synchronization
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

        {/* Form with Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

          {/* Test Result & Live Log Transcript Box */}
          {testResult && (
            <div
              className={`rounded-xl border overflow-hidden transition-all ${
                testResult.status === 'ONLINE'
                  ? 'bg-slate-950 border-emerald-500/40'
                  : 'bg-slate-950 border-rose-500/40'
              }`}
            >
              {/* Status Header */}
              <div
                className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
                  testResult.status === 'ONLINE'
                    ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-900/60 text-rose-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {testResult.status === 'ONLINE' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  )}
                  <span className="font-bold">
                    {testResult.status === 'ONLINE' ? 'Connection Succeeded' : 'Connection Failed'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-950 border border-slate-800 text-slate-300">
                    {testResult.latencyMs}ms
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-slate-900 border border-slate-800 text-slate-400 uppercase">
                    {testResult.logLevel} mode
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] transition-colors cursor-pointer"
                    title="Copy full connection transcript"
                  >
                    {copiedLogs ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Logs</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowLogs((prev) => !prev)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title={showLogs ? 'Collapse logs' : 'Expand logs'}
                  >
                    {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Message Banner */}
              <div className="px-4 py-2 text-xs text-slate-300 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
                <span>{testResult.message}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {showLogs ? 'Showing transcript below' : 'Click arrow to view transcript'}
                </span>
              </div>

              {/* Realtime Telemetry Metrics Chips */}
              {testResult.metrics && (testResult.metrics.cpuPercent !== null || testResult.metrics.memoryPercent !== null || testResult.metrics.diskPercent !== null) && (
                <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center space-x-4 sm:space-x-6 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Telemetry:</span>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                      <span className="text-slate-400">Disk:</span>
                      <span className={`font-semibold ${testResult.metrics.diskPercent !== null && testResult.metrics.diskPercent >= 90 ? 'text-rose-400' : testResult.metrics.diskPercent !== null && testResult.metrics.diskPercent >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {testResult.metrics.diskPercent !== null ? `${testResult.metrics.diskPercent}%` : '--'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                      <span className="text-slate-400">Memory:</span>
                      <span className={`font-semibold ${testResult.metrics.memoryPercent !== null && testResult.metrics.memoryPercent >= 90 ? 'text-rose-400' : testResult.metrics.memoryPercent !== null && testResult.metrics.memoryPercent >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {testResult.metrics.memoryPercent !== null ? `${testResult.metrics.memoryPercent}%` : '--'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                      <span className="text-slate-400">CPU:</span>
                      <span className={`font-semibold ${testResult.metrics.cpuPercent !== null && testResult.metrics.cpuPercent >= 90 ? 'text-rose-400' : testResult.metrics.cpuPercent !== null && testResult.metrics.cpuPercent >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {testResult.metrics.cpuPercent !== null ? `${testResult.metrics.cpuPercent}%` : '--'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Terminal Logs Output */}
              {showLogs && (
                <div className="p-3 max-h-52 overflow-y-auto bg-slate-950 font-mono text-[11px] leading-relaxed select-text space-y-0.5">
                  {testResult.logs ? (
                    testResult.logs.split('\n').map((line, idx) => {
                      let colorClass = 'text-slate-300';
                      if (line.includes('[SUCCESS]')) colorClass = 'text-emerald-400 font-bold';
                      else if (line.includes('[ERROR]')) colorClass = 'text-rose-400 font-bold';
                      else if (line.includes('[WARN]')) colorClass = 'text-amber-400';
                      else if (line.includes('[DEBUG]')) colorClass = 'text-purple-300';
                      else if (line.includes('[INFO]')) colorClass = 'text-sky-300';
                      else if (line.includes('Permission denied')) colorClass = 'text-rose-400 font-bold bg-rose-950/30 px-1 rounded';
                      else if (line.includes('Connection established') || line.includes('Authentication succeeded')) colorClass = 'text-emerald-300';
                      return (
                        <div key={idx} className={colorClass}>
                          {line}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-slate-500 italic">No output logged.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Display Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Primary Storage Node or Offsite DR Host"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Host / IP Address <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.50 or backup.internal"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SSH Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 22)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">SSH Username</label>
              <input
                type="text"
                placeholder="root"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Authentication Mode</label>
              <select
                value={authType}
                onChange={(e: any) => setAuthType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SSH_KEY">SSH Private Key (Recommended)</option>
                <option value="PASSWORD">Password Authentication</option>
                <option value="LOCAL">Local Host (127.0.0.1)</option>
              </select>
            </div>
          </div>

          {authType === 'SSH_KEY' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>SSH Private Key (PEM/OpenSSH)</span>
                <span className="text-[10px] text-slate-500 font-normal">Encrypted in DB</span>
              </label>
              <textarea
                rows={4}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                value={sshPrivateKey}
                onChange={(e) => setSshPrivateKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {authType === 'PASSWORD' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <input
                type="password"
                placeholder={server?.password ? '•••••••• (Leave blank to keep existing)' : 'Enter SSH password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Notes</label>
              <textarea
                rows={5}
                placeholder="e.g. Rack B, Shelf 3, 10GbE interface&#10;Secondary DR node connected via private VPC peering&#10;Contact sysadmin for maintenance window"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 min-h-[120px] resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Sticky Footer Actions - Always visible regardless of modal content scroll */}
          <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
            {/* Test Connection Controls: Log Level selector + Test button */}
            <div className="flex items-center space-x-2">
              {/* Log Level Toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setLogLevel('info');
                    if (testResult) handleTestNow('info');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    logLevel === 'info'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Standard connection check"
                >
                  Info
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLogLevel('debug');
                    if (testResult) handleTestNow('debug');
                  }}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    logLevel === 'debug'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Verbose debug trace (-vv): Shows raw SSH handshake, cipher negotiation & auth packets"
                >
                  <Bug className="h-3 w-3" />
                  <span>Debug (-v)</span>
                </button>
              </div>

              {/* Test Button */}
              <button
                type="button"
                onClick={() => handleTestNow()}
                disabled={testing || !host.trim()}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-40"
                title="Execute SSH connection test and capture logs"
              >
                <Wifi className={`h-3.5 w-3.5 ${testing ? 'animate-pulse text-indigo-400' : 'text-slate-400'}`} />
                <span>{testing ? 'Testing...' : `Test Connection`}</span>
              </button>
            </div>

            {/* Cancel & Save */}
            <div className="flex items-center justify-end space-x-2">
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : server ? 'Update Server' : 'Add Server'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
