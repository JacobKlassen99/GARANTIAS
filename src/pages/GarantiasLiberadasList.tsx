import React, { useState, useEffect, useRef } from 'react';
import {
  Archive,
  Search,
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Layers,
  X,
  FileCheck2,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { GarantiaLiberada, QueryParams } from '../types';
import {
  listarGarantiasLiberadas,
  obtenerGarantiaLiberadaCompleta,
  reactivarGarantia,
} from '../services/backend';
import { ImpresionGarantia } from './ImpresionGarantia';
import { VerBienesLotesModal } from '../components/common/VerBienesLotesModal';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { OrdenarPorDropdown } from '../components/common/OrdenarPorDropdown';
import {
  DEFAULT_GARANTIA_SORT,
  GarantiaSortConfig,
} from '../utils/garantiaSort';
import {
  formatFecha,
  formatPropietario,
} from '../utils/textSearch';
import { NavSection } from '../components/layout/Sidebar';

interface GarantiasLiberadasListProps {
  onNavigate?: (section: NavSection) => void;
}

export const GarantiasLiberadasList: React.FC<GarantiasLiberadasListProps> = ({ onNavigate }) => {
  const [garantias, setGarantias] = useState<GarantiaLiberada[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  // Paginación, búsqueda y ordenamiento
  const [search, setSearch] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<GarantiaSortConfig>(DEFAULT_GARANTIA_SORT);
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(200);
  const [total, setTotal] = useState<number>(0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const requestSeqRef = useRef(0);

  // Estados de modales
  const [garantiaParaVer, setGarantiaParaVer] = useState<GarantiaLiberada | null>(null);
  const [garantiaParaBienesLotes, setGarantiaParaBienesLotes] = useState<GarantiaLiberada | null>(null);
  const [garantiaParaImprimir, setGarantiaParaImprimir] = useState<GarantiaLiberada | null>(null);
  const [isCargandoDetalle, setIsCargandoDetalle] = useState<boolean>(false);

  // Reactivación de garantía liberada
  const [garantiaToReactivar, setGarantiaToReactivar] = useState<GarantiaLiberada | null>(null);
  const [isReactivando, setIsReactivando] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const loadData = async (forceRefresh: boolean = false) => {
    const reqId = ++requestSeqRef.current;
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
        search: appliedSearch || undefined,
        sortField: sortConfig.field,
        sortDirection: sortConfig.direction,
      };
      const res = await listarGarantiasLiberadas(params, forceRefresh);
      if (reqId !== requestSeqRef.current) return;
      const items = Array.isArray(res?.data) ? res.data : [];
      setGarantias(items);
      setTotal(typeof res?.total === 'number' ? Math.max(res.total, items.length) : items.length);
      setHasLoadedOnce(true);
    } catch {
      if (reqId !== requestSeqRef.current) return;
      if (garantias.length === 0) {
        setBackendMessage('No se pudo cargar el historial de garantías liberadas.');
      } else {
        setBackendMessage('No se pudo actualizar la información.');
      }
    } finally {
      if (reqId === requestSeqRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    loadData(false);
  }, [page, appliedSearch, sortConfig]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleClearSearch = () => {
    setSearch('');
    setAppliedSearch('');
    setPage(1);
  };

  const handleApplySort = (next: GarantiaSortConfig) => {
    setSortConfig(next);
    setPage(1);
  };

  // Abrir vista previa de impresión trayendo relaciones si no están cargadas
  const handleAbrirImpresion = async (g: GarantiaLiberada) => {
    const hasLoadedItems =
      (Array.isArray(g.lotes) && g.lotes.length > 0) ||
      (Array.isArray(g.bienes) && g.bienes.length > 0);
    if (hasLoadedItems) {
      setGarantiaParaImprimir(g);
      return;
    }
    setIsCargandoDetalle(true);
    try {
      const completa = await obtenerGarantiaLiberadaCompleta(g.idGarantia);
      setGarantiaParaImprimir(completa || g);
    } catch {
      setGarantiaParaImprimir(g);
    } finally {
      setIsCargandoDetalle(false);
    }
  };

  // Confirmar reactivación de garantía liberada (el backend valida disponibilidad de hectáreas y bienes)
  const handleConfirmReactivar = async () => {
    if (!garantiaToReactivar) return;
    setIsReactivando(true);
    setActionErrorMessage(null);
    setActionSuccessMessage(null);
    try {
      const numSol = garantiaToReactivar.numeroSolicitud || garantiaToReactivar.idGarantia;
      await reactivarGarantia(garantiaToReactivar.idGarantia);
      setGarantiaToReactivar(null);
      setActionSuccessMessage(
        `Garantía N.º ${numSol} reactivada con éxito. Ha regresado a Garantías Activas conservando sus datos y N.º de solicitud.`
      );
      setTimeout(() => setActionSuccessMessage(null), 5500);
      loadData(true);
    } catch (err: any) {
      setGarantiaToReactivar(null);
      setActionErrorMessage(
        err?.message ||
          'No se pudo reactivar la garantía porque uno o más terrenos o bienes no se encuentran disponibles.'
      );
    } finally {
      setIsReactivando(false);
    }
  };

  return (
    <div className="space-y-3 font-sans pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-50 text-amber-800 rounded border border-amber-200">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              GARANTÍAS LIBERADAS
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
                Historial
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Historial oficial de operaciones concluidas y consulta de garantías liberadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing}
            title="Actualizar garantías liberadas desde Google Sheets"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoading || isRefreshing ? 'animate-spin text-amber-700' : ''
              }`}
            />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda Backend */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex flex-wrap items-center gap-2 max-w-2xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por N.º Solicitud, propietario, prestatario, cuenta o garantía con..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-700 focus:border-amber-700"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded transition cursor-pointer"
            >
              Buscar
            </button>
            <OrdenarPorDropdown
              value={sortConfig}
              onApply={handleApplySort}
              disabled={isLoading && !hasLoadedOnce}
            />
            {(search || appliedSearch) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        <div className="text-[11px] text-slate-600 flex items-center gap-2 justify-between lg:justify-end">
          {isRefreshing && (
            <span className="text-[11px] font-medium text-amber-800 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando datos...
            </span>
          )}
          <span>
            Total: <strong className="font-mono text-slate-900">{total}</strong> garantías liberadas
          </span>
        </div>
      </div>

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
        <div className="p-2.5 bg-red-50 border border-red-300 rounded flex items-start justify-between gap-2 text-xs text-red-900">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold">No se pudo reactivar la garantía:</strong>{' '}
              <span>{actionErrorMessage}</span>
            </div>
          </div>
          <button
            onClick={() => setActionErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold p-1 cursor-pointer shrink-0"
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

      {/* TABLA COMPACTA DE GARANTÍAS LIBERADAS */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">N.º Solicitud</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">Fecha de Garantía</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">Fecha de Liberación</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Propietario</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Prestatario (Cuenta en Garantía)</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Garantía Con</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">Tipo de Garantía</th>
                <th className="py-1.5 px-3 font-bold text-center w-48">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {isLoading && !hasLoadedOnce ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-800" />
                      <span className="font-semibold text-slate-700">Cargando garantías liberadas...</span>
                      <span className="text-[11px] text-slate-400">Consultando registros históricos en Google Sheets</span>
                    </div>
                  </td>
                </tr>
              ) : backendMessage && garantias.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-red-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-red-500" />
                      <span className="font-semibold text-slate-800">No se pudo cargar el historial.</span>
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
                  return (
                    <tr
                      key={garantia.idGarantia || garantia.idLiberacion || garantia.numeroSolicitud}
                      className="hover:bg-amber-50/40 transition-colors group"
                    >
                      <td className="py-1.5 px-3 font-mono font-bold text-amber-950 border-r border-slate-100 bg-slate-50/30">
                        {garantia.numeroSolicitud || '—'}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-slate-600 border-r border-slate-100">
                        {formatFecha(garantia.fecha)}
                      </td>
                      <td className="py-1.5 px-3 font-mono border-r border-slate-100 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {formatFecha(garantia.fechaLiberacion)}
                        </span>
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
                        <span className="font-medium text-slate-800">
                          {garantia.garantiaConNombre || garantia.garantiaConTipo || '—'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {garantia.tipoGarantia || 'Terreno'}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setGarantiaParaVer(garantia)}
                            title="Ver detalles de la garantía liberada"
                            className="p-1 text-slate-600 hover:text-amber-900 hover:bg-amber-50 rounded transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setGarantiaParaBienesLotes(garantia)}
                            title="Ver bienes y lotes al momento de la liberación"
                            className="p-1 text-emerald-700 hover:text-emerald-950 hover:bg-emerald-50 rounded transition cursor-pointer"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAbrirImpresion(garantia)}
                            title="Imprimir contrato"
                            disabled={isCargandoDetalle}
                            className="p-1 text-slate-700 hover:text-slate-950 hover:bg-slate-100 rounded transition cursor-pointer disabled:opacity-50"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setActionErrorMessage(null);
                              setGarantiaToReactivar(garantia);
                            }}
                            title="Reactivar garantía (verifica disponibilidad antes de volver a Garantías Activas)"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reactivar</span>
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
                      <FileCheck2 className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="font-semibold text-slate-700">
                        {search
                          ? 'Sin coincidencias en garantías liberadas'
                          : 'No hay garantías liberadas registradas.'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {search
                          ? `No se encontró ningún registro con "${search}".`
                          : 'Cuando se liberen garantías desde el módulo principal, aparecerán en este historial.'}
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
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DETALLES DE GARANTÍA LIBERADA */}
      {garantiaParaVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Garantía Liberada N.º {garantiaParaVer.numeroSolicitud || garantiaParaVer.idGarantia}
                </h3>
              </div>
              <button
                onClick={() => setGarantiaParaVer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 text-xs space-y-3">
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded flex items-center justify-between text-amber-950 font-semibold">
                <span>Estado: Operación Liberada</span>
                <span className="font-mono text-[11px] bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Liberada: {formatFecha(garantiaParaVer.fechaLiberacion)}
                </span>
              </div>

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
                  <strong className="text-slate-900">{garantiaParaVer.tipoGarantia || 'Terreno'}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Modalidad:</span>{' '}
                  <span className="font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                    {garantiaParaVer.modalidad || 'Simple'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Propietario:</span>{' '}
                  <strong>
                    {formatPropietario(
                      garantiaParaVer.propietario,
                      garantiaParaVer.cuentaPropietario
                    )}
                  </strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Prestatario:</span>{' '}
                  <strong>{garantiaParaVer.prestatario}</strong>{' '}
                  {garantiaParaVer.cuentaPrestatario && (
                    <span className="text-slate-500">
                      ({garantiaParaVer.cuentaPrestatario})
                    </span>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Garantía Con:</span>{' '}
                  <strong className="text-slate-900">
                    {garantiaParaVer.garantiaConNombre || garantiaParaVer.garantiaConTipo}
                  </strong>
                </div>
              </div>

              {garantiaParaVer.motivoLiberacion && (
                <div className="p-2 bg-amber-50/70 border border-amber-200 rounded text-amber-900">
                  <strong>Motivo de Liberación:</strong> {garantiaParaVer.motivoLiberacion}
                </div>
              )}

              {garantiaParaVer.observacion && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700">
                  <strong>Observación:</strong> {garantiaParaVer.observacion}
                </div>
              )}

              <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const g = garantiaParaVer;
                    setGarantiaParaVer(null);
                    setGarantiaParaBienesLotes(g);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded flex items-center gap-1.5"
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
                      handleAbrirImpresion(g);
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
                      setActionErrorMessage(null);
                      setGarantiaToReactivar(g);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reactivar Garantía</span>
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

      {/* MODAL VER BIENES Y LOTES (RÁPIDO Y DIRECTO - MODO LIBERADA) */}
      {garantiaParaBienesLotes && (
        <VerBienesLotesModal
          idGarantia={garantiaParaBienesLotes.idGarantia}
          numeroSolicitud={garantiaParaBienesLotes.numeroSolicitud}
          isLiberada={true}
          onClose={() => setGarantiaParaBienesLotes(null)}
        />
      )}

      {/* VISTA DE IMPRESIÓN OFICIAL */}
      {garantiaParaImprimir && (
        <ImpresionGarantia
          garantia={garantiaParaImprimir}
          isLiberada={true}
          onClose={() => setGarantiaParaImprimir(null)}
        />
      )}

      {/* CONFIRMAR REACTIVACIÓN DE GARANTÍA */}
      <ConfirmModal
        isOpen={!!garantiaToReactivar}
        title="Reactivar Garantía"
        message={`¿Está seguro de reactivar la garantía N.º "${
          garantiaToReactivar?.numeroSolicitud || garantiaToReactivar?.idGarantia || ''
        }"? Antes de reactivarla, el sistema verificará si las hectáreas y los bienes comprometidos siguen disponibles. Si alguno ya está en uso, la reactivación será bloqueada.`}
        confirmLabel="Reactivar Garantía"
        isDestructive={false}
        isLoading={isReactivando}
        onCancel={() => {
          if (!isReactivando) setGarantiaToReactivar(null);
        }}
        onConfirm={handleConfirmReactivar}
      />
    </div>
  );
};
