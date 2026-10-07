import React, { useState } from 'react';
import { Database, Bell, Mail, BookOpen, LogOut, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Send, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onOpenNotificationLogs?: () => void;
  onOpenHousekeeping?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onOpenNotificationLogs,
  onOpenHousekeeping,
}) => {
  const [testingGChat, setTestingGChat] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTestGChat = async () => {
    setTestingGChat(true);
    setToastMessage(null);
    try {
      const res = await api.testGoogleChat();
      setToastMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setTestingGChat(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setToastMessage(null);
    try {
      const res = await api.testSmtp();
      setToastMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message });
    } finally {
      setTestingSmtp(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">BackupPulse</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  v1.0 Live
                </span>
              </div>
              <p className="text-xs text-slate-400">100+ Servers Telemetry & Automated Reporting</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Swagger Docs Link */}
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
              title="Open Swagger OpenAPI Documentation"
            >
              <BookOpen className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden md:inline">Swagger Docs</span>
            </a>

            {/* Test Google Chat */}
            <button
              onClick={handleTestGChat}
              disabled={testingGChat}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 transition-colors border border-emerald-600/30 disabled:opacity-50"
              title="Trigger instant test alert to Google Chat"
            >
              {testingGChat ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
              ) : (
                <Bell className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span className="hidden sm:inline">Test Chat</span>
            </button>

            {/* Test Email (SMTP) */}
            <button
              onClick={handleTestSmtp}
              disabled={testingSmtp}
              className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 bg-sky-950/60 hover:bg-sky-900/80 transition-colors border border-sky-600/30 disabled:opacity-50"
              title="Trigger instant test email via SMTP"
            >
              {testingSmtp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
              ) : (
                <Mail className="h-3.5 w-3.5 text-sky-400" />
              )}
              <span className="hidden sm:inline">Test Email</span>
            </button>

            {/* Notification Audit Logs */}
            {onOpenNotificationLogs && (
              <button
                onClick={onOpenNotificationLogs}
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/60 hover:bg-indigo-900/80 transition-colors border border-indigo-600/30"
                title="View Notification Delivery Audit Logs"
              >
                <Send className="h-3.5 w-3.5 text-indigo-400" />
                <span className="hidden lg:inline">Audit Logs</span>
              </button>
            )}

            {/* Database Storage & Housekeeping */}
            {onOpenHousekeeping && (
              <button
                onClick={onOpenHousekeeping}
                className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 transition-colors border border-amber-600/30"
                title="View Database Storage Retention and Run Housekeeping"
              >
                <Database className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden lg:inline">Storage</span>
              </button>
            )}

            {/* User Profile & Logout */}
            <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200">{user?.username || 'Admin'}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user?.role || 'Administrator'}</div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`flex items-center space-x-2 px-4 py-3 rounded-xl shadow-2xl border text-sm ${
              toastMessage.type === 'success'
                ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-red-500/50 text-red-300'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </>
  );
};
