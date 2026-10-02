import React, { useState, useEffect, useRef } from 'react';
import { Search, UserCheck, X, AlertCircle } from 'lucide-react';
import { Cliente } from '../../types';
import { normalizeText, formatClienteLabel } from '../../utils/textSearch';

interface ClientSearchAutocompleteProps {
  label: string;
  placeholder?: string;
  clientesList: Cliente[];
  selectedCuenta?: string | number | null;
  onSelect: (cliente: Cliente | null) => void;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export const ClientSearchAutocomplete: React.FC<ClientSearchAutocompleteProps> = ({
  label,
  placeholder = 'Buscar por N.º de cuenta o nombre...',
  clientesList,
  selectedCuenta,
  onSelect,
  required = false,
  disabled = false,
  helperText,
}) => {
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincronizar texto si viene una cuenta seleccionada
  useEffect(() => {
    const safeList = Array.isArray(clientesList) ? clientesList : [];
    if (selectedCuenta !== undefined && selectedCuenta !== null && selectedCuenta !== '') {
      const found = safeList.find((c) => String(c.cuenta).trim() === String(selectedCuenta).trim());
      if (found) {
        setInputText(formatClienteLabel(found.cuenta, found.nombre));
        setAccountNotFound(false);
      } else {
        setInputText(String(selectedCuenta));
      }
    } else {
      setInputText('');
      setAccountNotFound(false);
    }
  }, [selectedCuenta, clientesList]);

  // Cerrar lista al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Validar si el texto actual coincide con un cliente
        validateCurrentText();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputText, clientesList]);

  const validateCurrentText = () => {
    const safeList = Array.isArray(clientesList) ? clientesList : [];
    if (!inputText.trim()) {
      setAccountNotFound(false);
      onSelect(null);
      return;
    }

    // Comprobar si el texto contiene una cuenta directa (ej: "112" o "112 — ...")
    const clean = inputText.trim();
    const isNumericOnly = /^\d+$/.test(clean);

    if (isNumericOnly) {
      const match = safeList.find((c) => String(c.cuenta).trim() === clean);
      if (match) {
        setInputText(formatClienteLabel(match.cuenta, match.nombre));
        setAccountNotFound(false);
        onSelect(match);
      } else {
        setAccountNotFound(true);
        onSelect(null);
      }
      return;
    }

    // Comprobar si coincide exactamente con el formato "Cuenta — Nombre"
    const exact = safeList.find(
      (c) => formatClienteLabel(c.cuenta, c.nombre).toLowerCase() === clean.toLowerCase()
    );
    if (exact) {
      setAccountNotFound(false);
      onSelect(exact);
    } else {
      // No coincide con ningún cliente registrado en la hoja
      if (safeList.length > 0) {
        setAccountNotFound(true);
      }
      onSelect(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const safeList = Array.isArray(clientesList) ? clientesList : [];
    const val = e.target.value;
    setInputText(val);
    setIsOpen(true);
    setAccountNotFound(false);

    // Si escribe directamente un número de cuenta (ej. "112")
    const isNum = /^\d+$/.test(val.trim());
    if (isNum && val.trim().length > 0) {
      const match = safeList.find((c) => String(c.cuenta).trim() === val.trim());
      if (match) {
        // Encontró coincidencia directa por número de cuenta
        setAccountNotFound(false);
      }
    }
  };

  const handleSelectClient = (cliente: Cliente) => {
    setInputText(formatClienteLabel(cliente.cuenta, cliente.nombre));
    setIsOpen(false);
    setAccountNotFound(false);
    onSelect(cliente);
  };

  const handleClear = () => {
    setInputText('');
    setIsOpen(false);
    setAccountNotFound(false);
    onSelect(null);
  };

  // Filtrado inteligente con tolerancia de acentos, mayúsculas y coincidencias parciales
  const safeList = Array.isArray(clientesList) ? clientesList : [];
  const filteredClients = safeList.filter((cliente) => {
    if (!cliente) return false;
    if (!inputText.trim()) return true;
    const q = normalizeText(inputText);
    const cuentaStr = normalizeText(cliente.cuenta);
    const nombreStr = normalizeText(cliente.nombre);
    const ciStr = normalizeText(cliente.ci);
    return cuentaStr.includes(q) || nombreStr.includes(q) || ciStr.includes(q);
  });

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-xs font-semibold text-slate-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </div>

        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-8 pr-8 py-1.5 text-xs bg-white border rounded shadow-2xs transition focus:outline-none focus:ring-1 ${
            accountNotFound
              ? 'border-red-400 focus:border-red-500 focus:ring-red-400 text-red-900'
              : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600 text-slate-800'
          } ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}`}
        />

        {inputText && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Alerta de cuenta no encontrada */}
      {accountNotFound && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>La cuenta ingresada no existe.</span>
        </div>
      )}

      {helperText && !accountNotFound && (
        <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
      )}

      {/* Menú desplegable de sugerencias inteligentes */}
      {isOpen && !disabled && (
        <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-300 rounded shadow-lg text-xs">
          {filteredClients.length > 0 ? (
            <div className="py-1 divide-y divide-slate-100">
              {filteredClients.slice(0, 30).map((cliente) => (
                <button
                  key={`${cliente.cuenta}-${cliente.nombre}`}
                  type="button"
                  onClick={() => handleSelectClient(cliente)}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                      {cliente.cuenta}
                    </span>
                    <span className="text-slate-800 font-medium group-hover:text-emerald-950">
                      {cliente.nombre}
                    </span>
                  </div>
                  {cliente.ci && (
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-600">
                      CI: {cliente.ci}
                    </span>
                  )}
                </button>
              ))}
              {filteredClients.length > 30 && (
                <div className="px-3 py-1 text-[10px] text-slate-400 text-center bg-slate-50">
                  Mostrando primeros 30 resultados de {filteredClients.length}
                </div>
              )}
            </div>
          ) : (
            <div className="px-3 py-3 text-center text-slate-500">
              {safeList.length === 0 ? (
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-600 font-medium">Sin clientes disponibles</p>
                  <p className="text-[10px] text-slate-400">
                    No se encontraron clientes registrados en el sistema.
                  </p>
                </div>
              ) : (
                <span className="text-[11px]">No se encontraron coincidencias para "{inputText}"</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
