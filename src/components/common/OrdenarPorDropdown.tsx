import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  GarantiaSortConfig,
  GarantiaSortField,
  SortDirection,
  GARANTIA_SORT_OPTIONS,
} from '../../utils/garantiaSort';

interface OrdenarPorDropdownProps {
  value: GarantiaSortConfig;
  onApply: (next: GarantiaSortConfig) => void;
  disabled?: boolean;
}

export const OrdenarPorDropdown: React.FC<OrdenarPorDropdownProps> = ({
  value,
  onApply,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [draftField, setDraftField] = useState<GarantiaSortField>(value.field);
  const [draftDirection, setDraftDirection] = useState<SortDirection>(value.direction);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar la selección visual cada vez que se abre el menú o cambia el valor aplicado
  useEffect(() => {
    if (isOpen) {
      setDraftField(value.field);
      setDraftDirection(value.direction);
      if (containerRef.current && typeof window !== 'undefined') {
        const rect = containerRef.current.getBoundingClientRect();
        const menuWidth = 264;
        setAlignRight(rect.left + menuWidth > window.innerWidth - 12 && rect.right >= menuWidth);
      }
    }
  }, [isOpen, value.field, value.direction]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentLabel =
    GARANTIA_SORT_OPTIONS.find((opt) => opt.value === value.field)?.label || 'Fecha de garantía';
  const currentDirLabel = value.direction === 'asc' ? 'Ascendente' : 'Descendente';

  const handleApply = () => {
    onApply({ field: draftField, direction: draftDirection });
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Orden actual: ${currentLabel} (${currentDirLabel})`}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition cursor-pointer whitespace-nowrap disabled:opacity-60 ${
          isOpen
            ? 'bg-slate-100 text-slate-900 border-slate-400'
            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
        }`}
      >
        <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span>Ordenar por</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Opciones de ordenamiento"
          className={`absolute ${
            alignRight ? 'right-0' : 'left-0'
          } mt-1.5 w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-3 space-y-3`}
        >
          {/* Opciones de campo (selección única) */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
              Ordenar por
            </div>
            <div className="space-y-0.5" role="radiogroup" aria-label="Campo de ordenamiento">
              {GARANTIA_SORT_OPTIONS.map((option) => {
                const isSelected = draftField === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50 font-normal'
                    }`}
                  >
                    <input
                      type="radio"
                      name="garantia-sort-field"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => setDraftField(option.value)}
                      className="w-3.5 h-3.5 accent-slate-800 cursor-pointer shrink-0"
                    />
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Separador y selección de dirección */}
          <div className="border-t border-slate-100 pt-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
              Dirección
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDraftDirection('asc')}
                className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs border transition cursor-pointer ${
                  draftDirection === 'asc'
                    ? 'bg-slate-800 text-white border-slate-800 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>Ascendente</span>
                <ArrowUp className="w-3 h-3 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => setDraftDirection('desc')}
                className={`inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs border transition cursor-pointer ${
                  draftDirection === 'desc'
                    ? 'bg-slate-800 text-white border-slate-800 font-semibold'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                }`}
              >
                <span>Descendente</span>
                <ArrowDown className="w-3 h-3 shrink-0" />
              </button>
            </div>
          </div>

          {/* Botón Aplicar orden */}
          <div className="border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={handleApply}
              className="w-full py-1.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-md transition cursor-pointer"
            >
              Aplicar orden
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
