import React, { useState, useEffect } from 'react';
import { Printer, Download, X, ShieldCheck, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { Garantia, GarantiaLiberada, GarantiaLoteRelacion, GarantiaBienRelacion } from '../types';
import { formatFecha, formatHectareas, formatPropietario } from '../utils/textSearch';
import { obtenerGarantiaCompleta, obtenerGarantiaLiberadaCompleta } from '../services/backend';

interface ImpresionGarantiaProps {
  garantia: Garantia | GarantiaLiberada;
  isLiberada?: boolean;
  fechaLiberacion?: string;
  onClose: () => void;
}

interface UniqueSigner {
  key: string;
  nombre: string;
  cuenta: string;
  isPrestatario: boolean;
  isPropietario: boolean;
}

export const ImpresionGarantia: React.FC<ImpresionGarantiaProps> = ({
  garantia: garantiaProp,
  isLiberada: isLiberadaProp,
  fechaLiberacion: fechaLiberacionProp,
  onClose,
}) => {
  const isLiberada = isLiberadaProp || !!(garantiaProp as GarantiaLiberada).fechaLiberacion;
  const fechaLiberacion = fechaLiberacionProp || (garantiaProp as GarantiaLiberada).fechaLiberacion;

  // CAMPO TEMPORAL: IDENTIFICACIÓN (CI / Documento)
  // No se guarda en base de datos. Vive únicamente en el estado local de esta sesión.
  const [identificacionTemporal, setIdentificacionTemporal] = useState('');

  // Estados de carga de datos completos desde el backend
  const [fullGarantia, setFullGarantia] = useState<Garantia | GarantiaLiberada | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function cargarGarantiaCompleta() {
      if (
        Array.isArray(garantiaProp.lotes) &&
        garantiaProp.lotes.length > 0 &&
        Array.isArray(garantiaProp.bienes)
      ) {
        if (isMounted) {
          setFullGarantia(garantiaProp);
          setIsLoading(false);
        }
        return;
      }

      if (!garantiaProp.idGarantia) {
        if (isMounted) {
          setFullGarantia(garantiaProp);
          setIsLoading(false);
        }
        return;
      }

      if (isMounted) {
        setIsLoading(true);
        setErrorCarga(null);
      }

      try {
        let result: Garantia | GarantiaLiberada | null = null;
        if (isLiberada) {
          result = await obtenerGarantiaLiberadaCompleta(garantiaProp.idGarantia, true);
        } else {
          result = await obtenerGarantiaCompleta(garantiaProp.idGarantia, true);
        }

        if (!isMounted) return;

        if (result) {
          setFullGarantia(result);
        } else {
          setFullGarantia(garantiaProp);
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error al cargar datos completos de garantía para impresión:', err);
        setErrorCarga(
          err?.message || 'No se pudieron recuperar los elementos vinculados desde el servidor.'
        );
        setFullGarantia(garantiaProp);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    cargarGarantiaCompleta();

    return () => {
      isMounted = false;
    };
  }, [garantiaProp, isLiberada]);

  const handlePrint = () => {
    window.print();
  };

  const currentGarantia = fullGarantia || garantiaProp;

  const lotes: GarantiaLoteRelacion[] = Array.isArray(currentGarantia.lotes)
    ? currentGarantia.lotes
    : [];
  const bienes: GarantiaBienRelacion[] = Array.isArray(currentGarantia.bienes)
    ? currentGarantia.bienes
    : [];

  const hasLotes = lotes.length > 0;
  const hasBienes = bienes.length > 0;
  const hasItems = hasLotes || hasBienes;

  const totalHectareas = hasLotes
    ? lotes.reduce((acc, l) => acc + (Number(l.hectareas) || 0), 0)
    : 0;

  const totalValorUSD = hasBienes
    ? bienes.reduce((acc, b) => acc + (Number(b.valorGarantiaUSD) || 0), 0)
    : 0;

  let documentTitle = 'GARANTÍA DE BIENES';
  if (hasLotes && !hasBienes) {
    documentTitle = 'GARANTÍA DE PARCELAS';
  } else if (hasLotes && hasBienes) {
    documentTitle = 'GARANTÍA DE BIENES Y PARCELAS';
  }

  // Consolidar propietarios únicos
  const distinctOwnersMap = new Map<string, { cuenta: string; nombre: string }>();

  lotes.forEach((l) => {
    const pNombre = (l.propietario || '').trim();
    const pCuenta =
      l.cuentaPropietario !== undefined && l.cuentaPropietario !== null
        ? String(l.cuentaPropietario).trim()
        : '';
    if (pNombre || pCuenta) {
      const key = pCuenta ? `cta:${pCuenta}` : `nom:${pNombre.toLowerCase()}`;
      if (!distinctOwnersMap.has(key)) {
        distinctOwnersMap.set(key, { cuenta: pCuenta, nombre: pNombre });
      }
    }
  });

  bienes.forEach((b) => {
    const pNombre = (b.propietario || '').trim();
    const pCuenta =
      b.cuentaPropietario !== undefined && b.cuentaPropietario !== null
        ? String(b.cuentaPropietario).trim()
        : '';
    if (pNombre || pCuenta) {
      const key = pCuenta ? `cta:${pCuenta}` : `nom:${pNombre.toLowerCase()}`;
      if (!distinctOwnersMap.has(key)) {
        distinctOwnersMap.set(key, { cuenta: pCuenta, nombre: pNombre });
      }
    }
  });

  // Si no hay lotes ni bienes en los datos, agregar el propietario base si existe
  if (distinctOwnersMap.size === 0) {
    const baseProp = (currentGarantia.propietario || '').trim();
    const baseCuenta =
      currentGarantia.cuentaPropietario !== undefined && currentGarantia.cuentaPropietario !== null
        ? String(currentGarantia.cuentaPropietario).trim()
        : '';
    if (baseProp || baseCuenta) {
      const key = baseCuenta ? `cta:${baseCuenta}` : `nom:${baseProp.toLowerCase()}`;
      distinctOwnersMap.set(key, { cuenta: baseCuenta, nombre: baseProp });
    }
  }

  const distinctOwners = Array.from(distinctOwnersMap.values());

  // Prestatario
  const cuentaPrest = String(currentGarantia.cuentaPrestatario || '').trim();
  const nomPrest = String(currentGarantia.prestatario || '').trim();
  const prestatarioKey = cuentaPrest ? `cta:${cuentaPrest}` : `nom:${nomPrest.toLowerCase()}`;

  // CONSOLIDAR PERSONAS ÚNICAS QUE FIRMAN (SIN DUPLICAR NINGUNA PERSONA POR CUENTA)
  const signersMap = new Map<string, UniqueSigner>();

  // 1. Agregar propietarios
  distinctOwners.forEach((owner) => {
    const oCuenta = String(owner.cuenta || '').trim();
    const oNombre = String(owner.nombre || '').trim();
    const oKey = oCuenta ? `cta:${oCuenta}` : `nom:${oNombre.toLowerCase()}`;

    if (!oKey || oKey === 'nom:') return;

    const matchesPrestatario = oKey === prestatarioKey;

    signersMap.set(oKey, {
      key: oKey,
      nombre: oNombre,
      cuenta: oCuenta,
      isPrestatario: matchesPrestatario,
      isPropietario: true,
    });
  });

  // 2. Agregar prestatario
  if (nomPrest || cuentaPrest) {
    if (signersMap.has(prestatarioKey)) {
      const existing = signersMap.get(prestatarioKey)!;
      existing.isPrestatario = true;
      if (!existing.nombre) existing.nombre = nomPrest;
      if (!existing.cuenta) existing.cuenta = cuentaPrest;
    } else {
      signersMap.set(prestatarioKey, {
        key: prestatarioKey,
        nombre: nomPrest,
        cuenta: cuentaPrest,
        isPrestatario: true,
        isPropietario: false,
      });
    }
  }

  const uniqueSigners = Array.from(signersMap.values());

  // Determinar si la única persona involucrada es a la vez propietario y prestatario
  const isSamePerson =
    uniqueSigners.length === 1 &&
    uniqueSigners[0].isPrestatario &&
    uniqueSigners[0].isPropietario;

  // Consolidar Acreedores
  const acreedoresSet = new Set<string>();
  lotes.forEach((l) => {
    const acr = (l.garantiaConNombre || currentGarantia.garantiaConNombre || '').trim();
    if (acr) acreedoresSet.add(acr);
  });
  bienes.forEach((b) => {
    const acr = (b.garantiaConNombre || currentGarantia.garantiaConNombre || '').trim();
    if (acr) acreedoresSet.add(acr);
  });
  if (acreedoresSet.size === 0 && currentGarantia.garantiaConNombre) {
    acreedoresSet.add(currentGarantia.garantiaConNombre.trim());
  }

  const isMultipleAcreedores = acreedoresSet.size > 1;
  const mainAcreedor = isMultipleAcreedores
    ? 'MÚLTIPLES ACREEDORES'
    : Array.from(acreedoresSet)[0] || currentGarantia.garantiaConNombre || 'FARMER RECHNUNG';

  // Texto legal adaptado
  let propietarioLegalTexto = 'el Propietario declara y certifica';
  if (isSamePerson) {
    propietarioLegalTexto = 'el Propietario y Prestatario declara y certifica';
  } else if (distinctOwners.length > 1) {
    propietarioLegalTexto = 'los Propietarios declaran y certifican';
  }

  let prestatarioLegalTexto = `por el Prestatario con Cuenta en Garantía N.º ${
    currentGarantia.cuentaPrestatario || '—'
  } (${currentGarantia.prestatario || ''})`;
  if (isSamePerson) {
    prestatarioLegalTexto = `por su Cuenta en Garantía N.º ${currentGarantia.cuentaPrestatario || '—'}`;
  }

  let acreedorLegalTexto = mainAcreedor;
  if (isMultipleAcreedores) {
    acreedorLegalTexto = 'los Acreedores indicados en el detalle adjunto';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:block">
      {/* Configuración de Impresión en Tamaño CARTA (Letter) */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 10mm 12mm 10mm 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
          }
          tr, .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Contenedor Modal */}
      <div className="print-container w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Barra de control superior (No imprimible) */}
        <div className="print:hidden bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Vista Previa de Impresión Oficial (Carta / Letter) — Asoc. Civil "Colonia Chihuahua"
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoading || !hasItems}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed rounded transition shadow-2xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={isLoading || !hasItems}
              title="Utilice la opción Guardar como PDF en el diálogo de impresión"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed rounded transition border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Guardar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar vista de impresión"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel de campo temporal CI / Documento (No imprimible) */}
        <div className="print:hidden p-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-900 font-medium">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>Campo Temporal:</strong> Ingrese el N.º de Identificación / CI para completar el documento impreso (no se guarda en la base de datos).
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

        {/* Banner Estado de Carga (No imprimible) */}
        {isLoading && (
          <div className="print:hidden p-4 bg-blue-50 border-b border-blue-200 text-blue-900 flex items-center justify-center gap-2 text-xs font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
            <span>Cargando los detalles de lotes y bienes desde el servidor...</span>
          </div>
        )}

        {/* Banner Error de Carga (No imprimible & Impresion) */}
        {errorCarga && !isLoading && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-900 flex items-center gap-2 text-xs font-medium">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>
              <strong>Error de conexión / carga:</strong> {errorCarga}
            </span>
          </div>
        )}

        {/* Banner Advertencia cuando NO hay elementos vinculados */}
        {!isLoading && !hasItems && !errorCarga && (
          <div className="p-3 bg-amber-100 border-b border-amber-300 text-amber-950 flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
            <span>
              <strong>ADVERTENCIA:</strong> Esta garantía no tiene terrenos ni bienes registrados en la base de datos. No se puede imprimir un documento incompleto.
            </span>
          </div>
        )}

        {/* HOJA DE DOCUMENTO IMPRIMIBLE (Formato Carta / Letter Colonia Chihuahua) */}
        <div className="overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 print:p-0 print:m-0 print:overflow-visible font-serif text-[11pt] leading-normal select-text relative">
          {isLiberada && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] select-none z-0 overflow-hidden">
              <span className="text-7xl sm:text-9xl font-black uppercase tracking-widest text-slate-900 -rotate-45">
                LIBERADA
              </span>
            </div>
          )}

          {/* Encabezado Oficial */}
          <div className="text-center pb-3 border-b-2 border-slate-900 mb-4 relative z-10">
            <h1 className="text-base sm:text-lg font-black uppercase tracking-wider">
              ASOCIACIÓN CIVIL "COLONIA CHIHUAHUA"
            </h1>
            <p className="text-[10pt] font-semibold tracking-widest uppercase text-slate-700 mt-0.5">
              DEPARTAMENTO DE ADMINISTRACIÓN Y REGISTRO DE PARCELAS
            </p>
            <div className="mt-2 flex flex-col items-center gap-1">
              <div className="inline-block border-2 border-slate-900 px-5 py-0.5 font-black text-sm uppercase tracking-wider bg-slate-50">
                {documentTitle}
              </div>
              {isLiberada && (
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-amber-50 border border-amber-300 text-amber-900 font-sans font-bold text-[11px] uppercase tracking-wider rounded">
                  <span>COPIA DE CONSULTA — GARANTÍA LIBERADA</span>
                </div>
              )}
            </div>
            <div className="mt-2 text-right text-xs font-mono">
              <strong>N.º Solicitud:</strong> {currentGarantia.numeroSolicitud || '—'} &nbsp;|&nbsp;{' '}
              <strong>Fecha:</strong> {formatFecha(currentGarantia.fecha)}
              {isLiberada && fechaLiberacion && (
                <>
                  {' '}&nbsp;|&nbsp;{' '}
                  <strong className="text-amber-900">Liberada el:</strong> {formatFecha(fechaLiberacion)}
                </>
              )}
            </div>
          </div>

          {/* CUERPO DEL DOCUMENTO */}
          <div className="space-y-4 text-xs sm:text-sm font-sans">
            {/* SECCIÓN 1: DATOS DEL PROPIETARIO / PROPIETARIO Y PRESTATARIO */}
            <div className="border border-slate-400 rounded p-3 bg-slate-50/40 avoid-break">
              {isSamePerson ? (
                <>
                  <div className="font-bold uppercase text-[11px] tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                    1. DATOS DEL PROPIETARIO Y PRESTATARIO
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-600">Número de Cuenta: </span>
                      <strong className="font-mono text-slate-900">{cuentaPrest || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600">Nombre Completo: </span>
                      <strong className="text-slate-900">{nomPrest || '—'}</strong>
                    </div>
                    {identificacionTemporal && (
                      <div className="col-span-1 sm:col-span-2 text-slate-800 pt-0.5">
                        <span className="text-slate-600">Identificación / Documento: </span>
                        <strong className="font-mono text-slate-900">{identificacionTemporal}</strong>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold uppercase text-[11px] tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                    {distinctOwners.length > 1
                      ? '1. Datos de los Propietarios de los Bienes o Parcelas (Operación Múltiple)'
                      : '1. Datos del Propietario del Bien o Parcela'}
                  </div>
                  {distinctOwners.length > 1 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {distinctOwners.map((owner, idx) => (
                        <div key={idx} className="p-2 bg-white border border-slate-200 rounded">
                          <div>
                            <span className="text-slate-600">Propietario {idx + 1}: </span>
                            <strong className="text-slate-900">{owner.nombre || '—'}</strong>
                          </div>
                          <div>
                            <span className="text-slate-600">Número de Cuenta: </span>
                            <strong className="font-mono text-slate-900">{owner.cuenta || '—'}</strong>
                          </div>
                        </div>
                      ))}
                      {identificacionTemporal && (
                        <div className="col-span-1 sm:col-span-2 text-slate-800 pt-1">
                          <span className="text-slate-600">Identificación / Documento: </span>
                          <strong className="font-mono text-slate-900">{identificacionTemporal}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-600">Número de Cuenta: </span>
                        <strong className="font-mono text-slate-900">
                          {distinctOwners[0]?.cuenta || currentGarantia.cuentaPropietario || '—'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-600">Nombre Completo: </span>
                        <strong className="text-slate-900">
                          {distinctOwners[0]?.nombre || currentGarantia.propietario || '—'}
                        </strong>
                      </div>
                      {identificacionTemporal && (
                        <div className="col-span-1 sm:col-span-2 text-slate-800">
                          <span className="text-slate-600">Identificación / Documento: </span>
                          <strong className="font-mono text-slate-900">{identificacionTemporal}</strong>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* SECCIÓN 2: BIENES Y LOTES AFECTADOS */}
            <div className="border border-slate-400 rounded p-3 space-y-3">
              <div className="font-bold uppercase text-[11px] tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                2. Detalle de Bienes y/o Parcelas en Garantía
              </div>

              {/* Lotes / Parcelas */}
              {hasLotes && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-900 flex items-center justify-between">
                    <span>TERRENOS / PARCELAS COMPROMETIDAS:</span>
                    <span className="font-mono text-xs">
                      Subtotal: <strong>{formatHectareas(totalHectareas)}</strong>
                    </span>
                  </div>
                  <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-900">
                      <tr>
                        <th className="p-1.5 border-r border-slate-300 w-8 text-center">N.º</th>
                        <th className="p-1.5 border-r border-slate-300">N.º Parcela</th>
                        <th className="p-1.5 border-r border-slate-300">Propietario</th>
                        <th className="p-1.5 border-r border-slate-300 text-right">Sup. Comprom.</th>
                        <th className="p-1.5 border-r border-slate-300">Ubicación</th>
                        <th className="p-1.5">Garantía Constituida Con</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-normal">
                      {lotes.map((lote, i) => (
                        <tr key={i} className="avoid-break">
                          <td className="p-1.5 font-mono text-center border-r border-slate-200 text-slate-500 font-bold">
                            {i + 1}
                          </td>
                          <td className="p-1.5 font-bold font-mono border-r border-slate-200 text-slate-900">
                            {lote.numeroLote || '—'}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-slate-900 font-medium">
                            {formatPropietario(lote.propietario, lote.cuentaPropietario)}
                          </td>
                          <td className="p-1.5 font-mono text-right border-r border-slate-200 font-bold text-slate-900">
                            {formatHectareas(lote.hectareas)}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-slate-800">{lote.ubicacion || '—'}</td>
                          <td className="p-1.5 font-semibold text-slate-900">
                            {lote.garantiaConNombre || currentGarantia.garantiaConNombre || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Vehicles, Machinery & Goods */}
              {hasBienes && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-900 flex items-center justify-between">
                    <span>VEHÍCULOS, MAQUINARIAS E IMPLEMENTOS:</span>
                    <span className="font-mono text-xs text-slate-900">
                      Subtotal:{' '}
                      <strong>
                        $us.{' '}
                        {totalValorUSD.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </span>
                  </div>
                  <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-900">
                      <tr>
                        <th className="p-1.5 border-r border-slate-300 w-8 text-center">N.º</th>
                        <th className="p-1.5 border-r border-slate-300">Tipo y Descripción</th>
                        <th className="p-1.5 border-r border-slate-300">N.º Póliza / Reg.</th>
                        <th className="p-1.5 border-r border-slate-300">Propietario</th>
                        <th className="p-1.5 border-r border-slate-300 text-right">Valor Garantía ($us.)</th>
                        <th className="p-1.5 border-r border-slate-300">Placa / Ubicación</th>
                        <th className="p-1.5">Garantía Constituida Con</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-normal">
                      {bienes.map((bien, i) => {
                        const valUSD = Number(bien.valorGarantiaUSD) || 0;
                        const descCompleta = [
                          bien.tipoBien,
                          bien.descripcion,
                          bien.marca ? `Marca: ${bien.marca}` : null,
                          bien.modelo ? `Mod: ${bien.modelo}` : null,
                        ]
                          .filter(Boolean)
                          .join(' — ');

                        return (
                          <tr key={i} className="avoid-break">
                            <td className="p-1.5 font-mono text-center border-r border-slate-200 text-slate-500 font-bold">
                              {i + 1}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 font-medium text-slate-900">
                              {descCompleta || 'Bien en garantía'}
                            </td>
                            <td className="p-1.5 font-bold font-mono border-r border-slate-200 text-slate-900">
                              {bien.numeroPoliza || '—'}
                            </td>
                            <td className="p-1.5 border-r border-slate-200 text-slate-900 font-medium">
                              {formatPropietario(bien.propietario, bien.cuentaPropietario)}
                            </td>
                            <td className="p-1.5 font-mono text-right font-bold text-slate-900 border-r border-slate-200">
                              {valUSD > 0
                                ? `$us. ${valUSD.toLocaleString('es-BO', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}`
                                : '—'}
                            </td>
                            <td className="p-1.5 font-mono text-slate-800 border-r border-slate-200">
                              {bien.placa ? `Placa: ${bien.placa}` : bien.ubicacion || '—'}
                            </td>
                            <td className="p-1.5 font-semibold text-slate-900">
                              {bien.garantiaConNombre || currentGarantia.garantiaConNombre || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* RESUMEN CONSOLIDADO DE TOTALES */}
              {hasItems && (
                <div className="bg-slate-100 p-2.5 rounded border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs avoid-break">
                  {hasLotes && (
                    <div>
                      <span className="text-slate-700 uppercase font-bold text-[10px]">
                        Superficie Total Comprometida en Garantía:{' '}
                      </span>
                      <strong className="font-mono text-sm text-slate-950 ml-1">
                        {formatHectareas(totalHectareas)}
                      </strong>
                    </div>
                  )}
                  {hasBienes && (
                    <div>
                      <span className="text-slate-700 uppercase font-bold text-[10px]">
                        Valor Total de Bienes en Garantía:{' '}
                      </span>
                      <strong className="font-mono text-sm text-slate-950 ml-1">
                        $us.{' '}
                        {totalValorUSD.toLocaleString('es-BO', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 3: PRESTATARIO / ACREEDOR Y DESTINO DE GARANTÍA */}
            <div className="border border-slate-400 rounded p-3 bg-slate-50/40 avoid-break">
              {isSamePerson ? (
                <>
                  <div className="font-bold uppercase text-[11px] tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                    3. DESTINO DE LA GARANTÍA Y ACREEDOR
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-slate-600">Garantía Constituida Con: </span>
                      <strong className="text-slate-950 font-bold uppercase">{mainAcreedor}</strong>
                      {isMultipleAcreedores && (
                        <span className="text-[10px] text-slate-600 italic ml-1">
                          (Ver acreedor específico en la tabla detallada arriba)
                        </span>
                      )}
                    </div>
                    {currentGarantia.observacion && (
                      <div className="col-span-1 sm:col-span-2 pt-1 border-t border-slate-200 text-slate-800 italic">
                        <span className="text-slate-600 font-semibold not-italic">Observación: </span>
                        {currentGarantia.observacion}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold uppercase text-[11px] tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                    3. Datos del Prestatario y Destino de Garantía
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-600">Cuenta en Garantía (Prestatario): </span>
                      <strong className="font-mono text-slate-900">{cuentaPrest || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-600">Nombre del Prestatario: </span>
                      <strong className="text-slate-900">{nomPrest || '—'}</strong>
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-slate-600">Garantía Constituida Con: </span>
                      <strong className="text-slate-950 font-bold uppercase">{mainAcreedor}</strong>
                      {isMultipleAcreedores && (
                        <span className="text-[10px] text-slate-600 italic ml-1">
                          (Ver acreedor específico en la tabla detallada arriba)
                        </span>
                      )}
                    </div>
                    {currentGarantia.observacion && (
                      <div className="col-span-1 sm:col-span-2 pt-1 border-t border-slate-200 text-slate-800 italic">
                        <span className="text-slate-600 font-semibold not-italic">Observación: </span>
                        {currentGarantia.observacion}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* TEXTO INSTITUCIONAL FORMAL */}
            <div className="p-3 border border-slate-300 rounded text-[10.5pt] text-justify leading-relaxed text-slate-800 font-serif avoid-break">
              Por el presente documento, {propietarioLegalTexto} que los bienes y/o parcelas descritos precedentemente quedan gravados en calidad de garantía institucional en favor de <strong>{acreedorLegalTexto}</strong> para respaldar las obligaciones financieras y comerciales contraídas {prestatarioLegalTexto}. Los bienes gravados no podrán ser enajenados, cedidos ni transferidos sin previa autorización formal y liberación de gravamen emitida por la Administración de la Colonia Chihuahua.
            </div>

            {/* SECCIÓN DE FIRMAS DESDOPLADAS SIN DUPLICACIÓN DE PERSONAS NI RESPONSABLE DE REGISTRO */}
            <div className="pt-10 pb-4 avoid-break">
              <div
                className={`grid gap-6 text-center text-xs ${
                  uniqueSigners.length === 1
                    ? 'grid-cols-1 max-w-xs mx-auto'
                    : uniqueSigners.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                }`}
              >
                {uniqueSigners.map((signer, idx) => {
                  let tituloFirma = 'FIRMA DEL PROPIETARIO';
                  if (signer.isPropietario && signer.isPrestatario) {
                    tituloFirma = 'FIRMA DEL PROPIETARIO Y PRESTATARIO';
                  } else if (signer.isPrestatario && !signer.isPropietario) {
                    tituloFirma = 'FIRMA DEL INTERESADO / PRESTATARIO';
                  }

                  return (
                    <div key={idx} className="border-t border-slate-800 pt-2 px-2 avoid-break">
                      <div className="font-bold uppercase tracking-wider text-slate-900 text-[11px]">
                        {tituloFirma}
                      </div>
                      <div className="text-[11px] text-slate-800 mt-1 font-mono font-semibold">
                        {signer.nombre || '—'}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        Cuenta: {signer.cuenta || '—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
