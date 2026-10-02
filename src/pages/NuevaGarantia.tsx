import React, { useState, useEffect } from 'react';
import {
  FilePlus,
  Calendar,
  User,
  Building2,
  MapPin,
  Tractor,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
  Layers,
  ArrowRight,
} from 'lucide-react';
import {
  Cliente,
  Lote,
  Bien,
  Garantia,
  TipoGarantiaCon,
  GarantiaLoteRelacion,
  GarantiaBienRelacion,
} from '../types';
import {
  getClientes,
  getLotes,
  getBienes,
  getNextSolicitudNumber,
  saveGarantia,
} from '../services/backend';
import { ClientSearchAutocomplete } from '../components/common/ClientSearchAutocomplete';
import { getTodayIso, formatHectareas } from '../utils/textSearch';
import { NavSection } from '../components/layout/Sidebar';

interface NuevaGarantiaProps {
  onSuccessCreated: () => void;
  onNavigate: (section: NavSection) => void;
}

export const NuevaGarantia: React.FC<NuevaGarantiaProps> = ({ onSuccessCreated, onNavigate }) => {
  // Datos generales
  const [numeroSolicitud, setNumeroSolicitud] = useState<string>('—');
  const [fecha, setFecha] = useState<string>(getTodayIso());

  // Prestatario (Cuenta en Garantía)
  const [selectedPrestatario, setSelectedPrestatario] = useState<Cliente | null>(null);

  // Garantía con (Farmer Rechnung, Campo Grande, Cliente)
  const [garantiaConTipo, setGarantiaConTipo] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [selectedGarantiaCliente, setSelectedGarantiaCliente] = useState<Cliente | null>(null);

  // Bienes / Lotes agregados
  const [selectedLotes, setSelectedLotes] = useState<GarantiaLoteRelacion[]>([]);
  const [selectedBienes, setSelectedBienes] = useState<GarantiaBienRelacion[]>([]);

  // Observación
  const [observacion, setObservacion] = useState('');

  // Listas de referencia cargadas desde backend
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [availableLotes, setAvailableLotes] = useState<Lote[]>([]);
  const [availableBienes, setAvailableBienes] = useState<Bien[]>([]);

  // Modales de Selección
  const [isLoteModalOpen, setIsLoteModalOpen] = useState(false);
  const [isBienModalOpen, setIsBienModalOpen] = useState(false);
  const [loteSearchTerm, setLoteSearchTerm] = useState('');
  const [bienSearchTerm, setBienSearchTerm] = useState('');

  // Estado del formulario
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cargar número de solicitud y listas
  useEffect(() => {
    const initData = async () => {
      setIsLoadingReferences(true);
      try {
        const [nextSol, clientesRes, lotesRes, bienesRes] = await Promise.all([
          getNextSolicitudNumber(),
          getClientes({ page: 1, pageSize: 1000 }),
          getLotes({ page: 1, pageSize: 1000 }),
          getBienes({ page: 1, pageSize: 1000 }),
        ]);
        setNumeroSolicitud(nextSol || 'SOL-001');
        setClientesList(Array.isArray(clientesRes?.data) ? clientesRes.data : []);
        setAvailableLotes(Array.isArray(lotesRes?.data) ? lotesRes.data : []);
        setAvailableBienes(Array.isArray(bienesRes?.data) ? bienesRes.data : []);
      } catch (err: any) {
        console.warn('Error inicializando referencias:', err);
        setClientesList([]);
        setAvailableLotes([]);
        setAvailableBienes([]);
      } finally {
        setIsLoadingReferences(false);
      }
    };
    initData();
  }, []);

  // Agregar Lote
  const handleAddLote = (lote: Lote) => {
    // Verificar si ya está añadido en esta garantía
    if (selectedLotes.some((l) => l.idLote === lote.idLote)) {
      return;
    }
    const nuevoLoteRel: GarantiaLoteRelacion = {
      idLote: lote.idLote,
      numeroLote: lote.numeroLote,
      hectareas: lote.hectareas,
      propietario: lote.propietario,
      cuentaPropietario: lote.cuentaPropietario,
      ubicacion: lote.ubicacion,
      encargado: lote.encargado,
    };
    setSelectedLotes((prev) => [...prev, nuevoLoteRel]);
    setIsLoteModalOpen(false);
    setLoteSearchTerm('');
  };

  const handleRemoveLote = (idLote: string) => {
    setSelectedLotes((prev) => prev.filter((l) => l.idLote !== idLote));
  };

  // Agregar Bien
  const handleAddBien = (bien: Bien) => {
    if (selectedBienes.some((b) => b.idBien === bien.idBien)) {
      return;
    }
    const nuevoBienRel: GarantiaBienRelacion = {
      idBien: bien.idBien,
      numeroPoliza: bien.numeroPoliza,
      tipoBien: bien.tipoBien,
      descripcion: bien.descripcion,
      marca: bien.marca,
      modelo: bien.modelo,
      placa: bien.placa,
      propietario: bien.propietario,
      cuentaPropietario: bien.cuentaPropietario,
      ubicacion: bien.ubicacion,
    };
    setSelectedBienes((prev) => [...prev, nuevoBienRel]);
    setIsBienModalOpen(false);
    setBienSearchTerm('');
  };

  const handleRemoveBien = (idBien: string) => {
    setSelectedBienes((prev) => prev.filter((b) => b.idBien !== idBien));
  };

  // Determinar Propietario General de la Garantía
  // Se toma del primer bien o lote seleccionado, o del prestatario si aún no hay items
  const mainPropietarioNombre =
    selectedLotes[0]?.propietario ||
    selectedBienes[0]?.propietario ||
    (selectedPrestatario ? selectedPrestatario.nombre : '—');

  const mainPropietarioCuenta =
    selectedLotes[0]?.cuentaPropietario ||
    selectedBienes[0]?.cuentaPropietario ||
    (selectedPrestatario ? selectedPrestatario.cuenta : '—');

  // Determinar Tipo de Garantía
  const tipoGarantiaCalculado =
    selectedLotes.length > 0 && selectedBienes.length > 0
      ? 'Terrenos y Bienes'
      : selectedLotes.length > 0
      ? 'Terreno'
      : selectedBienes.length > 0
      ? 'Bien'
      : 'Sin elementos';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // VALIDACIONES OBLIGATORIAS
    if (!selectedPrestatario) {
      setErrorMessage('Debe seleccionar al Prestatario (Cuenta en Garantía).');
      return;
    }

    if (garantiaConTipo === 'Cliente' && !selectedGarantiaCliente) {
      setErrorMessage('Ha seleccionado "Cliente" en Garantía Con, debe especificar la cuenta del cliente.');
      return;
    }

    if (selectedLotes.length === 0 && selectedBienes.length === 0) {
      setErrorMessage('Debe agregar al menos un lote o un bien como respaldo de la garantía.');
      return;
    }

    setIsSaving(true);

    try {
      const garantiaData: Partial<Garantia> = {
        idGarantia: `GAR-${Date.now()}`,
        numeroSolicitud,
        fecha,
        cuentaPropietario: mainPropietarioCuenta,
        propietario: mainPropietarioNombre,
        cuentaPrestatario: selectedPrestatario.cuenta,
        prestatario: selectedPrestatario.nombre,
        garantiaConTipo,
        garantiaConCuenta:
          garantiaConTipo === 'Cliente' && selectedGarantiaCliente
            ? selectedGarantiaCliente.cuenta
            : undefined,
        garantiaConNombre:
          garantiaConTipo === 'Cliente' && selectedGarantiaCliente
            ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}`
            : garantiaConTipo,
        tipoGarantia: tipoGarantiaCalculado,
        observacion: observacion.trim(),
        lotes: selectedLotes,
        bienes: selectedBienes,
      };

      await saveGarantia(garantiaData, false);
      setSuccessMessage('Garantía registrada con éxito.');
      setTimeout(() => {
        onSuccessCreated();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'No se pudo registrar la garantía.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrado de lotes para el modal de selección
  const safeAvailableLotes = Array.isArray(availableLotes) ? availableLotes : [];
  const filteredAvailableLotes = safeAvailableLotes.filter((lote) => {
    if (!lote || !loteSearchTerm.trim()) return true;
    const term = loteSearchTerm.toLowerCase();
    return (
      (lote.numeroLote || '').toLowerCase().includes(term) ||
      (lote.propietario || '').toLowerCase().includes(term) ||
      String(lote.cuentaPropietario || '').toLowerCase().includes(term) ||
      (lote.ubicacion || '').toLowerCase().includes(term)
    );
  });

  // Filtrado de bienes para el modal de selección
  const safeAvailableBienes = Array.isArray(availableBienes) ? availableBienes : [];
  const filteredAvailableBienes = safeAvailableBienes.filter((bien) => {
    if (!bien || !bienSearchTerm.trim()) return true;
    const term = bienSearchTerm.toLowerCase();
    return (
      (bien.numeroPoliza || '').toLowerCase().includes(term) ||
      (bien.propietario || '').toLowerCase().includes(term) ||
      String(bien.cuentaPropietario || '').toLowerCase().includes(term) ||
      (bien.descripcion || '').toLowerCase().includes(term) ||
      (bien.marca || '').toLowerCase().includes(term) ||
      (bien.placa || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <FilePlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Registro de Nueva Garantía
            </h2>
            <p className="text-[11px] text-slate-500">
              Asoc. Civil "Colonia Chihuahua" — Respaldos de parcelas, vehículos y maquinarias
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('garantias')}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 bg-white"
        >
          Volver a Garantías
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Aviso del sistema: </span>
            {errorMessage}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-xs text-emerald-900 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECCIÓN 1: DATOS GENERALES */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Calendar className="w-4 h-4 text-emerald-800" />
            <span>SECCIÓN 1 — Datos Generales</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                N.º de Solicitud (Backend)
              </label>
              <input
                type="text"
                value={numeroSolicitud}
                readOnly
                disabled
                className="w-full px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-700 cursor-not-allowed"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                El N.º Solicitud viene asignado por el backend y no puede modificarse accidentalmente.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fecha de Emisión <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: PRESTATARIO */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
            <User className="w-4 h-4 text-emerald-800" />
            <span>SECCIÓN 2 — Prestatario (Cuenta en Garantía)</span>
          </div>

          <div className="space-y-2">
            <ClientSearchAutocomplete
              label="Prestatario Titular de la Operación"
              placeholder="Buscar por N.º de cuenta o nombre del prestatario..."
              clientesList={clientesList}
              selectedCuenta={selectedPrestatario?.cuenta}
              onSelect={setSelectedPrestatario}
              required
              helperText="Persona que realiza el préstamo/operación y compromete el bien en garantía."
            />

            {selectedPrestatario && (
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-950">Prestatario seleccionado: </span>
                  <span className="font-mono text-emerald-800 font-bold">{selectedPrestatario.cuenta}</span> —{' '}
                  <span className="text-slate-800 font-semibold">{selectedPrestatario.nombre}</span>
                </div>
                {selectedPrestatario.ci && (
                  <span className="text-[11px] text-slate-500 font-mono">CI: {selectedPrestatario.ci}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 3: GARANTÍA CON */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Building2 className="w-4 h-4 text-emerald-800" />
            <span>SECCIÓN 3 — Garantía Con (Institución / Acreedor)</span>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Seleccione la institución o cliente donde queda constituida la garantía:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setGarantiaConTipo('Farmer Rechnung');
                  setSelectedGarantiaCliente(null);
                }}
                className={`py-2 px-3 text-xs font-bold rounded border transition text-left flex items-center justify-between ${
                  garantiaConTipo === 'Farmer Rechnung'
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>Farmer Rechnung</span>
                {garantiaConTipo === 'Farmer Rechnung' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setGarantiaConTipo('Campo Grande');
                  setSelectedGarantiaCliente(null);
                }}
                className={`py-2 px-3 text-xs font-bold rounded border transition text-left flex items-center justify-between ${
                  garantiaConTipo === 'Campo Grande'
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>Campo Grande</span>
                {garantiaConTipo === 'Campo Grande' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={() => setGarantiaConTipo('Cliente')}
                className={`py-2 px-3 text-xs font-bold rounded border transition text-left flex items-center justify-between ${
                  garantiaConTipo === 'Cliente'
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>Cliente Particular</span>
                {garantiaConTipo === 'Cliente' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Si selecciona "Cliente", mostrar buscador */}
            {garantiaConTipo === 'Cliente' && (
              <div className="pt-2">
                <ClientSearchAutocomplete
                  label="Buscar Cliente Receptor de la Garantía"
                  placeholder="Buscar por N.º de cuenta o nombre..."
                  clientesList={clientesList}
                  selectedCuenta={selectedGarantiaCliente?.cuenta}
                  onSelect={setSelectedGarantiaCliente}
                  required
                  helperText="Al seleccionar un cliente, se registrará como Cuenta — Nombre."
                />
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 4: BIENES Y PARCELAS DADOS EN GARANTÍA */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Layers className="w-4 h-4 text-emerald-800" />
              <span>SECCIÓN 4 — Bienes y Parcelas Dados en Garantía</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLoteModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 transition"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>+ Añadir Lote</span>
              </button>
              <button
                type="button"
                onClick={() => setIsBienModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-100 hover:bg-blue-200 rounded border border-blue-300 transition"
              >
                <Tractor className="w-3.5 h-3.5" />
                <span>+ Añadir Bien</span>
              </button>
            </div>
          </div>

          {/* Listado de elementos afectados a la garantía */}
          {selectedLotes.length === 0 && selectedBienes.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded border border-dashed border-slate-300">
              <p className="text-xs font-semibold text-slate-600 mb-1">
                No hay lotes ni bienes agregados a esta garantía
              </p>
              <p className="text-[11px] text-slate-400">
                Presione <strong>+ Añadir Lote</strong> o <strong>+ Añadir Bien</strong> para vincular los respaldos.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                Elementos respaldando esta solicitud ({selectedLotes.length + selectedBienes.length} en total)
              </div>

              {/* Lotes Seleccionados */}
              {selectedLotes.map((lote) => (
                <div
                  key={`sel-lot-${lote.idLote}`}
                  className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-200 rounded text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 bg-emerald-200 text-emerald-900 rounded font-mono font-bold text-xs">
                      {lote.numeroLote}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>Terreno / Parcela</span>
                        <span className="text-[11px] font-mono text-emerald-800 bg-emerald-100 px-1 rounded">
                          {formatHectareas(lote.hectareas)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Titular: <strong>{lote.propietario}</strong> (Cta: {lote.cuentaPropietario})
                        {lote.encargado && <span> • Encargado: {lote.encargado}</span>}
                        {lote.ubicacion && <span> • {lote.ubicacion}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveLote(lote.idLote)}
                    className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition"
                    title="Quitar lote de la garantía"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Bienes Seleccionados */}
              {selectedBienes.map((bien) => (
                <div
                  key={`sel-bien-${bien.idBien}`}
                  className="flex items-center justify-between p-2.5 bg-blue-50/50 border border-blue-200 rounded text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 bg-blue-200 text-blue-900 rounded font-mono font-bold text-xs">
                      {bien.numeroPoliza}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{bien.tipoBien}</span>
                        {bien.descripcion && (
                          <span className="text-slate-700 font-medium">({bien.descripcion})</span>
                        )}
                        {(bien.marca || bien.modelo) && (
                          <span className="text-[11px] font-mono text-slate-500">
                            {bien.marca} {bien.modelo}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Titular: <strong>{bien.propietario}</strong> (Cta: {bien.cuentaPropietario})
                        {bien.placa && <span className="font-mono"> • Placa: {bien.placa}</span>}
                        {bien.ubicacion && <span> • {bien.ubicacion}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveBien(bien.idBien)}
                    className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition"
                    title="Quitar bien de la garantía"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OBSERVACIÓN Y RESUMEN */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones del Préstamo o Respaldo
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              placeholder="Detalles sobre plazo, condiciones u observaciones institucionales..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
            />
          </div>

          {/* Resumen Final de la Garantía */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
            <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">
              Resumen de la Transacción
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
              <div>
                <strong>Propietario Registrado: </strong>
                {mainPropietarioCuenta} — {mainPropietarioNombre}
              </div>
              <div>
                <strong>Prestatario: </strong>
                {selectedPrestatario
                  ? `${selectedPrestatario.cuenta} — ${selectedPrestatario.nombre}`
                  : '—'}
              </div>
              <div>
                <strong>Garantía Con: </strong>
                {garantiaConTipo === 'Cliente' && selectedGarantiaCliente
                  ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}`
                  : garantiaConTipo}
              </div>
              <div>
                <strong>Tipo de Garantía: </strong>
                <span className="font-bold text-emerald-800">{tipoGarantiaCalculado}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('garantias')}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-xs transition flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando en Google Sheets...</span>
                </>
              ) : (
                <>
                  <span>Guardar y Registrar Garantía</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* MODAL SELECCIONAR LOTE */}
      {isLoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Seleccionar Lote para Garantía</span>
              </h3>
              <button
                onClick={() => setIsLoteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={loteSearchTerm}
                  onChange={(e) => setLoteSearchTerm(e.target.value)}
                  placeholder="Buscar por N.º de lote, propietario, cuenta o ubicación..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-3 flex-1 divide-y divide-slate-100">
              {filteredAvailableLotes.length > 0 ? (
                filteredAvailableLotes.map((lote) => {
                  const isBlocked = lote.estado === 'Bloqueado';
                  const isInactive = lote.estado === 'Inactivo';
                  const isAlreadyInWarranty = !!lote.enGarantia;
                  const isAlreadySelected = selectedLotes.some((l) => l.idLote === lote.idLote);

                  const isDisabled = isBlocked || isInactive || isAlreadyInWarranty || isAlreadySelected;

                  let reason = '';
                  if (isAlreadySelected) reason = 'Ya añadido en este formulario';
                  else if (isAlreadyInWarranty) reason = `Ya está en la garantía activa ${lote.solicitudGarantiaActiva || ''}`;
                  else if (isBlocked) reason = `Lote Bloqueado: ${lote.motivoBloqueo || 'Impedimento administrativo'}`;
                  else if (isInactive) reason = 'Lote Inactivo en la hoja de registros';

                  return (
                    <div
                      key={lote.idLote}
                      className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                        isDisabled ? 'bg-slate-50/70 opacity-60' : 'hover:bg-emerald-50/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                            {lote.numeroLote}
                          </span>
                          <span className="font-semibold text-slate-800">{lote.propietario}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            (Cta: {lote.cuentaPropietario})
                          </span>
                          <span className="text-[11px] font-mono text-emerald-800 font-bold">
                            {formatHectareas(lote.hectareas)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {lote.ubicacion && <span>Ubicación: {lote.ubicacion} • </span>}
                          {lote.encargado && <span>Encargado: {lote.encargado} • </span>}
                          <span>Estado: {lote.estado}</span>
                        </div>
                        {isDisabled && (
                          <div className="text-[10px] text-red-600 font-medium mt-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{reason}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleAddLote(lote)}
                        className="px-2.5 py-1 text-xs font-semibold rounded shrink-0 transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-800 hover:bg-emerald-900 text-white"
                      >
                        {isAlreadySelected ? 'Seleccionado' : 'Seleccionar'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No se encontraron lotes disponibles para seleccionar.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLoteModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SELECCIONAR BIEN */}
      {isBienModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Tractor className="w-4 h-4 text-blue-400" />
                <span>Seleccionar Bien para Garantía</span>
              </h3>
              <button
                onClick={() => setIsBienModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={bienSearchTerm}
                  onChange={(e) => setBienSearchTerm(e.target.value)}
                  placeholder="Buscar por póliza, propietario, cuenta, descripción, marca, placa..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-3 flex-1 divide-y divide-slate-100">
              {filteredAvailableBienes.length > 0 ? (
                filteredAvailableBienes.map((bien) => {
                  const isBlocked = bien.estado === 'Bloqueado';
                  const isInactive = bien.estado === 'Inactivo';
                  const isAlreadyInWarranty = !!bien.enGarantia;
                  const isAlreadySelected = selectedBienes.some((b) => b.idBien === bien.idBien);

                  const isDisabled = isBlocked || isInactive || isAlreadyInWarranty || isAlreadySelected;

                  let reason = '';
                  if (isAlreadySelected) reason = 'Ya añadido en este formulario';
                  else if (isAlreadyInWarranty) reason = `Ya está en la garantía activa ${bien.solicitudGarantiaActiva || ''}`;
                  else if (isBlocked) reason = `Bien Bloqueado: ${bien.motivoBloqueo || 'Impedimento administrativo'}`;
                  else if (isInactive) reason = 'Bien Inactivo';

                  return (
                    <div
                      key={bien.idBien}
                      className={`p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                        isDisabled ? 'bg-slate-50/70 opacity-60' : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">
                            {bien.numeroPoliza}
                          </span>
                          <span className="font-semibold text-slate-800">{bien.tipoBien}</span>
                          {bien.descripcion && (
                            <span className="text-slate-600">({bien.descripcion})</span>
                          )}
                          {(bien.marca || bien.modelo) && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              {bien.marca} {bien.modelo}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          <span>Titular: {bien.propietario} (Cta: {bien.cuentaPropietario}) • </span>
                          {bien.placa && <span>Placa: {bien.placa} • </span>}
                          {bien.encargado && <span>Encargado: {bien.encargado} • </span>}
                          <span>Estado: {bien.estado}</span>
                        </div>
                        {isDisabled && (
                          <div className="text-[10px] text-red-600 font-medium mt-0.5 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{reason}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleAddBien(bien)}
                        className="px-2.5 py-1 text-xs font-semibold rounded shrink-0 transition disabled:opacity-40 disabled:cursor-not-allowed bg-blue-800 hover:bg-blue-900 text-white"
                      >
                        {isAlreadySelected ? 'Seleccionado' : 'Seleccionar'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  No se encontraron bienes disponibles para seleccionar.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsBienModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
