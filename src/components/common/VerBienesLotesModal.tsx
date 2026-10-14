import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  RefreshCw,
  AlertCircle,
  FileCheck2,
  Tractor,
  MapPin,
} from 'lucide-react';
import { Garantia, GarantiaLiberada } from '../../types';
import { obtenerGarantiaCompleta, obtenerGarantiaLiberadaCompleta } from '../../services/backend';
import { formatHectareas, formatPropietario } from '../../utils/textSearch';

interface VerBienesLotesModalProps {
  idGarantia: string;
  numeroSolicitud?: string;
  isLiberada?: boolean;
  onClose: () => void;
}

export const VerBienesLotesModal: React.FC<VerBienesLotesModalProps> = ({
  idGarantia,
  numeroSolicitud,
  isLiberada = false,
  onClose,
}) => {
  const [garantiaCompleta, setGarantiaCompleta] = useState<Garantia | GarantiaLiberada | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = async (forceRefresh: boolean = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const data = isLiberada
        ? await obtenerGarantiaLiberadaCompleta(idGarantia, forceRefresh)
        : await obtenerGarantiaCompleta(idGarantia, forceRefresh);

      if (data) {
        setGarantiaCompleta(data);
      } else {
        setError('No se pudo encontrar la información de esta garantía en Google Sheets.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al consultar bienes y lotes de la garantía.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (idGarantia) {
      cargarDatos(false);
    }
  }, [idGarantia]);

  const lotes = garantiaCompleta?.lotes || [];
  const bienes = garantiaCompleta?.bienes || [];
  const totalItems = lotes.length + bienes.length;

  const totalHectareas = lotes.reduce((acc, l) => acc + (Number(l.hectareas) || 0), 0);
  const totalValorUSD = bienes.reduce((acc, b) => acc + (Number(b.valorGarantiaUSD) || 0), 0);

  const numSolicitudDisplay =
    garantiaCompleta?.numeroSolicitud || numeroSolicitud || idGarantia;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-2xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-lg shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 rounded">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Bienes y Lotes — Solicitud N.º {numSolicitudDisplay}
                {isLiberada && (
                  <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                    Liberada
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-300">
                {isLiberada
                  ? 'Consulta de parcelas y bienes al momento de la liberación'
                  : 'Consulta directa de bienes muebles y parcelas respaldando la operación'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => cargarDatos(true)}
              disabled={isLoading || isRefreshing}
              title="Actualizar datos desde Google Sheets"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs bg-slate-50/50">
          {isLoading ? (
            <div className="py-14 text-center">
              <div className="flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-800" />
                <span className="font-semibold text-slate-700">
                  Consultando bienes y lotes vinculados...
                </span>
                <span className="text-[11px] text-slate-400">
                  Leyendo relaciones en garantia_lotes y garantia_bienes
                </span>
              </div>
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <div className="flex flex-col items-center justify-center gap-2 max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded text-red-800">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <span className="font-semibold">{error}</span>
                <button
                  type="button"
                  onClick={() => cargarDatos(true)}
                  className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded font-semibold text-xs transition cursor-pointer"
                >
                  Reintentar consulta
                </button>
              </div>
            </div>
          ) : totalItems === 0 ? (
            <div className="py-12 text-center bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                <div className="p-3 bg-slate-100 rounded-full text-slate-400">
                  <FileCheck2 className="w-8 h-8 stroke-[1.5]" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm">
                  No hay bienes o lotes vinculados a esta garantía.
                </h4>
                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  No existen registros asociados a esta garantía en las tablas{' '}
                  <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">garantia_lotes</code> ni{' '}
                  <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">garantia_bienes</code> de Google Sheets.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Resumen rápido de la garantía */}
              {garantiaCompleta && (
                <div className="bg-white border border-slate-200 rounded p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Prestatario:</span>{' '}
                    <strong className="text-slate-800">{garantiaCompleta.prestatario}</strong>{' '}
                    <span className="font-mono text-slate-500">({garantiaCompleta.cuentaPrestatario})</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Garantía Con:</span>{' '}
                    <strong className="text-emerald-900">{garantiaCompleta.garantiaConNombre}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Modalidad:</span>{' '}
                    <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                      {garantiaCompleta.modalidad || 'Simple'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tabla principal: Bien / Lote | Propietario | Cantidad / Valor | Garantía con */}
              <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-300 select-none">
                      <tr>
                        <th className="py-2 px-3 font-bold border-r border-slate-200">
                          Bien / Lote
                        </th>
                        <th className="py-2 px-3 font-bold border-r border-slate-200">
                          Propietario
                        </th>
                        <th className="py-2 px-3 font-bold border-r border-slate-200 text-right">
                          Cantidad / Valor
                        </th>
                        <th className="py-2 px-3 font-bold">
                          Garantía con
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      {/* Filas de Lotes */}
                      {lotes.map((lote, idx) => (
                        <tr
                          key={`lote-${lote.idLote || idx}`}
                          className="hover:bg-emerald-50/40 transition-colors"
                        >
                          <td className="py-2 px-3 border-r border-slate-100 align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-950 border border-emerald-300">
                                Lote {lote.numeroLote || 'S/N'}
                              </span>
                              <span className="text-[11px] font-medium text-slate-600">
                                Parcela / Terreno
                              </span>
                            </div>
                            {lote.ubicacion && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>{lote.ubicacion}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-100 align-top">
                            <div className="font-semibold text-slate-800">
                              {formatPropietario(lote.propietario, lote.cuentaPropietario)}
                            </div>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-100 text-right align-top font-mono font-bold text-emerald-900">
                            {formatHectareas(lote.hectareas)}
                          </td>
                          <td className="py-2 px-3 align-top font-semibold text-slate-800">
                            {lote.garantiaConNombre || garantiaCompleta?.garantiaConNombre || '—'}
                          </td>
                        </tr>
                      ))}

                      {/* Filas de Bienes */}
                      {bienes.map((bien, idx) => {
                        const valUSD = Number(bien.valorGarantiaUSD) || 0;
                        const detalleBien = [
                          bien.tipoBien,
                          bien.descripcion,
                          bien.marca ? `(${bien.marca})` : null,
                          bien.modelo ? `Mod. ${bien.modelo}` : null,
                        ]
                          .filter(Boolean)
                          .join(' ');

                        return (
                          <tr
                            key={`bien-${bien.idBien || idx}`}
                            className="hover:bg-blue-50/40 transition-colors"
                          >
                            <td className="py-2 px-3 border-r border-slate-100 align-top">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {bien.numeroPoliza && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-100 text-blue-950 border border-blue-300">
                                    Póliza {bien.numeroPoliza}
                                  </span>
                                )}
                                <span className="font-medium text-slate-800">
                                  {detalleBien || 'Bien Mueble'}
                                </span>
                              </div>
                              {bien.placa && (
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                                  Placa: <strong>{bien.placa}</strong>
                                </div>
                              )}
                              {bien.ubicacion && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{bien.ubicacion}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 align-top">
                              <div className="font-semibold text-slate-800">
                                {formatPropietario(bien.propietario, bien.cuentaPropietario)}
                              </div>
                            </td>
                            <td className="py-2 px-3 border-r border-slate-100 text-right align-top font-mono font-bold text-slate-900">
                              {valUSD > 0
                                ? `$us. ${valUSD.toLocaleString('es-BO', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : '—'}
                            </td>
                            <td className="py-2 px-3 align-top font-semibold text-slate-800">
                              {bien.garantiaConNombre || garantiaCompleta?.garantiaConNombre || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Totales consolidados al pie de la tabla */}
                <div className="bg-slate-100/90 px-3 py-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-slate-600 font-medium">
                    Total: <strong className="text-slate-900">{totalItems}</strong> ítem(s) vinculados
                    {lotes.length > 0 && ` (${lotes.length} lote${lotes.length > 1 ? 's' : ''})`}
                    {bienes.length > 0 && ` (${bienes.length} bien${bienes.length > 1 ? 'es' : ''})`}
                  </div>
                  <div className="flex items-center gap-4">
                    {lotes.length > 0 && (
                      <div>
                        <span className="text-slate-500 text-[11px] uppercase font-semibold">
                          Total Hectáreas:{' '}
                        </span>
                        <strong className="font-mono text-emerald-950 font-bold ml-1">
                          {formatHectareas(totalHectareas)}
                        </strong>
                      </div>
                    )}
                    {bienes.length > 0 && (
                      <div>
                        <span className="text-slate-500 text-[11px] uppercase font-semibold">
                          Total en $us:{' '}
                        </span>
                        <strong className="font-mono text-slate-900 font-bold ml-1">
                          $us.{' '}
                          {totalValorUSD.toLocaleString('es-BO', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="bg-slate-100 px-4 py-2.5 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
