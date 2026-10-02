import React from 'react';
import { ShieldCheck, LogOut } from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface HeaderProps {
  onLogout: () => void;
  institucionName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onLogout,
  institucionName = 'ASOC. CIVIL "COLONIA CHIHUAHUA"',
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        {/* Brand & Institution Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 truncate uppercase">
              Registro de Garantía de Terrenos
            </h1>
            <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-800 truncate">
              {institucionName}
            </p>
          </div>
        </div>

        {/* Right Actions: Status indicator, PWA button, Logout */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status badge */}
          <div
            title="Conexión activa"
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[11px] text-slate-600"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="font-medium text-slate-700">En línea</span>
          </div>

          {/* PWA Install Button */}
          <PWAInstallButton compact />

          {/* Logout button */}
          <button
            onClick={onLogout}
            title="Cerrar sesión del sistema"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded border border-slate-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
