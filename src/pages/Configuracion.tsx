import React, { useState, useEffect } from 'react';
import { Settings, Lock, Building, Save, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { getConfiguracion, updateConfiguracion } from '../services/backend';

export const Configuracion: React.FC = () => {
  const [nombreInstitucion, setNombreInstitucion] = useState('ASOC. CIVIL "COLONIA CHIHUAHUA"');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadConfig = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const cfg = await getConfiguracion();
      if (cfg.nombreInstitucion) {
        setNombreInstitucion(cfg.nombreInstitucion);
      }
    } catch {
      // Sin inventar valores
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (nuevaContrasena && nuevaContrasena !== confirmarContrasena) {
      setErrorMessage('La nueva contraseña y la confirmación no coinciden.');
      return;
    }

    setIsSaving(true);
    try {
      await updateConfiguracion({
        nuevaContrasena: nuevaContrasena || undefined,
        nombreInstitucion: nombreInstitucion.trim(),
      });
      setSuccessMessage('Configuración actualizada con éxito.');
      setNuevaContrasena('');
      setConfirmarContrasena('');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'No se pudo actualizar la configuración.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-slate-800 text-white rounded">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Configuración del Sistema
            </h2>
            <p className="text-[11px] text-slate-500">
              Parámetros generales de la institución y seguridad de acceso
            </p>
          </div>
        </div>

        <button
          onClick={loadConfig}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Recargar</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-xs text-emerald-900 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-5 rounded border border-slate-200 shadow-2xs space-y-4">
        {/* PARÁMETRO: Nombre de la Institución */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-emerald-800" />
            <span>Nombre de la Institución</span>
          </label>
          <input
            type="text"
            value={nombreInstitucion}
            onChange={(e) => setNombreInstitucion(e.target.value)}
            disabled={isSaving}
            required
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 font-semibold"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Nombre institucional utilizado en encabezados y documentos oficiales de garantía.
          </p>
        </div>

        {/* PARÁMETRO: Contraseña */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-800" />
            <span>Actualización de Contraseña</span>
          </div>
          <p className="text-[11px] text-slate-500">
            La contraseña se utiliza para autorizar el acceso al sistema. Deje estos campos en blanco si no desea modificarla.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                placeholder="Nueva contraseña..."
                disabled={isSaving}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Confirmar Nueva Contraseña
              </label>
              <input
                type="password"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                placeholder="Repita la nueva contraseña..."
                disabled={isSaving}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded transition flex items-center gap-2 shadow-xs cursor-pointer disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Parámetros</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
