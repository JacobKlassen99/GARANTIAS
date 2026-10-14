import React, { useEffect, useState, useMemo } from 'react';
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
  AlertCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Users,
  Eye,
  AlertTriangle,
  MapPin,
  Calendar,
} from 'lucide-react';
import {
  DashboardStats,
  EstadisticasPanel,
  UbicacionEstadistica,
  GarantiaProximaVencer,
} from '../types';
import {
  getDashboardStats,
  obtenerEstadisticasPanel,
  hasInMemoryCache,
} from '../services/backend';
import { NavSection } from '../components/layout/Sidebar';
import { formatHectareas, formatFecha, formatPropietario } from '../utils/textSearch';
import { VerBienesLotesModal } from '../components/common/VerBienesLotesModal';

export interface DashboardNavigateOptions {
  filterEstado?: string;
  search?: string;
}

interface DashboardProps {
  onNavigate: (section: NavSection, options?: DashboardNavigateOptions) => void;
  onOpenNuevoCliente: () => void;
  onOpenNuevoLote: () => void;
  onOpenNuevoBien: () => void;
}

type SortFieldUbicacion =
  | 'ubicacion'
  | 'hectareasTotales'
  | 'hectareasEnGarantia'
  | 'hectareasDisponibles'
  | 'hectareasBloqueadas';

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
    valorBienesEnGarantiaUSD: null,
    garantiasExternas: null,
    lotesBloqueados: null,
    bienesBloqueados: null,
  });

  const [panelStats, setPanelStats] = useState<EstadisticasPanel | null>(null);

  const [isLoading, setIsLoading] = useState(
    !hasInMemoryCache('dashboard') || !hasInMemoryCache('estadisticas_panel')
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Estados de la tabla Ubicaciones
  const [searchUbicacion, setSearchUbicacion] = useState('');
  const [sortFieldUbicacion, setSortFieldUbicacion] = useState<SortFieldUbicacion>('hectareasTotales');
  const [sortAscUbicacion, setSortAscUbicacion] = useState(false);

  // Modal para consultar garantía próxima a vencer
  const [garantiaConsultar, setGarantiaConsultar] = useState<GarantiaProximaVencer | null>(null);

  const loadData = async (forceRefresh: boolean = false) => {
    const isCached =
      !forceRefresh &&
      hasInMemoryCache('dashboard') &&
      hasInMemoryCache('estadisticas_panel');

    if (isCached) {
      setIsLoading(false);
    } else if (stats.garantiasActivas === null && panelStats === null) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setHasError(false);

    try {
      const [statsData, panelData] = await Promise.all([
        getDashboardStats(forceRefresh),
        obtenerEstadisticasPanel(forceRefresh),
      ]);

      if (statsData && typeof statsData === 'object') {
        setStats({
          garantiasActivas: typeof statsData.garantiasActivas === 'number' ? statsData.garantiasActivas : null,
          hectareasEnGarantia: typeof statsData.hectareasEnGarantia === 'number' ? statsData.hectareasEnGarantia : null,
          hectareasDisponibles: typeof statsData.hectareasDisponibles === 'number' ? statsData.hectareasDisponibles : null,
          bienesEnGarantia: typeof statsData.bienesEnGarantia === 'number' ? statsData.bienesEnGarantia : null,
          valorBienesEnGarantiaUSD:
            typeof statsData.valorBienesEnGarantiaUSD === 'number' ? statsData.valorBienesEnGarantiaUSD : null,
          garantiasExternas: typeof statsData.garantiasExternas === 'number' ? statsData.garantiasExternas : null,
          lotesBloqueados: typeof statsData.lotesBloqueados === 'number' ? statsData.lotesBloqueados : null,
          bienesBloqueados: typeof statsData.bienesBloqueados === 'number' ? statsData.bienesBloqueados : null,
        });
      }

      if (panelData && typeof panelData === 'object') {
        setPanelStats(panelData);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  const renderValue = (val: number | null | undefined, mode: 'count' | 'ha' | 'usd' = 'count') => {
    if (isLoading) {
      return <span className="inline-block w-8 h-4 bg-slate-200 animate-pulse rounded" />;
    }
    if (val === null || val === undefined) {
      return <span className="text-slate-400 font-mono">—</span>;
    }
    if (mode === 'ha') {
      return <span className="font-mono">{formatHectareas(val)}</span>;
    }
    if (mode === 'usd') {
      return (
        <span className="font-mono text-emerald-950 font-bold">
          $us. {val.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      );
    }
    return <span className="font-mono">{val.toLocaleString('es-BO')}</span>;
  };

  // 8 TARJETAS APROX. 20% MÁS COMPACTAS Y CLICABLES
  const metricCards = [
    {
      title: 'Garantías Activas',
      value: renderValue(stats.garantiasActivas),
      desc: 'Operaciones vigentes',
      icon: <FileCheck2 className="w-4 h-4 text-emerald-700" />,
      action: () => onNavigate('garantias'),
    },
    {
      title: 'Hectáreas en Garantía',
      value: renderValue(stats.hectareasEnGarantia, 'ha'),
      desc: 'Superficie total comprometida',
      icon: <Layers className="w-4 h-4 text-emerald-700" />,
      action: () => onNavigate('lotes'),
    },
    {
      title: 'Hectáreas Disponibles',
      value: renderValue(stats.hectareasDisponibles, 'ha'),
      desc: 'Superficie libre para respaldos',
      icon: <Landmark className="w-4 h-4 text-blue-700" />,
      action: () => onNavigate('lotes', { filterEstado: 'Disponible' }),
    },
    {
      title: 'Bienes en Garantía',
      value: renderValue(stats.bienesEnGarantia),
      desc: 'Vehículos y maquinarias activos',
      icon: <PlusCircle className="w-4 h-4 text-emerald-700" />,
      action: () => onNavigate('bienes'),
    },
    {
      title: 'Valor de Bienes en Garantía',
      value: renderValue(stats.valorBienesEnGarantiaUSD, 'usd'),
      desc: 'Monto total respaldado en USD',
      icon: <Landmark className="w-4 h-4 text-emerald-800" />,
      action: () => onNavigate('bienes'),
    },
    {
      title: 'Garantías Externas',
      value: renderValue(stats.garantiasExternas),
      desc: 'Farmer Rechnung y Campo Grande',
      icon: <ExternalLink className="w-4 h-4 text-purple-700" />,
      action: () => onNavigate('garantias', { search: 'Farmer' }),
    },
    {
      title: 'Lotes Bloqueados',
      value: renderValue(stats.lotesBloqueados),
      desc: 'Parcelas con impedimento administrativo',
      icon: <ShieldAlert className="w-4 h-4 text-amber-700" />,
      action: () => onNavigate('lotes', { filterEstado: 'Bloqueado' }),
    },
    {
      title: 'Bienes Bloqueados',
      value: renderValue(stats.bienesBloqueados),
      desc: 'Pólizas o bienes con retención/bloqueo',
      icon: <ShieldAlert className="w-4 h-4 text-amber-700" />,
      action: () => onNavigate('bienes', { filterEstado: 'Bloqueado' }),
    },
  ];

  // UBICACIONES FILTRADAS Y ORDENADAS
  const filteredUbicaciones = useMemo(() => {
    if (!panelStats?.porUbicacion) return [];
    let list = [...panelStats.porUbicacion];
    if (searchUbicacion.trim()) {
      const q = searchUbicacion.toLowerCase().trim();
      list = list.filter((u) => u.ubicacion.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortFieldUbicacion === 'ubicacion') {
        cmp = a.ubicacion.localeCompare(b.ubicacion);
      } else {
        cmp = (a[sortFieldUbicacion] || 0) - (b[sortFieldUbicacion] || 0);
      }
      return sortAscUbicacion ? cmp : -cmp;
    });
    return list;
  }, [panelStats?.porUbicacion, searchUbicacion, sortFieldUbicacion, sortAscUbicacion]);

  // TOTALES DE UBICACIONES PARA PIE DE TABLA
  const totalsUbicaciones = useMemo(() => {
    if (!panelStats?.porUbicacion) {
      return { total: 0, garantia: 0, disponibles: 0, bloqueadas: 0, lotes: 0 };
    }
    return panelStats.porUbicacion.reduce(
      (acc, u) => ({
        total: acc.total + (u.hectareasTotales || 0),
        garantia: acc.garantia + (u.hectareasEnGarantia || 0),
        disponibles: acc.disponibles + (u.hectareasDisponibles || 0),
        bloqueadas: acc.bloqueadas + (u.hectareasBloqueadas || 0),
        lotes: acc.lotes + (u.cantidadLotes || 0),
      }),
      { total: 0, garantia: 0, disponibles: 0, bloqueadas: 0, lotes: 0 }
    );
  }, [panelStats?.porUbicacion]);

  const handleSortUbicacion = (field: SortFieldUbicacion) => {
    if (sortFieldUbicacion === field) {
      setSortAscUbicacion(!sortAscUbicacion);
    } else {
      setSortFieldUbicacion(field);
      setSortAscUbicacion(field === 'ubicacion');
    }
  };

  const renderSortIndicator = (field: SortFieldUbicacion) => {
    if (sortFieldUbicacion !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition inline ml-1" />;
    }
    return sortAscUbicacion ? (
      <ArrowUp className="w-3 h-3 text-emerald-700 inline ml-1 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700 inline ml-1 font-bold" />
    );
  };

  const renderVencimientoStatus = (g: GarantiaProximaVencer) => {
    const dias = g.diasRestantes;
    const isVencida = g.estadoVencimiento === 'Vencida' || (dias !== undefined && dias < 0);

    if (isVencida) {
      const diasAtras = dias !== undefined ? Math.abs(dias) : null;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
          <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
          Vencida {diasAtras !== null ? `(hace ${diasAtras} d)` : ''}
        </span>
      );
    }

    if (dias === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          <Clock className="w-3 h-3 text-amber-700 shrink-0" />
          Vence hoy
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600 shrink-0" />
        {dias !== undefined ? `${dias} días restantes` : 'Próxima a vencer'}
      </span>
    );
  };

  const topClientes = useMemo(() => {
    if (!panelStats?.principalesClientes) return [];
    return panelStats.principalesClientes.slice(0, 10);
  }, [panelStats?.principalesClientes]);

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
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {hasError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>No se pudo cargar la información del panel administrativo.</span>
          </div>
          <button
            onClick={() => loadData(true)}
            className="px-2.5 py-1 text-xs font-semibold text-red-800 hover:text-red-900 bg-red-100 rounded hover:bg-red-200 transition cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ACCESOS RÁPIDOS */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
          Accesos Rápidos
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => onNavigate('nueva-garantia')}
            className="flex items-center gap-2 p-2 rounded bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-2xs transition active:scale-98 cursor-pointer"
          >
            <FilePlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">+ Nueva Garantía</span>
          </button>

          <button
            onClick={onOpenNuevoCliente}
            className="flex items-center gap-2 p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition active:scale-98 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
            <span className="truncate">+ Nuevo Cliente</span>
          </button>

          <button
            onClick={onOpenNuevoLote}
            className="flex items-center gap-2 p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition active:scale-98 cursor-pointer"
          >
            <MapPinPlus className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
            <span className="truncate">+ Nuevo Lote</span>
          </button>

          <button
            onClick={onOpenNuevoBien}
            className="flex items-center gap-2 p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-300 transition active:scale-98 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0 text-emerald-800" />
            <span className="truncate">+ Nuevo Bien</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 1: 8 TARJETAS MÉTRICAS (20% MÁS COMPACTAS, 4 POR FILA, CLICABLES) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {metricCards.map((card, idx) => (
          <div
            key={idx}
            onClick={card.action}
            title={`Abrir listado de ${card.title}`}
            className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs hover:border-emerald-600 hover:bg-slate-50/50 hover:shadow-xs cursor-pointer transition flex flex-col justify-between group"
          >
            <div className="flex items-start justify-between gap-1 mb-0.5">
              <span className="text-[11px] font-bold text-slate-700 leading-tight group-hover:text-emerald-900 transition">
                {card.title}
              </span>
              <span className="p-1 rounded bg-slate-50 border border-slate-100 shrink-0 group-hover:bg-emerald-50 group-hover:border-emerald-200 transition">
                {card.icon}
              </span>
            </div>
            <div className="my-0.5">
              <div className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {card.value}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 group-hover:text-slate-500 truncate mt-0.5">
              {card.desc}
            </div>
          </div>
        ))}
      </div>

      {/* SECCIÓN 2: DISPONIBILIDAD DE TERRENOS POR UBICACIÓN */}
      <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-800 shrink-0" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Disponibilidad de Terrenos por Ubicación
            </h3>
            {panelStats?.porUbicacion && (
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                {panelStats.porUbicacion.length} ubicaciones
              </span>
            )}
          </div>
          <div className="w-full sm:w-64 relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchUbicacion}
              onChange={(e) => setSearchUbicacion(e.target.value)}
              placeholder="Buscar ubicación..."
              className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-emerald-700 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-300 select-none">
                <th
                  onClick={() => handleSortUbicacion('ubicacion')}
                  className="px-3 py-2 cursor-pointer hover:bg-slate-200/80 transition group"
                >
                  Ubicación {renderSortIndicator('ubicacion')}
                </th>
                <th
                  onClick={() => handleSortUbicacion('hectareasTotales')}
                  className="px-3 py-2 text-right cursor-pointer hover:bg-slate-200/80 transition group"
                >
                  Total Hectáreas {renderSortIndicator('hectareasTotales')}
                </th>
                <th
                  onClick={() => handleSortUbicacion('hectareasEnGarantia')}
                  className="px-3 py-2 text-right cursor-pointer hover:bg-slate-200/80 transition group"
                >
                  Hectáreas en Garantía {renderSortIndicator('hectareasEnGarantia')}
                </th>
                <th
                  onClick={() => handleSortUbicacion('hectareasDisponibles')}
                  className="px-3 py-2 text-right cursor-pointer hover:bg-slate-200/80 transition group"
                >
                  Hectáreas Disponibles {renderSortIndicator('hectareasDisponibles')}
                </th>
                <th
                  onClick={() => handleSortUbicacion('hectareasBloqueadas')}
                  className="px-3 py-2 text-right cursor-pointer hover:bg-slate-200/80 transition group"
                >
                  Hectáreas Bloqueadas {renderSortIndicator('hectareasBloqueadas')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {isLoading && !panelStats ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-1.5 text-emerald-700" />
                    Cargando estadísticas de terrenos por ubicación...
                  </td>
                </tr>
              ) : filteredUbicaciones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                    No se encontraron ubicaciones que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredUbicaciones.map((u, i) => (
                  <tr
                    key={u.ubicacion || i}
                    onClick={() => onNavigate('lotes', { search: u.ubicacion })}
                    title={`Ver lotes de ${u.ubicacion}`}
                    className="hover:bg-slate-50 cursor-pointer transition"
                  >
                    <td className="px-3 py-1.5 font-semibold text-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{u.ubicacion}</span>
                      </div>
                      <span className="text-[10px] font-normal text-slate-400">
                        {u.cantidadLotes} lotes
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-700">
                      {formatHectareas(u.hectareasTotales)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-emerald-900 bg-emerald-50/30">
                      {formatHectareas(u.hectareasEnGarantia)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-blue-900 bg-blue-50/30">
                      {formatHectareas(u.hectareasDisponibles)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-amber-800">
                      {u.hectareasBloqueadas > 0 ? formatHectareas(u.hectareasBloqueadas) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredUbicaciones.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 font-bold text-xs text-slate-900 border-t-2 border-slate-300">
                  <td className="px-3 py-2">
                    Total Consolidado ({totalsUbicaciones.lotes} lotes)
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatHectareas(totalsUbicaciones.total)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-900">
                    {formatHectareas(totalsUbicaciones.garantia)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-blue-900">
                    {formatHectareas(totalsUbicaciones.disponibles)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-800">
                    {totalsUbicaciones.bloqueadas > 0 ? formatHectareas(totalsUbicaciones.bloqueadas) : '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* SECCIONES INFERIORES: PRÓXIMAS A VENCER + CLIENTES PRINCIPALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SECCIÓN 3: GARANTÍAS PRÓXIMAS A VENCER — 30 DÍAS */}
        <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-800 shrink-0" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Garantías Próximas a Vencer — 30 Días
              </h3>
            </div>
            {panelStats && (
              <span className="text-[10px] font-semibold text-slate-500">
                {panelStats.totalProximasAVencer || panelStats.proximasAVencer.length} registradas
              </span>
            )}
          </div>

          <div className="flex-1 overflow-x-auto">
            {isLoading && !panelStats ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-1.5 text-emerald-700" />
                Comprobando vencimientos...
              </div>
            ) : !panelStats || panelStats.proximasAVencer.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50/40">
                «No hay garantías próximas a vencer»
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-2.5 py-1.5">N.º Solicitud</th>
                    <th className="px-2.5 py-1.5">Prestatario</th>
                    <th className="px-2.5 py-1.5">Vencimiento</th>
                    <th className="px-2.5 py-1.5">Días Restantes</th>
                    <th className="px-2.5 py-1.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {panelStats.proximasAVencer.map((g, idx) => (
                    <tr key={g.idGarantia || idx} className="hover:bg-slate-50 transition">
                      <td className="px-2.5 py-1.5 font-bold font-mono text-slate-800">
                        N.º {g.numeroSolicitud || g.idGarantia}
                      </td>
                      <td className="px-2.5 py-1.5">
                        <div className="font-semibold text-slate-800 truncate max-w-[140px]">
                          {g.prestatario}
                        </div>
                        {g.cuentaPrestatario && (
                          <div className="text-[10px] text-slate-400">
                            Cta. {g.cuentaPrestatario}
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 font-mono text-slate-700">
                        {formatFecha(g.fechaVencimiento)}
                      </td>
                      <td className="px-2.5 py-1.5">
                        {renderVencimientoStatus(g)}
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        <button
                          onClick={() => setGarantiaConsultar(g)}
                          title="Consultar garantía"
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Consultar</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* SECCIÓN 4: CLIENTES CON MÁS GARANTÍAS ACTIVAS */}
        <div className="bg-white rounded border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-800 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Clientes con Más Garantías Activas
                </h3>
                <span className="text-[10px] text-slate-400">
                  Top 10 — Criterio: {panelStats?.criterioClientes || 'Cuenta Prestatario'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {isLoading && !panelStats ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin inline mr-1.5 text-emerald-700" />
                Cargando principales clientes...
              </div>
            ) : topClientes.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50/40">
                No hay registros de clientes disponibles.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-2.5 py-1.5 text-center w-8">#</th>
                    <th className="px-2.5 py-1.5">Cuenta</th>
                    <th className="px-2.5 py-1.5">Nombre del Cliente</th>
                    <th className="px-2.5 py-1.5 text-center">Garantías</th>
                    <th className="px-2.5 py-1.5 text-right">Hectáreas Comprometidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {topClientes.map((c, idx) => (
                    <tr
                      key={c.cuenta || idx}
                      onClick={() => onNavigate('garantias', { search: String(c.cuenta) })}
                      title={`Ver garantías de la cuenta ${c.cuenta}`}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-2.5 py-1.5 text-center font-bold text-[11px] text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-2.5 py-1.5 font-bold font-mono text-slate-700">
                        {c.cuenta}
                      </td>
                      <td className="px-2.5 py-1.5 font-semibold text-slate-800">
                        {c.nombre}
                      </td>
                      <td className="px-2.5 py-1.5 text-center">
                        <span className="inline-block px-2 py-0.2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded font-mono font-bold text-xs">
                          {c.cantidadGarantias}
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-slate-700">
                        {formatHectareas(c.hectareasEnGarantia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PARA CONSULTAR GARANTÍA PRÓXIMA A VENCER */}
      {garantiaConsultar && (
        <VerBienesLotesModal
          idGarantia={garantiaConsultar.idGarantia}
          numeroSolicitud={String(garantiaConsultar.numeroSolicitud)}
          onClose={() => setGarantiaConsultar(null)}
        />
      )}
    </div>
  );
};
