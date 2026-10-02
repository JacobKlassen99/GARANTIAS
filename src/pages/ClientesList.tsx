import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Cliente, QueryParams } from '../types';
import { getClientes, saveCliente, deleteCliente } from '../services/backend';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { EmptyState } from '../components/common/EmptyState';

interface ClientesListProps {
  initialOpenNew?: boolean;
  onCloseNew?: () => void;
}

export const ClientesList: React.FC<ClientesListProps> = ({ initialOpenNew = false, onCloseNew }) => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(200); // 200 registros por página según especificación
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<keyof Cliente>('cuenta');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [backendMessage, setBackendMessage] = useState<string | null>(null);

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
        sortField,
        sortDirection,
      };
      const res = await getClientes(params);
      setClientes(Array.isArray(res?.data) ? res.data : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
    } catch {
      setBackendMessage('No se pudo cargar la información.');
      setClientes([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, sortField, sortDirection]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

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
      await saveCliente(
        {
          cuenta: currentCuenta.trim(),
          nombre: currentNombre.trim(),
          ci: currentCi.trim(),
        },
        isEditing
      );
      handleCloseModal();
      loadData();
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
      await deleteCliente(clienteToDelete.cuenta);
      setClienteToDelete(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el cliente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

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
              Hoja: <code className="font-mono text-emerald-800 font-bold">clientes</code> (Cuenta, Nombre, CI)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            title="Recargar desde Google Sheets"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-700' : ''}`} />
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded shadow-2xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Añadir Cliente</span>
          </button>
        </div>
      </div>

      {/* Barra de búsqueda y paginación rápida */}
      <div className="bg-white p-2.5 rounded border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
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
          <button
            type="submit"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium rounded transition"
          >
            Buscar
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
                loadData();
              }}
              className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              Limpiar
            </button>
          )}
        </form>

        <div className="text-[11px] text-slate-600 flex items-center gap-2 justify-between sm:justify-end">
          <span>
            Total: <strong className="font-mono text-slate-900">{total}</strong> registros (200 por página)
          </span>
        </div>
      </div>

      {/* Alerta de estado del backend */}
      {backendMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{backendMessage}</div>
        </div>
      )}

      {/* TABLA COMPACTA ESTILO EXCEL */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-300 select-none shadow-2xs">
              <tr>
                <th
                  onClick={() => toggleSort('cuenta')}
                  className="py-1.5 px-3 font-bold cursor-pointer hover:bg-slate-200 border-r border-slate-200 w-28"
                >
                  <div className="flex items-center justify-between">
                    <span>Cuenta</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('nombre')}
                  className="py-1.5 px-3 font-bold cursor-pointer hover:bg-slate-200 border-r border-slate-200"
                >
                  <div className="flex items-center justify-between">
                    <span>Nombre Completo</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('ci')}
                  className="py-1.5 px-3 font-bold cursor-pointer hover:bg-slate-200 border-r border-slate-200 w-36"
                >
                  <div className="flex items-center justify-between">
                    <span>Cédula de Identidad (CI)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-1.5 px-3 font-bold text-center w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {clientes && clientes.length > 0 ? (
                clientes.map((cliente) => (
                  <tr
                    key={cliente.cuenta}
                    className="hover:bg-emerald-50/50 transition-colors group"
                  >
                    <td className="py-1.5 px-3 font-mono font-bold text-emerald-900 border-r border-slate-100 bg-slate-50/30">
                      {cliente.cuenta}
                    </td>
                    <td className="py-1.5 px-3 font-medium text-slate-800 border-r border-slate-100">
                      {cliente.nombre}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-slate-600 border-r border-slate-100">
                      {cliente.ci || '—'}
                    </td>
                    <td className="py-1.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(cliente)}
                          title="Editar cliente"
                          className="p-1 text-slate-600 hover:text-emerald-800 hover:bg-slate-100 rounded transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setClienteToDelete(cliente)}
                          title="Eliminar cliente"
                          className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-0">
                    <EmptyState
                      type={search ? 'no-results' : 'backend-required'}
                      title={search ? 'Sin coincidencias en clientes' : 'No hay registros de clientes'}
                      description={
                        search
                          ? `No se encontró ningún cliente con "${search}".`
                          : 'No se pudo cargar la información o no hay clientes registrados.'
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

      {/* MODAL CREAR / EDITAR CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider">
                {isEditing ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Número de Cuenta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentCuenta}
                  onChange={(e) => setCurrentCuenta(e.target.value)}
                  placeholder="Ej: 112"
                  disabled={isEditing || isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 disabled:bg-slate-100 font-mono"
                  required
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  {isEditing
                    ? 'El número de cuenta es el identificador único y no puede cambiarse.'
                    : 'Identificador único en la hoja clientes.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentNombre}
                  onChange={(e) => setCurrentNombre(e.target.value)}
                  placeholder="Ej: Juan Klassen Reimer"
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cédula de Identidad (CI)
                </label>
                <input
                  type="text"
                  value={currentCi}
                  onChange={(e) => setCurrentCi(e.target.value)}
                  placeholder="Ej: 4589231 SC"
                  disabled={isSaving}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 font-mono"
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
                  <span>{isEditing ? 'Actualizar Cliente' : 'Guardar en Google Sheets'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMAR ELIMINACIÓN */}
      <ConfirmModal
        isOpen={!!clienteToDelete}
        title="Eliminar Cliente"
        message={`¿Está seguro de eliminar al cliente "${clienteToDelete?.cuenta} — ${clienteToDelete?.nombre}"? El backend validará que no posea lotes, bienes o garantías activas asociadas.`}
        confirmLabel="Eliminar Cliente"
        isDestructive
        isLoading={isDeleting}
        onCancel={() => setClienteToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
