import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, AlertCircle } from 'lucide-react';

interface PWAUpdateBannerProps {
  isFormEditing?: boolean;
}

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({ isFormEditing = false }) => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload() {
      // OBLIGATORIO: Proveer onNeedReload evita que workbox llame automáticamente a window.location.reload()
      // En su lugar, simplemente informamos de la actualización y dejamos que el usuario decida cuándo aplicarla.
    },
    onRegisteredSW(_swUrl, _registration) {
      // El navegador maneja el ciclo de vida del Service Worker sin necesidad de forzar polling agresivo
    },
    onRegisterError(err) {
      console.warn('[PWA] Service Worker no registrado:', err);
    },
  });

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem('pwa_update_dismissed');
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('pwa_update_dismissed', 'true');
    } catch {}
    setNeedRefresh(false);
  };

  const handleUpdate = () => {
    if (isFormEditing) {
      const confirmUpdate = window.confirm(
        'Actualmente tiene un formulario o edición en curso con posibles datos no guardados.\n\n¿Desea actualizar de todas formas? Se recomienda guardar sus cambios primero.'
      );
      if (!confirmUpdate) return;
    }
    updateServiceWorker(true);
  };

  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-900 text-white shadow-xl border-b border-emerald-700 px-4 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-800 rounded-lg shrink-0">
            <AlertCircle className="w-5 h-5 text-emerald-200" />
          </div>
          <div>
            <h4 className="font-semibold text-sm sm:text-base">Nueva versión disponible</h4>
            <p className="text-xs sm:text-sm text-emerald-200">
              Hay una actualización del sistema lista para aplicarse.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleUpdate}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 text-xs sm:text-sm font-semibold rounded-lg shadow transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Actualizar ahora</span>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-2 bg-emerald-800 text-emerald-100 hover:bg-emerald-700 text-xs sm:text-sm font-medium rounded-lg transition cursor-pointer"
          >
            Más tarde
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-800 transition hidden sm:block cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
