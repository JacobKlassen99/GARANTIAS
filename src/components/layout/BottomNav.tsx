import React, { useState } from 'react';
import {
  LayoutDashboard,
  FilePlus,
  FileCheck2,
  Menu,
  X,
  Users,
  MapPin,
  Tractor,
  BarChart3,
  Settings,
} from 'lucide-react';
import { NavSection } from './Sidebar';

interface BottomNavProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentSection, onSelectSection }) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const mainItems: { id: NavSection; label: string; icon: React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'nueva-garantia',
      label: 'Nueva',
      icon: <FilePlus className="w-5 h-5" />,
    },
    {
      id: 'garantias',
      label: 'Garantías',
      icon: <FileCheck2 className="w-5 h-5" />,
    },
  ];

  const moreItems: { id: NavSection; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'clientes',
      label: 'Clientes',
      icon: <Users className="w-5 h-5 text-emerald-700" />,
      desc: 'Hoja clientes (Cuenta, Nombre, CI)',
    },
    {
      id: 'lotes',
      label: 'Lotes',
      icon: <MapPin className="w-5 h-5 text-emerald-700" />,
      desc: 'Hoja lotes y parcelas',
    },
    {
      id: 'bienes',
      label: 'Bienes',
      icon: <Tractor className="w-5 h-5 text-emerald-700" />,
      desc: 'Hoja bienes, maquinaria y pólizas',
    },
    {
      id: 'reportes',
      label: 'Reportes',
      icon: <BarChart3 className="w-5 h-5 text-emerald-700" />,
      desc: 'Estadísticas y reportes institucionales',
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      icon: <Settings className="w-5 h-5 text-slate-700" />,
      desc: 'Contraseña y parámetros del sistema',
    },
  ];

  const handleSelectMoreItem = (section: NavSection) => {
    onSelectSection(section);
    setShowMoreMenu(false);
  };

  const isMoreActive = ['clientes', 'lotes', 'bienes', 'reportes', 'configuracion'].includes(
    currentSection
  );

  return (
    <>
      {/* Modal / Drawer para "Más" */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-2xs md:hidden">
          <div className="bg-white rounded-t-xl p-4 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Secciones Adicionales
              </span>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-2 divide-y divide-slate-100">
              {moreItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectMoreItem(item.id)}
                  className={`w-full flex items-center gap-3 py-2.5 text-left transition ${
                    currentSection === item.id ? 'text-emerald-800 font-bold' : 'text-slate-700'
                  }`}
                >
                  <div className="p-2 rounded bg-slate-100">{item.icon}</div>
                  <div>
                    <div className="text-xs font-semibold">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Barra de navegación inferior móvil */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-300 shadow-lg safe-bottom">
        <div className="grid grid-cols-4 h-14">
          {mainItems.map((item) => {
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
                  isActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div className={`p-1 rounded ${isActive ? 'bg-emerald-50 text-emerald-800' : ''}`}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Botón "Más" */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ${
              isMoreActive ? 'text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className={`p-1 rounded ${isMoreActive ? 'bg-emerald-50 text-emerald-800' : ''}`}>
              <Menu className="w-5 h-5" />
            </div>
            <span>Más</span>
          </button>
        </div>
      </nav>
    </>
  );
};
