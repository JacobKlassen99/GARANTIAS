import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, RefreshCw, AlertCircle, Tractor } from 'lucide-react';
import { Bien, Cliente, GarantiaBienRelacion, TipoGarantiaCon } from '../../types';
import { obtenerBienes } from '../../services/backend';
import { ClientSearchAutocomplete } from './ClientSearchAutocomplete';

export interface SeleccionarBienModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBien: (bienRel: GarantiaBienRelacion) => void;
  alreadySelectedBienIds: (string | number)[];
  originalGarantiaBienIds?: (string | number)[];
  currentNumeroSolicitud?: string;
  clientesList: Cliente[];
  modalidad: 'Simple' | 'Múltiple';
  defaultGarantiaConTipo?: TipoGarantiaCon;
  defaultGarantiaCliente?: Cliente | null;
  availableBienes?: Bien[];
}

/**
 * Convierte cualquier valor (string, number, object, null, undefined) a un string limpio
 * sin acentos, en minúsculas y sin espacios sobrantes.
 */
function safeNormalizeString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const str = [obj.nombre, obj.cuenta, obj.idBien, obj.numeroPoliza]
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v))
      .join(' ');
    if (str.trim()) {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }
  }
  try {
    return String(val)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  } catch {
    return '';
  }
}

/**
 * Función ultra-segura para comparar un bien con el término de búsqueda.
 * Permite buscar por número de póliza, descripción, tipo de bien, marca, modelo,
 * placa, propietario y número de cuenta del propietario.
 * Tolera acentos, mayúsculas/minúsculas, campos nulos/undefined o valores numéricos.
 */
function matchesBienQuery(bien: Bien, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!bien || typeof bien !== 'object') return false;

  const cleanQuery = safeNormalizeString(query);
  if (!cleanQuery) return true;

  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);

  const searchFields = [
    bien.idBien,
    bien.numeroPoliza,
    bien.descripcion,
    bien.tipoBien,
    bien.marca,
    bien.modelo,
    bien.placa,
    bien.propietario,
    bien.cuentaPropietario,
    bien.ubicacion,
    bien.encargado,
    bien.cuentaEncargado,
    bien.estado,
  ];

  const combinedText = searchFields
    .map((field) => safeNormalizeString(field))
    .filter(Boolean)
    .join(' ');

  return queryTokens.every((token) => combinedText.includes(token));
}

export const SeleccionarBienModal: React.FC<SeleccionarBienModalProps> = ({
  isOpen,
  onClose,
  onSelectBien,
  alreadySelectedBienIds = [],
  originalGarantiaBienIds = [],
  currentNumeroSolicitud,
  clientesList = [],
  modalidad,
  defaultGarantiaConTipo = 'Farmer Rechnung',
  defaultGarantiaCliente = null,
  availableBienes: propAvailableBienes,
}) => {
  const [internalAvailableBienes, setInternalAvailableBienes] = useState<Bien[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Bien objetivo que el usuario está configurando
  const [targetBien, setTargetBien] = useState<Bien | null>(null);
  const [targetBienValUSD, setTargetBienValUSD] = useState<number>(0);
  const [targetBienGarantiaCon, setTargetBienGarantiaCon] = useState<TipoGarantiaCon>(defaultGarantiaConTipo);
  const [targetBienCliente, setTargetBienCliente] = useState<Cliente | null>(defaultGarantiaCliente);

  // Cargar lista base de bienes al abrir el modal si no están disponibles
  useEffect(() => {
    if (!isOpen) return;

    setLoadError(false);
    setSearchTerm('');
    setTargetBien(null);

    if (Array.isArray(propAvailableBienes) && propAvailableBienes.length > 0) {
      setInternalAvailableBienes(propAvailableBienes);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      obtenerBienes()
        .then((bienes) => {
          setInternalAvailableBienes(Array.isArray(bienes) ? bienes : []);
        })
        .catch(() => {
          setLoadError(true);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, propAvailableBienes]);

  // Actualizar si propAvailableBienes cambia externamente y trae datos
  useEffect(() => {
    if (Array.isArray(propAvailableBienes) && propAvailableBienes.length > 0) {
      setInternalAvailableBienes(propAvailableBienes);
    }
  }, [propAvailableBienes]);

  // Filtrado instantáneo e in-memory en memoria RAM
  const filteredBienes = useMemo(() => {
    if (!Array.isArray(internalAvailableBienes)) return [];
    return internalAvailableBienes.filter((b) => matchesBienQuery(b, searchTerm));
  }, [internalAvailableBienes, searchTerm]);

  if (!isOpen) return null;

  const handleSelectBienForAdd = (bien: Bien) => {
    setTargetBien(bien);
    setTargetBienValUSD(bien.valorGarantiaUSD || 0);
    setTargetBienGarantiaCon(defaultGarantiaConTipo);
    setTargetBienCliente(defaultGarantiaCliente);
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
      gTipo === 'Cliente' && targetBienCliente ? targetBienCliente.cuenta : undefined;

    const rel: GarantiaBienRelacion = {
      idBien: targetBien.idBien,
      numeroPoliza: targetBien.numeroPoliza || '',
      tipoBien: targetBien.tipoBien || 'Otro bien',
      descripcion: targetBien.descripcion || '',
      marca: targetBien.marca || '',
      modelo: targetBien.modelo || '',
      placa: targetBien.placa || '',
      propietario: targetBien.propietario || '',
      cuentaPropietario: targetBien.cuentaPropietario ?? '',
      ubicacion: targetBien.ubicacion || '',
      valorGarantiaUSD: targetBienValUSD,
      garantiaConTipo: gTipo,
      garantiaConCuenta: gCuenta,
      garantiaConNombre: gNombre,
    };

    onSelectBien(rel);
    setTargetBien(null);
    setTargetBienValUSD(0);
    setSearchTerm('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-2xs">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <Tractor className="w-4 h-4 text-blue-400" />
            <span>Seleccionar Vehículo, Maquinaria o Implemento</span>
          </h3>
          <button
            type="button"
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
              placeholder="Buscar por N.º de póliza, tipo, marca, modelo, placa, propietario o cuenta..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>
        </div>

        {/* Lista de bienes */}
        <div className="overflow-y-auto p-3 flex-1 divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-slate-600 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-blue-800" />
              <span className="font-semibold text-xs text-slate-700">Cargando lista de bienes...</span>
            </div>
          ) : loadError ? (
            <div className="p-8 text-center text-red-600 flex flex-col items-center justify-center gap-2 text-xs">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="font-semibold">No se pudo cargar la información.</span>
              <button
                type="button"
                onClick={() => {
                  setLoadError(false);
                  setIsLoading(true);
                  obtenerBienes(true)
                    .then((b) => setInternalAvailableBienes(Array.isArray(b) ? b : []))
                    .catch(() => setLoadError(true))
                    .finally(() => setIsLoading(false));
                }}
                className="mt-1 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-semibold transition cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : filteredBienes.length > 0 ? (
            filteredBienes.map((bien) => {
              if (!bien) return null;
              const isBlocked = bien.estado === 'Bloqueado';
              const isInactive = bien.estado === 'Inactivo';

              const hasValidId = bien.idBien !== undefined && bien.idBien !== null && bien.idBien !== '';

              // Si pertenecía a esta garantía originalmente, no se considera ocupado por OTRA garantía
              const wasOriginallyInThisGarantia =
                (hasValidId &&
                  originalGarantiaBienIds.some(
                    (id) => id !== undefined && id !== null && id !== '' && String(id) === String(bien.idBien)
                  )) ||
                (Boolean(currentNumeroSolicitud) &&
                  Boolean(bien.solicitudGarantiaActiva) &&
                  String(bien.solicitudGarantiaActiva).trim() === String(currentNumeroSolicitud).trim());

              const isAlreadyInWarranty = !!bien.enGarantia && !wasOriginallyInThisGarantia;
              const isAlreadySelected =
                hasValidId &&
                alreadySelectedBienIds.some(
                  (id) => id !== undefined && id !== null && id !== '' && String(id) === String(bien.idBien)
                );
              const isDisabled = isBlocked || isInactive || isAlreadyInWarranty || isAlreadySelected;

              let reason = '';
              if (isAlreadySelected) reason = 'Ya añadido en este formulario';
              else if (isBlocked) reason = `Bloqueado administrativamente (${bien.motivoBloqueo || 'Sin motivo'})`;
              else if (isInactive) reason = 'Bien inactivo';
              else if (isAlreadyInWarranty) reason = `Ya está en la garantía activa ${bien.solicitudGarantiaActiva || ''}`;

              return (
                <div
                  key={String(bien.idBien || bien.numeroPoliza || Math.random())}
                  className={`p-2.5 flex items-center justify-between text-xs transition ${
                    isDisabled ? 'bg-slate-50 opacity-60' : 'hover:bg-blue-50 cursor-pointer'
                  }`}
                  onClick={() => !isDisabled && handleSelectBienForAdd(bien)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono font-bold text-blue-950 bg-blue-100 px-1.5 py-0.5 rounded text-[11px]">
                        {bien.numeroPoliza || 'Sin Póliza'}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {bien.tipoBien || 'Bien'} {bien.descripcion ? `- ${bien.descripcion}` : ''}
                      </span>
                      {(bien.marca || bien.modelo) && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({bien.marca || ''} {bien.modelo || ''})
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
                        {bien.estado || 'Disponible'}
                      </span>
                      {wasOriginallyInThisGarantia && !isAlreadySelected && (
                        <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                          De esta garantía
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                      <span>Propietario: {bien.propietario || '—'} (Cta: {bien.cuentaPropietario || '—'})</span>
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

        {/* Formulario de detalle del bien seleccionado */}
        {targetBien && (
          <div className="p-3 bg-blue-50/60 border-t border-blue-200 space-y-2 text-xs">
            <div className="font-bold text-blue-950 flex items-center justify-between">
              <span>
                Configurar compromiso: Póliza {targetBien.numeroPoliza || 'Sin Póliza'} ({targetBien.tipoBien || 'Bien'})
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
                onClick={() => setTargetBien(null)}
                className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded border border-slate-300 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmAddBien}
                className="px-4 py-1 text-xs font-bold text-white bg-blue-800 hover:bg-blue-900 rounded cursor-pointer"
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
