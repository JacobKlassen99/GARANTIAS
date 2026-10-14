import React, { useState, useEffect, useRef } from 'react';
import { X, Search, RefreshCw, AlertCircle, MapPin } from 'lucide-react';
import { Lote, Cliente, GarantiaLoteRelacion, TipoGarantiaCon } from '../../types';
import { obtenerLotes, buscarLotes } from '../../services/backend';
import { getFromMemoryCache } from '../../services/dataCache';
import { formatHectareas, parseDecimal } from '../../utils/textSearch';
import { ClientSearchAutocomplete } from './ClientSearchAutocomplete';

export interface SeleccionarLoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLote: (loteRel: GarantiaLoteRelacion) => void;
  alreadySelectedLoteIds: (string | number)[];
  originalGarantiaLotes?: { idLote: string | number; hectareas: number }[];
  clientesList: Cliente[];
  modalidad: 'Simple' | 'Múltiple';
  defaultGarantiaConTipo?: TipoGarantiaCon;
  defaultGarantiaCliente?: Cliente | null;
  availableLotes?: Lote[];
}

export const SeleccionarLoteModal: React.FC<SeleccionarLoteModalProps> = ({
  isOpen,
  onClose,
  onSelectLote,
  alreadySelectedLoteIds,
  originalGarantiaLotes = [],
  clientesList,
  modalidad,
  defaultGarantiaConTipo = 'Farmer Rechnung',
  defaultGarantiaCliente = null,
  availableLotes: propAvailableLotes,
}) => {
  const [internalAvailableLotes, setInternalAvailableLotes] = useState<Lote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Lote[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // Lote objetivo que el usuario está configurando
  const [targetLote, setTargetLote] = useState<Lote | null>(null);
  const [targetLoteHa, setTargetLoteHa] = useState<number | string>(0);
  const [targetLoteGarantiaCon, setTargetLoteGarantiaCon] = useState<TipoGarantiaCon>(defaultGarantiaConTipo);
  const [targetLoteCliente, setTargetLoteCliente] = useState<Cliente | null>(defaultGarantiaCliente);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializar o cargar la lista base de lotes al abrir
  useEffect(() => {
    if (!isOpen) return;

    setSearchError(false);
    setSearchTerm('');
    setSearchResults(null);
    setTargetLote(null);

    if (propAvailableLotes && propAvailableLotes.length > 0) {
      setInternalAvailableLotes(propAvailableLotes);
    } else {
      setIsSearching(true);
      obtenerLotes()
        .then((lotes) => {
          setInternalAvailableLotes(lotes);
        })
        .catch(() => {
          setSearchError(true);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }
  }, [isOpen, propAvailableLotes]);

  // Si propAvailableLotes cambia externamente
  useEffect(() => {
    if (propAvailableLotes && propAvailableLotes.length > 0) {
      setInternalAvailableLotes(propAvailableLotes);
    }
  }, [propAvailableLotes]);

  // Búsqueda interactiva con debounce y filtrado local inmediato
  useEffect(() => {
    if (!isOpen) return;
    const clean = searchTerm.trim();
    if (!clean) {
      setSearchResults(null);
      setIsSearching(false);
      setSearchError(false);
      return;
    }

    // 1. Revisar caché en memoria
    const searchKey = `search:${clean.toLowerCase()}`;
    const cached = getFromMemoryCache<Lote[]>('lotes', searchKey);
    if (cached) {
      setSearchResults(cached);
      setIsSearching(false);
      setSearchError(false);
      return;
    }

    // 2. Filtrado inmediato si hay lotes en memoria
    if (internalAvailableLotes.length > 0) {
      const lower = clean.toLowerCase();
      const localMatches = internalAvailableLotes.filter(
        (l) =>
          (l.numeroLote || '').toLowerCase().includes(lower) ||
          (l.propietario || '').toLowerCase().includes(lower) ||
          String(l.cuentaPropietario || '').includes(lower) ||
          (l.ubicacion || '').toLowerCase().includes(lower)
      );
      if (localMatches.length > 0) {
        setSearchResults(localMatches);
      }
    }

    // 3. Consulta debounced al backend
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
      try {
        const results = await buscarLotes(clean);
        setSearchResults(results);
      } catch {
        setSearchError(true);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm, isOpen, internalAvailableLotes]);

  if (!isOpen) return null;

  const displayLotes = searchResults !== null ? searchResults : internalAvailableLotes;

  const handleSelectLoteForAdd = (lote: Lote) => {
    setTargetLote(lote);

    const originalItem = originalGarantiaLotes.find(
      (orig) => String(orig.idLote) === String(lote.idLote)
    );
    const originalHa = originalItem ? Number(originalItem.hectareas) || 0 : 0;
    const rawDisp =
      lote.hectareasDisponibles !== undefined && lote.hectareasDisponibles !== null
        ? lote.hectareasDisponibles
        : lote.hectareas || 0;
    const disp = rawDisp + originalHa;

    setTargetLoteHa(disp > 0 ? disp : lote.hectareas || 0);
    setTargetLoteGarantiaCon(defaultGarantiaConTipo);
    setTargetLoteCliente(defaultGarantiaCliente);
  };

  const handleConfirmAddLote = () => {
    if (!targetLote) return;
    const haNum = parseDecimal(targetLoteHa);
    if (haNum <= 0) {
      alert('Las hectáreas a poner en garantía deben ser mayores a 0.');
      return;
    }

    if (targetLoteGarantiaCon === 'Cliente' && !targetLoteCliente) {
      alert('Ha seleccionado "Cliente registrado", debe seleccionar obligatoriamente un cliente para este lote.');
      return;
    }

    const originalItem = originalGarantiaLotes.find(
      (orig) => String(orig.idLote) === String(targetLote.idLote)
    );
    const originalHa = originalItem ? Number(originalItem.hectareas) || 0 : 0;
    const rawDisp =
      targetLote.hectareasDisponibles !== undefined && targetLote.hectareasDisponibles !== null
        ? targetLote.hectareasDisponibles
        : targetLote.hectareas || 0;
    const disp = rawDisp + originalHa;

    const gTipo = targetLoteGarantiaCon;
    const gNombre =
      gTipo === 'Cliente' && targetLoteCliente
        ? `${targetLoteCliente.cuenta} — ${targetLoteCliente.nombre}`
        : gTipo;
    const gCuenta =
      gTipo === 'Cliente' && targetLoteCliente ? targetLoteCliente.cuenta : undefined;

    const rel: GarantiaLoteRelacion = {
      idLote: targetLote.idLote,
      numeroLote: targetLote.numeroLote,
      hectareas: haNum,
      hectareasTotales: targetLote.hectareas,
      hectareasDisponibles: disp,
      propietario: targetLote.propietario,
      cuentaPropietario: targetLote.cuentaPropietario,
      ubicacion: targetLote.ubicacion,
      encargado: targetLote.encargado,
      garantiaConTipo: gTipo,
      garantiaConCuenta: gCuenta,
      garantiaConNombre: gNombre,
    };

    onSelectLote(rel);
    setTargetLote(null);
    setTargetLoteHa(0);
    setSearchTerm('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>Seleccionar Lote / Parcela</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buscador */}
        <div className="p-3 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por N.º de lote, propietario, cuenta o ubicación..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>
        </div>

        {/* Lista de lotes */}
        <div className="overflow-y-auto p-3 flex-1 divide-y divide-slate-100">
          {isSearching && displayLotes.length === 0 ? (
            <div className="p-8 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-800" />
              <span className="font-semibold text-xs text-slate-700">Buscando lotes...</span>
              <span className="text-[11px] text-slate-400">Consultando registros oficiales en Google Sheets</span>
            </div>
          ) : searchError ? (
            <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center gap-2 text-xs">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="font-semibold">No se pudo cargar la información.</span>
              <button
                type="button"
                onClick={() => {
                  setSearchError(false);
                  setIsSearching(true);
                  obtenerLotes(true)
                    .then((lotes) => setInternalAvailableLotes(lotes))
                    .catch(() => setSearchError(true))
                    .finally(() => setIsSearching(false));
                }}
                className="mt-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold transition cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : displayLotes.length > 0 ? (
            displayLotes.map((lote) => {
              const originalItem = originalGarantiaLotes.find(
                (orig) => String(orig.idLote) === String(lote.idLote)
              );
              const originalHa = originalItem ? Number(originalItem.hectareas) || 0 : 0;

              const isBlocked = lote.estado === 'Bloqueado';
              const isInactive = lote.estado === 'Inactivo';
              const rawDisp =
                lote.hectareasDisponibles !== undefined && lote.hectareasDisponibles !== null
                  ? lote.hectareasDisponibles
                  : lote.hectareas || 0;
              // Si este lote ya pertenecía a esta garantía originalmente, reconocemos sus hectáreas comprometidas para no bloquearlo
              const disp = rawDisp + originalHa;
              const haTotales = lote.hectareas || 0;
              const haEnGarantiaTotal =
                lote.hectareasEnGarantia !== undefined
                  ? lote.hectareasEnGarantia
                  : lote.enGarantia
                  ? haTotales
                  : 0;
              const haEnGarantiaOtras = Math.max(0, haEnGarantiaTotal - originalHa);

              const isAlreadySelected = alreadySelectedLoteIds.some(
                (id) => String(id) === String(lote.idLote)
              );
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
                      {haEnGarantiaOtras > 0 && disp > 0 && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
                          Parcialmente en Garantía
                        </span>
                      )}
                      {originalHa > 0 && !isAlreadySelected && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                          De esta garantía ({formatHectareas(originalHa)} ha)
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                      <span>Ubicación: {lote.ubicacion || '—'}</span>
                      <span>Total: <strong>{formatHectareas(haTotales)}</strong></span>
                      {haEnGarantiaOtras > 0 && (
                        <span>Otras garantías: <strong className="text-purple-800">{formatHectareas(haEnGarantiaOtras)}</strong></span>
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

        {/* Formulario de detalle del lote seleccionado */}
        {targetLote && (
          <div className="p-3 bg-emerald-50/60 border-t border-emerald-200 space-y-2 text-xs">
            <div className="font-bold text-emerald-950 flex items-center justify-between">
              <span>
                Configurar compromiso: Lote {targetLote.numeroLote} ({targetLote.propietario})
              </span>
              <span className="text-[11px] text-emerald-800 font-mono">
                {(() => {
                  const orig = originalGarantiaLotes.find(
                    (o) => String(o.idLote) === String(targetLote.idLote)
                  );
                  const oHa = orig ? Number(orig.hectareas) || 0 : 0;
                  const rawDisp =
                    targetLote.hectareasDisponibles !== undefined && targetLote.hectareasDisponibles !== null
                      ? targetLote.hectareasDisponibles
                      : targetLote.hectareas || 0;
                  return `Disponible: ${formatHectareas(rawDisp + oHa)}`;
                })()}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hectáreas a Poner en Garantía:
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={targetLoteHa}
                  onChange={(e) => setTargetLoteHa(e.target.value)}
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
                  Acreedor asignado:{' '}
                  <strong>
                    {defaultGarantiaConTipo === 'Cliente' && defaultGarantiaCliente
                      ? `${defaultGarantiaCliente.cuenta} — ${defaultGarantiaCliente.nombre}`
                      : defaultGarantiaConTipo}
                  </strong>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTargetLote(null)}
                className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded border border-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAddLote}
                className="px-4 py-1 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-900 rounded cursor-pointer"
              >
                Confirmar y Añadir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
