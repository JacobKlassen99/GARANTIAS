import React, { useState } from 'react';
import { Printer, Download, X, ShieldCheck, AlertCircle } from 'lucide-react';
import { Garantia } from '../types';
import { formatFecha, formatHectareas } from '../utils/textSearch';

interface ImpresionGarantiaProps {
  garantia: Garantia;
  onClose: () => void;
}

export const ImpresionGarantia: React.FC<ImpresionGarantiaProps> = ({ garantia, onClose }) => {
  // CAMPO TEMPORAL: IDENTIFICACIÓN
  // REGLA CRÍTICA: NO se guarda en Google Sheets, NO en garantias, NO en bienes, NO en localStorage.
  // Vive únicamente en el estado local de React durante esta sesión de visualización.
  const [identificacionTemporal, setIdentificacionTemporal] = useState('');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto">
      {/* Contenedor Modal */}
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Barra de control superior (No imprimible) */}
        <div className="print:hidden bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Vista Previa de Impresión Oficial — Asoc. Civil "Colonia Chihuahua"
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handlePrint}
              title="Utilice la opción Guardar como PDF en el diálogo de impresión"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
              title="Cerrar vista de impresión"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel de campo temporal (No imprimible) */}
        <div className="print:hidden p-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Campo Temporal:</strong> Ingrese el N.º de Identificación / CI para completar el documento impreso.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-slate-700 uppercase">Identificación:</label>
            <input
              type="text"
              value={identificacionTemporal}
              onChange={(e) => setIdentificacionTemporal(e.target.value)}
              placeholder="Ej: CI / RUN / Pasaporte..."
              className="px-2.5 py-1 text-xs bg-white border border-amber-300 rounded font-mono focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </div>
        </div>

        {/* HOJA DE DOCUMENTO IMPRIMIBLE (Estilo oficial Colonia Chihuahua) */}
        <div className="overflow-y-auto p-6 sm:p-12 bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible font-serif text-[12pt] leading-normal select-text">
          {/* Encabezado Oficial */}
          <div className="text-center pb-4 border-b-2 border-slate-900 mb-6">
            <h1 className="text-base sm:text-lg font-black uppercase tracking-wider">
              ASOCIACIÓN CIVIL "COLONIA CHIHUAHUA"
            </h1>
            <p className="text-[10pt] font-semibold tracking-widest uppercase text-slate-700 mt-0.5">
              DEPARTAMENTO DE ADMINISTRACIÓN Y REGISTRO DE PARCELAS
            </p>
            <div className="mt-3 inline-block border border-slate-900 px-4 py-1 font-bold text-sm uppercase tracking-wider bg-slate-50">
              GARANTÍA DE PARCELAS / BIENES
            </div>
            <div className="mt-2 text-right text-xs font-mono">
              <strong>N.º Solicitud:</strong> {garantia.numeroSolicitud} &nbsp;|&nbsp;{' '}
              <strong>Fecha:</strong> {formatFecha(garantia.fecha)}
            </div>
          </div>

          {/* CUERPO DEL DOCUMENTO */}
          <div className="space-y-4 text-xs sm:text-sm font-sans">
            {/* SECCIÓN 1: DATOS DEL PROPIETARIO */}
            <div className="border border-slate-400 rounded p-3 bg-slate-50/40">
              <div className="font-bold uppercase text-[11px] tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                1. Datos del Propietario del Bien o Parcela
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-600">Número de Cuenta: </span>
                  <strong className="font-mono text-slate-900">{garantia.cuentaPropietario}</strong>
                </div>
                <div>
                  <span className="text-slate-600">Nombre Completo: </span>
                  <strong className="text-slate-900">{garantia.propietario}</strong>
                </div>
                {identificacionTemporal && (
                  <div className="col-span-1 sm:col-span-2 text-slate-800">
                    <span className="text-slate-600">Identificación / Documento: </span>
                    <strong className="font-mono">{identificacionTemporal}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: BIENES Y LOTES AFECTADOS */}
            <div className="border border-slate-400 rounded p-3">
              <div className="font-bold uppercase text-[11px] tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                2. Detalle de Bienes y/o Parcelas en Garantía
              </div>

              {/* Lotes */}
              {garantia.lotes && garantia.lotes.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-bold text-emerald-950 mb-1">
                    Parcelas / Terrenos Comprometidos:
                  </div>
                  <table className="w-full text-left text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 border-r border-slate-300">N.º Parcela</th>
                        <th className="p-1.5 border-r border-slate-300">Superficie</th>
                        <th className="p-1.5 border-r border-slate-300">Ubicación</th>
                        <th className="p-1.5">Encargado (si corresponde)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {garantia.lotes.map((lote, i) => (
                        <tr key={i}>
                          <td className="p-1.5 font-bold font-mono border-r border-slate-200">
                            {lote.numeroLote}
                          </td>
                          <td className="p-1.5 font-mono border-r border-slate-200">
                            {formatHectareas(lote.hectareas)}
                          </td>
                          <td className="p-1.5 border-r border-slate-200">{lote.ubicacion || '—'}</td>
                          <td className="p-1.5">{lote.encargado || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bienes */}
              {garantia.bienes && garantia.bienes.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-blue-950 mb-1">
                    Vehículos, Maquinarias e Implementos:
                  </div>
                  <table className="w-full text-left text-xs border border-slate-300">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300">
                      <tr>
                        <th className="p-1.5 border-r border-slate-300">N.º Póliza</th>
                        <th className="p-1.5 border-r border-slate-300">Tipo / Descripción</th>
                        <th className="p-1.5 border-r border-slate-300">Marca / Modelo</th>
                        <th className="p-1.5">Placa / Ubicación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {garantia.bienes.map((bien, i) => (
                        <tr key={i}>
                          <td className="p-1.5 font-bold font-mono border-r border-slate-200">
                            {bien.numeroPoliza}
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            {bien.tipoBien} {bien.descripcion ? `- ${bien.descripcion}` : ''}
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            {bien.marca} {bien.modelo}
                          </td>
                          <td className="p-1.5 font-mono">
                            {bien.placa ? `Placa: ${bien.placa}` : bien.ubicacion || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SECCIÓN 3: PRESTATARIO Y GARANTÍA CON */}
            <div className="border border-slate-400 rounded p-3 bg-slate-50/40">
              <div className="font-bold uppercase text-[11px] tracking-wider text-slate-800 border-b border-slate-300 pb-1 mb-2">
                3. Datos del Prestatario y Destino de Garantía
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-600">Cuenta en Garantía (Prestatario): </span>
                  <strong className="font-mono text-slate-900">{garantia.cuentaPrestatario}</strong>
                </div>
                <div>
                  <span className="text-slate-600">Nombre del Prestatario: </span>
                  <strong className="text-slate-900">{garantia.prestatario}</strong>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <span className="text-slate-600">Garantía Constituida Con: </span>
                  <strong className="text-emerald-950 font-bold uppercase">{garantia.garantiaConNombre}</strong>
                </div>
                {garantia.observacion && (
                  <div className="col-span-1 sm:col-span-2 pt-1 border-t border-slate-200 text-slate-700 italic">
                    <span className="text-slate-600 font-semibold not-italic">Observación: </span>
                    {garantia.observacion}
                  </div>
                )}
              </div>
            </div>

            {/* TEXTO INSTITUCIONAL FORMAL */}
            <div className="p-3 border border-slate-300 rounded text-[11px] text-justify leading-relaxed text-slate-700 font-serif">
              Por el presente documento, el Propietario declara y certifica que los bienes y/o parcelas descritos precedentemente quedan gravados en calidad de garantía institucional en favor de <strong>{garantia.garantiaConNombre}</strong> para respaldar las obligaciones financieras y comerciales contraídas por el Prestatario con Cuenta en Garantía N.º <strong>{garantia.cuentaPrestatario}</strong>. Los bienes gravados no podrán ser enajenados, cedidos ni transferidos sin previa autorización formal y liberación de gravamen emitida por la Administración de la Colonia Chihuahua.
            </div>

            {/* SECCIÓN DE FIRMAS */}
            <div className="pt-16 pb-4 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="border-t border-slate-800 pt-2">
                <div className="font-bold uppercase tracking-wider text-slate-900">
                  FIRMA DEL PROPIETARIO
                </div>
                <div className="text-[11px] text-slate-600 mt-1 font-mono">
                  {garantia.propietario}
                </div>
                <div className="text-[10px] text-slate-400">Cuenta: {garantia.cuentaPropietario}</div>
              </div>

              <div className="border-t border-slate-800 pt-2">
                <div className="font-bold uppercase tracking-wider text-slate-900">
                  FIRMA DEL INTERESADO / PRESTATARIO
                </div>
                <div className="text-[11px] text-slate-600 mt-1 font-mono">
                  {garantia.prestatario}
                </div>
                <div className="text-[10px] text-slate-400">Cuenta: {garantia.cuentaPrestatario}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
