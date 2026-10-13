import React, { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X, AlertCircle } from 'lucide-react';

export const PWAUpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      if (r) {
        // Comprobar actualizaciones periódicamente cada 60 minutos y al volver a enfocar la pestaña
        const interval = setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);

        const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            r.update();
          }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
          clearInterval(interval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    },
  });

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('pwa_update_dismissed');
    if (isDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_update_dismissed', 'true');
    setNeedRefresh(false);
  };

  const handleUpdate = () => {
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
            <p className="text-xs sm:text-sm text-emerald-200">Hay una actualización de la aplicación.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleUpdate}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 text-xs sm:text-sm font-semibold rounded-lg shadow transition active:scale-95"
          >
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Actualizar ahora</span>
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-2 bg-emerald-800 text-emerald-100 hover:bg-emerald-700 text-xs sm:text-sm font-medium rounded-lg transition"
          >
            Descartar
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-emerald-300 hover:text-white rounded-lg hover:bg-emerald-800 transition hidden sm:block"
            title="Descartar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
