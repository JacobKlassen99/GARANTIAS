import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, X, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { Garantia } from '../../types';

interface EliminarGarantiaPendienteModalProps {
  isOpen: boolean;
  garantia: Garantia | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
  errorMessage?: string | null;
}

export const EliminarGarantiaPendienteModal: React.FC<EliminarGarantiaPendienteModalProps> = ({
  isOpen,
  garantia,
  isLoading,
  onCancel,
  onConfirm,
  errorMessage,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    setPassword('');
    setShowPassword(false);
    setLocalError(null);
    submittingRef.current = false;

    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, garantia]);

  if (!isOpen || !garantia) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || submittingRef.current) return;

    if (!password.trim()) {
      setLocalError('Debe ingresar la contraseña de administrador para continuar.');
      inputRef.current?.focus();
      return;
    }

    setLocalError(null);
    submittingRef.current = true;
    try {
      await onConfirm(password);
    } finally {
      submittingRef.current = false;
    }
  };

  const currentError = localError || errorMessage;
  const solicitudNum = garantia.numeroSolicitud || garantia.idGarantia || '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-2xs">
      <div
        className="w-full max-w-[420px] rounded-xl bg-white p-6 shadow-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-eliminar-pendiente-title"
      >
        {/* Cabecera unificada */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h3
                id="modal-eliminar-pendiente-title"
                className="text-sm font-bold text-slate-900 leading-tight"
              >
                Eliminar garantía
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Solicitud N.º {solicitudNum}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer disabled:opacity-50"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mensaje principal y descripción */}
        <div className="mt-4 space-y-1">
          <p className="text-xs font-semibold text-slate-800">
            ¿Desea eliminar definitivamente esta garantía?
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Se liberarán los terrenos y bienes reservados. Esta acción no se puede deshacer.
          </p>
        </div>

        {/* Formulario de contraseña */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label
              htmlFor="admin-delete-password-pendiente"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Contraseña de administrador
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Lock className="w-3.5 h-3.5" />
              </span>
              <input
                ref={inputRef}
                id="admin-delete-password-pendiente"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (localError) setLocalError(null);
                }}
                disabled={isLoading}
                placeholder="Ingrese su contraseña"
                className="w-full pl-9 pr-9 py-2 text-xs bg-slate-50/80 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-mono transition disabled:opacity-60"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                disabled={isLoading}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {currentError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{currentError}</span>
            </div>
          )}

          {/* Botones */}
          <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
