import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Tractor,
} from 'lucide-react';
import {
  Garantia,
  Cliente,
  Lote,
  Bien,
  GarantiaLoteRelacion,
  GarantiaBienRelacion,
  TipoGarantiaCon,
} from '../../types';
import {
  obtenerGarantiaCompleta,
  editarGarantia,
  getClientes,
  getLotes,
  getBienes,
} from '../../services/backend';
import { ClientSearchAutocomplete } from './ClientSearchAutocomplete';
import { formatHectareas } from '../../utils/textSearch';

interface EditarGarantiaModalProps {
  idGarantia: string;
  onClose: () => void;
  onSaved: () => void;
}

export const EditarGarantiaModal: React.FC<EditarGarantiaModalProps> = ({
  idGarantia,
  onClose,
  onSaved,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Datos principales
  const [numeroSolicitud, setNumeroSolicitud] = useState('');
  const [fecha, setFecha] = useState('');
  const [modalidad, setModalidad] = useState<'Simple' | 'Múltiple'>('Simple');
  const [selectedPropietario, setSelectedPropietario] = useState<Cliente | null>(null);
  const [selectedPrestatario, setSelectedPrestatario] = useState<Cliente | null>(null);
  const [garantiaConTipo, setGarantiaConTipo] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [selectedGarantiaCliente, setSelectedGarantiaCliente] = useState<Cliente | null>(null);
  const [observacion, setObservacion] = useState('');

  // Items
  const [lotes, setLotes] = useState<GarantiaLoteRelacion[]>([]);
  const [bienes, setBienes] = useState<GarantiaBienRelacion[]>([]);

  // Referencias para agregar
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [availableLotes, setAvailableLotes] = useState<Lote[]>([]);
  const [availableBienes, setAvailableBienes] = useState<Bien[]>([]);

  // Modales secundarios de selección
  const [isAddingLote, setIsAddingLote] = useState(false);
  const [isAddingBien, setIsAddingBien] = useState(false);
  const [tempLoteHa, setTempLoteHa] = useState<number>(0);
  const [tempLoteTarget, setTempLoteTarget] = useState<Lote | null>(null);
  const [tempLoteGarantiaCon, setTempLoteGarantiaCon] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [tempLoteCliente, setTempLoteCliente] = useState<Cliente | null>(null);

  const [tempBienValUSD, setTempBienValUSD] = useState<number>(0);
  const [tempBienTarget, setTempBienTarget] = useState<Bien | null>(null);
  const [tempBienGarantiaCon, setTempBienGarantiaCon] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [tempBienCliente, setTempBienCliente] = useState<Cliente | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadAll = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [garantiaFull, cRes, lRes, bRes] = await Promise.all([
          obtenerGarantiaCompleta(idGarantia),
          getClientes({ page: 1, pageSize: 1000 }),
          getLotes({ page: 1, pageSize: 1000 }),
          getBienes({ page: 1, pageSize: 1000 }),
        ]);

        if (!isMounted) return;

        setClientesList(Array.isArray(cRes?.data) ? cRes.data : []);
        setAvailableLotes(Array.isArray(lRes?.data) ? lRes.data : []);
        setAvailableBienes(Array.isArray(bRes?.data) ? bRes.data : []);

        if (garantiaFull) {
          setNumeroSolicitud(garantiaFull.numeroSolicitud);
          setFecha(garantiaFull.fecha ? garantiaFull.fecha.split('T')[0] : '');
          setModalidad(garantiaFull.modalidad === 'Múltiple' ? 'Múltiple' : 'Simple');
          setSelectedPropietario({
            cuenta: garantiaFull.cuentaPropietario,
            nombre: garantiaFull.propietario,
            ci: '',
          });
          setSelectedPrestatario({
            cuenta: garantiaFull.cuentaPrestatario,
            nombre: garantiaFull.prestatario,
            ci: '',
          });

          const gTipo = garantiaFull.garantiaConTipo || 'Farmer Rechnung';
          setGarantiaConTipo(gTipo);
          if (gTipo === 'Cliente' && garantiaFull.garantiaConCuenta) {
            setSelectedGarantiaCliente({
              cuenta: garantiaFull.garantiaConCuenta,
              nombre: garantiaFull.garantiaConNombre,
              ci: '',
            });
          }

          setObservacion(garantiaFull.observacion || '');
          setLotes(Array.isArray(garantiaFull.lotes) ? garantiaFull.lotes : []);
          setBienes(Array.isArray(garantiaFull.bienes) ? garantiaFull.bienes : []);
        } else {
          setErrorMessage('No se pudo encontrar la garantía seleccionada.');
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err.message || 'Error cargando datos.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [idGarantia]);

  const totalHectareas = lotes.reduce((acc, l) => acc + (Number(l.hectareas) || 0), 0);
  const totalValorUSD = bienes.reduce((acc, b) => acc + (Number(b.valorGarantiaUSD) || 0), 0);

  const handleRemoveLote = (idLote: string) => {
    setLotes((prev) => prev.filter((l) => l.idLote !== idLote));
  };

  const handleRemoveBien = (idBien: string) => {
    setBienes((prev) => prev.filter((b) => b.idBien !== idBien));
  };

  const handleConfirmAddLote = () => {
    if (!tempLoteTarget) return;
    if (tempLoteHa <= 0) {
      alert('Las hectáreas a poner en garantía deben ser mayores a 0.');
      return;
    }
    const gNombre =
      tempLoteGarantiaCon === 'Cliente' && tempLoteCliente
        ? `${tempLoteCliente.cuenta} — ${tempLoteCliente.nombre}`
        : tempLoteGarantiaCon;

    const gCuenta =
      tempLoteGarantiaCon === 'Cliente' && tempLoteCliente ? tempLoteCliente.cuenta : undefined;

    setLotes((prev) => [
      ...prev.filter((l) => l.idLote !== tempLoteTarget.idLote),
      {
        idGarantia,
        idLote: tempLoteTarget.idLote,
        numeroLote: tempLoteTarget.numeroLote,
        hectareas: tempLoteHa,
        propietario: tempLoteTarget.propietario,
        cuentaPropietario: tempLoteTarget.cuentaPropietario,
        ubicacion: tempLoteTarget.ubicacion,
        encargado: tempLoteTarget.encargado,
        garantiaConTipo: tempLoteGarantiaCon,
        garantiaConCuenta: gCuenta,
        garantiaConNombre: gNombre,
      },
    ]);

    setTempLoteTarget(null);
    setTempLoteHa(0);
    setIsAddingLote(false);
  };

  const handleConfirmAddBien = () => {
    if (!tempBienTarget) return;
    if (tempBienValUSD < 0) {
      alert('El valor en garantía debe ser un número válido.');
      return;
    }
    const gNombre =
      tempBienGarantiaCon === 'Cliente' && tempBienCliente
        ? `${tempBienCliente.cuenta} — ${tempBienCliente.nombre}`
        : tempBienGarantiaCon;

    const gCuenta =
      tempBienGarantiaCon === 'Cliente' && tempBienCliente ? tempBienCliente.cuenta : undefined;

    setBienes((prev) => [
      ...prev.filter((b) => b.idBien !== tempBienTarget.idBien),
      {
        idGarantia,
        idBien: tempBienTarget.idBien,
        numeroPoliza: tempBienTarget.numeroPoliza,
        tipoBien: tempBienTarget.tipoBien,
        descripcion: tempBienTarget.descripcion,
        marca: tempBienTarget.marca,
        modelo: tempBienTarget.modelo,
        placa: tempBienTarget.placa,
        propietario: tempBienTarget.propietario,
        cuentaPropietario: tempBienTarget.cuentaPropietario,
        ubicacion: tempBienTarget.ubicacion,
        valorGarantiaUSD: tempBienValUSD,
        garantiaConTipo: tempBienGarantiaCon,
        garantiaConCuenta: gCuenta,
        garantiaConNombre: gNombre,
      },
    ]);

    setTempBienTarget(null);
    setTempBienValUSD(0);
    setIsAddingBien(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedPrestatario) {
      setErrorMessage('Debe especificar el Prestatario.');
      return;
    }
    if (!selectedPropietario) {
      setErrorMessage('Debe especificar el Propietario.');
      return;
    }
    if (lotes.length === 0 && bienes.length === 0) {
      setErrorMessage('Debe contar con al menos un lote o bien en garantía.');
      return;
    }

    const gNombre =
      garantiaConTipo === 'Cliente' && selectedGarantiaCliente
        ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}`
        : garantiaConTipo;

    const gCuenta =
      garantiaConTipo === 'Cliente' && selectedGarantiaCliente
        ? selectedGarantiaCliente.cuenta
        : undefined;

    const tipoGarantiaCalculado =
      lotes.length > 0 && bienes.length > 0
        ? 'Terrenos y Bienes'
        : lotes.length > 0
        ? 'Terreno'
        : 'Bien';

    setIsSaving(true);
    try {
      const payload: Partial<Garantia> = {
        idGarantia,
        numeroSolicitud,
        fecha,
        cuentaPropietario: selectedPropietario.cuenta,
        propietario: selectedPropietario.nombre,
        cuentaPrestatario: selectedPrestatario.cuenta,
        prestatario: selectedPrestatario.nombre,
        garantiaConTipo,
        garantiaConCuenta: gCuenta,
        garantiaConNombre: gNombre,
        tipoGarantia: tipoGarantiaCalculado,
        modalidad,
        observacion: observacion.trim(),
        lotes,
        bienes,
      };

      await editarGarantia(payload);
      setSuccessMessage('Garantía actualizada correctamente.');
      setTimeout(() => {
        onSaved();
      }, 900);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo guardar la edición.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-2xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto max-h-[96vh]">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Editar Garantía — Solicitud N.º {numeroSolicitud || idGarantia}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">
            <span className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
            <p>Cargando datos completos de la garantía...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-red-800">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-emerald-900 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* SECCIÓN 1: DATOS GENERALES */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-3">
              <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                <span>Datos Generales de la Solicitud</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    N.º Solicitud (No editable)
                  </label>
                  <input
                    type="text"
                    value={numeroSolicitud}
                    disabled
                    className="w-full px-2.5 py-1.5 bg-slate-200 border border-slate-300 rounded font-mono font-bold text-slate-700 cursor-not-allowed text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Modalidad
                  </label>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setModalidad('Simple')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded border transition ${
                        modalidad === 'Simple'
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Simple
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalidad('Múltiple')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded border transition ${
                        modalidad === 'Múltiple'
                          ? 'bg-emerald-800 text-white border-emerald-900'
                          : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      Múltiple
                    </button>
                  </div>
                </div>
              </div>

              {/* Propietario y Prestatario */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <ClientSearchAutocomplete
                  label="Propietario del Bien o Parcela"
                  clientesList={clientesList}
                  selectedCuenta={selectedPropietario?.cuenta}
                  onSelect={setSelectedPropietario}
                  required
                />

                <ClientSearchAutocomplete
                  label="Prestatario (Cuenta en Garantía)"
                  clientesList={clientesList}
                  selectedCuenta={selectedPrestatario?.cuenta}
                  onSelect={setSelectedPrestatario}
                  required
                />
              </div>

              {/* Garantía con (cuando es Simple o general) */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Garantía Constituida Con {modalidad === 'Múltiple' && '(General)'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Farmer Rechnung', 'Campo Grande', 'Cliente'] as TipoGarantiaCon[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setGarantiaConTipo(tipo)}
                      className={`py-1.5 px-2 text-xs font-semibold rounded border transition text-center ${
                        garantiaConTipo === tipo
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tipo}
                    </button>
                  ))}
                </div>

                {garantiaConTipo === 'Cliente' && (
                  <div className="pt-2">
                    <ClientSearchAutocomplete
                      label="Cliente Receptor de la Garantía"
                      clientesList={clientesList}
                      selectedCuenta={selectedGarantiaCliente?.cuenta}
                      onSelect={setSelectedGarantiaCliente}
                      required
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: LISTA DE ITEMS (LOTES Y BIENES) */}
            <div className="p-3.5 bg-white border border-slate-300 rounded space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Items en Garantía ({lotes.length + bienes.length})</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTempLoteGarantiaCon(garantiaConTipo);
                      setTempLoteCliente(selectedGarantiaCliente);
                      setIsAddingLote(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Lote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempBienGarantiaCon(garantiaConTipo);
                      setTempBienCliente(selectedGarantiaCliente);
                      setIsAddingBien(true);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-100 hover:bg-blue-200 rounded border border-blue-300 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Bien</span>
                  </button>
                </div>
              </div>

              {/* TABLA COMPACTA DE ITEMS */}
              <div className="border border-slate-200 rounded overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-1.5 border-r border-slate-200">Item</th>
                      <th className="p-1.5 border-r border-slate-200">Tipo</th>
                      <th className="p-1.5 border-r border-slate-200 text-right">Cantidad / Valor</th>
                      <th className="p-1.5 border-r border-slate-200">Garantía con</th>
                      <th className="p-1.5 text-center w-16">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lotes.map((lote) => (
                      <tr key={`l-${lote.idLote}`} className="hover:bg-slate-50">
                        <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-emerald-950">
                          Lote {lote.numeroLote}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-slate-600">
                          Terreno / Parcela
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-900">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={lote.hectareas}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setLotes((prev) =>
                                prev.map((item) =>
                                  item.idLote === lote.idLote ? { ...item, hectareas: val } : item
                                )
                              );
                            }}
                            className="w-24 px-1.5 py-0.5 text-right font-mono border border-slate-300 rounded text-xs"
                          />{' '}
                          ha
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          {lote.garantiaConNombre || garantiaConTipo}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLote(lote.idLote)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {bienes.map((bien) => (
                      <tr key={`b-${bien.idBien}`} className="hover:bg-slate-50">
                        <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-blue-950">
                          {bien.numeroPoliza} — {bien.tipoBien}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-slate-600">
                          {bien.descripcion || bien.marca || 'Bien mueble'}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-950">
                          $us.{' '}
                          <input
                            type="number"
                            step="100"
                            min="0"
                            value={bien.valorGarantiaUSD || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setBienes((prev) =>
                                prev.map((item) =>
                                  item.idBien === bien.idBien ? { ...item, valorGarantiaUSD: val } : item
                                )
                              );
                            }}
                            className="w-28 px-1.5 py-0.5 text-right font-mono border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          {bien.garantiaConNombre || garantiaConTipo}
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBien(bien.idBien)}
                            className="p-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {lotes.length === 0 && bienes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                          No hay lotes ni bienes en esta garantía. Agregue al menos uno.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* TOTALES SEPARADOS */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
                <div>
                  <span className="text-slate-500 font-semibold">Superficie Total: </span>
                  <strong className="font-mono text-emerald-900">{formatHectareas(totalHectareas)}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Valor Total de Bienes: </span>
                  <strong className="font-mono text-emerald-900">
                    $us. {totalValorUSD.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>

            {/* OBSERVACIÓN */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Observación
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700 text-xs"
              />
            </div>

            {/* BOTONES ACCIÓN */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded border border-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MODAL AGREGAR LOTE */}
        {isAddingLote && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Añadir Lote a la Garantía</span>
                </span>
                <button onClick={() => setIsAddingLote(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Seleccionar Lote:</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                    value={tempLoteTarget?.idLote || ''}
                    onChange={(e) => {
                      const selected = availableLotes.find((l) => l.idLote === e.target.value) || null;
                      setTempLoteTarget(selected);
                      if (selected) {
                        const disp = selected.hectareasDisponibles !== undefined ? selected.hectareasDisponibles : selected.hectareas;
                        setTempLoteHa(disp);
                      }
                    }}
                  >
                    <option value="">-- Elija un lote --</option>
                    {availableLotes.map((lote) => {
                      const disp = lote.hectareasDisponibles !== undefined ? lote.hectareasDisponibles : lote.hectareas;
                      return (
                        <option
                          key={lote.idLote}
                          value={lote.idLote}
                          disabled={lote.estado === 'Bloqueado' || lote.estado === 'Inactivo'}
                        >
                          Lote {lote.numeroLote} — {lote.propietario} (Disp: {formatHectareas(disp)}) {lote.estado === 'Bloqueado' ? '[BLOQUEADO]' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {tempLoteTarget && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>Propietario: <strong>{tempLoteTarget.propietario}</strong></div>
                      <div>Ubicación: <strong>{tempLoteTarget.ubicacion || '—'}</strong></div>
                      <div>Hectáreas Totales: <strong>{formatHectareas(tempLoteTarget.hectareas)}</strong></div>
                      <div>Disponibles: <strong className="text-emerald-800">{formatHectareas(tempLoteTarget.hectareasDisponibles !== undefined ? tempLoteTarget.hectareasDisponibles : tempLoteTarget.hectareas)}</strong></div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Hectáreas a poner en garantía:
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={tempLoteHa}
                        onChange={(e) => setTempLoteHa(parseFloat(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                      />
                    </div>

                    {modalidad === 'Múltiple' && (
                      <div className="pt-2 border-t border-slate-200">
                        <label className="block font-bold text-slate-700 mb-1">
                          Garantía con para este lote:
                        </label>
                        <select
                          value={tempLoteGarantiaCon}
                          onChange={(e) => setTempLoteGarantiaCon(e.target.value as TipoGarantiaCon)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs mb-2"
                        >
                          <option value="Farmer Rechnung">Farmer Rechnung</option>
                          <option value="Campo Grande">Campo Grande</option>
                          <option value="Cliente">Cliente</option>
                        </select>
                        {tempLoteGarantiaCon === 'Cliente' && (
                          <ClientSearchAutocomplete
                            label="Cliente receptor"
                            clientesList={clientesList}
                            selectedCuenta={tempLoteCliente?.cuenta}
                            onSelect={setTempLoteCliente}
                            required
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingLote(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddLote}
                    disabled={!tempLoteTarget || tempLoteHa <= 0}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded disabled:opacity-50"
                  >
                    Confirmar Lote
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL AGREGAR BIEN */}
        {isAddingBien && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold uppercase">
                <span className="flex items-center gap-1.5">
                  <Tractor className="w-3.5 h-3.5 text-blue-400" />
                  <span>Añadir Bien a la Garantía</span>
                </span>
                <button onClick={() => setIsAddingBien(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Seleccionar Bien / Maquinaria:</label>
                  <select
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded"
                    value={tempBienTarget?.idBien || ''}
                    onChange={(e) => {
                      const selected = availableBienes.find((b) => b.idBien === e.target.value) || null;
                      setTempBienTarget(selected);
                      if (selected) {
                        setTempBienValUSD(selected.valorGarantiaUSD || 0);
                      }
                    }}
                  >
                    <option value="">-- Elija un bien --</option>
                    {availableBienes.map((bien) => (
                      <option
                        key={bien.idBien}
                        value={bien.idBien}
                        disabled={bien.estado === 'Bloqueado' || bien.estado === 'Inactivo'}
                      >
                        {bien.numeroPoliza} — {bien.tipoBien} {bien.descripcion || bien.marca} ({bien.propietario}) {bien.estado === 'Bloqueado' ? '[BLOQUEADO]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {tempBienTarget && (
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>Póliza: <strong>{tempBienTarget.numeroPoliza}</strong></div>
                      <div>Tipo: <strong>{tempBienTarget.tipoBien}</strong></div>
                      <div>Propietario: <strong>{tempBienTarget.propietario}</strong></div>
                      <div>Placa / Ubicación: <strong>{tempBienTarget.placa || tempBienTarget.ubicacion || '—'}</strong></div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        VALOR EN GARANTÍA ($us.):
                      </label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={tempBienValUSD}
                        onChange={(e) => setTempBienValUSD(parseFloat(e.target.value) || 0)}
                        placeholder="Ej: 50000"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-xs"
                      />
                    </div>

                    {modalidad === 'Múltiple' && (
                      <div className="pt-2 border-t border-slate-200">
                        <label className="block font-bold text-slate-700 mb-1">
                          Garantía con para este bien:
                        </label>
                        <select
                          value={tempBienGarantiaCon}
                          onChange={(e) => setTempBienGarantiaCon(e.target.value as TipoGarantiaCon)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs mb-2"
                        >
                          <option value="Farmer Rechnung">Farmer Rechnung</option>
                          <option value="Campo Grande">Campo Grande</option>
                          <option value="Cliente">Cliente</option>
                        </select>
                        {tempBienGarantiaCon === 'Cliente' && (
                          <ClientSearchAutocomplete
                            label="Cliente receptor"
                            clientesList={clientesList}
                            selectedCuenta={tempBienCliente?.cuenta}
                            onSelect={setTempBienCliente}
                            required
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingBien(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddBien}
                    disabled={!tempBienTarget || tempBienValUSD < 0}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded disabled:opacity-50"
                  >
                    Confirmar Bien
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
