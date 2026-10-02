import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Search,
  Plus,
  Eye,
  Printer,
  Unlock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Building2,
  Layers,
  X,
} from 'lucide-react';
import { Garantia, QueryParams } from '../types';
import { getGarantias, liberarGarantia } from '../services/backend';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EmptyState } from '../components/common/EmptyState';
import { ImpresionGarantia } from './ImpresionGarantia';
import { formatFecha, formatHectareas } from '../utils/textSearch';
import { NavSection } from '../components/layout/Sidebar';

interface GarantiasListProps {
  onNavigate: (section: NavSection) => void;
}

export const GarantiasList: React.FC<GarantiasListProps> = ({ onNavigate }) => {
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(200);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  // Garantía para imprimir
  const [garantiaParaImprimir, setGarantiaParaImprimir] = useState<Garantia | null>(null);

  // Garantía para ver detalle
  const [garantiaParaVer, setGarantiaParaVer] = useState<Garantia | null>(null);

  // Modal Confirmar Liberación
  const [garantiaToLiberar, setGarantiaToLiberar] = useState<Garantia | null>(null);
  const [isLiberando, setIsLiberando] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setBackendMessage(null);
    try {
      const params: QueryParams = {
        page,
        pageSize,
        search: search.trim() || undefined,
      };
      const res = await getGarantias(params);
      setGarantias(Array.isArray(res?.data) ? res.data : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
    } catch {
      setBackendMessage('No se pudo cargar la información.');
      setGarantias([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleConfirmLiberar = async () => {
    if (!garantiaToLiberar) return;
    setIsLiberando(true);
    try {
      await liberarGarantia(garantiaToLiberar.idGarantia);
      setGarantiaToLiberar(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Esta función requiere conexión con Google Apps Script.');
    } finally {
      setIsLiberando(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Garantías Activas
            </h2>
            <p className="text-[11px] text-slate-500">
              Hoja: <code className="font-mono text-emerald-800 font-bold">garantias</code> (Relaciones en garantia_lotes y garantia_bienes)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            title="Recargar garantías desde Google Sheets"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('nueva-garantia')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition"
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
              placeholder="Buscar por N.º Solicitud, propietario, prestatario, cuenta, garantía con, lote o póliza..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded transition"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                loadData();
              }}
              className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Limpiar
            </button>
          )}
        </form>

        <div className="text-[11px] text-slate-600 text-right">
          Total: <strong className="font-mono text-slate-900">{total}</strong> garantías (200 por página)
        </div>
      </div>

      {backendMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{backendMessage}</div>
        </div>
      )}

      {/* TABLA COMPACTA DE GARANTÍAS */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">N.º Solicitud</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-24">Fecha</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Propietario del Bien</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Prestatario (Cuenta en G.)</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Garantía Con</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">Tipo</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Bienes / Lotes Respaldando</th>
                <th className="py-1.5 px-3 font-bold text-center w-32">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {Array.isArray(garantias) && garantias.length > 0 ? (
                garantias.map((garantia) => {
                  const cantLotes = garantia.lotes?.length || 0;
                  const cantBienes = garantia.bienes?.length || 0;

                  return (
                    <tr
                      key={garantia.idGarantia}
                      className="hover:bg-emerald-50/50 transition-colors group"
                    >
                      <td className="py-1.5 px-3 font-mono font-bold text-emerald-950 border-r border-slate-100 bg-slate-50/30">
                        {garantia.numeroSolicitud}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-slate-600 border-r border-slate-100">
                        {formatFecha(garantia.fecha)}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{garantia.propietario}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Cta: {garantia.cuentaPropietario}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{garantia.prestatario}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Cta: {garantia.cuentaPrestatario}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <span className="font-bold text-slate-700">{garantia.garantiaConNombre}</span>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {garantia.tipoGarantia}
                        </span>
                      </td>

                      {/* Bienes / Lotes */}
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="flex flex-wrap gap-1 text-[11px]">
                          {garantia.lotes?.map((l, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded font-mono text-[10px]"
                              title={`Lote ${l.numeroLote} - ${formatHectareas(l.hectareas)}`}
                            >
                              Lote {l.numeroLote}
                            </span>
                          ))}
                          {garantia.bienes?.map((b, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.2 bg-blue-100 text-blue-900 border border-blue-300 rounded font-mono text-[10px]"
                              title={`${b.tipoBien} - Póliza ${b.numeroPoliza}`}
                            >
                              {b.numeroPoliza}
                            </span>
                          ))}
                          {cantLotes === 0 && cantBienes === 0 && (
                            <span className="text-slate-400 italic text-[10px]">Sin items vinculados</span>
                          )}
                        </div>
                      </td>

                      {/* Acciones: Ver, Imprimir, Liberar */}
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setGarantiaParaVer(garantia)}
                            title="Ver detalles de la garantía"
                            className="p-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setGarantiaParaImprimir(garantia)}
                            title="Imprimir Garantía Institucional"
                            className="p-1 text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50 rounded transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setGarantiaToLiberar(garantia)}
                            title="Liberar garantía (dejar disponibles los bienes/lotes)"
                            className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-50 rounded transition"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      type={search ? 'no-results' : 'backend-required'}
                      title={search ? 'Sin coincidencias en garantías' : 'No hay garantías activas'}
                      description={
                        search
                          ? `No se encontró ninguna garantía con "${search}".`
                          : 'No se pudo cargar la información o no hay garantías registradas.'
                      }
                      onAction={loadData}
                      actionLabel="Reintentar Consulta"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Real Backend (200 registros por página) */}
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

      {/* MODAL DETALLES DE GARANTÍA */}
      {garantiaParaVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Garantía N.º {garantiaParaVer.numeroSolicitud}
              </h3>
              <button
                onClick={() => setGarantiaParaVer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 text-xs space-y-3">
              <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                <div>
                  <span className="text-slate-500">Fecha:</span>{' '}
                  <strong>{formatFecha(garantiaParaVer.fecha)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Tipo:</span>{' '}
                  <strong>{garantiaParaVer.tipoGarantia}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Propietario:</span>{' '}
                  <strong>{garantiaParaVer.propietario}</strong> ({garantiaParaVer.cuentaPropietario})
                </div>
                <div>
                  <span className="text-slate-500">Prestatario:</span>{' '}
                  <strong>{garantiaParaVer.prestatario}</strong> ({garantiaParaVer.cuentaPrestatario})
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Garantía Con:</span>{' '}
                  <strong className="text-emerald-900">{garantiaParaVer.garantiaConNombre}</strong>
                </div>
              </div>

              {garantiaParaVer.observacion && (
                <div className="p-2 bg-amber-50/60 border border-amber-200 rounded text-slate-700">
                  <strong>Observación:</strong> {garantiaParaVer.observacion}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setGarantiaParaImprimir(garantiaParaVer);
                    setGarantiaParaVer(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Documento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGarantiaParaVer(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA DE IMPRESIÓN OFICIAL */}
      {garantiaParaImprimir && (
        <ImpresionGarantia
          garantia={garantiaParaImprimir}
          onClose={() => setGarantiaParaImprimir(null)}
        />
      )}

      {/* CONFIRMAR LIBERACIÓN */}
      <ConfirmModal
        isOpen={!!garantiaToLiberar}
        title="Liberar Garantía"
        message={`¿Está seguro de liberar la solicitud de garantía N.º "${garantiaToLiberar?.numeroSolicitud}"? Al confirmar, el backend liberará los lotes y bienes asociados, quedando disponibles para nuevas operaciones.`}
        confirmLabel="Liberar Garantía"
        isDestructive={false}
        isLoading={isLiberando}
        onCancel={() => setGarantiaToLiberar(null)}
        onConfirm={handleConfirmLiberar}
      />
    </div>
  );
};
