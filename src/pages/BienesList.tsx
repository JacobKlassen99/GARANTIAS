import React, { useState, useEffect } from 'react';
import {
  Tractor,
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
  Truck,
  Wrench,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { Bien, Cliente, QueryParams, EstadoRegistro, TipoBien } from '../types';
import {
  getBienes,
  saveBien,
  deleteBien,
  setBienBloqueo,
  getClientes,
} from '../services/backend';
import { ClientSearchAutocomplete } from '../components/common/ClientSearchAutocomplete';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EmptyState } from '../components/common/EmptyState';
import { getTodayIso } from '../utils/textSearch';

interface BienesListProps {
  initialOpenNew?: boolean;
  onCloseNew?: () => void;
}

export const BienesList: React.FC<BienesListProps> = ({ initialOpenNew = false, onCloseNew }) => {
  const [bienes, setBienes] = useState<Bien[]>([]);
  const [clientesList, setClientesList] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fromRecord, setFromRecord] = useState(0);
  const [toRecord, setToRecord] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 200;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [isLoading, setIsLoading] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal Añadir / Editar
  const [isModalOpen, setIsModalOpen] = useState(initialOpenNew);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Debounce para búsqueda (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Form Fields
  const [numeroPoliza, setNumeroPoliza] = useState('');
  const [selectedPropietario, setSelectedPropietario] = useState<Cliente | null>(null);
  const [selectedEncargado, setSelectedEncargado] = useState<Cliente | null>(null);
  const [tipoBien, setTipoBien] = useState<TipoBien>('Vehículo');
  const [descripcion, setDescripcion] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [placa, setPlaca] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [estado, setEstado] = useState<EstadoRegistro>('Disponible');
  const [motivoBloqueo, setMotivoBloqueo] = useState('');
  const [fechaBloqueo, setFechaBloqueo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Bloqueo rápido
  const [bienToToggleLock, setBienToToggleLock] = useState<Bien | null>(null);
  const [lockMotivoInput, setLockMotivoInput] = useState('');

  // Modal Eliminar
  const [bienToDelete, setBienToDelete] = useState<Bien | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (initialOpenNew) {
      handleOpenCreate();
    }
  }, [initialOpenNew]);

  const loadData = async (targetPage = page, targetSearch = debouncedSearch) => {
    setIsLoading(true);
    setBackendMessage(null);
    try {
      const filters: Record<string, any> = {};
      if (filtroTipo !== 'todos') filters.tipoBien = filtroTipo;
      if (filtroEstado !== 'todos') filters.estado = filtroEstado;

      const params: QueryParams = {
        page: targetPage,
        pageSize,
        search: targetSearch.trim() || undefined,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      };
      const res = await getBienes(params);
      const items = Array.isArray(res?.data) ? res.data : [];
      setBienes(items);
      setTotal(typeof res?.total === 'number' ? res.total : items.length);
      setTotalPages(typeof res?.totalPages === 'number' ? res.totalPages : 1);
      setFromRecord(typeof res?.from === 'number' ? res.from : items.length > 0 ? (targetPage - 1) * pageSize + 1 : 0);
      setToRecord(typeof res?.to === 'number' ? res.to : Math.min(targetPage * pageSize, res?.total || items.length));
    } catch {
      setBackendMessage('No se pudo cargar la información.');
      setBienes([]);
      setTotal(0);
      setTotalPages(1);
      setFromRecord(0);
      setToRecord(0);
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
    loadData(page, debouncedSearch);
  }, [page, debouncedSearch, filtroTipo, filtroEstado]);

  useEffect(() => {
    loadClientes();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setNumeroPoliza('');
    setSelectedPropietario(null);
    setSelectedEncargado(null);
    setTipoBien('Vehículo');
    setDescripcion('');
    setMarca('');
    setModelo('');
    setPlaca('');
    setUbicacion('');
    setEstado('Disponible');
    setMotivoBloqueo('');
    setFechaBloqueo('');
    setObservacion('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (bien: Bien) => {
    setIsEditing(true);
    setEditingId(bien.idBien);
    setNumeroPoliza(bien.numeroPoliza);

    const safeList = Array.isArray(clientesList) ? clientesList : [];
    const prop = safeList.find((c) => String(c.cuenta) === String(bien.cuentaPropietario)) || {
      cuenta: bien.cuentaPropietario,
      nombre: bien.propietario,
      ci: '',
    };
    setSelectedPropietario(prop);

    if (bien.cuentaEncargado && bien.encargado) {
      const enc = safeList.find((c) => String(c.cuenta) === String(bien.cuentaEncargado)) || {
        cuenta: bien.cuentaEncargado,
        nombre: bien.encargado,
        ci: '',
      };
      setSelectedEncargado(enc);
    } else {
      setSelectedEncargado(null);
    }

    setTipoBien(bien.tipoBien || 'Vehículo');
    setDescripcion(bien.descripcion || '');
    setMarca(bien.marca || '');
    setModelo(bien.modelo || '');
    setPlaca(bien.placa || '');
    setUbicacion(bien.ubicacion || '');
    setEstado(bien.estado || 'Disponible');
    setMotivoBloqueo(bien.motivoBloqueo || '');
    setFechaBloqueo(bien.fechaBloqueo || '');
    setObservacion(bien.observacion || '');
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
    if (!numeroPoliza.trim()) {
      setFormError('El N.º de Póliza es fundamental para identificar el bien.');
      return;
    }
    if (!selectedPropietario) {
      setFormError('Debe seleccionar un propietario registrado en la hoja clientes.');
      return;
    }

    if (estado === 'Bloqueado' && !motivoBloqueo.trim()) {
      setFormError('Debe indicar el motivo del bloqueo.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload: Partial<Bien> = {
        idBien: editingId || undefined,
        numeroPoliza: numeroPoliza.trim(),
        cuentaPropietario: selectedPropietario.cuenta,
        propietario: selectedPropietario.nombre,
        cuentaEncargado: selectedEncargado ? selectedEncargado.cuenta : undefined,
        encargado: selectedEncargado ? selectedEncargado.nombre : undefined,
        tipoBien,
        descripcion: descripcion.trim(),
        marca: marca.trim(),
        modelo: modelo.trim(),
        placa: placa.trim(),
        ubicacion: ubicacion.trim(),
        estado,
        motivoBloqueo: estado === 'Bloqueado' ? motivoBloqueo.trim() : '',
        fechaBloqueo: estado === 'Bloqueado' ? fechaBloqueo || getTodayIso() : '',
        observacion: observacion.trim(),
      };

      await saveBien(payload, isEditing);
      setSuccessMessage(isEditing ? 'Bien actualizado con éxito.' : 'Bien registrado con éxito.');
      setTimeout(() => setSuccessMessage(null), 3500);
      handleCloseModal();
      loadData(page, debouncedSearch);
    } catch (err: any) {
      setFormError(err.message || 'No se pudo guardar el bien.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmToggleLock = async () => {
    if (!bienToToggleLock) return;
    const isCurrentlyLocked = bienToToggleLock.estado === 'Bloqueado';
    setIsSaving(true);
    try {
      await setBienBloqueo(
        bienToToggleLock.idBien,
        !isCurrentlyLocked,
        !isCurrentlyLocked ? lockMotivoInput : undefined,
        !isCurrentlyLocked ? getTodayIso() : undefined
      );
      setBienToToggleLock(null);
      setLockMotivoInput('');
      setSuccessMessage(`Bien ${!isCurrentlyLocked ? 'bloqueado' : 'desbloqueado'} con éxito.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      loadData(page, debouncedSearch);
    } catch (err: any) {
      alert(err.message || 'No se pudo actualizar el estado del bien.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!bienToDelete) return;
    if (bienToDelete.enGarantia) {
      alert('No se puede eliminar un bien que se encuentra actualmente en una garantía activa.');
      setBienToDelete(null);
      return;
    }
    setIsDeleting(true);
    try {
      await deleteBien(bienToDelete.idBien);
      setBienToDelete(null);
      setSuccessMessage('Bien eliminado con éxito.');
      setTimeout(() => setSuccessMessage(null), 3000);
      loadData(page, debouncedSearch);
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el bien.');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderIconTipo = (tipo: TipoBien) => {
    switch (tipo) {
      case 'Vehículo':
        return <Truck className="w-3.5 h-3.5 text-blue-700" />;
      case 'Maquinaria':
        return <Tractor className="w-3.5 h-3.5 text-emerald-700" />;
      case 'Implemento':
        return <Wrench className="w-3.5 h-3.5 text-amber-700" />;
      default:
        return <Package className="w-3.5 h-3.5 text-slate-700" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <Tractor className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Registro de Bienes y Maquinaria
            </h2>
            <p className="text-[11px] text-slate-500">
              Control de vehículos, maquinarias, implementos y pólizas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(page, debouncedSearch)}
            disabled={isLoading}
            title="Recargar bienes"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Añadir Bien</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-xs text-emerald-900 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {backendMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between text-xs text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{backendMessage}</span>
          </div>
          <button
            onClick={() => loadData(page, debouncedSearch)}
            className="px-2.5 py-1 text-xs font-semibold text-red-800 hover:text-red-900 bg-red-100 rounded hover:bg-red-200 transition cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex items-center gap-2 max-w-md">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por póliza, propietario, cuenta, descripción, marca, placa..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
              />
            </div>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Filtro por tipo de bien */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-medium">Tipo:</span>
            <select
              value={filtroTipo}
              onChange={(e) => {
                setFiltroTipo(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-emerald-700 cursor-pointer"
            >
              <option value="todos">Todos los tipos</option>
              <option value="Vehículo">Vehículo</option>
              <option value="Maquinaria">Maquinaria</option>
              <option value="Implemento">Implemento</option>
              <option value="Otro bien">Otro bien</option>
            </select>
          </div>

          {/* Filtro por estado */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-500 font-medium">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 focus:outline-none focus:border-emerald-700 cursor-pointer"
            >
              <option value="todos">Todos</option>
              <option value="Disponible">Disponible</option>
              <option value="Bloqueado">Bloqueado</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <div className="text-[11px] text-slate-600 flex items-center gap-2 justify-between sm:justify-end">
          {total > 0 && (
            <span>
              Mostrando <strong className="font-mono text-slate-900">{fromRecord}–{toRecord}</strong> de{' '}
              <strong className="font-mono text-slate-900">{total}</strong>
            </span>
          )}
        </div>
      </div>

      {/* TABLA COMPACTA DE BIENES */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">N.º Póliza</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 w-28">Tipo</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Descripción y Datos</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Propietario Actual</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Encargado</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200">Placa / Ubicación</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 text-center w-24">Garantía</th>
                <th className="py-1.5 px-3 font-bold border-r border-slate-200 text-center w-24">Estado</th>
                <th className="py-1.5 px-3 font-bold text-center w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {Array.isArray(bienes) && bienes.length > 0 ? (
                bienes.map((bien) => {
                  const isBlocked = bien.estado === 'Bloqueado';
                  return (
                    <tr
                      key={bien.idBien}
                      className={`hover:bg-emerald-50/50 transition-colors group ${
                        isBlocked ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-1.5 px-3 font-mono font-bold text-emerald-950 border-r border-slate-100 bg-slate-50/30">
                        {bien.numeroPoliza}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="flex items-center gap-1.5">
                          {renderIconTipo(bien.tipoBien)}
                          <span className="font-semibold text-slate-700">{bien.tipoBien}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-medium text-slate-900">{bien.descripcion || '—'}</div>
                        {(bien.marca || bien.modelo) && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            {bien.marca} {bien.modelo}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100">
                        <div className="font-semibold text-slate-800">{bien.propietario}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Cta: {bien.cuentaPropietario}
                        </div>
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 text-slate-600">
                        {bien.encargado ? (
                          <>
                            <div className="font-medium text-slate-700">{bien.encargado}</div>
                            {bien.cuentaEncargado && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Cta: {bien.cuentaEncargado}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 border-r border-slate-100 text-slate-600">
                        {bien.placa && (
                          <div className="font-mono font-bold text-slate-700 text-[11px]">
                            Placa: {bien.placa}
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {bien.ubicacion || '—'}
                        </div>
                      </td>

                      {/* EN GARANTÍA (CALCULADO) */}
                      <td className="py-1.5 px-3 text-center border-r border-slate-100">
                        {bien.enGarantia ? (
                          <span
                            title={`Afectado a la garantía ${bien.solicitudGarantiaActiva || ''}`}
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
                            bien.estado === 'Disponible'
                              ? 'bg-slate-50 text-slate-700 border-slate-200'
                              : bien.estado === 'Bloqueado'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-200'
                          }`}
                        >
                          {bien.estado}
                        </span>
                      </td>

                      {/* ACCIONES */}
                      <td className="py-1.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(bien)}
                            title="Editar bien"
                            className="p-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setBienToToggleLock(bien);
                              setLockMotivoInput(bien.motivoBloqueo || '');
                            }}
                            title={isBlocked ? 'Desbloquear bien' : 'Bloquear bien'}
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
                            onClick={() => setBienToDelete(bien)}
                            disabled={!!bien.enGarantia}
                            title={
                              bien.enGarantia
                                ? 'No se puede eliminar un bien en garantía activa'
                                : 'Eliminar bien'
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
                  <td colSpan={9} className="p-0">
                    <EmptyState
                      type={search ? 'no-results' : 'backend-required'}
                      title={search ? 'Sin coincidencias en bienes' : 'No hay registros de bienes'}
                      description={
                        search
                          ? `No se encontró ningún bien con "${search}".`
                          : 'No se pudo cargar la información o no hay bienes registrados.'
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
            {total > 0 && (
              <span className="ml-2 text-slate-500 hidden sm:inline">
                ({fromRecord}–{toRecord} de {total})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Anterior</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR BIEN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-100 my-8">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isEditing ? 'Editar Bien' : 'Añadir Nuevo Bien'}
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
                    N.º de Póliza <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={numeroPoliza}
                    onChange={(e) => setNumeroPoliza(e.target.value)}
                    placeholder="Ej: POL-98402 / C 11078"
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-bold"
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Dato fundamental para identificar el bien.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipo de Bien <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={tipoBien}
                    onChange={(e) => setTipoBien(e.target.value as TipoBien)}
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-medium"
                  >
                    <option value="Vehículo">Vehículo</option>
                    <option value="Maquinaria">Maquinaria</option>
                    <option value="Implemento">Implemento</option>
                    <option value="Otro bien">Otro bien</option>
                  </select>
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
              />

              {/* Búsqueda inteligente de Encargado (Opcional) */}
              <ClientSearchAutocomplete
                label="Encargado (Opcional)"
                placeholder="Buscar comprador sin transferencia definitiva..."
                clientesList={clientesList}
                selectedCuenta={selectedEncargado?.cuenta}
                onSelect={setSelectedEncargado}
                disabled={isSaving}
              />

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Descripción del Bien
                </label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Camioneta cabina doble / Tractor agrícola"
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Marca</label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ej: Toyota / John Deere"
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ej: Hilux 4x4 / 6110D"
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Placa</label>
                  <input
                    type="text"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    placeholder="Ej: 3412-ABC"
                    disabled={isSaving}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ubicación</label>
                  <input
                    type="text"
                    value={ubicacion}
                    onChange={(e) => setUbicacion(e.target.value)}
                    placeholder="Ej: Colonia Chihuahua - Campo 3"
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
                </div>
              </div>

              {/* Bloque de bloqueo condicional */}
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
                      placeholder="Ej: Retención preventiva / Gravamen bancario"
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
                  placeholder="Detalles sobre estado mecánico, chasis, etc..."
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
                  <span>{isEditing ? 'Actualizar Bien' : 'Guardar Bien'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BLOQUEAR / DESBLOQUEAR RÁPIDO */}
      {bienToToggleLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-300 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
              {bienToToggleLock.estado === 'Bloqueado' ? (
                <>
                  <Unlock className="w-4 h-4 text-emerald-700" />
                  <span>Desbloquear Bien (Póliza {bienToToggleLock.numeroPoliza})</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-700" />
                  <span>Bloquear Bien (Póliza {bienToToggleLock.numeroPoliza})</span>
                </>
              )}
            </h3>

            {bienToToggleLock.estado !== 'Bloqueado' ? (
              <div className="space-y-2 mb-4">
                <p className="text-xs text-slate-600">
                  El bien no podrá ser afectado en nuevas garantías mientras permanezca bloqueado.
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
                ¿Está seguro de desbloquear la póliza{' '}
                <strong>{bienToToggleLock.numeroPoliza}</strong>? Pasará a estado <strong>Disponible</strong>.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBienToToggleLock(null)}
                className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleLock}
                disabled={bienToToggleLock.estado !== 'Bloqueado' && !lockMotivoInput.trim()}
                className={`px-3 py-1.5 text-xs font-semibold text-white rounded ${
                  bienToToggleLock.estado === 'Bloqueado'
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
        isOpen={!!bienToDelete}
        title="Eliminar Bien"
        message={`¿Está seguro de eliminar el bien con póliza "${bienToDelete?.numeroPoliza}" (${bienToDelete?.descripcion})?`}
        confirmLabel="Eliminar Bien"
        isDestructive
        isLoading={isDeleting}
        onCancel={() => setBienToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
