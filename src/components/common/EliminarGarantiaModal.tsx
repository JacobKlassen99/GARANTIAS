import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Lock, Eye, EyeOff, X, Loader2, Trash2 } from 'lucide-react';
import { Garantia } from '../../types';

interface EliminarGarantiaModalProps {
  isOpen: boolean;
  garantia: Garantia | null;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
  errorMessage?: string | null;
}

export const EliminarGarantiaModal: React.FC<EliminarGarantiaModalProps> = ({
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

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setLocalError(null);
      // Enfocar el input después de renderizar
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, garantia]);

  if (!isOpen || !garantia) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setLocalError('Debe ingresar la contraseña del administrador para continuar.');
      inputRef.current?.focus();
      return;
    }
    setLocalError(null);
    await onConfirm(password);
  };

  const currentError = localError || errorMessage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl border border-red-200 animate-in fade-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-eliminar-title"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 border border-red-200">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 id="modal-eliminar-title" className="text-sm font-bold text-slate-900 leading-tight">
                ¿Está seguro de que desea eliminar la garantía N.º {garantia.numeroSolicitud}?
              </h3>
              <p className="text-[11px] text-red-600 font-semibold mt-0.5">
                Esta acción es permanente y no se podrá deshacer.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition cursor-pointer disabled:opacity-50"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Descripción del impacto */}
        <div className="mt-3.5 pl-13 text-xs text-slate-600 space-y-1.5">
          <p>
            Al eliminar definitivamente la garantía, se borrará su registro de la hoja principal y se retirarán las relaciones en las tablas de lotes y bienes garantizados.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Los terrenos y bienes asociados no serán borrados del sistema; quedarán liberados para nuevas operaciones.
            </span>
          </div>
        </div>

        {/* Formulario con campo de contraseña */}
        <form onSubmit={handleSubmit} className="mt-4 pl-13 space-y-3">
          <div>
            <label
              htmlFor="admin-delete-password"
              className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Contraseña del Administrador</span>
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="admin-delete-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (localError) setLocalError(null);
                }}
                disabled={isLoading}
                placeholder="Ingrese contraseña de administrador..."
                className="w-full pl-3 pr-9 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600 focus:border-red-600 font-mono disabled:opacity-60"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Mensaje de Error */}
          {currentError && (
            <div className="p-2 bg-red-50 border border-red-300 rounded text-xs text-red-800 flex items-start gap-1.5 animate-in fade-in">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium">{currentError}</span>
            </div>
          )}

          {/* Botones de acción */}
          <div className="mt-5 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 active:bg-red-900 rounded transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar definitivamente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
