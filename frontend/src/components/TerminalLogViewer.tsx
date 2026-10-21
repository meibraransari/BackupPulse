import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  Copy,
  Check,
  Download,
  Terminal,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';

interface TerminalLogViewerProps {
  stdoutLog?: string | null;
  stderrLog?: string | null;
  zipFilename?: string;
  projectName?: string;
}

interface LogStage {
  id: string;
  title: string;
  lines: string[];
  isError: boolean;
  isSuccess: boolean;
}

export const TerminalLogViewer: React.FC<TerminalLogViewerProps> = ({
  stdoutLog,
  stderrLog,
  zipFilename = 'backup.tar.gz',
  projectName = 'project',
}) => {
  const [activeTab, setActiveTab] = useState<'combined' | 'stdout' | 'stderr'>(
    stderrLog && stderrLog.trim().length > 0 ? 'combined' : 'stdout'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  // Active raw text based on selected tab
  const rawText = useMemo(() => {
    if (activeTab === 'stderr') return stderrLog || '';
    if (activeTab === 'stdout') return stdoutLog || '';
    // Combined
    const parts: string[] = [];
    if (stdoutLog && stdoutLog.trim()) {
      parts.push(stdoutLog.trim());
    }
    if (stderrLog && stderrLog.trim()) {
      parts.push(`\n--- [STANDARD ERROR TRACES] ---\n${stderrLog.trim()}`);
    }
    return parts.join('\n') || 'No logs recorded.';
  }, [activeTab, stdoutLog, stderrLog]);

  // Parse logs into stages if [1/5], [2/5] pattern exists
  const parsedStages = useMemo((): LogStage[] => {
    const lines = rawText.split('\n');
    const stages: LogStage[] = [];
    let currentStage: LogStage = {
      id: 'preamble',
      title: 'Initialization & Preamble',
      lines: [],
      isError: false,
      isSuccess: false,
    };

    const stageRegex = /\[(\d+\/\d+)\]\s+(.*)/i;

    lines.forEach((line) => {
      const match = line.match(stageRegex);
      if (match) {
        if (currentStage.lines.length > 0) {
          stages.push(currentStage);
        }
        const stageNum = match[1];
        const stageDesc = match[2];
        const isError = /fail|error|fatal|denied/i.test(line);
        const isSuccess = /completed|success/i.test(line);

        currentStage = {
          id: `stage-${stageNum}`,
          title: `[${stageNum}] ${stageDesc}`,
          lines: [line],
          isError,
          isSuccess,
        };
      } else {
        if (/fail|error|fatal|denied/i.test(line)) {
          currentStage.isError = true;
        }
        if (/completed successfully|backup completed/i.test(line)) {
          currentStage.isSuccess = true;
        }
        currentStage.lines.push(line);
      }
    });

    if (currentStage.lines.length > 0) {
      stages.push(currentStage);
    }

    return stages;
  }, [rawText]);

  const hasStages = parsedStages.length > 1;

  // Toggle stage collapse
  const toggleStage = (stageId: string) => {
    setCollapsedStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    parsedStages.forEach((s) => {
      allCollapsed[s.id] = true;
    });
    setCollapsedStages(allCollapsed);
  };

  const expandAll = () => {
    setCollapsedStages({});
  };

  // Copy helper
  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Download log file
  const handleDownloadLog = () => {
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_backup_${new Date().toISOString().slice(0, 10)}.log`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Search matches count
  const searchMatchesCount = useMemo(() => {
    if (!searchQuery.trim()) return 0;
    const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = rawText.match(regex);
    return matches ? matches.length : 0;
  }, [rawText, searchQuery]);

  // Syntax highlighting helper for individual line
  const renderHighlightedLine = (line: string, index: number) => {
    const isErrorLine = /fail|error|fatal|denied|critical|exit code [1-9]|permission denied/i.test(line);
    const isSuccessLine = /completed successfully|success|🎉|archive size/i.test(line);
    const isCommandLine = /pg_dump|mysqldump|mongodump|redis-cli|tar\s+-czf|sqlite3|curl|gsutil|aws s3|azcopy/i.test(line);
    const isStepHeader = /\[\d+\/\d+\]/i.test(line);

    // If search active, highlight search query occurrences
    if (searchQuery.trim()) {
      const parts = line.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      return (
        <span
          className={`${
            isErrorLine
              ? 'text-rose-400 font-semibold'
              : isSuccessLine
              ? 'text-emerald-400'
              : isCommandLine
              ? 'text-cyan-300'
              : 'text-slate-300'
          }`}
        >
          {parts.map((part, i) =>
            part.toLowerCase() === searchQuery.toLowerCase() ? (
              <mark key={i} className="bg-amber-400/30 text-amber-200 px-0.5 rounded border border-amber-400/50">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    }

    if (isErrorLine) {
      return <span className="text-rose-400 font-semibold">{line}</span>;
    }
    if (isSuccessLine) {
      return <span className="text-emerald-400 font-medium">{line}</span>;
    }
    if (isStepHeader) {
      return <span className="text-indigo-300 font-bold">{line}</span>;
    }
    if (isCommandLine) {
      return <span className="text-cyan-300 font-mono">{line}</span>;
    }
    return <span className="text-slate-300">{line}</span>;
  };

  return (
    <div
      className={`bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all ${
        isExpanded ? 'fixed inset-4 z-50 max-h-none' : 'relative max-h-[500px]'
      }`}
    >
      {/* 1. Terminal Top Bar */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Window Dots & Tabs */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500/80" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Log Stream Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('combined')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                activeTab === 'combined'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Streams
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stdout')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                activeTab === 'stdout'
                  ? 'bg-slate-800 text-emerald-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              stdout
            </button>
            {stderrLog && stderrLog.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('stderr')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  activeTab === 'stderr'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-sm'
                    : 'text-rose-400 hover:text-rose-300'
                }`}
              >
                <AlertCircle className="h-3 w-3" />
                <span>stderr</span>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Search Box & Actions */}
        <div className="flex items-center space-x-2">
          {/* In-Log Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search log (Ctrl+F)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-16 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors w-44 sm:w-56"
            />
            {searchQuery && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1 text-[10px] text-slate-400">
                <span>{searchMatchesCount} hits</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Copy Full Log */}
          <button
            type="button"
            onClick={() => handleCopy(rawText, 'all')}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] border border-slate-700"
            title="Copy logs to clipboard"
          >
            {copiedType === 'all' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span className="hidden sm:inline">Copy</span>
              </>
            )}
          </button>

          {/* Download Raw Log */}
          <button
            type="button"
            onClick={handleDownloadLog}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title="Download raw log (.log)"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Fullscreen / Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            title={isExpanded ? 'Collapse' : 'Full Screen'}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Stages Sub-Bar (If structured stages detected) */}
      {hasStages && (
        <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center space-x-2">
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span>Structured Stages ({parsedStages.length} phases detected)</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={expandAll}
              className="hover:text-white transition-colors underline decoration-slate-600"
            >
              Expand All
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={collapseAll}
              className="hover:text-white transition-colors underline decoration-slate-600"
            >
              Collapse All
            </button>
          </div>
        </div>
      )}

      {/* 3. Log Stream Body with Line Numbers */}
      <div className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed p-3 bg-black/95 select-text">
        {hasStages ? (
          /* Render by Stages */
          <div className="space-y-3">
            {parsedStages.map((stage) => {
              const isCollapsed = !!collapsedStages[stage.id];
              return (
                <div
                  key={stage.id}
                  className={`rounded-xl border transition-all ${
                    stage.isError
                      ? 'border-rose-900/50 bg-rose-950/20'
                      : stage.isSuccess
                      ? 'border-emerald-900/40 bg-emerald-950/10'
                      : 'border-slate-800/80 bg-slate-900/30'
                  }`}
                >
                  {/* Stage Header */}
                  <div
                    onClick={() => toggleStage(stage.id)}
                    className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                  >
                    <div className="flex items-center space-x-2">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      <span
                        className={`font-semibold ${
                          stage.isError
                            ? 'text-rose-400'
                            : stage.isSuccess
                            ? 'text-emerald-400'
                            : 'text-indigo-300'
                        }`}
                      >
                        {stage.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-sans">
                      {stage.lines.length} lines {isCollapsed ? '(collapsed)' : ''}
                    </span>
                  </div>

                  {/* Stage Content */}
                  {!isCollapsed && (
                    <div className="p-3 border-t border-slate-800/60 space-y-1">
                      {stage.lines.map((line, idx) => (
                        <div key={idx} className="flex hover:bg-slate-800/30 px-1.5 py-0.5 rounded">
                          <span className="w-8 shrink-0 text-slate-600 select-none text-right pr-3 font-mono text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="flex-1 whitespace-pre-wrap break-all">
                            {renderHighlightedLine(line, idx)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Render Plain Lines with Line Numbers */
          <div className="space-y-0.5">
            {rawText.split('\n').map((line, idx) => (
              <div key={idx} className="flex hover:bg-slate-800/30 px-1.5 py-0.5 rounded">
                <span className="w-10 shrink-0 text-slate-600 select-none text-right pr-3 font-mono text-[10px]">
                  {idx + 1}
                </span>
                <span className="flex-1 whitespace-pre-wrap break-all">
                  {renderHighlightedLine(line, idx)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Terminal Bottom Status Bar */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center space-x-2">
          <Terminal className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-mono text-slate-400">{zipFilename}</span>
          <span>•</span>
          <span>{rawText.split('\n').length} lines</span>
        </div>
        <div>
          {searchQuery && searchMatchesCount > 0 && (
            <span className="text-amber-400 font-medium">{searchMatchesCount} search results found</span>
          )}
        </div>
      </div>
    </div>
  );
};
