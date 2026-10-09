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
  ExternalLink,
  MessageSquare,
  Server,
  Cloud,
  Key,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettingItem, SystemSettingsCategory } from '../types';

interface SettingsViewProps {
  onSettingsSaved?: () => void;
}

interface SettingCardDefinition {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  icon: any;
  iconColor: string;
  badge?: string;
  testChannel?: 'google_chat' | 'slack' | 'discord' | 'telegram' | 'email';
  testButtonLabel?: string;
  settingKeys: string[];
}

const SETTING_CARDS: SettingCardDefinition[] = [
  // 1. General & Hub
  {
    id: 'general',
    category: 'general',
    title: 'General & Hub Configuration',
    subtitle: 'Base URL for alert hyperlinks, console request logging, and global ingestion master key.',
    icon: Layers,
    iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    settingKeys: ['APP_BASE_URL', 'INGESTION_API_KEY', 'ENABLE_CONSOLE_LOG', 'LOG_LEVEL'],
  },

  // 2. Alerts & Cron Schedules
  {
    id: 'alerts',
    category: 'alerts',
    title: 'Automated Reports & Incident Alerts',
    subtitle: 'Daily telemetry summary cron schedule and real-time instant alerts on backup failures.',
    icon: Calendar,
    iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    settingKeys: ['REPORT_CRON', 'INSTANT_ALERT_ON_FAILURE'],
  },

  // 3. Google Chat (Single Cohesive Card)
  {
    id: 'google_chat',
    category: 'google_chat',
    title: 'Google Chat Integration',
    subtitle: 'Send rich Cards v2 daily digests and failure alert cards to your Google Chat space.',
    icon: MessageSquare,
    iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    testChannel: 'google_chat',
    testButtonLabel: 'Test Google Chat',
    settingKeys: ['ENABLE_GOOGLE_CHAT', 'GOOGLE_CHAT_WEBHOOK_URL'],
  },

  // 4. Slack (Single Cohesive Card)
  {
    id: 'slack',
    category: 'slack',
    title: 'Slack Webhook Integration',
    subtitle: 'Send Block Kit formatted telemetry cards and instant incident alerts to Slack.',
    icon: Send,
    iconColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    testChannel: 'slack',
    testButtonLabel: 'Test Slack',
    settingKeys: ['ENABLE_SLACK', 'SLACK_WEBHOOK_URL'],
  },

  // 5. Discord (Single Cohesive Card)
  {
    id: 'discord',
    category: 'discord',
    title: 'Discord Webhook Integration',
    subtitle: 'Send Rich Embed daily digests and instant failure alerts to Discord channels.',
    icon: ExternalLink,
    iconColor: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    testChannel: 'discord',
    testButtonLabel: 'Test Discord',
    settingKeys: ['ENABLE_DISCORD', 'DISCORD_WEBHOOK_URL'],
  },

  // 6. Telegram (Single Cohesive Card)
  {
    id: 'telegram',
    category: 'telegram',
    title: 'Telegram Bot Alerts',
    subtitle: 'Send formatted HTML summary reports and instant incident alerts via Telegram Bot.',
    icon: Send,
    iconColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    testChannel: 'telegram',
    testButtonLabel: 'Test Telegram',
    settingKeys: ['ENABLE_TELEGRAM', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
  },

  // 7. Email Gateway Routing (Single Cohesive Card)
  {
    id: 'email_routing',
    category: 'email',
    title: 'Email Delivery & Global Dispatch',
    subtitle: 'Select active email delivery engine and default sender/recipient destination addresses.',
    icon: Mail,
    iconColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    testChannel: 'email',
    testButtonLabel: 'Test Email Delivery',
    badge: 'Router',
    settingKeys: ['ENABLE_EMAIL', 'EMAIL_PROVIDER', 'EMAIL_FROM', 'EMAIL_TO'],
  },

  // 8. Standard SMTP Relay (Single Cohesive Card)
  {
    id: 'smtp_relay',
    category: 'email',
    title: 'Standard SMTP Relay Server',
    subtitle: 'Configure traditional SMTP credentials (e.g. Gmail, Postfix, Office 365, or relay server).',
    icon: Server,
    iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    badge: 'SMTP',
    settingKeys: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD'],
  },

  // 9. SendGrid Web API (Single Cohesive Card)
  {
    id: 'sendgrid_api',
    category: 'email',
    title: 'SendGrid Web API v3',
    subtitle: 'Direct cloud email dispatch using SendGrid official HTTP Web API (high deliverability).',
    icon: Cloud,
    iconColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    badge: 'SendGrid',
    settingKeys: ['SENDGRID_API_KEY'],
  },

  // 10. Amazon AWS SES (Single Cohesive Card)
  {
    id: 'aws_ses',
    category: 'email',
    title: 'Amazon AWS SES (Simple Email Service)',
    subtitle: 'High-throughput enterprise email delivery via AWS SES regional endpoint.',
    icon: Cloud,
    iconColor: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    badge: 'AWS SES',
    settingKeys: ['AWS_SES_REGION', 'AWS_SES_ACCESS_KEY_ID', 'AWS_SES_SECRET_ACCESS_KEY'],
  },

  // 11. Database Retention & Housekeeping (Single Cohesive Card)
  {
    id: 'retention',
    category: 'retention',
    title: 'Database Storage & Housekeeping Policy',
    subtitle: 'Automated background cleanup to purge stale backup telemetry and audit logs.',
    icon: Database,
    iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    settingKeys: ['ENABLE_HOUSEKEEPING', 'DB_RETENTION_DAYS', 'HOUSEKEEPING_CRON'],
  },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsSaved }) => {
  const [settingsMap, setSettingsMap] = useState<Map<string, SystemSettingItem>>(new Map());
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
      const map = new Map<string, SystemSettingItem>();
      res.settings.forEach((s) => map.set(s.key, s));
      setSettingsMap(map);
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
        text: `${res.updatedCount} setting(s) updated and applied immediately in memory without server restart!`,
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
      }, 7000);
    }
  };

  // Filter cards based on selected category and search query
  const filteredCards = SETTING_CARDS.filter((card) => {
    const matchesCategory = activeCategory === 'all' || card.category === activeCategory;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const titleMatch = card.title.toLowerCase().includes(query);
    const subtitleMatch = card.subtitle.toLowerCase().includes(query);

    const settingMatch = card.settingKeys.some((k) => {
      const item = settingsMap.get(k);
      if (!item) return false;
      return (
        item.label.toLowerCase().includes(query) ||
        item.key.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    });

    return titleMatch || subtitleMatch || settingMatch;
  });

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
                Zero-Restart Hot Reload
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-3xl leading-relaxed">
              Configure alert schedules, webhook endpoints, email gateways, and retention rules directly in the database.
              Each service is grouped into a <b>single dedicated card</b>. Saved modifications apply <b>immediately in memory</b> without needing a Docker container restart!
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
                You have <b>{Object.keys(editedValues).length}</b> unsaved modification(s). Click "Save & Apply Now" to update database and active in-memory services.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Professional Category Navigation & Search Toolbar (Multi-line layout, zero scrollbars) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Multi-line wrapping category pills (Zero horizontal scrollbar) */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setActiveCategory('all')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400/30'
                  : 'bg-slate-950/70 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/80'
              }`}
            >
              <span>All Settings</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeCategory === 'all' ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {SETTING_CARDS.length}
              </span>
            </button>
            {categories.map((cat) => {
              const count = SETTING_CARDS.filter((c) => c.category === cat.id).length;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40 ring-1 ring-emerald-400/30'
                      : 'bg-slate-950/70 text-slate-400 hover:text-white hover:bg-slate-800/80 border border-slate-800/80'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isActive ? 'bg-emerald-700 text-white' : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input on the right, perfectly styled */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search setting name, key, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-500 hover:text-white p-0.5 rounded-full hover:bg-slate-800 text-xs transition-colors"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Settings Cohesive Cards Grid */}
      <div className="space-y-6">
        {filteredCards.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
            No settings match your search query "{searchQuery}".
          </div>
        ) : (
          filteredCards.map((card) => {
            const Icon = card.icon;
            const test = card.testChannel ? testStatus[card.testChannel] : null;

            // Check if any setting inside this card has been modified
            const cardModifiedCount = card.settingKeys.filter((k) => k in editedValues).length;

            return (
              <div
                key={card.id}
                className={`bg-slate-900/70 border rounded-2xl overflow-hidden transition-all ${
                  cardModifiedCount > 0
                    ? 'border-amber-500/60 shadow-xl shadow-amber-950/20 ring-1 ring-amber-500/30'
                    : 'border-slate-800 hover:border-slate-700/80'
                }`}
              >
                {/* Single Cohesive Card Header */}
                <div className="p-5 border-b border-slate-800/80 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className={`p-2.5 rounded-xl border shrink-0 ${card.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-base font-bold text-white tracking-tight">{card.title}</h3>
                        {card.badge && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {card.badge}
                          </span>
                        )}
                        {cardModifiedCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {cardModifiedCount} Modified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{card.subtitle}</p>
                    </div>
                  </div>

                  {/* Channel Test Button inside this card */}
                  {card.testChannel && (
                    <button
                      onClick={() => handleTestChannel(card.testChannel!)}
                      disabled={test?.loading}
                      className="self-start sm:self-auto flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shrink-0 disabled:opacity-50"
                      title={`Verify ${card.title} channel`}
                    >
                      {test?.loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                      ) : test?.success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : test?.success === false ? (
                        <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                      <span>{test?.loading ? 'Testing...' : card.testButtonLabel || 'Test Connection'}</span>
                    </button>
                  )}
                </div>

                {/* Card Fields Body */}
                <div className="p-5 space-y-4 divide-y divide-slate-800/60">
                  {card.settingKeys.map((key) => {
                    const item = settingsMap.get(key);
                    if (!item) return null;

                    const isModified = key in editedValues;
                    const currentValue = isModified ? editedValues[key] : item.value;
                    const isSecret = item.isEncrypted;
                    const isSecretRevealed = showSecrets[key] || false;

                    return (
                      <div
                        key={key}
                        className={`pt-4 first:pt-0 flex flex-col md:flex-row md:items-center justify-between gap-4`}
                      >
                        {/* Label, Key, Description */}
                        <div className="md:w-5/12 pr-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-white">{item.label}</span>
                            {isSecret && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-800/40 flex items-center space-x-1">
                                <ShieldCheck className="h-2.5 w-2.5" />
                                <span>Secret</span>
                              </span>
                            )}
                            {isModified && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Modified
                              </span>
                            )}
                          </div>
                          <code className="text-[10px] text-slate-500 font-mono block mt-0.5 select-all">{item.key}</code>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                        </div>

                        {/* Input Control */}
                        <div className="md:w-7/12">
                          {item.type === 'boolean' ? (
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                              <span className="text-xs font-medium text-slate-300">
                                Status:{' '}
                                <b className={currentValue === 'true' ? 'text-emerald-400' : 'text-slate-500'}>
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
                            <select
                              value={currentValue}
                              onChange={(e) => handleFieldChange(item.key, e.target.value)}
                              className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-semibold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                            >
                              {item.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          ) : item.type === 'password' ? (
                            <div className="relative">
                              <input
                                type={isSecretRevealed ? 'text' : 'password'}
                                value={currentValue}
                                placeholder={item.isConfigured ? '•••••••• (Encrypted — enter new to replace)' : 'Enter secret value...'}
                                onChange={(e) => handleFieldChange(item.key, e.target.value)}
                                className={`w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-950/80 border text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors ${
                                  isModified ? 'border-amber-500/80' : 'border-slate-800 focus:border-emerald-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowSecrets((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                                className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 p-0.5"
                                title="Toggle secret visibility"
                              >
                                {isSecretRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          ) : (
                            <input
                              type={item.type === 'number' ? 'number' : 'text'}
                              value={currentValue}
                              placeholder="Enter value..."
                              onChange={(e) => handleFieldChange(item.key, e.target.value)}
                              className={`w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border text-xs font-mono text-white placeholder-slate-600 focus:outline-none transition-colors ${
                                isModified ? 'border-amber-500/80' : 'border-slate-800 focus:border-emerald-500'
                              }`}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Save Action Bar when modifications exist */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 inset-x-0 mx-auto max-w-xl z-40 px-4 animate-slide-up">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-2xl p-4 shadow-2xl flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-xs text-white">
                <b>{Object.keys(editedValues).length} setting(s) modified</b>
                <div className="text-[11px] text-slate-400">Click to apply changes immediately</div>
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

      {/* Floating Toast Notification */}
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
