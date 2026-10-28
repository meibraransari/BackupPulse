import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2, ShieldAlert, Info } from 'lucide-react';

export interface RsyncConfirmItemDetail {
  label: string;
  value: React.ReactNode;
}

export interface RsyncConfirmModalConfig {
  title: string;
  subtitle?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  itemDetails?: RsyncConfirmItemDetail[];
  onConfirm: () => Promise<void>;
}

interface RsyncConfirmModalProps {
  config: RsyncConfirmModalConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export const RsyncConfirmModal: React.FC<RsyncConfirmModalProps> = ({
  config,
  isOpen,
  onClose,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !config) return null;

  const handleConfirmAction = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await config.onConfirm();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isDestructive = config.isDestructive ?? true;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 bg-gradient-to-r ${
            isDestructive
              ? 'from-rose-950/70 via-slate-950 to-slate-950 border-b border-rose-900/40'
              : 'from-amber-950/70 via-slate-950 to-slate-950 border-b border-amber-900/40'
          } flex items-center justify-between`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`p-2 rounded-xl border ${
                isDestructive
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}
            >
              {isDestructive ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">{config.title}</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isDestructive
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  Admin Action
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{config.subtitle || 'Confirmation required'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* Warning Message Card */}
          <div
            className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
              isDestructive
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-200'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
            }`}
          >
            <ShieldAlert
              className={`h-5 w-5 shrink-0 mt-0.5 ${
                isDestructive ? 'text-rose-400' : 'text-amber-400'
              }`}
            />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">Confirmation Needed</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">{config.description}</p>
            </div>
          </div>

          {/* Item Details Card (if provided) */}
          {config.itemDetails && config.itemDetails.length > 0 && (
            <div className="bg-slate-950/80 rounded-xl border border-slate-800/90 p-4 space-y-2.5 font-mono text-[11px]">
              {config.itemDetails.map((detail, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between ${
                    index !== config.itemDetails!.length - 1 ? 'border-b border-slate-800/80 pb-2' : ''
                  }`}
                >
                  <span className="text-slate-500 font-sans text-xs font-semibold">{detail.label}</span>
                  <span className="text-slate-200 font-medium truncate max-w-[280px]" title={typeof detail.value === 'string' ? detail.value : undefined}>
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Audit Notice */}
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5 px-1">
            <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <span>This action will be logged in the immutable system audit trail.</span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-800/60 text-red-300 text-xs flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700 disabled:opacity-50"
          >
            {config.cancelText || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleConfirmAction}
            disabled={submitting}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 ${
              isDestructive
                ? 'bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 shadow-rose-900/30'
                : 'bg-gradient-to-r from-amber-600 to-orange-700 hover:from-amber-500 hover:to-orange-600 shadow-amber-900/30'
            }`}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{config.confirmText || (isDestructive ? 'Delete Permanently' : 'Confirm')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
