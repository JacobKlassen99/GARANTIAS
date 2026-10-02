import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Search,
  Plus,
  Edit2,
  Trash2,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { Lote, Cliente, QueryParams, EstadoRegistro } from '../types';
import {
  getLotes,
  saveLote,
  deleteLote,
  setLoteBloqueo,
  getClientes,
} from '../services/backend';
import { ClientSearchAutocomplete } from '../components/common/ClientSearchAutocomplete';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EmptyState } from '../components/common/EmptyState';
import { formatHectareas, formatFecha, getTodayIso } from '../utils/textSearch';

interface LotesListProps {
  initialOpenNew?: boolean;
  onCloseNew?: () => void;
}

export const LotesList: React.FC<LotesListProps> = ({ initialOpenNew = false, onCloseNew }) => {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(200);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [isLoading, setIsLoading] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

  // Modal Añadir / Editar
  const [isModalOpen, setIsModalOpen] = useState(initialOpenNew);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [numeroLote, setNumeroLote] = useState('');
  const [selectedPropietario, setSelectedPropietario] = useState<Cliente | null>(null);
  const [selectedEncargado, setSelectedEncargado] = useState<Cliente | null>(null);
  const [hectareas, setHectareas] = useState<string>('');
  const [ubicacion, setUbicacion] = useState('');
  const [estado, setEstado] = useState<EstadoRegistro>('Disponible');
  const [motivoBloqueo, setMotivoBloqueo] = useState('');
  const [fechaBloqueo, setFechaBloqueo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Bloqueo / Desbloqueo rápido
  const [loteToToggleLock, setLoteToToggleLock] = useState<Lote | null>(null);
  const [lockMotivoInput, setLockMotivoInput] = useState('');

  // Modal Eliminar
  const [loteToDelete, setLoteToDelete] = useState<Lote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (initialOpenNew) {
      handleOpenCreate();
    }
  }, [initialOpenNew]);

  const loadData = async () => {
    setIsLoading(true);
    setBackendMessage(null);
    try {
      const params: QueryParams = {
        page,
        pageSize,
        search: search.trim() || undefined,
        filters: filtroEstado !== 'todos' ? { estado: filtroEstado } : undefined,
      };
      const res = await getLotes(params);
      setLotes(Array.isArray(res?.data) ? res.data : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
    } catch {
      setBackendMessage('No se pudo cargar la información.');
      setLotes([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientes = async () => {
    try {
      const res = await getClientes({ page: 1, pageSize: 1000 });
      setClientesList(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setClientesList([]);
    }
  };

  useEffect(() => {
    loadData();
    loadClientes();
  }, [page, filtroEstado]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setNumeroLote('');
    setSelectedPropietario(null);
    setSelectedEncargado(null);
    setHectareas('');
    setUbicacion('');
    setEstado('Disponible');
    setMotivoBloqueo('');
    setFechaBloqueo('');
    setObservacion('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lote: Lote) => {
    setIsEditing(true);
    setEditingId(lote.idLote);
    setNumeroLote(lote.numeroLote);

    const safeList = Array.isArray(clientesList) ? clientesList : [];
    const prop = safeList.find((c) => String(c.cuenta) === String(lote.cuentaPropietario)) || {
      cuenta: lote.cuentaPropietario,
      nombre: lote.propietario,
      ci: '',
    };
    setSelectedPropietario(prop);

    if (lote.cuentaEncargado && lote.encargado) {
      const enc = safeList.find((c) => String(c.cuenta) === String(lote.cuentaEncargado)) || {
        cuenta: lote.cuentaEncargado,
        nombre: lote.encargado,
        ci: '',
      };
      setSelectedEncargado(enc);
    } else {
      setSelectedEncargado(null);
    }

    setHectareas(String(lote.hectareas || ''));
    setUbicacion(lote.ubicacion || '');
    setEstado(lote.estado || 'Disponible');
    setMotivoBloqueo(lote.motivoBloqueo || '');
    setFechaBloqueo(lote.fechaBloqueo || '');
    setObservacion(lote.observacion || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    if (onCloseNew) onCloseNew();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroLote.trim()) {
      setFormError('El número de lote es obligatorio.');
      return;
    }
    if (!selectedPropietario) {
      setFormError('Debe seleccionar un propietario registrado en la hoja clientes.');
      return;
    }
    const haNum = parseFloat(hectareas);
    if (isNaN(haNum) || haNum <= 0) {
      setFormError('La superficie en hectáreas debe ser un número mayor a 0.');
      return;
    }

    if (estado === 'Bloqueado' && !motivoBloqueo.trim()) {
      setFormError('Debe indicar el motivo del bloqueo.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload: Partial<Lote> = {
        idLote: editingId || `LOT-${Date.now()}`,
        numeroLote: numeroLote.trim(),
        cuentaPropietario: selectedPropietario.cuenta,
        propietario: selectedPropietario.nombre,
        cuentaEncargado: selectedEncargado ? selectedEncargado.cuenta : undefined,
        encargado: selectedEncargado ? selectedEncargado.nombre : undefined,
        hectareas: haNum,
        ubicacion: ubicacion.trim(),
        estado,
        motivoBloqueo: estado === 'Bloqueado' ? motivoBloqueo.trim() : '',
        fechaBloqueo: estado === 'Bloqueado' ? fechaBloqueo || getTodayIso() : '',
        observacion: observacion.trim(),
      };

      await saveLote(payload, isEditing);
      handleCloseModal();
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'No se pudo guardar el lote.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmToggleLock = async () => {
    if (!loteToToggleLock) return;
    const isCurrentlyLocked = loteToToggleLock.estado === 'Bloqueado';
    setIsSaving(true);
    try {
      await setLoteBloqueo(
        loteToToggleLock.idLote,
        !isCurrentlyLocked,
        !isCurrentlyLocked ? lockMotivoInput : undefined,
        !isCurrentlyLocked ? getTodayIso() : undefined
      );
      setLoteToToggleLock(null);
      setLockMotivoInput('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'No se pudo actualizar el estado del lote.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!loteToDelete) return;
    if (loteToDelete.enGarantia) {
      alert('No se puede eliminar un lote que se encuentra actualmente en una garantía activa.');
      setLoteToDelete(null);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteLote(loteToDelete.idLote);
      setLoteToDelete(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el lote.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-3">
      {/* Encabezado de sección */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Registro de Lotes y Parcelas
            </h2>
            <p className="text-[11px] text-slate-500">
              Hoja: <code className="font-mono text-emerald-800 font-bold">lotes</code> (El estado "EN GARANTÍA" se calcula automáticamente)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            title="Recargar lotes desde Google Sheets"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Añadir Lote</span>
          </button>
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por N.º de lote, propietario, cuenta o ubicación..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded transition"
            >
              Buscar
            </button>
          </form>

          {/* Filtro por estado administrativo */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-medium">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-emerald-700"
            >
              <option value="todos">Todos</option>
              <option value="Disponible">Disponible</option>
              <option value="Bloqueado">Bloqueado</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-600 text-right">
          Total: <strong className="font-mono text-slate-900">{total}</strong> lotes
        </div>
      </div>

      {backendMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{backendMessage}</div>
        </div>
      )}

      {/* TABLA COMPACTA DE LOTES */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-24">N.º Lote</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Propietario Actual</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Encargado (Comprador)</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 text-right w-24">Superficie</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Ubicación</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 text-center w-24">Garantía</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 text-center w-24">Estado</th>
                <th className="py-1.5 px-3 font-bold text-center w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {Array.isArray(lotes) && lotes.length > 0 ? (
                lotes.map((lote) => {
                  const isBlocked = lote.estado === 'Bloqueado';
                  return (
                    <tr
                      key={lote.idLote}
                      className={`hover:bg-emerald-50/50 transition-colors group ${
                        isBlocked ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-1.5 px-3 font-mono font-bold text-emerald-950 border-r border-slate-100 bg-slate-50/30">
                        {lote.numeroLote}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{lote.propietario}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Cta: {lote.cuentaPropietario}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 text-slate-600">
                        {lote.encargado ? (
                          <>
                            <div className="font-medium text-slate-700">{lote.encargado}</div>
                            {lote.cuentaEncargado && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Cta: {lote.cuentaEncargado}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-right font-medium text-slate-800 border-r border-slate-100">
                        {formatHectareas(lote.hectareas)}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600 border-r border-slate-100 truncate max-w-[140px]">
                        {lote.ubicacion || '—'}
                      </td>

                      {/* DISPONIBILIDAD / EN GARANTÍA (CALCULADO) */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-100">
                        {lote.enGarantia ? (
                          <span
                            title={`Afectado a la garantía ${lote.solicitudGarantiaActiva || ''}`}
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 uppercase tracking-tight"
                          >
                            EN GARANTÍA
                          </span>
                        ) : (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Libre
                          </span>
                        )}
                      </td>

                      {/* ESTADO ADMINISTRATIVO */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-100">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                            lote.estado === 'Disponible'
                              ? 'bg-slate-50 text-slate-700 border-slate-200'
                              : lote.estado === 'Bloqueado'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          {lote.estado}
                        </span>
                      </td>

                      {/* ACCIONES */}
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(lote)}
                            title="Editar lote"
                            className="p-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setLoteToToggleLock(lote);
                              setLockMotivoInput(lote.motivoBloqueo || '');
                            }}
                            title={isBlocked ? 'Desbloquear lote' : 'Bloquear lote'}
                            className={`p-1 rounded transition ${
                              isBlocked
                                ? 'text-amber-700 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-amber-700 hover:bg-slate-100'
                            }`}
                          >
                            {isBlocked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setLoteToDelete(lote)}
                            disabled={!!lote.enGarantia}
                            title={
                              lote.enGarantia
                                ? 'No se puede eliminar un lote en garantía activa'
                                : 'Eliminar lote'
                            }
                            className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="p-0">
                    <EmptyState
                      type={search ? 'no-results' : 'backend-required'}
                      title={search ? 'Sin coincidencias en lotes' : 'No hay registros de parcelas'}
                      description={
                        search
                          ? `No se encontró ningún lote con "${search}".`
                          : 'No se pudo cargar la información o no hay lotes registrados.'
                      }
                      onAction={loadData}
                      actionLabel="Reintentar Consulta"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación Real Backend (200 registros por página) */}
        <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Página <strong className="text-slate-900">{page}</strong> de{' '}
            <strong className="text-slate-900">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR LOTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-8">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isEditing ? 'Editar Lote / Parcela' : 'Añadir Nuevo Lote'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3">
              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    N.º de Lote / Parcela <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={numeroLote}
                    onChange={(e) => setNumeroLote(e.target.value)}
                    placeholder="Ej: M-31"
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Superficie (Hectáreas) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={hectareas}
                    onChange={(e) => setHectareas(e.target.value)}
                    placeholder="Ej: 44.47"
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Búsqueda inteligente de Propietario */}
              <ClientSearchAutocomplete
                label="Propietario Titular"
                placeholder="Buscar por cuenta o nombre del titular..."
                clientesList={clientesList}
                selectedCuenta={selectedPropietario?.cuenta}
                onSelect={setSelectedPropietario}
                required
                disabled={isSaving}
                helperText="Persona que figura actualmente como propietaria en el registro."
              />

              {/* Búsqueda inteligente de Encargado (Opcional) */}
              <ClientSearchAutocomplete
                label="Encargado (Opcional)"
                placeholder="Buscar comprador sin transferencia definitiva..."
                clientesList={clientesList}
                selectedCuenta={selectedEncargado?.cuenta}
                onSelect={setSelectedEncargado}
                disabled={isSaving}
                helperText="Persona que compró el lote pero aún no concluyó la transferencia definitiva."
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ubicación</label>
                <input
                  type="text"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Campo Grande / Campo 2"
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Estado Administrativo
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoRegistro)}
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-medium"
                >
                  <option value="Disponible">Disponible</option>
                  <option value="Bloqueado">Bloqueado</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
                <p className="mt-1 text-[10px] text-slate-400">
                  Nota: El estado "En garantía" no se asigna manualmente; se calcula a partir de las garantías activas.
                </p>
              </div>

              {/* Si Estado = Bloqueado, mostrar motivo y fecha de bloqueo */}
              {estado === 'Bloqueado' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Detalles del Bloqueo Administrativo</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                      Motivo del Bloqueo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={motivoBloqueo}
                      onChange={(e) => setMotivoBloqueo(e.target.value)}
                      placeholder="Ej: Retención por trámite sucesorio / Orden judicial"
                      disabled={isSaving}
                      className="w-full px-2.5 py-1 text-xs bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                      required={estado === 'Bloqueado'}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                      Fecha de Bloqueo
                    </label>
                    <input
                      type="date"
                      value={fechaBloqueo}
                      onChange={(e) => setFechaBloqueo(e.target.value)}
                      disabled={isSaving}
                      className="w-full px-2.5 py-1 text-xs bg-white border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observación</label>
                <textarea
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={2}
                  placeholder="Detalles adicionales del lote..."
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded transition flex items-center gap-1.5"
                >
                  {isSaving && (
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  <span>{isEditing ? 'Actualizar Lote' : 'Guardar Lote'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BLOQUEAR / DESBLOQUEAR RÁPIDO */}
      {loteToToggleLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-300 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
              {loteToToggleLock.estado === 'Bloqueado' ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-700" />
                  <span>Desbloquear Lote {loteToToggleLock.numeroLote}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>Bloquear Lote {loteToToggleLock.numeroLote}</span>
                </>
              )}
            </h3>

            {loteToToggleLock.estado !== 'Bloqueado' ? (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-slate-600">
                  El lote no podrá ser seleccionado en nuevas garantías mientras permanezca bloqueado.
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Motivo del Bloqueo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lockMotivoInput}
                    onChange={(e) => setLockMotivoInput(e.target.value)}
                    placeholder="Ingrese el motivo del bloqueo..."
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-600"
                    autoFocus
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 mb-4">
                ¿Está seguro de desbloquear el lote{' '}
                <strong>{loteToToggleLock.numeroLote}</strong>? Pasará a estado <strong>Disponible</strong>.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLoteToToggleLock(null)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleLock}
                disabled={loteToToggleLock.estado !== 'Bloqueado' && !lockMotivoInput.trim()}
                className={`px-3 py-1.5 text-xs font-semibold text-white rounded ${
                  loteToToggleLock.estado === 'Bloqueado'
                    ? 'bg-emerald-800 hover:bg-emerald-900'
                    : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAR ELIMINACIÓN */}
      <ConfirmModal
        isOpen={!!loteToDelete}
        title="Eliminar Lote"
        message={`¿Está seguro de eliminar el lote "${loteToDelete?.numeroLote}" perteneciente a ${loteToDelete?.propietario}? El backend impedirá la eliminación si se encuentra comprometido en operaciones activas.`}
        confirmLabel="Eliminar Lote"
        isDestructive
        isLoading={isDeleting}
        onCancel={() => setLoteToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
