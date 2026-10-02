import React from 'react';
import { Database, Search, AlertCircle, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  type?: 'no-data' | 'no-results' | 'backend-required';
  title?: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-data',
  title,
  description,
  onAction,
  actionLabel = 'Actualizar',
}) => {
  let defaultIcon = <Database className="w-8 h-8 text-slate-400 stroke-1" />;
  let defaultTitle = 'Sin registros disponibles';
  let defaultDesc = 'No hay información registrada en este momento.';

  if (type === 'no-results') {
    defaultIcon = <Search className="w-8 h-8 text-slate-400 stroke-1" />;
    defaultTitle = 'No se encontraron coincidencias';
    defaultDesc = 'Intente con otro término de búsqueda o limpie los filtros.';
  } else if (type === 'backend-required') {
    defaultIcon = <AlertCircle className="w-8 h-8 text-emerald-700 stroke-1" />;
    defaultTitle = 'No hay registros para mostrar';
    defaultDesc = 'No se pudo cargar la información en este momento. Verifique la conexión o intente nuevamente.';
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded border border-slate-200">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-50 border border-slate-200 mb-3">
        {defaultIcon}
      </div>
      <h3 className="text-sm font-semibold text-slate-800 mb-1">{title || defaultTitle}</h3>
      <p className="text-xs text-slate-500 max-w-md mb-4">{description || defaultDesc}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
