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
} from 'lucide-react';
import { ReporteItem } from '../types';
import { getReporte } from '../services/backend';
import { EmptyState } from '../components/common/EmptyState';

export const Reportes: React.FC = () => {
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
    link.setAttribute('download', `${selectedReportId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={!reportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Selector de Tipo de Reporte */}
      <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
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
              className="w-full py-2 px-4 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 shadow-2xs"
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
          <div className="mt-3 p-2.5 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <FileText className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">{selectedReportInfo.titulo}:</strong>{' '}
              {selectedReportInfo.descripcion}
            </div>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* ÁREA DE RESULTADOS */}
      {reportData && Array.isArray(reportData.filas) && Array.isArray(reportData.columnas) ? (
        <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                {reportData.titulo}
              </h3>
              <p className="text-[11px] text-slate-500">
                {reportData.filas.length} registros incluidos
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-300">
                <tr>
                  {reportData.columnas.map((col, idx) => (
                    <th key={idx} className="py-1.5 px-3 font-bold border-r border-slate-200">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.filas.map((fila, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50">
                    {(Array.isArray(fila) ? fila : []).map((celda, cIdx) => (
                      <td key={cIdx} className="py-1.5 px-3 border-r border-slate-100 font-mono text-[11px]">
                        {celda}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          type="backend-required"
          title={`Reporte: ${selectedReportInfo?.titulo || 'Reporte Institucional'}`}
          description="Presione 'Generar Reporte' para consultar la información consolidada."
          onAction={handleGenerateReport}
          actionLabel="Consultar Reporte"
        />
      )}
    </div>
  );
};
