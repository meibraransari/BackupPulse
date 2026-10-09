import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Bell,
  Mail,
  Send,
  Database,
  Calendar,
  Layers,
  Search,
  Loader2,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettingItem, SystemSettingsCategory } from '../types';

interface SettingsViewProps {
  onSettingsSaved?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [categories, setCategories] = useState<SystemSettingsCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; success?: boolean; message?: string }>>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
      setCategories(res.categories);
      setEditedValues({});
    } catch (err: any) {
      setToast({ type: 'error', text: `Failed to load settings: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFieldChange = (key: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const hasUnsavedChanges = Object.keys(editedValues).length > 0;

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await api.updateSettings(editedValues);
      setToast({
        type: 'success',
        text: `${res.updatedCount} settings updated and applied immediately in memory without server restart!`,
      });
      await fetchSettings();
      if (onSettingsSaved) onSettingsSaved();
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setEditedValues({});
    setToast({ type: 'success', text: 'All unsaved modifications discarded.' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleTestChannel = async (channel: 'google_chat' | 'slack' | 'discord' | 'telegram' | 'email') => {
    setTestStatus((prev) => ({
      ...prev,
      [channel]: { loading: true },
    }));
    try {
      const res = await api.testChannel(channel);
      setTestStatus((prev) => ({
        ...prev,
        [channel]: { loading: false, success: true, message: res.message },
      }));
      setToast({ type: 'success', text: res.message });
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [channel]: { loading: false, success: false, message: err.message },
      }));
      setToast({ type: 'error', text: err.message || `Testing ${channel} failed.` });
    } finally {
      setTimeout(() => {
        setTestStatus((prev) => ({
          ...prev,
          [channel]: { ...prev[channel], loading: false },
        }));
      }, 6000);
    }
  };

  // Filter settings
  const filteredSettings = settings.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (catId: string) => {
    switch (catId) {
      case 'general':
        return <Layers className="h-4 w-4" />;
      case 'alerts':
        return <Calendar className="h-4 w-4" />;
      case 'google_chat':
      case 'slack':
      case 'discord':
      case 'telegram':
        return <Bell className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'retention':
        return <Database className="h-4 w-4" />;
      default:
        return <Sliders className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading dynamic database settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Info */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Sliders className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">System Settings Engine</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Instant Zero-Restart
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
              Configure alert schedules, webhook endpoints, email gateways, and retention rules directly in the database.
              Saved modifications are applied <b>immediately in memory</b> without needing a Docker container restart, and are preserved in database backups.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {hasUnsavedChanges && (
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Discard ({Object.keys(editedValues).length})</span>
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg ${
                hasUnsavedChanges
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-950/50 cursor-pointer animate-pulse'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Save className="h-4 w-4" />}
              <span>{saving ? 'Applying...' : 'Save & Apply Now'}</span>
            </button>
          </div>
        </div>

        {/* Unsaved indicator banner */}
        {hasUnsavedChanges && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                You have <b>{Object.keys(editedValues).length}</b> unsaved modification(s). Click "Save & Apply Now" to update the database and running services.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === 'all'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>All Settings</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
              {settings.length}
            </span>
          </button>
          {categories.map((cat) => {
            const count = settings.filter((s) => s.category === cat.id).length;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-950/60 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Channel Quick Tests Toolbar (When relevant category or all is selected) */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span>Instant Channel Verification:</span>
        </span>

        {/* Google Chat Test */}
        <button
          onClick={() => handleTestChannel('google_chat')}
          disabled={testStatus.google_chat?.loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-800/50 hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
        >
          {testStatus.google_chat?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          <span>Test Google Chat</span>
        </button>

        {/* Slack Test */}
        <button
          onClick={() => handleTestChannel('slack')}
          disabled={testStatus.slack?.loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-950/30 border border-indigo-800/50 hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
        >
          {testStatus.slack?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span>Test Slack</span>
        </button>

        {/* Discord Test */}
        <button
          onClick={() => handleTestChannel('discord')}
          disabled={testStatus.discord?.loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sky-300 bg-sky-950/30 border border-sky-800/50 hover:bg-sky-900/40 transition-colors disabled:opacity-50"
        >
          {testStatus.discord?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
          <span>Test Discord</span>
        </button>

        {/* Telegram Test */}
        <button
          onClick={() => handleTestChannel('telegram')}
          disabled={testStatus.telegram?.loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-300 bg-cyan-950/30 border border-cyan-800/50 hover:bg-cyan-900/40 transition-colors disabled:opacity-50"
        >
          {testStatus.telegram?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span>Test Telegram</span>
        </button>

        {/* Email Test */}
        <button
          onClick={() => handleTestChannel('email')}
          disabled={testStatus.email?.loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/30 border border-rose-800/50 hover:bg-rose-900/40 transition-colors disabled:opacity-50"
        >
          {testStatus.email?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
          <span>Test Email Gateway</span>
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSettings.map((item) => {
          const isModified = item.key in editedValues;
          const currentValue = isModified ? editedValues[item.key] : item.value;
          const isSecret = item.isEncrypted;
          const isSecretRevealed = showSecrets[item.key] || false;

          return (
            <div
              key={item.key}
              className={`bg-slate-900/70 border rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all ${
                isModified
                  ? 'border-amber-500/60 shadow-lg shadow-amber-950/20 bg-slate-900/90 ring-1 ring-amber-500/30'
                  : 'border-slate-800 hover:border-slate-700/80'
              }`}
            >
              <div>
                {/* Header: Label, Key, Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white tracking-tight flex items-center space-x-2">
                      <span>{item.label}</span>
                      {isModified && (
                        <span className="text-[10px] font-bold px-2 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/40">
                          Modified
                        </span>
                      )}
                    </h3>
                    <code className="text-[11px] text-slate-500 font-mono select-all">{item.key}</code>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                      {item.category}
                    </span>
                    {item.isEncrypted && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-950/40 text-rose-400 border border-rose-800/40 flex items-center space-x-1">
                        <ShieldCheck className="h-3 w-3" />
                        <span>Secret</span>
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{item.description}</p>
              </div>

              {/* Input Control Based on Type */}
              <div className="pt-2">
                {item.type === 'boolean' ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                    <span className="text-xs font-medium text-slate-300">
                      Current Status: <b className={currentValue === 'true' ? 'text-emerald-400' : 'text-slate-500'}>
                        {currentValue === 'true' ? 'ENABLED' : 'DISABLED'}
                      </b>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFieldChange(item.key, currentValue === 'true' ? 'false' : 'true')}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        currentValue === 'true' ? 'bg-emerald-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          currentValue === 'true' ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ) : item.type === 'select' && item.options ? (
                  <div className="space-y-1">
                    <select
                      value={currentValue}
                      onChange={(e) => handleFieldChange(item.key, e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500"
                    >
                      {item.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : item.type === 'password' ? (
                  <div className="relative">
                    <input
                      type={isSecretRevealed ? 'text' : 'password'}
                      value={currentValue}
                      placeholder={item.isConfigured ? '•••••••• (Encrypted — enter new value to overwrite)' : 'Enter value...'}
                      onChange={(e) => handleFieldChange(item.key, e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecrets((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 p-0.5"
                    >
                      {isSecretRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                ) : (
                  <input
                    type={item.type === 'number' ? 'number' : 'text'}
                    value={currentValue}
                    placeholder="Enter value..."
                    onChange={(e) => handleFieldChange(item.key, e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                )}
              </div>

              {/* Footer info: Last updated */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                {item.updatedBy && <span>By: {item.updatedBy}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Save Bar when modifications exist */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 inset-x-0 mx-auto max-w-xl z-40 px-4 animate-slide-up">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-xs text-white">
                <b>{Object.keys(editedValues).length} setting(s) changed</b>
                <div className="text-[11px] text-slate-400">Click to apply instantly in memory</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDiscard}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors flex items-center space-x-1.5 shadow-md shadow-emerald-950/60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span>Save & Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`flex items-center space-x-2 px-4 py-3 rounded-xl shadow-2xl border text-sm ${
              toast.type === 'success'
                ? 'bg-slate-900 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-900 border-red-500/50 text-red-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};
