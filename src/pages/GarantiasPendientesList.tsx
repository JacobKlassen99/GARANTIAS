import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Search,
  Plus,
  Eye,
  Printer,
  Edit2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Layers,
  X,
} from 'lucide-react';
import { Garantia, QueryParams } from '../types';
import {
  listarGarantiasPendientes,
  activarGarantia,
  getConfiguracion,
} from '../services/backend';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ImpresionGarantia } from './ImpresionGarantia';
import { EditarGarantiaModal } from '../components/common/EditarGarantiaModal';
import { VerBienesLotesModal } from '../components/common/VerBienesLotesModal';
import {
  formatFecha,
  formatPropietario,
  calcularDiasPendientes,
} from '../utils/textSearch';
import { NavSection } from '../components/layout/Sidebar';

interface GarantiasPendientesListProps {
  onNavigate: (section: NavSection) => void;
  initialSearch?: string;
}

export const GarantiasPendientesList: React.FC<GarantiasPendientesListProps> = ({
  onNavigate,
  initialSearch,
}) => {
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(200);
  const [search, setSearch] = useState(initialSearch || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  // Umbral de alerta configurado (por defecto 30 días)
  const [diasAlertaPendientes, setDiasAlertaPendientes] = useState<number>(30);

  // Modales de acción
  const [garantiaParaVer, setGarantiaParaVer] = useState<Garantia | null>(null);
  const [garantiaParaBienesLotes, setGarantiaParaBienesLotes] = useState<Garantia | null>(null);
  const [garantiaToEdit, setGarantiaToEdit] = useState<Garantia | null>(null);
  const [garantiaParaImprimir, setGarantiaParaImprimir] = useState<Garantia | null>(null);

  // Confirmar Activación
  const [garantiaToActivar, setGarantiaToActivar] = useState<Garantia | null>(null);
  const [isActivando, setIsActivando] = useState(false);

  // Mensajes de acción en línea
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const loadData = async (forceRefresh: boolean = false) => {
    if (garantias.length === 0 && !hasLoadedOnce) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setBackendMessage(null);

    try {
      const params: QueryParams = {
        page,
        pageSize,
        search: search.trim() || undefined,
      };
      const [res, cfg] = await Promise.all([
        listarGarantiasPendientes(params, forceRefresh),
        getConfiguracion(forceRefresh).catch(() => null),
      ]);

      const items = Array.isArray(res?.data) ? res.data : [];
      setGarantias(items);
      setTotal(typeof res?.total === 'number' ? Math.max(res.total, items.length) : items.length);
      if (cfg && typeof cfg.diasAlertaPendientes === 'number' && cfg.diasAlertaPendientes > 0) {
        setDiasAlertaPendientes(cfg.diasAlertaPendientes);
      }
      setHasLoadedOnce(true);
    } catch {
      if (garantias.length === 0) {
        setBackendMessage('No se pudieron cargar las garantías pendientes.');
      } else {
        setBackendMessage('No se pudo actualizar la información.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [page]);

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData(false);
  };

  const getDiasPendientes = (g: Garantia): number => {
    if (typeof g.diasPendientes === 'number' && Number.isFinite(g.diasPendientes) && g.diasPendientes >= 0) {
      return g.diasPendientes;
    }
    return calcularDiasPendientes(g.fechaRegistro || g.fecha);
  };

  const totalConAlerta = useMemo(() => {
    return garantias.filter((g) => getDiasPendientes(g) > diasAlertaPendientes).length;
  }, [garantias, diasAlertaPendientes]);

  const handleConfirmActivar = async () => {
    if (!garantiaToActivar) return;
    setIsActivando(true);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      const numSol = garantiaToActivar.numeroSolicitud || garantiaToActivar.idGarantia;
      await activarGarantia(garantiaToActivar.idGarantia);
      setGarantiaToActivar(null);
      setActionSuccessMessage(
        `Garantía N.º ${numSol} activada con éxito. Ahora se encuentra en Garantías Activas.`
      );
      setTimeout(() => setActionSuccessMessage(null), 5000);
      loadData(true);
    } catch (err: any) {
      setGarantiaToActivar(null);
      setActionErrorMessage(
        err?.message || 'No se pudo activar la garantía. Verifique la conexión e intente nuevamente.'
      );
    } finally {
      setIsActivando(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-700 text-white rounded">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Garantías Pendientes por Activar
            </h2>
            <p className="text-[11px] text-slate-500">
              Garantías registradas con terrenos y bienes reservados en espera de activación formal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing}
            title="Actualizar garantías pendientes desde Google Sheets"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin text-amber-700' : ''}`} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          <button
            onClick={() => onNavigate('nueva-garantia')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Garantía</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda Backend */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por N.º Solicitud, propietario, prestatario, cuenta o garantía con..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-700 focus:border-amber-700"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded transition cursor-pointer"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                loadData(false);
              }}
              className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </form>

        <div className="text-[11px] text-slate-600 flex items-center gap-2 justify-between sm:justify-end">
          {isRefreshing && (
            <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando datos...
            </span>
          )}
          <span>
            Total: <strong className="font-mono text-slate-900">{total}</strong> pendientes
            <span className="text-slate-400 ml-1.5">(Alerta &gt; {diasAlertaPendientes} días)</span>
          </span>
        </div>
      </div>

      {/* Alerta visual cuando hay garantías que superan los días configurados */}
      {totalConAlerta > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded flex items-start gap-2 text-xs text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold">
              Atención: {totalConAlerta}{' '}
              {totalConAlerta === 1
                ? 'garantía pendiente supera'
                : 'garantías pendientes superan'}{' '}
              el límite de {diasAlertaPendientes} días sin activarse.
            </strong>{' '}
            <span className="text-amber-900">
              Revise las filas resaltadas. Los terrenos y bienes continúan reservados hasta que decida activar o editar cada garantía.
            </span>
          </div>
        </div>
      )}

      {actionSuccessMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{actionSuccessMessage}</span>
          </div>
          <button
            onClick={() => setActionSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionErrorMessage && (
        <div className="p-2.5 bg-red-50 border border-red-300 rounded flex items-center justify-between text-xs text-red-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{actionErrorMessage}</span>
          </div>
          <button
            onClick={() => setActionErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {backendMessage && garantias.length > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{backendMessage}</span>
          </div>
          <button
            onClick={() => loadData(true)}
            className="font-medium text-amber-900 underline hover:no-underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* TABLA COMPACTA DE GARANTÍAS PENDIENTES */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">N.º Solicitud</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-24">Fecha</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Propietario</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Prestatario</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Garantía con</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">Tipo de garantía</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-36 text-center">Días pendientes</th>
                <th className="py-1.5 px-3 font-bold text-center w-40">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {isLoading && !hasLoadedOnce ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-700" />
                      <span className="font-semibold text-slate-700">Cargando garantías pendientes...</span>
                      <span className="text-[11px] text-slate-400">Consultando registros oficiales en Google Sheets</span>
                    </div>
                  </td>
                </tr>
              ) : backendMessage && garantias.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-red-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-red-500" />
                      <span className="font-semibold text-slate-800">{backendMessage}</span>
                      <button
                        onClick={() => loadData(true)}
                        className="mt-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium transition cursor-pointer"
                      >
                        Reintentar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : Array.isArray(garantias) && garantias.length > 0 ? (
                garantias.map((garantia) => {
                  const dias = getDiasPendientes(garantia);
                  const tieneAlerta = dias > diasAlertaPendientes;

                  return (
                    <tr
                      key={garantia.idGarantia}
                      className={`transition-colors group ${
                        tieneAlerta
                          ? 'bg-amber-50/70 hover:bg-amber-100/60'
                          : 'hover:bg-emerald-50/40'
                      }`}
                    >
                      <td className="py-1.5 px-3 font-mono font-bold text-emerald-950 border-r border-slate-100 bg-slate-50/30">
                        <div className="flex items-center gap-1.5">
                          {tieneAlerta && (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-amber-700 shrink-0"
                              aria-label={`Supera los ${diasAlertaPendientes} días pendientes`}
                            />
                          )}
                          <span>{garantia.numeroSolicitud || '—'}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-slate-600 border-r border-slate-100 whitespace-nowrap">
                        {formatFecha(garantia.fecha)}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{garantia.propietario || '—'}</div>
                        {garantia.cuentaPropietario && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cta: {garantia.cuentaPropietario}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{garantia.prestatario || '—'}</div>
                        {garantia.cuentaPrestatario && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cta: {garantia.cuentaPrestatario}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <span className="font-bold text-slate-700">
                          {garantia.garantiaConNombre || garantia.garantiaConTipo || '—'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {garantia.tipoGarantia || 'Terreno'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-bold border ${
                              tieneAlerta
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-amber-50 text-amber-900 border-amber-200'
                            }`}
                          >
                            {tieneAlerta && <AlertTriangle className="w-3 h-3 text-red-600" />}
                            {dias} {dias === 1 ? 'día' : 'días'}
                          </span>
                          {tieneAlerta && (
                            <span className="text-[9px] font-bold uppercase tracking-wide text-red-700">
                              Alerta (&gt; {diasAlertaPendientes} d.)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Acciones: Ver detalles, Editar, Imprimir contrato, Activar garantía */}
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setGarantiaParaVer(garantia)}
                            title="Ver detalles"
                            className="p-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setGarantiaToEdit(garantia)}
                            title="Editar garantía pendiente"
                            className="p-1 text-slate-600 hover:text-blue-800 hover:bg-blue-50 rounded transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setGarantiaParaImprimir(garantia)}
                            title="Imprimir contrato"
                            className="p-1 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded transition cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setActionErrorMessage(null);
                              setGarantiaToActivar(garantia);
                            }}
                            title="Activar garantía"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5 max-w-sm mx-auto">
                      <Clock className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="font-semibold text-slate-700">
                        {search
                          ? 'Sin coincidencias en garantías pendientes'
                          : 'No hay garantías pendientes por activar.'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {search
                          ? `No se encontró ninguna garantía pendiente con "${search}".`
                          : 'Todas las garantías nuevas que registre aparecerán aquí hasta ser activadas.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Página <strong className="text-slate-900">{page}</strong> de{' '}
            <strong className="text-slate-900">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLES DE GARANTÍA PENDIENTE */}
      {garantiaParaVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Garantía Pendiente N.º {garantiaParaVer.numeroSolicitud || garantiaParaVer.idGarantia}
                </h3>
              </div>
              <button
                onClick={() => setGarantiaParaVer(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 text-xs space-y-3">
              {(() => {
                const dias = getDiasPendientes(garantiaParaVer);
                const tieneAlerta = dias > diasAlertaPendientes;
                return (
                  <div
                    className={`p-2.5 rounded border flex items-center justify-between font-semibold ${
                      tieneAlerta
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-amber-50 border-amber-200 text-amber-950'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {tieneAlerta ? (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-700" />
                      )}
                      <span>Pendiente por activar (terrenos/bienes reservados)</span>
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/80 border border-current/20">
                      {dias} {dias === 1 ? 'día' : 'días'}
                    </span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500">Fecha de Emisión:</span>{' '}
                  <strong>{formatFecha(garantiaParaVer.fecha)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Vencimiento:</span>{' '}
                  <strong>
                    {garantiaParaVer.fechaVencimiento
                      ? formatFecha(garantiaParaVer.fechaVencimiento)
                      : 'Sin vencimiento'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500">Tipo:</span>{' '}
                  <strong>{garantiaParaVer.tipoGarantia || 'Terreno'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Modalidad:</span>{' '}
                  <span className="font-semibold text-emerald-900 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                    {garantiaParaVer.modalidad || 'Simple'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Propietario:</span>{' '}
                  <strong>
                    {formatPropietario(garantiaParaVer.propietario, garantiaParaVer.cuentaPropietario)}
                  </strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Prestatario:</span>{' '}
                  <strong>{garantiaParaVer.prestatario}</strong>{' '}
                  {garantiaParaVer.cuentaPrestatario && (
                    <span className="text-slate-500">({garantiaParaVer.cuentaPrestatario})</span>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Garantía Con:</span>{' '}
                  <strong className="text-emerald-900">
                    {garantiaParaVer.garantiaConNombre || garantiaParaVer.garantiaConTipo}
                  </strong>
                </div>
              </div>

              {garantiaParaVer.observacion && (
                <div className="p-2 bg-amber-50/60 border border-amber-200 rounded text-slate-700">
                  <strong>Observación:</strong> {garantiaParaVer.observacion}
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const g = garantiaParaVer;
                    setGarantiaParaVer(null);
                    setGarantiaParaBienesLotes(g);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ver Bienes y Lotes</span>
                </button>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const g = garantiaParaVer;
                      setGarantiaParaVer(null);
                      setGarantiaParaImprimir(g);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Contrato</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const g = garantiaParaVer;
                      setGarantiaParaVer(null);
                      setGarantiaToActivar(g);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Activar Garantía</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGarantiaParaVer(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VER BIENES Y LOTES */}
      {garantiaParaBienesLotes && (
        <VerBienesLotesModal
          idGarantia={garantiaParaBienesLotes.idGarantia}
          numeroSolicitud={garantiaParaBienesLotes.numeroSolicitud}
          onClose={() => setGarantiaParaBienesLotes(null)}
        />
      )}

      {/* VISTA DE IMPRESIÓN OFICIAL (SIN MARCA DE ESTADO Y SIN ALTERAR ESTADO) */}
      {garantiaParaImprimir && (
        <ImpresionGarantia
          garantia={garantiaParaImprimir}
          onClose={() => setGarantiaParaImprimir(null)}
        />
      )}

      {/* MODAL DE EDICIÓN */}
      {garantiaToEdit && (
        <EditarGarantiaModal
          idGarantia={garantiaToEdit.idGarantia}
          garantiaPrevia={garantiaToEdit}
          onClose={() => setGarantiaToEdit(null)}
          onSaved={() => {
            setGarantiaToEdit(null);
            loadData(true);
          }}
        />
      )}

      {/* CONFIRMAR ACTIVACIÓN DE GARANTÍA */}
      <ConfirmModal
        isOpen={!!garantiaToActivar}
        title="Activar Garantía"
        message={`¿Confirma la activación de la garantía N.º "${
          garantiaToActivar?.numeroSolicitud || garantiaToActivar?.idGarantia || ''
        }"? La garantía pasará al listado de Garantías Activas manteniendo la reserva actual de terrenos y bienes sin duplicarla.`}
        confirmLabel="Activar Garantía"
        isDestructive={false}
        isLoading={isActivando}
        onCancel={() => {
          if (!isActivando) setGarantiaToActivar(null);
        }}
        onConfirm={handleConfirmActivar}
      />
    </div>
  );
};
