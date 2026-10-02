import React, { useEffect, useState } from 'react';
import {
  FilePlus,
  UserPlus,
  MapPinPlus,
  PlusCircle,
  FileCheck2,
  Landmark,
  ShieldAlert,
  Layers,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { DashboardStats } from '../types';
import { getDashboardStats } from '../services/backend';
import { NavSection } from '../components/layout/Sidebar';
import { formatHectareas } from '../utils/textSearch';

interface DashboardProps {
  onNavigate: (section: NavSection) => void;
  onOpenNuevoCliente: () => void;
  onOpenNuevoLote: () => void;
  onOpenNuevoBien: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenNuevoCliente,
  onOpenNuevoLote,
  onOpenNuevoBien,
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    garantiasActivas: null,
    hectareasEnGarantia: null,
    hectareasDisponibles: null,
    bienesEnGarantia: null,
    garantiasExternas: null,
    lotesBloqueados: null,
    bienesBloqueados: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const data = await getDashboardStats();
      if (data && typeof data === 'object') {
        setStats({
          garantiasActivas: typeof data.garantiasActivas === 'number' ? data.garantiasActivas : null,
          hectareasEnGarantia: typeof data.hectareasEnGarantia === 'number' ? data.hectareasEnGarantia : null,
          hectareasDisponibles: typeof data.hectareasDisponibles === 'number' ? data.hectareasDisponibles : null,
          bienesEnGarantia: typeof data.bienesEnGarantia === 'number' ? data.bienesEnGarantia : null,
          garantiasExternas: typeof data.garantiasExternas === 'number' ? data.garantiasExternas : null,
          lotesBloqueados: typeof data.lotesBloqueados === 'number' ? data.lotesBloqueados : null,
          bienesBloqueados: typeof data.bienesBloqueados === 'number' ? data.bienesBloqueados : null,
        });
      } else {
        setStats({
          garantiasActivas: null,
          hectareasEnGarantia: null,
          hectareasDisponibles: null,
          bienesEnGarantia: null,
          garantiasExternas: null,
          lotesBloqueados: null,
          bienesBloqueados: null,
        });
      }
    } catch {
      setStats({
        garantiasActivas: null,
        hectareasEnGarantia: null,
        hectareasDisponibles: null,
        bienesEnGarantia: null,
        garantiasExternas: null,
        lotesBloqueados: null,
        bienesBloqueados: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const renderValue = (val: number | null | undefined, isHectareas = false) => {
    if (isLoading) {
      return <span className="inline-block w-8 h-4 bg-slate-200 animate-pulse rounded" />;
    }
    if (val === null || val === undefined) {
      return <span className="text-slate-400 font-mono">—</span>;
    }
    if (isHectareas) {
      return <span className="font-mono">{formatHectareas(val)}</span>;
    }
    return <span className="font-mono">{val.toLocaleString('es-BO')}</span>;
  };

  const metricCards = [
    {
      title: 'Garantías Activas',
      value: renderValue(stats.garantiasActivas),
      desc: 'Operaciones vigentes',
      icon: <FileCheck2 className="w-5 h-5 text-emerald-700" />,
      action: () => onNavigate('garantias'),
    },
    {
      title: 'Hectáreas en Garantía',
      value: renderValue(stats.hectareasEnGarantia, true),
      desc: 'Superficie total comprometida',
      icon: <Layers className="w-5 h-5 text-emerald-700" />,
      action: () => onNavigate('lotes'),
    },
    {
      title: 'Hectáreas Disponibles',
      value: renderValue(stats.hectareasDisponibles, true),
      desc: 'Superficie libre para respaldos',
      icon: <Landmark className="w-5 h-5 text-blue-700" />,
      action: () => onNavigate('lotes'),
    },
    {
      title: 'Bienes en Garantía',
      value: renderValue(stats.bienesEnGarantia),
      desc: 'Vehículos, maquinarias e implementos activos',
      icon: <PlusCircle className="w-5 h-5 text-emerald-700" />,
      action: () => onNavigate('bienes'),
    },
    {
      title: 'Garantías Externas',
      value: renderValue(stats.garantiasExternas),
      desc: 'Farmer Rechnung y Campo Grande',
      icon: <ExternalLink className="w-5 h-5 text-purple-700" />,
      action: () => onNavigate('garantias'),
    },
    {
      title: 'Lotes Bloqueados',
      value: renderValue(stats.lotesBloqueados),
      desc: 'Parcelas con impedimento administrativo',
      icon: <ShieldAlert className="w-5 h-5 text-amber-700" />,
      action: () => onNavigate('lotes'),
    },
    {
      title: 'Bienes Bloqueados',
      value: renderValue(stats.bienesBloqueados),
      desc: 'Pólizas o bienes con retención/bloqueo',
      icon: <ShieldAlert className="w-5 h-5 text-amber-700" />,
      action: () => onNavigate('bienes'),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Bar with Title and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">
            Panel de Control Administrativo
          </h2>
          <p className="text-xs text-slate-500">
            Resumen consolidado — Asoc. Civil "Colonia Chihuahua"
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStats}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
            <span>Actualizar Datos</span>
          </button>
        </div>
      </div>

      {/* ACCESOS RÁPIDOS */}
      <div className="bg-white p-3 rounded border border-slate-200 shadow-2xs">
        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
          Accesos Rápidos
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => onNavigate('nueva-garantia')}
            className="flex items-center gap-2 p-2 rounded bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-2xs transition active:scale-98"
          >
            <FilePlus className="w-4 h-4 shrink-0" />
            <span className="truncate">+ Nueva Garantía</span>
          </button>

          <button
            onClick={onOpenNuevoCliente}
            className="flex items-center gap-2 p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition active:scale-98"
          >
            <UserPlus className="w-4 h-4 shrink-0 text-emerald-800" />
            <span className="truncate">+ Nuevo Cliente</span>
          </button>

          <button
            onClick={onOpenNuevoLote}
            className="flex items-center gap-2 p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition active:scale-98"
          >
            <MapPinPlus className="w-4 h-4 shrink-0 text-emerald-800" />
            <span className="truncate">+ Nuevo Lote</span>
          </button>

          <button
            onClick={onOpenNuevoBien}
            className="flex items-center gap-2 p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition active:scale-98"
          >
            <PlusCircle className="w-4 h-4 shrink-0 text-emerald-800" />
            <span className="truncate">+ Nuevo Bien</span>
          </button>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES COMPACTAS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            onClick={card.action}
            className="bg-white p-3 rounded border border-slate-200 shadow-2xs hover:border-emerald-600 cursor-pointer transition flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-1 mb-1">
              <span className="text-[11px] font-bold text-slate-600 leading-tight">
                {card.title}
              </span>
              <span className="p-1 rounded bg-slate-50 border border-slate-100 shrink-0">
                {card.icon}
              </span>
            </div>
            <div className="my-1">
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {card.value}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 truncate">{card.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
