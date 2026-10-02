import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isDestructive = false,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl border border-slate-300 animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                isDestructive ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 pl-12">
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>

        <div className="mt-5 flex justify-end gap-2 pl-12">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-3 py-1.5 text-xs font-semibold text-white rounded transition flex items-center gap-1.5 ${
              isDestructive
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-emerald-800 hover:bg-emerald-900'
            }`}
          >
            {isLoading && (
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
