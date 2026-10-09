import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught UI error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[250px] p-6 rounded-2xl bg-slate-900 border border-red-900/60 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl m-4">
          <div className="h-12 w-12 rounded-full bg-red-950 border border-red-800 flex items-center justify-center text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">Something went wrong in this view</h3>
            <p className="text-xs text-slate-400 max-w-md">
              {this.props.fallbackMessage || 'An unexpected rendering error occurred. Please try resetting or reloading the page.'}
            </p>
          </div>
          {this.state.error && (
            <pre className="p-3 bg-black/80 rounded-xl border border-red-900/40 text-red-300 font-mono text-[11px] max-w-lg overflow-x-auto text-left">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex items-center space-x-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center space-x-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try Again</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
