import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Instalar aplicación en este dispositivo"
        className={`inline-flex items-center gap-1.5 rounded bg-emerald-700 font-medium text-white shadow-xs hover:bg-emerald-800 transition active:scale-95 ${
          compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
        }`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          title="Instrucciones para instalar en iPhone/iPad"
          className={`inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100 transition ${
            compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Instalar en iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800">Instalar en iPhone / iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <p>Para usar como aplicación sin navegador:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>
                    Presione el botón <strong>Compartir</strong> (ícono con flecha hacia arriba) en la barra de Safari.
                  </li>
                  <li>
                    Desplácese hacia abajo y elija <strong>Agregar a pantalla de inicio</strong>.
                  </li>
                  <li>Confirme tocando <strong>Agregar</strong> en la esquina superior.</li>
                </ol>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded bg-emerald-700 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
