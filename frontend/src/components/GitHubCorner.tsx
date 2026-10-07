import React from 'react';
import { Github, ExternalLink } from 'lucide-react';

export const GITHUB_REPO_URL = 'https://github.com/meibraransari/BackupPulse.git';

export const GitHubCorner: React.FC = () => {
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-3.5 right-3.5 sm:top-4 sm:right-6 z-50 flex items-center space-x-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-800 hover:border-emerald-500/50 shadow-xl shadow-black/50 backdrop-blur-md transition-all duration-200 group cursor-pointer"
      title="View BackupPulse source code on GitHub"
      aria-label="BackupPulse GitHub Repository"
    >
      <div className="flex items-center justify-center p-0.5 rounded-lg bg-slate-800/80 group-hover:bg-slate-700 transition-colors">
        <Github className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
      </div>
      <span className="text-xs font-semibold tracking-wide">GitHub</span>
      <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
    </a>
  );
};
