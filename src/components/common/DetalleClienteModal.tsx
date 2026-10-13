import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  MapPin,
  Tractor,
  RefreshCw,
  AlertCircle,
  FileText,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { DetalleCliente } from '../../types';
import { obtenerDetalleCliente } from '../../services/backend';
import { formatFecha, formatHectareas } from '../../utils/textSearch';

interface DetalleClienteModalProps {
  cuenta: string | number;
  nombre?: string;
  ci?: string;
  onClose: () => void;
}

export const DetalleClienteModal: React.FC<DetalleClienteModalProps> = ({
  cuenta,
  nombre: initialNombre,
  ci: initialCi,
  onClose,
}) => {
  const [data, setData] = useState<DetalleCliente | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'garantias' | 'lotes' | 'bienes'>('garantias');

  const loadDetalle = async (forceRefresh: boolean = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const res = await obtenerDetalleCliente(cuenta, forceRefresh);
      if (res) {
        setData(res);
      } else {
        setError('No se pudo encontrar la información del cliente.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al consultar datos en Google Sheets.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDetalle(false);
  }, [cuenta]);

  const displayNombre = data?.nombre || initialNombre || '—';
  const displayCi = data?.ci || initialCi || '—';
  const displayCuenta = data?.cuenta ?? cuenta;

  const totalGarantias = data?.garantias?.length || 0;
  const totalLotes = data?.lotes?.length || 0;
  const totalBienes = data?.bienes?.length || 0;

  const getVencimientoBadge = (estado?: string, fechaVenc?: string) => {
    if (!estado && !fechaVenc) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          Sin vencimiento
        </span>
      );
    }
    const st = (estado || '').toLowerCase();
    if (st.includes('vencid') && !st.includes('próxim')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          Vencida
        </span>
      );
    }
    if (st.includes('próxim') || st.includes('proxim')) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Próxima a vencer
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
        Vigente
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-2xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Cabecera institucional */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-emerald-700 rounded text-white">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Ficha Integral de Cliente — Colonia Chihuahua
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadDetalle(true)}
              disabled={isLoading || isRefreshing}
              title="Refrescar datos desde Google Sheets"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tarjeta de Resumen del Cliente */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                N.º de Cuenta
              </span>
              <div className="font-mono font-bold text-sm text-emerald-950">
                {displayCuenta}
              </div>
            </div>

            <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs sm:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    Titular Registrado
                  </span>
                  <div className="font-bold text-sm text-slate-900">
                    {displayNombre}
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    C.I.
                  </span>
                  <div className="font-mono text-xs font-semibold text-slate-700">
                    {displayCi}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas de Selección */}
        <div className="flex border-b border-slate-200 bg-white px-4 pt-2 gap-2 text-xs select-none">
          <button
            type="button"
            onClick={() => setActiveTab('garantias')}
            className={`pb-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'garantias'
                ? 'border-emerald-800 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>GARANTÍAS</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'garantias' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalGarantias}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lotes')}
            className={`pb-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'lotes'
                ? 'border-emerald-800 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>TERRENOS / LOTES</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'lotes' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalLotes}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bienes')}
            className={`pb-2.5 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
              activeTab === 'bienes'
                ? 'border-emerald-800 text-emerald-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tractor className="w-3.5 h-3.5" />
            <span>BIENES</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === 'bienes' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalBienes}
            </span>
          </button>
        </div>

        {/* Cuerpo del Contenido */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-800" />
              <span className="font-semibold text-slate-700">Cargando expediente del cliente...</span>
              <span className="text-[11px] text-slate-400">Consultando registros oficiales en Google Sheets</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center gap-2 text-xs">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <span className="font-semibold">{error}</span>
              <button
                type="button"
                onClick={() => loadDetalle(true)}
                className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold transition cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <>
              {/* PESTAÑA: GARANTÍAS */}
              {activeTab === 'garantias' && (
                <div className="space-y-3">
                  {totalGarantias === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded">
                      Este cliente no tiene garantías registradas actualmente.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-3 border-r border-slate-200">N.º Solicitud</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Fecha</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Vencimiento</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Garantía con</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Modalidad</th>
                            <th className="py-1.5 px-3">Bienes / Lotes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data!.garantias.map((g) => (
                            <tr key={g.idGarantia || g.numeroSolicitud} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2 px-3 font-mono font-bold text-emerald-950 border-r border-slate-100">
                                {g.numeroSolicitud || '—'}
                              </td>
                              <td className="py-2 px-3 text-slate-600 font-mono border-r border-slate-100 whitespace-nowrap">
                                {formatFecha(g.fecha)}
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-slate-700">
                                    {g.fechaVencimiento ? formatFecha(g.fechaVencimiento) : '—'}
                                  </span>
                                  {getVencimientoBadge(g.estadoVencimiento, g.fechaVencimiento)}
                                </div>
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100">
                                <span className="font-semibold text-slate-800">
                                  {g.garantiaConNombre || g.garantiaConTipo || '—'}
                                </span>
                              </td>
                              <td className="py-2 px-3 border-r border-slate-100">
                                <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {g.modalidad || 'Simple'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-600 text-[11px]">
                                {g.lotesResumen || g.polizasResumen || g.tipoGarantia || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA: TERRENOS / LOTES */}
              {activeTab === 'lotes' && (
                <div className="space-y-3">
                  {totalLotes === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded">
                      No se encontraron terrenos o parcelas registrados a nombre de este cliente.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {data!.lotes.map((lote) => {
                        const estaEnGarantia = lote.hectareasEnGarantia > 0;
                        return (
                          <div
                            key={lote.idLote || lote.numeroLote}
                            className="p-3 bg-white border border-slate-200 rounded shadow-2xs hover:border-slate-300 transition"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Lote {lote.numeroLote}
                                </span>
                                <span className="text-xs text-slate-500">
                                  Ubicación: <strong className="text-slate-700">{lote.ubicacion || '—'}</strong>
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    lote.estado === 'Disponible'
                                      ? 'bg-slate-50 text-slate-700 border-slate-200'
                                      : lote.estado === 'Bloqueado'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-red-50 text-red-800 border-red-200'
                                  }`}
                                >
                                  {lote.estado}
                                </span>
                                {estaEnGarantia && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                                    En Garantía
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Detalle métrico de hectáreas */}
                            <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">
                                  Hectáreas Totales
                                </span>
                                <span className="font-mono font-bold text-slate-800">
                                  {formatHectareas(lote.hectareas)}
                                </span>
                              </div>
                              <div className="bg-purple-50/60 p-2 rounded border border-purple-200">
                                <span className="block text-[10px] font-bold text-purple-800 uppercase">
                                  En Garantía
                                </span>
                                <span className="font-mono font-bold text-purple-950">
                                  {formatHectareas(lote.hectareasEnGarantia)}
                                </span>
                              </div>
                              <div className="bg-emerald-50/60 p-2 rounded border border-emerald-200">
                                <span className="block text-[10px] font-bold text-emerald-800 uppercase">
                                  Disponibles
                                </span>
                                <span className="font-mono font-bold text-emerald-950">
                                  {formatHectareas(lote.hectareasDisponibles)}
                                </span>
                              </div>
                            </div>

                            {/* Con quién está en garantía */}
                            {estaEnGarantia && (
                              <div className="mt-2.5 p-2 bg-purple-50/80 rounded border border-purple-200 text-xs">
                                <div className="font-bold text-[11px] text-purple-900 flex items-center gap-1.5 mb-1">
                                  <Shield className="w-3.5 h-3.5 text-purple-700" />
                                  <span>Compromiso de Garantía:</span>
                                </div>
                                {Array.isArray(lote.relaciones) && lote.relaciones.length > 0 ? (
                                  <div className="space-y-1">
                                    {lote.relaciones.map((rel, rIdx) => (
                                      <div
                                        key={rIdx}
                                        className="text-slate-700 flex flex-wrap items-center justify-between gap-1 text-[11px] bg-white p-1.5 rounded border border-purple-100"
                                      >
                                        <div>
                                          <span className="font-semibold text-slate-900">
                                            {rel.garantiaConNombre || rel.garantiaConTipo || 'Acreedor'}
                                          </span>
                                          {rel.numeroSolicitud && (
                                            <span className="text-slate-400 font-mono ml-1.5">
                                              (Sol. {rel.numeroSolicitud})
                                            </span>
                                          )}
                                        </div>
                                        <div className="font-mono font-bold text-purple-900">
                                          {formatHectareas(rel.hectareas)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-purple-950 font-semibold">
                                    Garantía registrada para este lote con entidades o clientes particulares autorizados.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA: BIENES */}
              {activeTab === 'bienes' && (
                <div className="space-y-3">
                  {totalBienes === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400 italic bg-slate-50 border border-slate-200 rounded">
                      No se encontraron maquinarias, vehículos ni bienes registrados a nombre de este cliente.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1.5 px-3 border-r border-slate-200">N.º Póliza</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Tipo de Bien</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Descripción / Detalles</th>
                            <th className="py-1.5 px-3 border-r border-slate-200 text-right">Valor ($us.)</th>
                            <th className="py-1.5 px-3 border-r border-slate-200">Estado</th>
                            <th className="py-1.5 px-3">Garantía Con</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data!.bienes.map((bien) => {
                            const valUSD = Number(bien.valorGarantiaUSD) || 0;
                            return (
                              <tr key={bien.idBien || bien.numeroPoliza} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 font-mono font-bold text-blue-950 border-r border-slate-100">
                                  {bien.numeroPoliza}
                                </td>
                                <td className="py-2 px-3 text-slate-700 font-semibold border-r border-slate-100">
                                  {bien.tipoBien}
                                </td>
                                <td className="py-2 px-3 text-slate-600 border-r border-slate-100">
                                  <div>{bien.descripcion || '—'}</div>
                                  {(bien.marca || bien.modelo || bien.placa) && (
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {[bien.marca, bien.modelo, bien.placa ? `Placa: ${bien.placa}` : '']
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono font-bold text-emerald-950 text-right border-r border-slate-100">
                                  $us. {valUSD.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 px-3 border-r border-slate-100">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      bien.estado === 'Disponible'
                                        ? 'bg-slate-50 text-slate-700 border-slate-200'
                                        : bien.estado === 'Bloqueado'
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-red-50 text-red-800 border-red-200'
                                    }`}
                                  >
                                    {bien.estado}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  {bien.enGarantia ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-semibold text-purple-900">
                                        {bien.garantiaConNombre || 'En Garantía'}
                                      </span>
                                      {bien.numeroSolicitud && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          (Sol. {bien.numeroSolicitud})
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[11px] italic">Libre</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pie de modal */}
        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-500">
            Registro Oficial · Asoc. Civil "Colonia Chihuahua"
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
