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
  Printer,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
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
  buscarLotes,
  buscarBienes,
  obtenerLotes,
  obtenerBienes,
  findAnyCachedData,
  getFromMemoryCache,
} from '../services/backend';
import { ClientSearchAutocomplete } from '../components/common/ClientSearchAutocomplete';
import { getTodayIso, formatHectareas } from '../utils/textSearch';
import { ImpresionGarantia } from './ImpresionGarantia';
import { NavSection } from '../components/layout/Sidebar';

interface NuevaGarantiaProps {
  onSuccessCreated: () => void;
  onNavigate: (section: NavSection) => void;
}

export const NuevaGarantia: React.FC<NuevaGarantiaProps> = ({ onSuccessCreated, onNavigate }) => {
  // Modalidad: si es null, muestra pantalla de elección inicial
  const [modalidad, setModalidad] = useState<'Simple' | 'Múltiple' | null>(null);

  // Datos de cabecera
  const [numeroSolicitud, setNumeroSolicitud] = useState<string>('');
  const [fecha, setFecha] = useState<string>(getTodayIso());
  const [fechaVencimiento, setFechaVencimiento] = useState<string>('');

  // Personas
  const [selectedPropietario, setSelectedPropietario] = useState<Cliente | null>(null);
  const [selectedPrestatario, setSelectedPrestatario] = useState<Cliente | null>(null);

  // Garantía con (Principal / Para modalidad Simple)
  const [garantiaConTipo, setGarantiaConTipo] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [selectedGarantiaCliente, setSelectedGarantiaCliente] = useState<Cliente | null>(null);

  // Elementos dados en garantía
  const [selectedLotes, setSelectedLotes] = useState<GarantiaLoteRelacion[]>([]);
  const [selectedBienes, setSelectedBienes] = useState<GarantiaBienRelacion[]>([]);

  // Observaciones
  const [observacion, setObservacion] = useState('');

  // Listas cargadas desde Google Sheets — inicializadas inmediatamente desde la caché en memoria si ya existen
  const [clientesList, setClientesList] = useState<Cliente[]>(() => findAnyCachedData<Cliente>('clientes') || []);
  const [availableLotes, setAvailableLotes] = useState<Lote[]>(() => findAnyCachedData<Lote>('lotes') || []);
  const [availableBienes, setAvailableBienes] = useState<Bien[]>(() => findAnyCachedData<Bien>('bienes') || []);

  // Estados de modales para añadir Lote / Bien
  const [isLoteModalOpen, setIsLoteModalOpen] = useState(false);
  const [isBienModalOpen, setIsBienModalOpen] = useState(false);

  // Estado temporal al agregar Lote
  const [targetLote, setTargetLote] = useState<Lote | null>(null);
  const [targetLoteHa, setTargetLoteHa] = useState<number>(0);
  const [targetLoteGarantiaCon, setTargetLoteGarantiaCon] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [targetLoteCliente, setTargetLoteCliente] = useState<Cliente | null>(null);

  // Búsqueda remota y estados para Modal de Lotes
  const [loteSearchTerm, setLoteSearchTerm] = useState('');
  const [isSearchingLotes, setIsSearchingLotes] = useState(false);
  const [loteSearchError, setLoteSearchError] = useState(false);
  const [loteSearchResults, setLoteSearchResults] = useState<Lote[] | null>(null);
  const loteDebounceRef = React.useRef<any>(null);

  // Estado temporal al agregar Bien
  const [targetBien, setTargetBien] = useState<Bien | null>(null);
  const [targetBienValUSD, setTargetBienValUSD] = useState<number>(0);
  const [targetBienGarantiaCon, setTargetBienGarantiaCon] = useState<TipoGarantiaCon>('Farmer Rechnung');
  const [targetBienCliente, setTargetBienCliente] = useState<Cliente | null>(null);

  // Búsqueda remota y estados para Modal de Bienes
  const [bienSearchTerm, setBienSearchTerm] = useState('');
  const [isSearchingBienes, setIsSearchingBienes] = useState(false);
  const [bienSearchError, setBienSearchError] = useState(false);
  const [bienSearchResults, setBienSearchResults] = useState<Bien[] | null>(null);
  const bienDebounceRef = React.useRef<any>(null);

  // Estados de proceso
  const [isLoadingReferences, setIsLoadingReferences] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Vista de impresión sin guardar
  const [printPreviewGarantia, setPrintPreviewGarantia] = useState<Garantia | null>(null);

  // Cargar datos iniciales desde Google Sheets (reutiliza caché si ya está disponible)
  const loadReferences = async () => {
    const hasCachedLotes = findAnyCachedData('lotes') !== null;
    const hasCachedBienes = findAnyCachedData('bienes') !== null;
    const hasCachedClientes = findAnyCachedData('clientes') !== null;

    if (!hasCachedLotes || !hasCachedBienes || !hasCachedClientes) {
      setIsLoadingReferences(true);
    }
    try {
      const [clientesRes, lotesRes, bienesRes] = await Promise.all([
        getClientes({ page: 1, pageSize: 1000 }),
        getLotes({ page: 1, pageSize: 1000 }),
        getBienes({ page: 1, pageSize: 1000 }),
      ]);
      if (Array.isArray(clientesRes?.data) && clientesRes.data.length > 0) {
        setClientesList(clientesRes.data);
      }
      if (Array.isArray(lotesRes?.data) && lotesRes.data.length > 0) {
        setAvailableLotes(lotesRes.data);
      }
      if (Array.isArray(bienesRes?.data) && bienesRes.data.length > 0) {
        setAvailableBienes(bienesRes.data);
      }
    } catch {
      // Mantener lo que ya esté en memoria
    } finally {
      setIsLoadingReferences(false);
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  // Manejador apertura y búsqueda de lotes
  useEffect(() => {
    if (isLoteModalOpen) {
      setLoteSearchError(false);
      if (availableLotes.length === 0) {
        setIsSearchingLotes(true);
        obtenerLotes()
          .then((lotes) => {
            setAvailableLotes(lotes);
          })
          .catch(() => {
            setLoteSearchError(true);
          })
          .finally(() => {
            setIsSearchingLotes(false);
          });
      } else {
        setIsSearchingLotes(false);
      }
    }
  }, [isLoteModalOpen]);

  useEffect(() => {
    if (!isLoteModalOpen) return;
    const clean = loteSearchTerm.trim();
    if (!clean) {
      setLoteSearchResults(null);
      setIsSearchingLotes(false);
      setLoteSearchError(false);
      return;
    }

    // 1. Revisar caché en memoria de búsquedas
    const searchKey = `search:${clean.toLowerCase()}`;
    const cached = getFromMemoryCache<Lote[]>('lotes', searchKey);
    if (cached) {
      setLoteSearchResults(cached);
      setIsSearchingLotes(false);
      setLoteSearchError(false);
      return;
    }

    // 2. Si ya hay lotes en memoria, filtrar inmediatamente
    if (availableLotes.length > 0) {
      const lower = clean.toLowerCase();
      const localMatches = availableLotes.filter(
        (l) =>
          (l.numeroLote || '').toLowerCase().includes(lower) ||
          (l.propietario || '').toLowerCase().includes(lower) ||
          String(l.cuentaPropietario || '').includes(lower) ||
          (l.ubicacion || '').toLowerCase().includes(lower)
      );
      if (localMatches.length > 0) {
        setLoteSearchResults(localMatches);
      }
    }

    if (loteDebounceRef.current) clearTimeout(loteDebounceRef.current);
    loteDebounceRef.current = setTimeout(async () => {
      setIsSearchingLotes(true);
      setLoteSearchError(false);
      try {
        const results = await buscarLotes(clean);
        setLoteSearchResults(results);
      } catch {
        setLoteSearchError(true);
      } finally {
        setIsSearchingLotes(false);
      }
    }, 350);

    return () => {
      if (loteDebounceRef.current) clearTimeout(loteDebounceRef.current);
    };
  }, [loteSearchTerm, isLoteModalOpen]);

  // Manejador apertura y búsqueda de bienes
  useEffect(() => {
    if (isBienModalOpen) {
      setBienSearchError(false);
      if (availableBienes.length === 0) {
        setIsSearchingBienes(true);
        obtenerBienes()
          .then((bienes) => {
            setAvailableBienes(bienes);
          })
          .catch(() => {
            setBienSearchError(true);
          })
          .finally(() => {
            setIsSearchingBienes(false);
          });
      } else {
        setIsSearchingBienes(false);
      }
    }
  }, [isBienModalOpen]);

  useEffect(() => {
    if (!isBienModalOpen) return;
    const clean = bienSearchTerm.trim();
    if (!clean) {
      setBienSearchResults(null);
      setIsSearchingBienes(false);
      setBienSearchError(false);
      return;
    }

    // 1. Revisar caché en memoria de búsquedas
    const searchKey = `search:${clean.toLowerCase()}`;
    const cached = getFromMemoryCache<Bien[]>('bienes', searchKey);
    if (cached) {
      setBienSearchResults(cached);
      setIsSearchingBienes(false);
      setBienSearchError(false);
      return;
    }

    // 2. Si ya hay bienes en memoria, filtrar inmediatamente
    if (availableBienes.length > 0) {
      const lower = clean.toLowerCase();
      const localMatches = availableBienes.filter(
        (b) =>
          (b.numeroPoliza || '').toLowerCase().includes(lower) ||
          (b.propietario || '').toLowerCase().includes(lower) ||
          String(b.cuentaPropietario || '').includes(lower) ||
          (b.descripcion || '').toLowerCase().includes(lower) ||
          (b.marca || '').toLowerCase().includes(lower) ||
          (b.placa || '').toLowerCase().includes(lower)
      );
      if (localMatches.length > 0) {
        setBienSearchResults(localMatches);
      }
    }

    if (bienDebounceRef.current) clearTimeout(bienDebounceRef.current);
    bienDebounceRef.current = setTimeout(async () => {
      setIsSearchingBienes(true);
      setBienSearchError(false);
      try {
        const results = await buscarBienes(clean);
        setBienSearchResults(results);
      } catch {
        setBienSearchError(true);
      } finally {
        setIsSearchingBienes(false);
      }
    }, 350);

    return () => {
      if (bienDebounceRef.current) clearTimeout(bienDebounceRef.current);
    };
  }, [bienSearchTerm, isBienModalOpen]);

  // Totales separados
  const totalHectareas = selectedLotes.reduce((acc, l) => acc + (Number(l.hectareas) || 0), 0);
  const totalValorUSD = selectedBienes.reduce((acc, b) => acc + (Number(b.valorGarantiaUSD) || 0), 0);

  // Determinar si hay operaciones con Cliente (para mostrar botón Imprimir sin Guardar)
  const tieneOperacionCliente =
    garantiaConTipo === 'Cliente' ||
    selectedLotes.some((l) => l.garantiaConTipo === 'Cliente') ||
    selectedBienes.some((b) => b.garantiaConTipo === 'Cliente');

  // Tipo de garantía calculado
  const tipoGarantiaCalculado =
    selectedLotes.length > 0 && selectedBienes.length > 0
      ? 'Terrenos y Bienes'
      : selectedLotes.length > 0
      ? 'Terreno'
      : selectedBienes.length > 0
      ? 'Bien'
      : 'Sin elementos';

  // Manejo de Agregar Lote
  const handleSelectLoteForAdd = (lote: Lote) => {
    setTargetLote(lote);
    const disp =
      lote.hectareasDisponibles !== undefined && lote.hectareasDisponibles !== null
        ? lote.hectareasDisponibles
        : lote.hectareas;
    setTargetLoteHa(disp > 0 ? disp : lote.hectareas);
    // Heredar el acreedor por defecto vigente en la Sección 3
    setTargetLoteGarantiaCon(garantiaConTipo);
    setTargetLoteCliente(selectedGarantiaCliente);
  };

  const handleConfirmAddLote = () => {
    if (!targetLote) return;
    if (targetLoteHa <= 0) {
      alert('Las hectáreas a poner en garantía deben ser mayores a 0.');
      return;
    }

    if (targetLoteGarantiaCon === 'Cliente' && !targetLoteCliente) {
      alert('Ha seleccionado "Cliente registrado", debe seleccionar obligatoriamente un cliente para este lote.');
      return;
    }

    const disp =
      targetLote.hectareasDisponibles !== undefined && targetLote.hectareasDisponibles !== null
        ? targetLote.hectareasDisponibles
        : targetLote.hectareas;

    if (targetLoteHa > disp && disp > 0) {
      alert(`No puede solicitar más de las hectáreas disponibles (${disp} ha).`);
      return;
    }

    const gTipo = targetLoteGarantiaCon;
    const gNombre =
      gTipo === 'Cliente' && targetLoteCliente
        ? `${targetLoteCliente.cuenta} — ${targetLoteCliente.nombre}`
        : gTipo;

    const gCuenta =
      gTipo === 'Cliente' && targetLoteCliente
        ? targetLoteCliente.cuenta
        : undefined;

    // Si aún no se seleccionó propietario general, autocompletar con el del primer lote
    if (!selectedPropietario) {
      const propFromLote = clientesList.find(
        (c) => String(c.cuenta) === String(targetLote.cuentaPropietario)
      );
      if (propFromLote) {
        setSelectedPropietario(propFromLote);
      } else {
        setSelectedPropietario({
          cuenta: targetLote.cuentaPropietario,
          nombre: targetLote.propietario,
          ci: '',
        });
      }
    }

    setSelectedLotes((prev) => [
      ...prev.filter((l) => l.idLote !== targetLote.idLote),
      {
        idLote: targetLote.idLote,
        numeroLote: targetLote.numeroLote,
        hectareas: targetLoteHa,
        hectareasTotales: targetLote.hectareas,
        hectareasDisponibles: disp,
        propietario: targetLote.propietario,
        cuentaPropietario: targetLote.cuentaPropietario,
        ubicacion: targetLote.ubicacion,
        encargado: targetLote.encargado,
        garantiaConTipo: gTipo,
        garantiaConCuenta: gCuenta,
        garantiaConNombre: gNombre,
      },
    ]);

    setTargetLote(null);
    setTargetLoteHa(0);
    setIsLoteModalOpen(false);
    setLoteSearchTerm('');
  };

  const handleRemoveLote = (idLote: string) => {
    setSelectedLotes((prev) => prev.filter((l) => l.idLote !== idLote));
  };

  // Manejo de Agregar Bien
  const handleSelectBienForAdd = (bien: Bien) => {
    setTargetBien(bien);
    setTargetBienValUSD(bien.valorGarantiaUSD || 0);
    // Heredar el acreedor por defecto vigente en la Sección 3
    setTargetBienGarantiaCon(garantiaConTipo);
    setTargetBienCliente(selectedGarantiaCliente);
  };

  const handleConfirmAddBien = () => {
    if (!targetBien) return;
    if (targetBienValUSD < 0) {
      alert('El valor en garantía debe ser un valor válido en dólares ($us.).');
      return;
    }

    if (targetBienGarantiaCon === 'Cliente' && !targetBienCliente) {
      alert('Ha seleccionado "Cliente registrado", debe seleccionar obligatoriamente un cliente para este bien.');
      return;
    }

    const gTipo = targetBienGarantiaCon;
    const gNombre =
      gTipo === 'Cliente' && targetBienCliente
        ? `${targetBienCliente.cuenta} — ${targetBienCliente.nombre}`
        : gTipo;

    const gCuenta =
      gTipo === 'Cliente' && targetBienCliente
        ? targetBienCliente.cuenta
        : undefined;

    // Si aún no se seleccionó propietario general, autocompletar con el del bien
    if (!selectedPropietario) {
      const propFromBien = clientesList.find(
        (c) => String(c.cuenta) === String(targetBien.cuentaPropietario)
      );
      if (propFromBien) {
        setSelectedPropietario(propFromBien);
      } else {
        setSelectedPropietario({
          cuenta: targetBien.cuentaPropietario,
          nombre: targetBien.propietario,
          ci: '',
        });
      }
    }

    setSelectedBienes((prev) => [
      ...prev.filter((b) => b.idBien !== targetBien.idBien),
      {
        idBien: targetBien.idBien,
        numeroPoliza: targetBien.numeroPoliza,
        tipoBien: targetBien.tipoBien,
        descripcion: targetBien.descripcion,
        marca: targetBien.marca,
        modelo: targetBien.modelo,
        placa: targetBien.placa,
        propietario: targetBien.propietario,
        cuentaPropietario: targetBien.cuentaPropietario,
        ubicacion: targetBien.ubicacion,
        valorGarantiaUSD: targetBienValUSD,
        garantiaConTipo: gTipo,
        garantiaConCuenta: gCuenta,
        garantiaConNombre: gNombre,
      },
    ]);

    setTargetBien(null);
    setTargetBienValUSD(0);
    setIsBienModalOpen(false);
    setBienSearchTerm('');
  };

  const handleRemoveBien = (idBien: string) => {
    setSelectedBienes((prev) => prev.filter((b) => b.idBien !== idBien));
  };

  // Preparar objeto de garantía en memoria (para guardar o para imprimir sin guardar)
  const buildGarantiaPayload = (): Partial<Garantia> => {
    const mainPropNombre =
      selectedPropietario?.nombre ||
      selectedLotes[0]?.propietario ||
      selectedBienes[0]?.propietario ||
      '—';

    const mainPropCuenta =
      selectedPropietario?.cuenta ||
      selectedLotes[0]?.cuentaPropietario ||
      selectedBienes[0]?.cuentaPropietario ||
      '—';

    const gNombre =
      garantiaConTipo === 'Cliente' && selectedGarantiaCliente
        ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}`
        : garantiaConTipo;

    const gCuenta =
      garantiaConTipo === 'Cliente' && selectedGarantiaCliente
        ? selectedGarantiaCliente.cuenta
        : undefined;

    return {
      numeroSolicitud: numeroSolicitud.trim(),
      fecha,
      fechaVencimiento: fechaVencimiento || '',
      cuentaPropietario: mainPropCuenta,
      propietario: mainPropNombre,
      cuentaPrestatario: selectedPrestatario ? selectedPrestatario.cuenta : '',
      prestatario: selectedPrestatario ? selectedPrestatario.nombre : '',
      garantiaConTipo,
      garantiaConCuenta: gCuenta,
      garantiaConNombre: gNombre,
      tipoGarantia: tipoGarantiaCalculado,
      modalidad: modalidad || 'Simple',
      observacion: observacion.trim(),
      lotes: selectedLotes,
      bienes: selectedBienes,
      totalHectareas,
      totalValorBienesUSD: totalValorUSD,
    };
  };

  // IMPRIMIR SIN GUARDAR
  // NO crea garantía, NO escribe en Sheets, NO reserva hectáreas, NO ocupa bien, NO localStorage, NO IndexedDB
  const handlePrintWithoutSaving = () => {
    setErrorMessage(null);

    if (!selectedPrestatario) {
      setErrorMessage('Para preparar la impresión debe seleccionar al Prestatario (Cuenta en Garantía).');
      return;
    }
    if (selectedLotes.length === 0 && selectedBienes.length === 0) {
      setErrorMessage('Debe agregar al menos un lote o bien para poder preparar el documento.');
      return;
    }

    const payload = buildGarantiaPayload();
    setPrintPreviewGarantia({
      ...payload,
      idGarantia: 'PREVIEW-TEMP',
      numeroSolicitud: numeroSolicitud || '—',
      fecha,
      cuentaPropietario: payload.cuentaPropietario || '',
      propietario: payload.propietario || '',
      cuentaPrestatario: payload.cuentaPrestatario || '',
      prestatario: payload.prestatario || '',
      garantiaConTipo: payload.garantiaConTipo || 'Cliente',
      garantiaConNombre: payload.garantiaConNombre || '',
      tipoGarantia: payload.tipoGarantia || '',
      lotes: selectedLotes,
      bienes: selectedBienes,
    } as Garantia);
  };

  // GUARDAR GARANTÍA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!selectedPrestatario) {
      setErrorMessage('Debe seleccionar al Prestatario (Cuenta en Garantía).');
      return;
    }

    if (garantiaConTipo === 'Cliente' && !selectedGarantiaCliente) {
      setErrorMessage('Ha seleccionado "Cliente registrado" como acreedor en la Sección 3, debe especificar el cliente.');
      return;
    }

    // Validar que cada lote y bien con acreedor tipo Cliente tenga asignado su respectivo cliente
    const loteSinCliente = selectedLotes.find((l) => l.garantiaConTipo === 'Cliente' && (!l.garantiaConCuenta || !l.garantiaConNombre));
    if (loteSinCliente) {
      setErrorMessage(`El Lote ${loteSinCliente.numeroLote} tiene como acreedor a un Cliente registrado pero no se ha especificado el cliente.`);
      return;
    }

    const bienSinCliente = selectedBienes.find((b) => b.garantiaConTipo === 'Cliente' && (!b.garantiaConCuenta || !b.garantiaConNombre));
    if (bienSinCliente) {
      setErrorMessage(`El bien ${bienSinCliente.numeroPoliza} tiene como acreedor a un Cliente registrado pero no se ha especificado el cliente.`);
      return;
    }

    if (selectedLotes.length === 0 && selectedBienes.length === 0) {
      setErrorMessage('Debe agregar al menos un lote o un bien como respaldo de la garantía.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildGarantiaPayload();
      await saveGarantia(payload, false);
      setSuccessMessage('Garantía registrada y guardada con éxito en Google Sheets.');
      setTimeout(() => {
        onSuccessCreated();
      }, 1100);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo registrar la garantía.');
    } finally {
      setIsSaving(false);
    }
  };

  // PANTALLA INICIAL DE ELECCIÓN DE MODALIDAD
  if (modalidad === null) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4 sm:pt-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-2.5 bg-emerald-800 text-white rounded-lg shadow-sm">
            <FilePlus className="w-6 h-6" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">
            ¿Cómo desea registrar la garantía?
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Elija la modalidad adecuada según los respaldos y la relación con la institución o acreedores.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Opción 1: Garantía Simple */}
          <button
            type="button"
            onClick={() => setModalidad('Simple')}
            className="p-5 bg-white border-2 border-slate-200 hover:border-emerald-600 rounded-lg text-left shadow-2xs hover:shadow-md transition group cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold text-[10px] uppercase tracking-wider">
                  Modalidad Estándar
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-1" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight mb-1 group-hover:text-emerald-900">
                Garantía Simple
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Usar cuando todos los lotes y bienes corresponden a un mismo <strong>Garantía Con</strong> (Farmer Rechnung, Campo Grande o un Cliente particular).
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-100 text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
              <span>Continuar con Garantía Simple</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>

          {/* Opción 2: Garantía Múltiple / Detallada */}
          <button
            type="button"
            onClick={() => setModalidad('Múltiple')}
            className="p-5 bg-white border-2 border-slate-200 hover:border-emerald-600 rounded-lg text-left shadow-2xs hover:shadow-md transition group cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-bold text-[10px] uppercase tracking-wider">
                  Operaciones Combinadas
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-1" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm uppercase tracking-tight mb-1 group-hover:text-emerald-900">
                Garantía Múltiple / Detallada
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Permite combinar dentro de la misma solicitud varios lotes, vehículos o maquinarias, y además <strong>cada línea puede tener su propio Garantía Con</strong>.
              </p>
            </div>
            <div className="pt-4 mt-3 border-t border-slate-100 text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
              <span>Continuar con Garantía Múltiple</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onNavigate('garantias')}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
          >
            Volver a la lista de Garantías Activas
          </button>
        </div>
      </div>
    );
  }

  // Resultados a mostrar en los modales: búsquedas remotas o disponibles en memoria
  const displayLotes = loteSearchResults !== null ? loteSearchResults : availableLotes;
  const displayBienes = bienSearchResults !== null ? bienSearchResults : availableBienes;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Encabezado con Switch de Modalidad */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <FilePlus className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
                Nueva Garantía — {modalidad === 'Simple' ? 'Garantía Simple' : 'Garantía Múltiple / Detallada'}
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 uppercase">
                {modalidad}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Asoc. Civil "Colonia Chihuahua" — Registro oficial en Google Sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-0.5 rounded border border-slate-300 flex text-xs">
            <button
              type="button"
              onClick={() => setModalidad('Simple')}
              className={`px-2 py-1 rounded font-semibold transition cursor-pointer ${
                modalidad === 'Simple'
                  ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setModalidad('Múltiple')}
              className={`px-2 py-1 rounded font-semibold transition cursor-pointer ${
                modalidad === 'Múltiple'
                  ? 'bg-white text-purple-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Múltiple
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('garantias')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded border border-slate-300 bg-white cursor-pointer"
          >
            Volver
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
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
            <span>SECCIÓN 1 — Solicitud y Fechas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                N.º de Solicitud
              </label>
              <input
                type="text"
                value={numeroSolicitud}
                onChange={(e) => setNumeroSolicitud(e.target.value)}
                placeholder="Ej. 7097 (opcional)"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Identificador de Farmer Rechnung, Campo Grande o solicitud física. Opcional (puede quedar vacío).
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
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Fecha oficial de registro de la garantía.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Fecha de Vencimiento
                </label>
                {fechaVencimiento && (
                  <button
                    type="button"
                    onClick={() => setFechaVencimiento('')}
                    className="text-[10px] text-red-600 hover:text-red-800 underline cursor-pointer"
                  >
                    Borrar fecha
                  </button>
                )}
              </div>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Opcional. Dejar vacío si la garantía no tiene vencimiento.
              </p>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: INTERVINIENTES (PROPIETARIO Y PRESTATARIO) */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
            <User className="w-4 h-4 text-emerald-800" />
            <span>SECCIÓN 2 — Titulares de la Operación</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Prestatario: persona que hace/solicita el préstamo */}
            <div>
              <ClientSearchAutocomplete
                label="Prestatario (Cuenta en Garantía)"
                placeholder="Buscar prestatario por cuenta o nombre..."
                clientesList={clientesList}
                selectedCuenta={selectedPrestatario?.cuenta}
                onSelect={setSelectedPrestatario}
                required
                helperText="Persona que solicita el préstamo y compromete el bien en garantía."
              />
            </div>

            {/* Propietario del bien/lote */}
            <div>
              <ClientSearchAutocomplete
                label="Propietario del Bien o Parcela"
                placeholder="Buscar dueño por cuenta o nombre..."
                clientesList={clientesList}
                selectedCuenta={selectedPropietario?.cuenta}
                onSelect={setSelectedPropietario}
                required
                helperText="Dueño legal del bien (puede ser el prestatario o un garante)."
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: GARANTÍA CON (INSTITUCIÓN / ACREEDOR) */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100 text-xs font-bold uppercase tracking-wider text-slate-700">
            <Building2 className="w-4 h-4 text-emerald-800" />
            <span>
              SECCIÓN 3 — Garantía Constituida Con {modalidad === 'Múltiple' ? '(General / Predeterminado)' : ''}
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              {modalidad === 'Múltiple'
                ? 'Seleccione el acreedor por defecto (en modalidad múltiple, cada elemento puede personalizarse):'
                : 'Todos los elementos de esta garantía quedarán constituidos en favor de:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setGarantiaConTipo('Farmer Rechnung');
                  setSelectedGarantiaCliente(null);
                }}
                className={`py-2 px-3 text-xs font-bold rounded border transition text-left flex items-center justify-between cursor-pointer ${
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
                className={`py-2 px-3 text-xs font-bold rounded border transition text-left flex items-center justify-between cursor-pointer ${
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
                className={`py-2 px-3 text-xs font-bold rounded border transition text-left flex items-center justify-between cursor-pointer ${
                  garantiaConTipo === 'Cliente'
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>Cliente registrado</span>
                {garantiaConTipo === 'Cliente' && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Si selecciona "Cliente registrado", mostrar buscador */}
            {garantiaConTipo === 'Cliente' && (
              <div className="pt-2">
                <ClientSearchAutocomplete
                  label="Cliente Receptor de la Garantía (Google Sheets)"
                  placeholder="Buscar cliente registrado por N.º de cuenta o nombre..."
                  clientesList={clientesList}
                  selectedCuenta={selectedGarantiaCliente?.cuenta}
                  onSelect={setSelectedGarantiaCliente}
                  required
                  helperText="Al seleccionar un cliente registrado, se vinculará su cuenta y nombre oficiales de Google Sheets."
                />
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 4: BIENES Y PARCELAS DADOS EN GARANTÍA */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <Layers className="w-4 h-4 text-emerald-800" />
              <span>SECCIÓN 4 — Detalle de Bienes y Parcelas</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTargetLote(null);
                  setTargetLoteHa(0);
                  setIsLoteModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded border border-emerald-300 transition cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>+ Añadir Lote / Parcela</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTargetBien(null);
                  setTargetBienValUSD(0);
                  setIsBienModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-900 bg-blue-100 hover:bg-blue-200 rounded border border-blue-300 transition cursor-pointer"
              >
                <Tractor className="w-3.5 h-3.5" />
                <span>+ Añadir Vehículo / Maquinaria</span>
              </button>
            </div>
          </div>

          {/* TABLA COMPACTA ESTILO EXCEL */}
          <div className="border border-slate-200 rounded overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 border-b border-slate-300 select-none">
                <tr>
                  <th className="py-1.5 px-3 font-bold border-r border-slate-200">Bien / Lote</th>
                  <th className="py-1.5 px-3 font-bold border-r border-slate-200">Tipo</th>
                  <th className="py-1.5 px-3 font-bold border-r border-slate-200 text-right">Cantidad / Valor</th>
                  <th className="py-1.5 px-3 font-bold border-r border-slate-200">Garantía Con</th>
                  <th className="py-1.5 px-3 font-bold text-center w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {/* Lotes */}
                {selectedLotes.map((lote) => (
                  <tr key={`lot-${lote.idLote}`} className="hover:bg-emerald-50/40">
                    <td className="py-1.5 px-3 border-r border-slate-200 font-mono font-bold text-emerald-950">
                      Lote {lote.numeroLote}
                      {lote.ubicacion && (
                        <span className="text-[10px] text-slate-400 font-sans ml-1">({lote.ubicacion})</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-slate-700">
                      Terreno / Parcela
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-900">
                      {formatHectareas(lote.hectareas)}
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 font-semibold text-slate-800">
                      {lote.garantiaConNombre || garantiaConTipo}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLote(lote.idLote)}
                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition cursor-pointer"
                        title="Quitar de la garantía"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Bienes */}
                {selectedBienes.map((bien) => {
                  const valUSD = Number(bien.valorGarantiaUSD) || 0;
                  return (
                    <tr key={`bien-${bien.idBien}`} className="hover:bg-blue-50/40">
                      <td className="py-1.5 px-3 border-r border-slate-200 font-mono font-bold text-blue-950">
                        {bien.numeroPoliza} — {bien.descripcion || bien.marca || bien.tipoBien}
                        {bien.placa && (
                          <span className="text-[10px] text-slate-400 font-mono ml-1">[{bien.placa}]</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-slate-700">
                        {bien.tipoBien}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-emerald-950">
                        $us. {valUSD.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-200 font-semibold text-slate-800">
                        {bien.garantiaConNombre || garantiaConTipo}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBien(bien.idBien)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition cursor-pointer"
                          title="Quitar de la garantía"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {selectedLotes.length === 0 && selectedBienes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                      No se han agregado lotes ni bienes a esta solicitud. Use los botones superiores para añadir.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TOTALES ESTRICTAMENTE SEPARADOS (HECTÁREAS Y DÓLARES) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 uppercase text-[10px]">Superficie Total en Garantía:</span>
              <strong className="font-mono text-sm text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                {formatHectareas(totalHectareas)}
              </strong>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-600 uppercase text-[10px]">Valor Total de Bienes en Garantía:</span>
              <strong className="font-mono text-sm text-emerald-950 bg-white px-2 py-0.5 rounded border border-emerald-300">
                $us. {totalValorUSD.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>

        {/* OBSERVACIÓN Y RESUMEN */}
        <div className="bg-white p-4 rounded border border-slate-200 shadow-2xs space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Observaciones Institucionales / Términos
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              placeholder="Detalles sobre acuerdos, fechas o condiciones especiales..."
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          {/* BOTONES DE ACCIÓN: GUARDAR / IMPRIMIR SIN GUARDAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-200">
            <div>
              {tieneOperacionCliente && (
                <button
                  type="button"
                  onClick={handlePrintWithoutSaving}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition cursor-pointer shadow-2xs"
                  title="Prepara e imprime el contrato entre clientes sin alterar la base de datos ni reservar disponibilidad"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir Sin Guardar (Contrato Previo)</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onNavigate('garantias')}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-xs transition cursor-pointer disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Validando con Google Sheets...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Guardar Garantía</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* MODAL SELECCIONAR LOTE */}
      {isLoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Seleccionar Lote / Parcela</span>
              </h3>
              <button
                onClick={() => setIsLoteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
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
              {isSearchingLotes ? (
                <div className="p-8 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-emerald-800" />
                  <span className="font-semibold text-xs text-slate-700">Buscando lotes...</span>
                  <span className="text-[11px] text-slate-400">Consultando registros oficiales en Google Sheets</span>
                </div>
              ) : loteSearchError ? (
                <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center gap-2 text-xs">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="font-semibold">No se pudo cargar la información.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoteSearchError(false);
                      setIsSearchingLotes(true);
                      obtenerLotes(true)
                        .then((lotes) => setAvailableLotes(lotes))
                        .catch(() => setLoteSearchError(true))
                        .finally(() => setIsSearchingLotes(false));
                    }}
                    className="mt-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold transition cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              ) : displayLotes.length > 0 ? (
                displayLotes.map((lote) => {
                  const isBlocked = lote.estado === 'Bloqueado';
                  const isInactive = lote.estado === 'Inactivo';
                  const disp =
                    lote.hectareasDisponibles !== undefined && lote.hectareasDisponibles !== null
                      ? lote.hectareasDisponibles
                      : lote.hectareas;
                  const haTotales = lote.hectareas || 0;
                  const haEnGarantia =
                    lote.hectareasEnGarantia !== undefined
                      ? lote.hectareasEnGarantia
                      : lote.enGarantia
                      ? haTotales
                      : 0;

                  const isAlreadySelected = selectedLotes.some((l) => l.idLote === lote.idLote);
                  const noDisp = disp <= 0;
                  const isDisabled = isBlocked || isInactive || isAlreadySelected || noDisp;

                  let reason = '';
                  if (isAlreadySelected) reason = 'Ya añadido en este formulario';
                  else if (isBlocked) reason = `Bloqueado administrativamente (${lote.motivoBloqueo || 'Sin motivo'})`;
                  else if (isInactive) reason = 'Lote inactivo';
                  else if (noDisp) reason = 'Sin hectáreas disponibles (100% en garantía)';

                  return (
                    <div
                      key={lote.idLote}
                      className={`p-2.5 flex items-center justify-between text-xs transition ${
                        isDisabled ? 'bg-slate-50 opacity-60' : 'hover:bg-emerald-50 cursor-pointer'
                      }`}
                      onClick={() => !isDisabled && handleSelectLoteForAdd(lote)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-mono font-bold text-emerald-950 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                            Lote {lote.numeroLote}
                          </span>
                          <span className="font-semibold text-slate-800">{lote.propietario}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Cta: {lote.cuentaPropietario}</span>
                          {lote.encargado && (
                            <span className="text-[10px] text-slate-500">
                              (Encargado: {lote.encargado}{lote.cuentaEncargado ? ` - Cta: ${lote.cuentaEncargado}` : ''})
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                              lote.estado === 'Disponible'
                                ? 'bg-slate-50 text-slate-700 border-slate-200'
                                : lote.estado === 'Bloqueado'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-red-50 text-red-800 border-red-200'
                            }`}
                          >
                            {lote.estado}
                          </span>
                          {lote.enGarantia && disp > 0 && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                              Parcialmente en Garantía
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                          <span>Ubicación: {lote.ubicacion || '—'}</span>
                          <span>Total: <strong>{formatHectareas(haTotales)}</strong></span>
                          {haEnGarantia > 0 && (
                            <span>En garantía: <strong className="text-purple-800">{formatHectareas(haEnGarantia)}</strong></span>
                          )}
                          <span>
                            Disponible:{' '}
                            <strong className={disp > 0 ? 'text-emerald-800' : 'text-red-700'}>
                              {formatHectareas(disp)}
                            </strong>
                          </span>
                        </div>
                        {reason && (
                          <div className="text-[10px] text-amber-700 font-medium mt-0.5">{reason}</div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLoteForAdd(lote);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Seleccionar
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No se encontraron lotes que coincidan con la búsqueda.
                </div>
              )}
            </div>

            {/* FORMULARIO DE DETALLE DE LOTE SELECCIONADO */}
            {targetLote && (
              <div className="p-3 bg-emerald-50/60 border-t border-emerald-200 space-y-2 text-xs">
                <div className="font-bold text-emerald-950 flex items-center justify-between">
                  <span>
                    Configurar compromiso: Lote {targetLote.numeroLote} ({targetLote.propietario})
                  </span>
                  <span className="text-[11px] text-emerald-800 font-mono">
                    Disponible: {formatHectareas(targetLote.hectareasDisponibles !== undefined ? targetLote.hectareasDisponibles : targetLote.hectareas)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Hectáreas a Poner en Garantía:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={targetLoteHa}
                      onChange={(e) => setTargetLoteHa(parseFloat(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded font-mono font-bold text-xs"
                    />
                  </div>

                  {modalidad === 'Múltiple' ? (
                    <div className="pt-1 space-y-2 border-t border-emerald-200">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Garantía Constituida Con (Acreedor de este lote):
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetLoteGarantiaCon('Farmer Rechnung');
                            setTargetLoteCliente(null);
                          }}
                          className={`py-1 px-2 text-[11px] font-bold rounded border transition text-center cursor-pointer ${
                            targetLoteGarantiaCon === 'Farmer Rechnung'
                              ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Farmer Rechnung
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetLoteGarantiaCon('Campo Grande');
                            setTargetLoteCliente(null);
                          }}
                          className={`py-1 px-2 text-[11px] font-bold rounded border transition text-center cursor-pointer ${
                            targetLoteGarantiaCon === 'Campo Grande'
                              ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Campo Grande
                        </button>

                        <button
                          type="button"
                          onClick={() => setTargetLoteGarantiaCon('Cliente')}
                          className={`py-1 px-2 text-[11px] font-bold rounded border transition text-center cursor-pointer ${
                            targetLoteGarantiaCon === 'Cliente'
                              ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Cliente registrado
                        </button>
                      </div>

                      {targetLoteGarantiaCon === 'Cliente' && (
                        <div className="pt-1">
                          <ClientSearchAutocomplete
                            label="Cliente Receptor de este Lote"
                            placeholder="Buscar cliente registrado por cuenta o nombre..."
                            clientesList={clientesList}
                            selectedCuenta={targetLoteCliente?.cuenta}
                            onSelect={setTargetLoteCliente}
                            required
                            helperText="Seleccione el cliente particular que recibe la garantía sobre este lote."
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-600 bg-emerald-100/50 p-2 rounded border border-emerald-200">
                      Acreedor asignado: <strong>{garantiaConTipo === 'Cliente' && selectedGarantiaCliente ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}` : garantiaConTipo}</strong>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetLote(null)}
                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded border border-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddLote}
                    className="px-4 py-1 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded"
                  >
                    Confirmar y Añadir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL SELECCIONAR BIEN */}
      {isBienModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Tractor className="w-4 h-4 text-blue-400" />
                <span>Seleccionar Vehículo, Maquinaria o Implemento</span>
              </h3>
              <button
                onClick={() => setIsBienModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
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
                  placeholder="Buscar por N.º de póliza, tipo, marca, propietario o placa..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>
            </div>

            <div className="overflow-y-auto p-3 flex-1 divide-y divide-slate-100">
              {isSearchingBienes ? (
                <div className="p-8 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-800" />
                  <span className="font-semibold text-xs text-slate-700">Buscando bienes...</span>
                  <span className="text-[11px] text-slate-400">Consultando registros oficiales en Google Sheets</span>
                </div>
              ) : bienSearchError ? (
                <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center gap-2 text-xs">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="font-semibold">No se pudo cargar la información.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBienSearchError(false);
                      setIsSearchingBienes(true);
                      obtenerBienes(true)
                        .then((b) => setAvailableBienes(b))
                        .catch(() => setBienSearchError(true))
                        .finally(() => setIsSearchingBienes(false));
                    }}
                    className="mt-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold transition cursor-pointer"
                  >
                    Reintentar
                  </button>
                </div>
              ) : displayBienes.length > 0 ? (
                displayBienes.map((bien) => {
                  const isBlocked = bien.estado === 'Bloqueado';
                  const isInactive = bien.estado === 'Inactivo';
                  const isAlreadyInWarranty = !!bien.enGarantia;
                  const isAlreadySelected = selectedBienes.some((b) => b.idBien === bien.idBien);
                  const isDisabled = isBlocked || isInactive || isAlreadyInWarranty || isAlreadySelected;

                  let reason = '';
                  if (isAlreadySelected) reason = 'Ya añadido en este formulario';
                  else if (isBlocked) reason = `Bloqueado administrativamente (${bien.motivoBloqueo || 'Sin motivo'})`;
                  else if (isInactive) reason = 'Bien inactivo';
                  else if (isAlreadyInWarranty) reason = `Ya está en la garantía activa ${bien.solicitudGarantiaActiva || ''}`;

                  return (
                    <div
                      key={bien.idBien}
                      className={`p-2.5 flex items-center justify-between text-xs transition ${
                        isDisabled ? 'bg-slate-50 opacity-60' : 'hover:bg-blue-50 cursor-pointer'
                      }`}
                      onClick={() => !isDisabled && handleSelectBienForAdd(bien)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="font-mono font-bold text-blue-950 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                            {bien.numeroPoliza}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {bien.tipoBien} {bien.descripcion ? `- ${bien.descripcion}` : ''}
                          </span>
                          {(bien.marca || bien.modelo) && (
                            <span className="text-[11px] text-slate-500 font-mono">
                              ({bien.marca} {bien.modelo})
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${
                              bien.estado === 'Disponible'
                                ? 'bg-slate-50 text-slate-700 border-slate-200'
                                : bien.estado === 'Bloqueado'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-red-50 text-red-800 border-red-200'
                            }`}
                          >
                            {bien.estado}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                          <span>Propietario: {bien.propietario} (Cta: {bien.cuentaPropietario})</span>
                          {bien.encargado && (
                            <span>
                              Encargado: {bien.encargado}{bien.cuentaEncargado ? ` (Cta: ${bien.cuentaEncargado})` : ''}
                            </span>
                          )}
                          {bien.placa && <span>Placa: {bien.placa}</span>}
                          {bien.ubicacion && <span>Ubicación: {bien.ubicacion}</span>}
                        </div>
                        {reason && (
                          <div className="text-[10px] text-amber-700 font-medium mt-0.5">{reason}</div>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectBienForAdd(bien);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-900 rounded disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Seleccionar
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-slate-400 italic text-xs">
                  No se encontraron bienes que coincidan con la búsqueda.
                </div>
              )}
            </div>

            {/* FORMULARIO DE DETALLE DE BIEN SELECCIONADO */}
            {targetBien && (
              <div className="p-3 bg-blue-50/60 border-t border-blue-200 space-y-2 text-xs">
                <div className="font-bold text-blue-950 flex items-center justify-between">
                  <span>
                    Configurar compromiso: Póliza {targetBien.numeroPoliza} ({targetBien.tipoBien})
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      VALOR EN GARANTÍA ($us.):
                    </label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={targetBienValUSD}
                      onChange={(e) => setTargetBienValUSD(parseFloat(e.target.value) || 0)}
                      placeholder="Ej: 50000"
                      className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded font-mono font-bold text-xs"
                    />
                  </div>

                  {modalidad === 'Múltiple' ? (
                    <div className="pt-1 space-y-2 border-t border-blue-200">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Garantía Constituida Con (Acreedor de este bien):
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTargetBienGarantiaCon('Farmer Rechnung');
                            setTargetBienCliente(null);
                          }}
                          className={`py-1 px-2 text-[11px] font-bold rounded border transition text-center cursor-pointer ${
                            targetBienGarantiaCon === 'Farmer Rechnung'
                              ? 'bg-blue-800 text-white border-blue-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Farmer Rechnung
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTargetBienGarantiaCon('Campo Grande');
                            setTargetBienCliente(null);
                          }}
                          className={`py-1 px-2 text-[11px] font-bold rounded border transition text-center cursor-pointer ${
                            targetBienGarantiaCon === 'Campo Grande'
                              ? 'bg-blue-800 text-white border-blue-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Campo Grande
                        </button>

                        <button
                          type="button"
                          onClick={() => setTargetBienGarantiaCon('Cliente')}
                          className={`py-1 px-2 text-[11px] font-bold rounded border transition text-center cursor-pointer ${
                            targetBienGarantiaCon === 'Cliente'
                              ? 'bg-blue-800 text-white border-blue-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          Cliente registrado
                        </button>
                      </div>

                      {targetBienGarantiaCon === 'Cliente' && (
                        <div className="pt-1">
                          <ClientSearchAutocomplete
                            label="Cliente Receptor de este Bien"
                            placeholder="Buscar cliente registrado por cuenta o nombre..."
                            clientesList={clientesList}
                            selectedCuenta={targetBienCliente?.cuenta}
                            onSelect={setTargetBienCliente}
                            required
                            helperText="Seleccione el cliente particular que recibe la garantía sobre este bien."
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-600 bg-blue-100/50 p-2 rounded border border-blue-200">
                      Acreedor asignado: <strong>{garantiaConTipo === 'Cliente' && selectedGarantiaCliente ? `${selectedGarantiaCliente.cuenta} — ${selectedGarantiaCliente.nombre}` : garantiaConTipo}</strong>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetBien(null)}
                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded border border-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddBien}
                    className="px-4 py-1 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded"
                  >
                    Confirmar y Añadir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA DE IMPRESIÓN SIN GUARDAR */}
      {printPreviewGarantia && (
        <ImpresionGarantia
          garantia={printPreviewGarantia}
          onClose={() => setPrintPreviewGarantia(null)}
        />
      )}
    </div>
  );
};
