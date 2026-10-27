import React, { useState, useEffect } from 'react';
import { X, Server, Key, Lock, CheckCircle2, AlertTriangle, ShieldCheck, Wifi } from 'lucide-react';
import { RsyncServer } from '../../types';
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
  const [testResult, setTestResult] = useState<{ status: 'ONLINE' | 'OFFLINE'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (server) {
      setName(server.name || '');
      setHost(server.host || '');
      setPort(server.port || 22);
      setUsername(server.username || 'root');
      setAuthType(server.authType || 'SSH_KEY');
      setPassword(server.password || '');
      setSshPrivateKey(server.sshPrivateKey || '');
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
      if (server) {
        await api.updateRsyncServer(server.id, {
          name,
          host,
          port,
          username,
          authType,
          password: password || undefined,
          sshPrivateKey: sshPrivateKey || undefined,
          notes,
        });
      } else {
        await api.createRsyncServer({
          name,
          host,
          port,
          username,
          authType,
          password: password || undefined,
          sshPrivateKey: sshPrivateKey || undefined,
          notes,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save server credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNow = async () => {
    if (!host.trim()) {
      setError('Please provide the Host / IP address before testing connection.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await api.testRsyncConnection({
        host: host.trim(),
        port,
        username: username.trim(),
        authType,
        password: password || undefined,
        sshPrivateKey: sshPrivateKey || undefined,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ status: 'OFFLINE', message: err.message || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                testResult.status === 'ONLINE'
                  ? 'bg-emerald-950/40 border-emerald-900/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-900/60 text-rose-300'
              }`}
            >
              {testResult.status === 'ONLINE' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

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
            <input
              type="text"
              placeholder="e.g. Rack B, Shelf 3, 10GbE interface"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestNow}
              disabled={testing || !host.trim()}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer disabled:opacity-40"
              title="Test SSH connection using the entered credentials before saving"
            >
              <Wifi className={`h-3.5 w-3.5 ${testing ? 'animate-pulse text-indigo-400' : 'text-slate-400'}`} />
              <span>{testing ? 'Testing Connection...' : 'Test SSH Connection'}</span>
            </button>

            <div className="flex items-center space-x-2">
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all cursor-pointer"
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
