import React from 'react';
import {
  LayoutDashboard,
  FilePlus,
  FileCheck2,
  Users,
  MapPin,
  Tractor,
  BarChart3,
  Settings,
} from 'lucide-react';

export type NavSection =
  | 'dashboard'
  | 'nueva-garantia'
  | 'garantias'
  | 'clientes'
  | 'lotes'
  | 'bienes'
  | 'reportes'
  | 'configuracion';

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentSection, onSelectSection }) => {
  const navItems: { id: NavSection; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'nueva-garantia',
      label: 'Nueva Garantía',
      icon: <FilePlus className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'garantias',
      label: 'Garantías',
      icon: <FileCheck2 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: <Users className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'lotes',
      label: 'Lotes',
      icon: <MapPin className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'bienes',
      label: 'Bienes',
      icon: <Tractor className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'reportes',
      label: 'Reportes',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 bg-slate-900 text-slate-200 border-r border-slate-800 min-h-[calc(100vh-53px)] select-none">
      {/* Navigation Links */}
      <div className="p-2 space-y-0.5 flex-1">
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Menú Principal
        </div>
        {navItems.map((item) => {
          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition text-left ${
                isActive
                  ? 'bg-emerald-800 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={isActive ? 'text-emerald-300' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Institutional Footer in Sidebar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 text-[10px] text-slate-400">
        <div className="font-semibold text-slate-300 uppercase tracking-wider mb-0.5">
          Asoc. Civil "Colonia Chihuahua"
        </div>
        <div className="text-slate-500">
          Registro Oficial de Garantías
        </div>
      </div>
    </aside>
  );
};
