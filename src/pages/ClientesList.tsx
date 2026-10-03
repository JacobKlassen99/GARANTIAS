import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Cliente, QueryParams } from '../types';
import { listarClientes, crearCliente, editarCliente, eliminarCliente } from '../services/backend';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EmptyState } from '../components/common/EmptyState';

interface ClientesListProps {
  initialOpenNew?: boolean;
  onCloseNew?: () => void;
}

export const ClientesList: React.FC<ClientesListProps> = ({ initialOpenNew = false, onCloseNew }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [fromRecord, setFromRecord] = useState(0);
  const [toRecord, setToRecord] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 200; // 200 registros por página según especificación
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Cliente>('cuenta');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal Añadir / Editar
  const [isModalOpen, setIsModalOpen] = useState(initialOpenNew);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCuenta, setCurrentCuenta] = useState('');
  const [currentNombre, setCurrentNombre] = useState('');
  const [currentCi, setCurrentCi] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal Confirmar Eliminación
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce para búsqueda (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (initialOpenNew) {
      handleOpenCreate();
    }
  }, [initialOpenNew]);

  const loadData = async (
    targetPage = page,
    targetSearch = debouncedSearch,
    forceRefresh = false
  ) => {
    if (clientes.length === 0 && !hasLoadedOnce) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const params: QueryParams = {
        page: targetPage,
        pageSize,
        search: targetSearch.trim() || undefined,
        sortField,
        sortDirection,
      };
      const res = await listarClientes(params, forceRefresh);
      const items = Array.isArray(res?.data) ? res.data : [];
      setClientes(items);
      setTotal(typeof res?.total === 'number' ? res.total : items.length);
      setTotalPages(typeof res?.totalPages === 'number' ? res.totalPages : 1);
      setFromRecord(typeof res?.from === 'number' ? res.from : items.length > 0 ? (targetPage - 1) * pageSize + 1 : 0);
      setToRecord(typeof res?.to === 'number' ? res.to : Math.min(targetPage * pageSize, res?.total || items.length));
      setHasLoadedOnce(true);
    } catch {
      if (clientes.length === 0) {
        setErrorMessage('No se pudo cargar la información.');
        setTotal(0);
        setTotalPages(1);
        setFromRecord(0);
        setToRecord(0);
      } else {
        setErrorMessage('No se pudo actualizar la información.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(page, debouncedSearch, false);
  }, [page, debouncedSearch, sortField, sortDirection]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setCurrentCuenta('');
    setCurrentNombre('');
    setCurrentCi('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cliente: Cliente) => {
    setIsEditing(true);
    setCurrentCuenta(String(cliente.cuenta));
    setCurrentNombre(cliente.nombre);
    setCurrentCi(cliente.ci || '');
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
    if (!currentCuenta.trim()) {
      setFormError('El número de cuenta es obligatorio.');
      return;
    }
    if (!currentNombre.trim()) {
      setFormError('El nombre completo es obligatorio.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (isEditing) {
        await editarCliente({
          cuenta: currentCuenta.trim(),
          nombre: currentNombre.trim(),
          ci: currentCi.trim(),
        });
        setSuccessMessage('Cliente actualizado con éxito.');
      } else {
        await crearCliente({
          cuenta: currentCuenta.trim(),
          nombre: currentNombre.trim(),
          ci: currentCi.trim(),
        });
        setSuccessMessage('Cliente registrado con éxito.');
      }
      setTimeout(() => setSuccessMessage(null), 3500);
      handleCloseModal();
      loadData(page, debouncedSearch);
    } catch (err: any) {
      setFormError(err.message || 'No se pudo guardar el cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!clienteToDelete) return;
    setIsDeleting(true);
    try {
      await eliminarCliente(clienteToDelete.cuenta);
      setClienteToDelete(null);
      setSuccessMessage('Cliente eliminado.');
      setTimeout(() => setSuccessMessage(null), 3000);
      loadData(page, debouncedSearch);
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el cliente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSort = (field: keyof Cliente) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-3">
      {/* Título y acciones superiores */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-800 text-white rounded">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-800 uppercase tracking-tight">
              Padrón de Clientes
            </h2>
            <p className="text-[11px] text-slate-500">
              Registro de cuentas, socios y titulares autorizados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(page, debouncedSearch, true)}
            disabled={isLoading || isRefreshing}
            title="Actualizar clientes desde Google Sheets"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin text-emerald-700' : ''}`} />
            <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Añadir Cliente</span>
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-xs text-emerald-900 font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && clientes.length > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => loadData(page, debouncedSearch, true)}
            className="font-medium text-amber-900 underline hover:no-underline cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Barra de búsqueda y paginación rápida */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por Cuenta, Nombre o CI..."
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

        <div className="text-[11px] text-slate-600 flex items-center gap-2 justify-between sm:justify-end">
          {isRefreshing && (
            <span className="text-[11px] font-medium text-emerald-800 flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando datos...
            </span>
          )}
          {total > 0 && (
            <span>
              Mostrando <strong className="font-mono text-slate-900">{fromRecord}–{toRecord}</strong> de{' '}
              <strong className="font-mono text-slate-900">{total}</strong>
            </span>
          )}
        </div>
      </div>

      {/* TABLA COMPACTA ESTILO EXCEL */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th
                  onClick={() => toggleSort('cuenta')}
                  className="py-1.5 px-3 font-bold border-r border-slate-200 cursor-pointer hover:bg-slate-200 w-28"
                >
                  <div className="flex items-center justify-between">
                    <span>Cuenta</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('nombre')}
                  className="py-1.5 px-3 font-bold border-r border-slate-200 cursor-pointer hover:bg-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <span>Nombre Completo</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('ci')}
                  className="py-1.5 px-3 font-bold border-r border-slate-200 cursor-pointer hover:bg-slate-200 w-36"
                >
                  <div className="flex items-center justify-between">
                    <span>C.I.</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-1.5 px-3 font-bold text-center w-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && !hasLoadedOnce ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-emerald-800" />
                      <span className="font-semibold text-slate-700">Cargando clientes...</span>
                      <span className="text-[11px] text-slate-400">Consultando registros oficiales en Google Sheets</span>
                    </div>
                  </td>
                </tr>
              ) : errorMessage && clientes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs text-red-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-6 h-6 text-red-500" />
                      <span className="font-semibold text-slate-800">No se pudo cargar la información.</span>
                      <button
                        onClick={() => loadData(page, debouncedSearch, true)}
                        className="mt-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium transition cursor-pointer"
                      >
                        Reintentar
                      </button>
                    </div>
                  </td>
                </tr>
              ) : Array.isArray(clientes) && clientes.length > 0 ? (
                clientes.map((cliente) => (
                  <tr key={cliente.cuenta} className="hover:bg-slate-50 transition-colors">
                    <td className="py-1.5 px-3 font-mono font-semibold text-slate-800 border-r border-slate-100">
                      {cliente.cuenta}
                    </td>
                    <td className="py-1.5 px-3 text-slate-800 border-r border-slate-100 font-medium">
                      {cliente.nombre}
                    </td>
                    <td className="py-1.5 px-3 text-slate-600 font-mono border-r border-slate-100">
                      {cliente.ci || '—'}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(cliente)}
                          title="Editar cliente"
                          className="p-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setClienteToDelete(cliente)}
                          title="Eliminar cliente"
                          className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-xs text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5 max-w-sm mx-auto">
                      <Users className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="font-semibold text-slate-700">
                        {debouncedSearch ? 'Sin coincidencias en clientes' : 'No hay registros para mostrar.'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {debouncedSearch
                          ? `No se encontró ningún cliente con "${debouncedSearch}".`
                          : 'No se encontraron clientes registrados en Google Sheets.'}
                      </span>
                    </div>
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

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={handleCloseModal}
                disabled={isSaving}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 space-y-3">
              {formError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded flex items-start gap-1.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>{formError}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Cuenta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentCuenta}
                  onChange={(e) => setCurrentCuenta(e.target.value)}
                  placeholder="Ej: 112"
                  disabled={isEditing || isSaving}
                  required
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentNombre}
                  onChange={(e) => setCurrentNombre(e.target.value)}
                  placeholder="Ej: Jacob Klassen Reimer"
                  disabled={isSaving}
                  required
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cédula de Identidad (C.I.)
                </label>
                <input
                  type="text"
                  value={currentCi}
                  onChange={(e) => setCurrentCi(e.target.value)}
                  placeholder="Opcional..."
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded transition flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isSaving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN DE ELIMINACIÓN */}
      <ConfirmModal
        isOpen={!!clienteToDelete}
        title="Confirmar Eliminación"
        message={`¿Está seguro de eliminar al cliente ${clienteToDelete?.nombre} (Cuenta: ${clienteToDelete?.cuenta})?`}
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setClienteToDelete(null)}
      />
    </div>
  );
};
