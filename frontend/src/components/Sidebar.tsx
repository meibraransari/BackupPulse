import React, { useState } from 'react';
import {
  Database,
  Table,
  Server,
  Users,
  BookOpen,
  Bell,
  Mail,
  Send,
  Trash2,
  LogOut,
  Settings,
  User as UserIcon,
  Loader2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Menu,
  X,
  HardDrive,
} from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface SidebarProps {
  user: User | null;
  activeTab: 'telemetry' | 'fleet' | 'users';
  onTabChange: (tab: 'telemetry' | 'fleet' | 'users') => void;
  onOpenProfile: () => void;
  onOpenNotificationLogs: () => void;
  onOpenHousekeeping: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onOpenProfile,
  onOpenNotificationLogs,
  onOpenHousekeeping,
  onLogout,
}) => {
  const [testingGChat, setTestingGChat] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navItems = [
    {
      id: 'telemetry' as const,
      label: 'Backup Telemetry',
      icon: Table,
      badge: 'Live',
    },
    {
      id: 'fleet' as const,
      label: 'Server Fleet',
      icon: Server,
      badge: '100+',
    },
    {
      id: 'users' as const,
      label: 'User Management',
      icon: Users,
      badge: user?.role === 'admin' ? 'Admin' : undefined,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800 w-64 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-tight text-white">BackupPulse</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" title="System Live" />
            </div>
            <p className="text-[11px] text-slate-400">100+ Production Fleet</p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="px-3 py-4 space-y-1">
        <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Core Workspaces
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                    isActive
                      ? 'bg-emerald-700/60 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Operations & System Tools Section */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 pt-2 border-t border-slate-800/80">
          DevOps Operations
        </div>

        {/* Swagger Docs */}
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors group"
        >
          <div className="flex items-center space-x-2.5">
            <BookOpen className="h-4 w-4 text-blue-400" />
            <span>Swagger API Docs</span>
          </div>
          <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-white" />
        </a>

        {/* Notification Delivery Audit Logs */}
        <button
          onClick={() => {
            onOpenNotificationLogs();
            setMobileOpen(false);
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-indigo-300 hover:text-white hover:bg-indigo-950/40 transition-colors"
        >
          <Send className="h-4 w-4 text-indigo-400" />
          <span>Audit Logs</span>
        </button>

        {/* Storage & Housekeeping */}
        <button
          onClick={() => {
            onOpenHousekeeping();
            setMobileOpen(false);
          }}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-300 hover:text-white hover:bg-amber-950/40 transition-colors"
        >
          <HardDrive className="h-4 w-4 text-amber-400" />
          <span>Storage & Housekeeping</span>
        </button>

        {/* Test Google Chat */}
        <button
          onClick={handleTestGChat}
          disabled={testingGChat}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-emerald-300 hover:text-white hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
        >
          {testingGChat ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          ) : (
            <Bell className="h-4 w-4 text-emerald-400" />
          )}
          <span>Test Google Chat</span>
        </button>

        {/* Test Email Delivery (SMTP / SendGrid / AWS SES) */}
        <button
          onClick={handleTestSmtp}
          disabled={testingSmtp}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-sky-300 hover:text-white hover:bg-sky-950/40 transition-colors disabled:opacity-50"
          title="Send test email via active provider (SMTP, SendGrid, or AWS SES)"
        >
          {testingSmtp ? (
            <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
          ) : (
            <Mail className="h-4 w-4 text-sky-400" />
          )}
          <span>Test Email Delivery</span>
        </button>
      </div>

      {/* User Profile & Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-800/60 transition-colors">
          <div
            onClick={() => {
              onOpenProfile();
              setMobileOpen(false);
            }}
            className="flex items-center space-x-2.5 cursor-pointer flex-1 min-w-0"
            title="Edit profile & security settings"
          >
            <div className="h-9 w-9 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt="User Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-4 w-4 text-slate-300" />
              )}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.fullName || user?.username || 'Admin'}
              </div>
              <div className="text-[10px] text-slate-400 capitalize flex items-center space-x-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{user?.role || 'Administrator'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => {
                onOpenProfile();
                setMobileOpen(false);
              }}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Profile Settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed left) */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30">{sidebarContent}</aside>

      {/* Mobile Top Header with Hamburger Toggle */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Database className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm text-white">BackupPulse</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div
            onClick={onOpenProfile}
            className="h-7 w-7 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center cursor-pointer"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-3.5 w-3.5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer (Slide over) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex-1 max-w-xs w-full shadow-2xl z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Floating Toast Notification */}
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
