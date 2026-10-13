import React, { useState } from 'react';
import {
  BarChart3,
  Printer,
  Download,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  FileText,
  Calendar,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { ReporteItem } from '../types';
import { getReporte, obtenerReporteVencimientos } from '../services/backend';
import { EmptyState } from '../components/common/EmptyState';
import { formatFecha } from '../utils/textSearch';

type SeccionReportes = 'catalogo' | 'vencimientos';
type FiltroVencimiento = 'TODAS' | 'VENCIDAS' | 'VIGENTES' | 'PRÓXIMAS A VENCER' | 'SIN VENCIMIENTO';

export const Reportes: React.FC = () => {
  const [seccion, setSeccion] = useState<SeccionReportes>('catalogo');
  const [filtroVencimiento, setFiltroVencimiento] = useState<FiltroVencimiento>('TODAS');

  const reportesDisponibles: ReporteItem[] = [
    {
      id: 'garantias-activas',
      codigo: 'RPT-01',
      titulo: 'Garantías activas',
      descripcion: 'Listado consolidado de todas las solicitudes de garantía vigentes.',
    },
    {
      id: 'garantias-por-propietario',
      codigo: 'RPT-02',
      titulo: 'Garantías por propietario',
      descripcion: 'Agrupación de bienes comprometidos clasificados por titular del registro.',
    },
    {
      id: 'garantias-por-prestatario',
      codigo: 'RPT-03',
      titulo: 'Garantías por prestatario',
      descripcion: 'Obligaciones y respaldos asociados por cuenta de prestatario.',
    },
    {
      id: 'garantias-farmer-rechnung',
      codigo: 'RPT-04',
      titulo: 'Garantías con Farmer Rechnung',
      descripcion: 'Operaciones constituidas directamente con Farmer Rechnung.',
    },
    {
      id: 'garantias-campo-grande',
      codigo: 'RPT-05',
      titulo: 'Garantías con Campo Grande',
      descripcion: 'Operaciones constituidas con Campo Grande.',
    },
    {
      id: 'garantias-clientes',
      codigo: 'RPT-06',
      titulo: 'Garantías con clientes',
      descripcion: 'Garantías otorgadas entre socios y particulares.',
    },
    {
      id: 'lotes-en-garantia',
      codigo: 'RPT-07',
      titulo: 'Lotes en garantía',
      descripcion: 'Detalle de cada parcela afectada en garantías activas.',
    },
    {
      id: 'hectareas-en-garantia',
      codigo: 'RPT-08',
      titulo: 'Hectáreas en garantía',
      descripcion: 'Cálculo de superficie total gravada en la Colonia.',
    },
    {
      id: 'hectareas-disponibles',
      codigo: 'RPT-09',
      titulo: 'Hectáreas disponibles',
      descripcion: 'Superficie de parcelas libres de gravamen.',
    },
    {
      id: 'bienes-en-garantia',
      codigo: 'RPT-09',
      titulo: 'Bienes en garantía',
      descripcion: 'Vehículos, maquinarias e implementos actualmente retenidos.',
    },
    {
      id: 'lotes-bloqueados',
      codigo: 'RPT-10',
      titulo: 'Lotes bloqueados',
      descripcion: 'Parcelas con restricción o bloqueo administrativo y sus motivos.',
    },
    {
      id: 'bienes-bloqueados',
      codigo: 'RPT-11',
      titulo: 'Bienes bloqueados',
      descripcion: 'Pólizas y maquinarias bloqueadas preventivamente.',
    },
    {
      id: 'reporte-general',
      codigo: 'RPT-12',
      titulo: 'Reporte general',
      descripcion: 'Informe institucional integral para auditoría y directorio.',
    },
  ];

  const [selectedReportId, setSelectedReportId] = useState<string>('garantias-activas');
  const [reportData, setReportData] = useState<{
    titulo: string;
    columnas: string[];
    filas: (string | number)[][];
    resumen?: Record<string, string | number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedReportInfo = reportesDisponibles.find((r) => r.id === selectedReportId);

  const handleGenerateReport = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getReporte(selectedReportId);
      if (data && Array.isArray(data.columnas) && Array.isArray(data.filas)) {
        setReportData({
          titulo: selectedReportInfo?.titulo || 'Reporte de Garantías',
          columnas: data.columnas,
          filas: data.filas,
          resumen: {
            'Total Registros': data.registros?.length || data.totalGarantias || 0,
            ...(data.hectareasEnGarantia > 0 ? { 'Hectáreas Comprometidas': `${data.hectareasEnGarantia} ha` } : {}),
            'Fecha Generación': new Date(data.generado).toLocaleDateString(),
          },
        });
      } else {
        setErrorMessage('No se pudo cargar la información para este reporte.');
        setReportData(null);
      }
    } catch {
      setErrorMessage('No se pudo cargar la información para este reporte.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateVencimientosReport = async (
    filtro: FiltroVencimiento = filtroVencimiento,
    forceRefresh: boolean = false
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await obtenerReporteVencimientos(filtro, forceRefresh);
      if (data && Array.isArray(data.columnas) && Array.isArray(data.filas)) {
        setReportData({
          titulo: `Reporte de Vencimientos — ${filtro}`,
          columnas: data.columnas,
          filas: data.filas,
          resumen: {
            'Filtro': filtro,
            'Total Garantías': data.totalGarantias || data.registros?.length || 0,
            'Fecha Generación': new Date(data.generado).toLocaleDateString(),
          },
        });
      } else {
        setErrorMessage('No se pudo cargar el reporte de vencimientos desde el backend.');
        setReportData(null);
      }
    } catch {
      setErrorMessage('No se pudo cargar la información para este reporte de vencimientos.');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!reportData || !Array.isArray(reportData.filas) || reportData.filas.length === 0) {
      alert('No hay datos disponibles para exportar.');
      return;
    }

    const headers = (Array.isArray(reportData.columnas) ? reportData.columnas : []).join(';');
    const rows = (Array.isArray(reportData.filas) ? reportData.filas : [])
      .map((row) => (Array.isArray(row) ? row : []).map((cell) => `"${cell}"`).join(';'))
      .join('\n');
    const csvContent = `data:text/csv;charset=utf-8,\uFEFF${headers}\n${rows}`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filenamePrefix = seccion === 'vencimientos' ? `vencimientos_${filtroVencimiento}` : selectedReportId;
    link.setAttribute('download', `${filenamePrefix}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderBadge = (cell: string | number) => {
    const text = String(cell);
    const lower = text.toLowerCase();
    if (lower === 'vigente') {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          Vigente
        </span>
      );
    }
    if (lower === 'próxima a vencer' || lower === 'proxima a vencer') {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          Próxima a vencer
        </span>
      );
    }
    if (lower === 'vencida') {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          Vencida
        </span>
      );
    }
    if (lower === 'sin vencimiento') {
      return (
        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
          Sin vencimiento
        </span>
      );
    }
    return text;
  };

  const filtrosVencimientoList: FiltroVencimiento[] = [
    'TODAS',
    'VENCIDAS',
    'VIGENTES',
    'PRÓXIMAS A VENCER',
    'SIN VENCIMIENTO',
  ];

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Módulo de Reportes Institucionales
            </h2>
            <p className="text-[11px] text-slate-500">
              Consultas consolidadas y generación de documentos para auditoría y directorio
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={!reportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!reportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Selector de Sección de Reportes */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 gap-2 text-xs select-none rounded-t border-t border-x">
        <button
          type="button"
          onClick={() => {
            setSeccion('catalogo');
            setReportData(null);
            setErrorMessage(null);
          }}
          className={`pb-2 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            seccion === 'catalogo'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Reportes Institucionales por Categoría</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSeccion('vencimientos');
            setReportData(null);
            setErrorMessage(null);
            handleGenerateVencimientosReport('TODAS');
          }}
          className={`pb-2 px-3 font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            seccion === 'vencimientos'
              ? 'border-emerald-800 text-emerald-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Reportes de Vencimientos</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Nuevo
          </span>
        </button>
      </div>

      {/* Contenido según Sección */}
      {seccion === 'catalogo' ? (
        /* SECCIÓN 1: CATÁLOGO DE REPORTES INSTITUCIONALES */
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Seleccione el Reporte a Generar (13 Tipos Disponibles)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <select
                value={selectedReportId}
                onChange={(e) => {
                  setSelectedReportId(e.target.value);
                  setReportData(null);
                  setErrorMessage(null);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 font-medium text-slate-800"
              >
                {reportesDisponibles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.codigo} — {r.titulo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={handleGenerateReport}
                disabled={isLoading}
                className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando reporte...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Generar Reporte</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {selectedReportInfo && (
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
              <FileText className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">{selectedReportInfo.titulo}:</strong>{' '}
                {selectedReportInfo.descripcion}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SECCIÓN 2: REPORTES DE VENCIMIENTOS */
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-800" />
                <span>Control y Estado de Vencimientos</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Consulta directa en Google Apps Script. Próxima a vencer considera garantías con caducidad en los próximos 30 días.
              </p>
            </div>

            <button
              onClick={() => handleGenerateVencimientosReport(filtroVencimiento, true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar Backend</span>
            </button>
          </div>

          {/* Filtros de Vencimiento */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Filtrar Garantías por Vencimiento:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {filtrosVencimientoList.map((filtro) => {
                const isSelected = filtroVencimiento === filtro;
                return (
                  <button
                    key={filtro}
                    type="button"
                    onClick={() => {
                      setFiltroVencimiento(filtro);
                      handleGenerateVencimientosReport(filtro, false);
                    }}
                    className={`py-2 px-2.5 text-xs font-bold rounded border transition text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>{filtro}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* ÁREA DE RESULTADOS */}
      {reportData && Array.isArray(reportData.filas) && Array.isArray(reportData.columnas) ? (
        <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 mb-4 gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                {reportData.titulo}
              </h3>
              <p className="text-[11px] text-slate-500">
                {reportData.filas.length} registros obtenidos desde Google Sheets
              </p>
            </div>

            {reportData.resumen && (
              <div className="flex flex-wrap gap-2 text-[11px]">
                {Object.entries(reportData.resumen).map(([k, v]) => (
                  <span
                    key={k}
                    className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 text-slate-700 font-medium"
                  >
                    <strong>{k}:</strong> {v}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-300 sticky top-0 z-10 shadow-2xs">
                <tr>
                  {reportData.columnas.map((col, idx) => (
                    <th key={idx} className="py-2 px-3 font-bold border-r border-slate-200 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.filas.length > 0 ? (
                  reportData.filas.map((fila, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                      {(Array.isArray(fila) ? fila : []).map((celda, cIdx) => {
                        const colName = reportData.columnas[cIdx] || '';
                        const isEstadoCol = colName.toLowerCase().includes('estado');
                        const isDateCol = colName.toLowerCase().includes('fecha');

                        return (
                          <td
                            key={cIdx}
                            className="py-1.5 px-3 border-r border-slate-100 font-mono text-[11px] whitespace-nowrap"
                          >
                            {isEstadoCol
                              ? renderBadge(celda)
                              : isDateCol && celda !== '—'
                              ? formatFecha(String(celda))
                              : celda}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={reportData.columnas.length}
                      className="py-12 text-center text-xs text-slate-400 italic"
                    >
                      No se encontraron garantías para este filtro o reporte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          type="backend-required"
          title={
            seccion === 'vencimientos'
              ? `Reporte de Vencimientos: ${filtroVencimiento}`
              : `Reporte: ${selectedReportInfo?.titulo || 'Reporte Institucional'}`
          }
          description="Presione 'Generar Reporte' o seleccione un filtro para consultar la información consolidada."
          onAction={
            seccion === 'vencimientos'
              ? () => handleGenerateVencimientosReport(filtroVencimiento)
              : handleGenerateReport
          }
          actionLabel="Consultar Reporte"
        />
      )}
    </div>
  );
};
