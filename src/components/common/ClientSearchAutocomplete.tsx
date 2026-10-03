import React, { useState, useEffect, useRef } from 'react';
import { Search, UserCheck, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Cliente } from '../../types';
import { buscarClientes, obtenerClientePorCuenta } from '../../services/backend';
import { formatClienteLabel } from '../../utils/textSearch';

interface ClientSearchAutocompleteProps {
  label: string;
  placeholder?: string;
  clientesList?: Cliente[];
  selectedCuenta?: string | number | null;
  onSelect: (cliente: Cliente | null) => void;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
}

export const ClientSearchAutocomplete: React.FC<ClientSearchAutocompleteProps> = ({
  label,
  placeholder = 'Buscar por N.º de cuenta o nombre...',
  clientesList = [],
  selectedCuenta,
  onSelect,
  required = false,
  disabled = false,
  helperText,
}) => {
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [suggestions, setSuggestions] = useState<Cliente[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  // Sincronizar texto si viene una cuenta seleccionada
  useEffect(() => {
    if (selectedCuenta !== undefined && selectedCuenta !== null && selectedCuenta !== '') {
      const clean = String(selectedCuenta).trim();
      // Buscar primero en el caché local si existe
      const localFound = Array.isArray(clientesList)
        ? clientesList.find((c) => String(c.cuenta).trim() === clean)
        : null;

      if (localFound) {
        setInputText(formatClienteLabel(localFound.cuenta, localFound.nombre));
        setAccountNotFound(false);
      } else {
        // Consultar directamente por cuenta
        obtenerClientePorCuenta(clean)
          .then((cliente) => {
            if (cliente) {
              setInputText(formatClienteLabel(cliente.cuenta, cliente.nombre));
              setAccountNotFound(false);
            } else {
              setInputText(clean);
              setAccountNotFound(true);
            }
          })
          .catch(() => {
            setInputText(clean);
          });
      }
    } else {
      setInputText('');
      setAccountNotFound(false);
    }
  }, [selectedCuenta]);

  // Cerrar lista al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        validateCurrentText();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputText]);

  // Búsqueda remota con debounce (350ms)
  useEffect(() => {
    if (disabled) return;
    const clean = inputText.trim();

    if (!clean) {
      setSuggestions([]);
      setAccountNotFound(false);
      return;
    }

    // Si coincide con "112 — Juan Perez", no reiniciar búsqueda
    if (clean.includes('—')) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await buscarClientes(clean);
        setSuggestions(results);
        // Si el usuario escribió únicamente un número y no hay resultados
        if (/^\d+$/.test(clean) && results.length === 0) {
          const direct = await obtenerClientePorCuenta(clean);
          if (direct) {
            setSuggestions([direct]);
            setAccountNotFound(false);
          } else {
            setAccountNotFound(true);
          }
        } else {
          setAccountNotFound(false);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputText, disabled]);

  const validateCurrentText = async () => {
    const clean = inputText.trim();
    if (!clean) {
      setAccountNotFound(false);
      onSelect(null);
      return;
    }

    // Si es solo número (ej: "112")
    if (/^\d+$/.test(clean)) {
      try {
        const match = await obtenerClientePorCuenta(clean);
        if (match) {
          setInputText(formatClienteLabel(match.cuenta, match.nombre));
          setAccountNotFound(false);
          onSelect(match);
        } else {
          setAccountNotFound(true);
          onSelect(null);
        }
      } catch {
        setAccountNotFound(true);
        onSelect(null);
      }
      return;
    }

    // Si tiene el formato "Cuenta — Nombre", extraer cuenta
    const matchParts = clean.match(/^(\d+)\s*—/);
    if (matchParts && matchParts[1]) {
      const cuentaNum = matchParts[1];
      const match = await obtenerClientePorCuenta(cuentaNum);
      if (match) {
        setAccountNotFound(false);
        onSelect(match);
      } else {
        setAccountNotFound(true);
        onSelect(null);
      }
      return;
    }

    // Si es texto libre y tenemos una sugerencia exacta
    if (suggestions.length === 1) {
      const single = suggestions[0];
      handleSelectClient(single);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    setIsOpen(true);
    setAccountNotFound(false);
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
    setSuggestions([]);
    setAccountNotFound(false);
    onSelect(null);
  };

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

        {isSearching && (
          <div className="absolute inset-y-0 right-7 flex items-center">
            <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
          </div>
        )}

        {inputText && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Alerta de cuenta no encontrada */}
      {accountNotFound && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-red-600 font-medium">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>La cuenta ingresada no existe.</span>
        </div>
      )}

      {helperText && !accountNotFound && (
        <p className="mt-1 text-[11px] text-slate-500">{helperText}</p>
      )}

      {/* Menú desplegable de sugerencias inteligentes */}
      {isOpen && !disabled && inputText.trim() && !inputText.includes('—') && (
        <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-300 rounded shadow-lg text-xs">
          {suggestions.length > 0 ? (
            <div className="py-1 divide-y divide-slate-100">
              {suggestions.map((cliente) => (
                <button
                  key={`${cliente.cuenta}-${cliente.nombre}`}
                  type="button"
                  onClick={() => handleSelectClient(cliente)}
                  className="w-full text-left px-3 py-1.5 hover:bg-emerald-50 transition flex items-center justify-between group cursor-pointer"
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
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-mono">
                      CI: {cliente.ci}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-center text-slate-500">
              {isSearching ? (
                <span className="text-[11px]">Buscando clientes...</span>
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
