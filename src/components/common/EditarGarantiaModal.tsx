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
import { SeleccionarLoteModal } from './SeleccionarLoteModal';
import { SeleccionarBienModal } from './SeleccionarBienModal';
import { formatHectareas, formatPropietario, parseDecimal } from '../../utils/textSearch';

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
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [modalidad, setModalidad] = useState<'Simple' | 'Múltiple'>('Simple');
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

  // Modales de selección unificados
  const [isAddingLote, setIsAddingLote] = useState(false);
  const [isAddingBien, setIsAddingBien] = useState(false);
  const [originalLotes, setOriginalLotes] = useState<{ idLote: string | number; hectareas: number }[]>([]);
  const [originalBienIds, setOriginalBienIds] = useState<(string | number)[]>([]);

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

        const cList = Array.isArray(cRes?.data) ? cRes.data : [];
        const lList = Array.isArray(lRes?.data) ? lRes.data : [];
        const bList = Array.isArray(bRes?.data) ? bRes.data : [];

        setClientesList(cList);
        setAvailableLotes(lList);
        setAvailableBienes(bList);

        if (garantiaFull) {
          setNumeroSolicitud(garantiaFull.numeroSolicitud || '');
          setFecha(garantiaFull.fecha ? garantiaFull.fecha.split('T')[0] : '');
          setFechaVencimiento(
            garantiaFull.fechaVencimiento ? garantiaFull.fechaVencimiento.split('T')[0] : ''
          );
          setModalidad(garantiaFull.modalidad === 'Múltiple' ? 'Múltiple' : 'Simple');
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

          const rawLotes = Array.isArray(garantiaFull.lotes) ? garantiaFull.lotes : [];
          setOriginalLotes(
            rawLotes.map((l) => ({ idLote: l.idLote, hectareas: Number(l.hectareas) || 0 }))
          );
          const lotesEnriquecidos = rawLotes.map((lote) => {
            const masterLote = lList.find((l) => String(l.idLote) === String(lote.idLote));
            return {
              ...lote,
              propietario: lote.propietario || masterLote?.propietario || '',
              cuentaPropietario: lote.cuentaPropietario ?? masterLote?.cuentaPropietario ?? '',
            };
          });
          setLotes(lotesEnriquecidos);

          const rawBienes = Array.isArray(garantiaFull.bienes) ? garantiaFull.bienes : [];
          setOriginalBienIds(rawBienes.map((b) => b.idBien));
          const bienesEnriquecidos = rawBienes.map((bien) => {
            const masterBien = bList.find((b) => String(b.idBien) === String(bien.idBien));
            return {
              ...bien,
              propietario: bien.propietario || masterBien?.propietario || '',
              cuentaPropietario: bien.cuentaPropietario ?? masterBien?.cuentaPropietario ?? '',
            };
          });
          setBienes(bienesEnriquecidos);
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

  const handleSelectLoteFromModal = (loteRel: GarantiaLoteRelacion) => {
    setLotes((prev) => [
      ...prev.filter((l) => String(l.idLote) !== String(loteRel.idLote)),
      { ...loteRel, idGarantia },
    ]);
  };

  const handleSelectBienFromModal = (bienRel: GarantiaBienRelacion) => {
    setBienes((prev) => [
      ...prev.filter((b) => String(b.idBien) !== String(bienRel.idBien)),
      { ...bienRel, idGarantia },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedPrestatario) {
      setErrorMessage('Debe especificar el Prestatario.');
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

    // Obtener consolidado de propietarios únicos a partir de los lotes y bienes
    const ownersMap = new Map<string, { cuenta: string | number; nombre: string }>();

    for (const l of lotes) {
      const pNombre = (l.propietario || '').trim();
      const pCuenta =
        l.cuentaPropietario !== undefined && l.cuentaPropietario !== null
          ? String(l.cuentaPropietario).trim()
          : '';
      if (pNombre || pCuenta) {
        const key = pCuenta ? `cta:${pCuenta}` : `nom:${pNombre}`;
        if (!ownersMap.has(key)) {
          ownersMap.set(key, { cuenta: l.cuentaPropietario ?? '', nombre: pNombre });
        }
      }
    }

    for (const b of bienes) {
      const pNombre = (b.propietario || '').trim();
      const pCuenta =
        b.cuentaPropietario !== undefined && b.cuentaPropietario !== null
          ? String(b.cuentaPropietario).trim()
          : '';
      if (pNombre || pCuenta) {
        const key = pCuenta ? `cta:${pCuenta}` : `nom:${pNombre}`;
        if (!ownersMap.has(key)) {
          ownersMap.set(key, { cuenta: b.cuentaPropietario ?? '', nombre: pNombre });
        }
      }
    }

    const distinctOwners = Array.from(ownersMap.values());
    let mainPropNombre = '—';
    let mainPropCuenta: string | number = '';
    if (distinctOwners.length === 1) {
      mainPropNombre = distinctOwners[0].nombre;
      mainPropCuenta = distinctOwners[0].cuenta;
    } else if (distinctOwners.length > 1) {
      mainPropNombre = distinctOwners.map((o) => o.nombre || `Cuenta ${o.cuenta}`).join(' / ');
      mainPropCuenta = distinctOwners.map((o) => o.cuenta).filter((c) => c !== '').join(' / ');
    }

    setIsSaving(true);
    try {
      const payload: Partial<Garantia> = {
        idGarantia,
        numeroSolicitud: numeroSolicitud.trim(),
        fecha,
        fechaVencimiento: fechaVencimiento || '',
        cuentaPropietario: mainPropCuenta,
        propietario: mainPropNombre,
        cuentaPrestatario: selectedPrestatario.cuenta,
        prestatario: selectedPrestatario.nombre,
        garantiaConTipo: modalidad === 'Múltiple' ? 'Cliente' : garantiaConTipo,
        garantiaConCuenta: modalidad === 'Múltiple' ? undefined : gCuenta,
        garantiaConNombre: modalidad === 'Múltiple' ? 'Clientes Particulares Múltiples' : gNombre,
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

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    N.º de Solicitud
                  </label>
                  <input
                    type="text"
                    value={numeroSolicitud}
                    onChange={(e) => setNumeroSolicitud(e.target.value)}
                    placeholder="Ej. 7097"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700"
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">
                      Fecha de Vencimiento
                    </label>
                    {fechaVencimiento && (
                      <button
                        type="button"
                        onClick={() => setFechaVencimiento('')}
                        className="text-[10px] text-red-600 hover:text-red-800 underline cursor-pointer"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
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

              {/* Prestatario */}
              <div className="pt-2">
                <ClientSearchAutocomplete
                  label="Prestatario (Cuenta en Garantía)"
                  clientesList={clientesList}
                  selectedCuenta={selectedPrestatario?.cuenta}
                  onSelect={setSelectedPrestatario}
                  required
                />
              </div>

              {/* Garantía con (General / Predeterminado) */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {modalidad === 'Múltiple'
                    ? 'Seleccione el acreedor por defecto (en modalidad múltiple, cada elemento puede personalizarse):'
                    : 'Garantía Constituida Con'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Farmer Rechnung', 'Campo Grande', 'Cliente'] as TipoGarantiaCon[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setGarantiaConTipo(tipo)}
                      className={`py-1.5 px-2 text-xs font-semibold rounded border transition text-center cursor-pointer ${
                        garantiaConTipo === tipo
                          ? 'bg-emerald-800 text-white border-emerald-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {tipo === 'Cliente' ? 'Cliente registrado' : tipo}
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
                    onClick={() => setIsAddingLote(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Lote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingBien(true)}
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
                      <th className="p-1.5 border-r border-slate-200">Bien / Lote</th>
                      <th className="p-1.5 border-r border-slate-200">Propietario</th>
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
                        <td className="p-1.5 border-r border-slate-200 text-slate-800 font-medium">
                          {formatPropietario(lote.propietario, lote.cuentaPropietario)}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold text-emerald-900">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={lote.hectareas}
                            onChange={(e) => {
                              const val = parseDecimal(e.target.value);
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
                        <td className="p-1.5 border-r border-slate-200 space-y-1">
                          <select
                            value={lote.garantiaConTipo || 'Farmer Rechnung'}
                            onChange={(e) => {
                              const tipo = e.target.value as TipoGarantiaCon;
                              setLotes((prev) =>
                                prev.map((item) =>
                                  item.idLote === lote.idLote
                                    ? {
                                        ...item,
                                        garantiaConTipo: tipo,
                                        garantiaConCuenta: tipo === 'Cliente' ? item.garantiaConCuenta : undefined,
                                        garantiaConNombre: tipo === 'Cliente' ? item.garantiaConNombre : tipo,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white font-semibold"
                          >
                            <option value="Farmer Rechnung">Farmer Rechnung</option>
                            <option value="Campo Grande">Campo Grande</option>
                            <option value="Cliente">Cliente registrado</option>
                          </select>

                          {lote.garantiaConTipo === 'Cliente' && (
                            <select
                              value={lote.garantiaConCuenta || ''}
                              onChange={(e) => {
                                const cuenta = e.target.value;
                                const cli = clientesList.find((c) => String(c.cuenta) === String(cuenta));
                                setLotes((prev) =>
                                  prev.map((item) =>
                                    item.idLote === lote.idLote
                                      ? {
                                          ...item,
                                          garantiaConCuenta: cuenta,
                                          garantiaConNombre: cli ? `${cli.cuenta} — ${cli.nombre}` : cuenta,
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white"
                            >
                              <option value="">-- Seleccionar cliente --</option>
                              {clientesList.map((c) => (
                                <option key={c.cuenta} value={c.cuenta}>
                                  {c.cuenta} — {c.nombre}
                                </option>
                              ))}
                            </select>
                          )}
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
                          {bien.numeroPoliza} — {bien.descripcion || bien.marca || bien.tipoBien}
                        </td>
                        <td className="p-1.5 border-r border-slate-200 text-slate-800 font-medium">
                          {formatPropietario(bien.propietario, bien.cuentaPropietario)}
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
                        <td className="p-1.5 border-r border-slate-200 space-y-1">
                          <select
                            value={bien.garantiaConTipo || 'Farmer Rechnung'}
                            onChange={(e) => {
                              const tipo = e.target.value as TipoGarantiaCon;
                              setBienes((prev) =>
                                prev.map((item) =>
                                  item.idBien === bien.idBien
                                    ? {
                                        ...item,
                                        garantiaConTipo: tipo,
                                        garantiaConCuenta: tipo === 'Cliente' ? item.garantiaConCuenta : undefined,
                                        garantiaConNombre: tipo === 'Cliente' ? item.garantiaConNombre : tipo,
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full px-1.5 py-1 text-xs border border-slate-300 rounded bg-white font-semibold"
                          >
                            <option value="Farmer Rechnung">Farmer Rechnung</option>
                            <option value="Campo Grande">Campo Grande</option>
                            <option value="Cliente">Cliente registrado</option>
                          </select>

                          {bien.garantiaConTipo === 'Cliente' && (
                            <select
                              value={bien.garantiaConCuenta || ''}
                              onChange={(e) => {
                                const cuenta = e.target.value;
                                const cli = clientesList.find((c) => String(c.cuenta) === String(cuenta));
                                setBienes((prev) =>
                                  prev.map((item) =>
                                    item.idBien === bien.idBien
                                      ? {
                                          ...item,
                                          garantiaConCuenta: cuenta,
                                          garantiaConNombre: cli ? `${cli.cuenta} — ${cli.nombre}` : cuenta,
                                        }
                                      : item
                                  )
                                );
                              }}
                              className="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white"
                            >
                              <option value="">-- Seleccionar cliente --</option>
                              {clientesList.map((c) => (
                                <option key={c.cuenta} value={c.cuenta}>
                                  {c.cuenta} — {c.nombre}
                                </option>
                              ))}
                            </select>
                          )}
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

        {/* MODAL SELECCIONAR LOTE */}
        <SeleccionarLoteModal
          isOpen={isAddingLote}
          onClose={() => setIsAddingLote(false)}
          onSelectLote={handleSelectLoteFromModal}
          alreadySelectedLoteIds={lotes.map((l) => l.idLote)}
          originalGarantiaLotes={originalLotes}
          clientesList={clientesList}
          modalidad={modalidad}
          defaultGarantiaConTipo={garantiaConTipo}
          defaultGarantiaCliente={selectedGarantiaCliente}
          availableLotes={availableLotes}
        />

        {/* MODAL SELECCIONAR BIEN */}
        <SeleccionarBienModal
          isOpen={isAddingBien}
          onClose={() => setIsAddingBien(false)}
          onSelectBien={handleSelectBienFromModal}
          alreadySelectedBienIds={bienes.map((b) => b.idBien)}
          originalGarantiaBienIds={originalBienIds}
          currentNumeroSolicitud={numeroSolicitud}
          clientesList={clientesList}
          modalidad={modalidad}
          defaultGarantiaConTipo={garantiaConTipo}
          defaultGarantiaCliente={selectedGarantiaCliente}
          availableBienes={availableBienes}
        />
      </div>
    </div>
  );
};
