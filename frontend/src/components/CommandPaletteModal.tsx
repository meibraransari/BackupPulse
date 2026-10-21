import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Home,
  ShieldCheck,
  Server,
  Users,
  Sliders,
  FileText,
  Sparkles,
  Key,
  Trash2,
  Bell,
  Globe,
  Download,
  RefreshCw,
  Tv,
  ArrowRight,
  Database,
  Terminal,
  CornerDownLeft,
} from 'lucide-react';

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'telemetry' | 'drills' | 'fleet' | 'users' | 'settings' | 'audit') => void;
  onOpenModal: (
    modal: 'deploy' | 'apikeys' | 'housekeeping' | 'notifications' | 'profile' | 'wallboard'
  ) => void;
  onSelectProject: (project: string) => void;
  onSelectServer: (serverId: string) => void;
  onToggleTimezone: () => void;
  onExportCsv: () => void;
  onRefreshData: () => void;
  projects: string[];
  servers: { serverId: string; hostname: string }[];
}

interface PaletteItem {
  id: string;
  category: 'Navigation' | 'Quick Actions' | 'Projects' | 'Servers';
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  action: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onOpenModal,
  onSelectProject,
  onSelectServer,
  onToggleTimezone,
  onExportCsv,
  onRefreshData,
  projects,
  servers,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct all palette items
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      // 1. Navigation
      {
        id: 'nav-telemetry',
        category: 'Navigation',
        title: 'Home / Backup Telemetry',
        subtitle: 'View live backups, anomalies, and execution windows',
        icon: Home,
        badge: 'View',
        action: () => {
          onNavigateTab('telemetry');
          onClose();
        },
      },
      {
        id: 'nav-drills',
        category: 'Navigation',
        title: 'DR Verification Drills (DrillPulse)',
        subtitle: 'Automated sandbox restoration validation logs',
        icon: ShieldCheck,
        badge: 'View',
        action: () => {
          onNavigateTab('drills');
          onClose();
        },
      },
      {
        id: 'nav-fleet',
        category: 'Navigation',
        title: 'Server Fleet Inventory',
        subtitle: "100+ servers matrix and Dead Man's Snitch",
        icon: Server,
        badge: 'View',
        action: () => {
          onNavigateTab('fleet');
          onClose();
        },
      },
      {
        id: 'nav-users',
        category: 'Navigation',
        title: 'User Management & Access Control',
        subtitle: 'Team accounts, roles, and login history',
        icon: Users,
        badge: 'View',
        action: () => {
          onNavigateTab('users');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'System Settings & Webhooks',
        subtitle: 'Dynamic database-backed zero-restart configuration',
        icon: Sliders,
        badge: 'Admin',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        action: () => {
          onNavigateTab('settings');
          onClose();
        },
      },
      {
        id: 'nav-audit',
        category: 'Navigation',
        title: 'Governance & Change Audit Log',
        subtitle: 'SOC 2 / ISO 27001 tamper-evident management logs',
        icon: FileText,
        badge: 'Audit',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        action: () => {
          onNavigateTab('audit');
          onClose();
        },
      },

      // 2. Quick Actions
      {
        id: 'action-wallboard',
        category: 'Quick Actions',
        title: 'Launch Full-Screen NOC Wallboard TV Mode',
        subtitle: 'Operations center high-contrast dashboard with live countdown',
        icon: Tv,
        badge: 'TV Mode',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        action: () => {
          onOpenModal('wallboard');
          onClose();
        },
      },
      {
        id: 'action-deploy',
        category: 'Quick Actions',
        title: 'Deploy New Server & Script Generator Wizard',
        subtitle: 'Generate bash backup cron scripts for S3, GCS, Azure, SFTP',
        icon: Sparkles,
        badge: 'Wizard',
        badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
        action: () => {
          onOpenModal('deploy');
          onClose();
        },
      },
      {
        id: 'action-apikeys',
        category: 'Quick Actions',
        title: 'API Ingestion Tokens & Scoped Keys',
        subtitle: 'Create, rotate, or revoke ingestion tokens',
        icon: Key,
        badge: 'Security',
        action: () => {
          onOpenModal('apikeys');
          onClose();
        },
      },
      {
        id: 'action-housekeeping',
        category: 'Quick Actions',
        title: 'Database Housekeeping & Retention Purge',
        subtitle: 'Clean expired logs and enforce database retention',
        icon: Trash2,
        badge: 'Storage',
        action: () => {
          onOpenModal('housekeeping');
          onClose();
        },
      },
      {
        id: 'action-notifications',
        category: 'Quick Actions',
        title: 'Notification Delivery Audit Logs',
        subtitle: 'View Google Chat, Slack, Discord, Telegram delivery history',
        icon: Bell,
        badge: 'Alerts',
        action: () => {
          onOpenModal('notifications');
          onClose();
        },
      },
      {
        id: 'action-timezone',
        category: 'Quick Actions',
        title: 'Toggle Display Timezone (UTC vs Local)',
        subtitle: 'Instantly re-format timestamps across all views',
        icon: Globe,
        badge: 'Timezone',
        action: () => {
          onToggleTimezone();
          onClose();
        },
      },
      {
        id: 'action-export',
        category: 'Quick Actions',
        title: 'Export Telemetry Records to CSV',
        subtitle: 'Download filtered backup records as CSV spreadsheet',
        icon: Download,
        badge: 'Export',
        action: () => {
          onExportCsv();
          onClose();
        },
      },
      {
        id: 'action-refresh',
        category: 'Quick Actions',
        title: 'Refresh All Telemetry & Fleet Status',
        subtitle: 'Poll latest database changes and update stats',
        icon: RefreshCw,
        badge: 'Sync',
        action: () => {
          onRefreshData();
          onClose();
        },
      },
    ];

    // 3. Projects
    projects.forEach((proj) => {
      items.push({
        id: `proj-${proj}`,
        category: 'Projects',
        title: proj,
        subtitle: 'Filter telemetry table for this project',
        icon: Database,
        badge: 'Project',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        action: () => {
          onSelectProject(proj);
          onClose();
        },
      });
    });

    // 4. Servers
    servers.forEach((srv) => {
      items.push({
        id: `srv-${srv.serverId}`,
        category: 'Servers',
        title: `${srv.hostname || srv.serverId}`,
        subtitle: `Server ID: ${srv.serverId}`,
        icon: Terminal,
        badge: 'Server',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        action: () => {
          onSelectServer(srv.serverId);
          onClose();
        },
      });
    });

    return items;
  }, [
    projects,
    servers,
    onNavigateTab,
    onOpenModal,
    onSelectProject,
    onSelectServer,
    onToggleTimezone,
    onExportCsv,
    onRefreshData,
    onClose,
  ]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: { category: string; items: PaletteItem[] }[] = [];
    const categories: ('Navigation' | 'Quick Actions' | 'Projects' | 'Servers')[] = [
      'Navigation',
      'Quick Actions',
      'Projects',
      'Servers',
    ];

    categories.forEach((cat) => {
      const itemsInCat = filteredItems.filter((i) => i.category === cat);
      if (itemsInCat.length > 0) {
        // Limit projects and servers to 8 each in search results for speed
        const limited = cat === 'Projects' || cat === 'Servers' ? itemsInCat.slice(0, 8) : itemsInCat;
        groups.push({ category: cat, items: limited });
      }
    });

    return groups;
  }, [filteredItems]);

  // Flattened list for keyboard index selection
  const flatSelectableItems = useMemo(() => {
    const list: PaletteItem[] = [];
    groupedItems.forEach((g) => list.push(...g.items));
    return list;
  }, [groupedItems]);

  // Ensure selectedIndex is within bounds
  useEffect(() => {
    if (selectedIndex >= flatSelectableItems.length) {
      setSelectedIndex(0);
    }
  }, [flatSelectableItems, selectedIndex]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % flatSelectableItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + flatSelectableItems.length) % flatSelectableItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatSelectableItems[selectedIndex]) {
        flatSelectableItems[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  let currentItemIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-2xl shadow-indigo-950/50 overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Top Search Input */}
        <div className="p-4 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/80">
          <Search className="h-5 w-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, servers, views, or actions (Ctrl+K)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 rounded-md">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="p-2 overflow-y-auto space-y-4 max-h-[55vh]">
          {flatSelectableItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Search className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p>No matching commands, projects, or servers found.</p>
              <p className="text-[11px] text-slate-600 mt-1">Try typing a project name, server IP, or action keyword.</p>
            </div>
          ) : (
            groupedItems.map((group) => (
              <div key={group.category} className="space-y-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {group.category}
                </div>
                {group.items.map((item) => {
                  currentItemIndex++;
                  const isSelected = currentItemIndex === selectedIndex;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      onClick={() => item.action()}
                      onMouseEnter={() => {
                        // find index
                        const idx = flatSelectableItems.findIndex((x) => x.id === item.id);
                        if (idx !== -1) setSelectedIndex(idx);
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{item.title}</p>
                          {item.subtitle && (
                            <p
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-indigo-100' : 'text-slate-500'
                              }`}
                            >
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {item.badge && (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                              item.badgeColor ||
                              (isSelected
                                ? 'bg-white/20 text-white border-white/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700')
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-white animate-pulse" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                ↵
              </kbd>
              <span>to select</span>
            </span>
          </div>
          <div className="hidden sm:block font-mono text-[10px] text-slate-500">
            BackupPulse Command Engine
          </div>
        </div>
      </div>
    </div>
  );
};
