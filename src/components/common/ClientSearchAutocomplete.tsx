import React, { useState, useEffect, useRef } from 'react';
import { Search, UserCheck, X, AlertCircle, RefreshCw } from 'lucide-react';
import { Cliente } from '../../types';
import {
  buscarClientes,
  obtenerClientePorCuenta,
  findAnyCachedData,
  getFromMemoryCache,
} from '../../services/backend';
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
  const [searchError, setSearchError] = useState(false);
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [suggestions, setSuggestions] = useState<Cliente[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<any>(null);

  // Clientes disponibles en caché para autocompletado inmediato
  const effectiveClients: Cliente[] =
    Array.isArray(clientesList) && clientesList.length > 0
      ? clientesList
      : findAnyCachedData<Cliente>('clientes') || [];

  // Sincronizar texto si viene una cuenta seleccionada
  useEffect(() => {
    if (selectedCuenta !== undefined && selectedCuenta !== null && selectedCuenta !== '') {
      const clean = String(selectedCuenta).trim();
      // Buscar primero en el caché local/en memoria si existe
      const localFound = effectiveClients.find((c) => String(c.cuenta).trim() === clean);

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
  }, [selectedCuenta, effectiveClients.length]);

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

  // Ejecutar búsqueda (con caché inmediata o remota con debounce)
  const executeSearch = (clean: string) => {
    // 1. Verificar si ya existe en la caché en memoria de búsquedas
    const searchKey = `search:${clean.toLowerCase()}`;
    const cachedResults = getFromMemoryCache<Cliente[]>('clientes', searchKey);
    if (cachedResults) {
      setSuggestions(cachedResults);
      setIsSearching(false);
      setSearchError(false);
      return;
    }

    // 2. Si no está en caché remota, buscar primero en los clientes ya cargados en memoria
    if (effectiveClients.length > 0) {
      const lower = clean.toLowerCase();
      const localMatches = effectiveClients.filter(
        (c) =>
          String(c.cuenta).toLowerCase().includes(lower) ||
          c.nombre.toLowerCase().includes(lower) ||
          (c.ci && c.ci.toLowerCase().includes(lower))
      );
      if (localMatches.length > 0) {
        setSuggestions(localMatches);
      }
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(false);
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
        setSearchError(true);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  // Búsqueda al escribir
  useEffect(() => {
    if (disabled) return;
    const clean = inputText.trim();

    if (!clean) {
      setSuggestions([]);
      setAccountNotFound(false);
      setIsSearching(false);
      setSearchError(false);
      return;
    }

    // Si coincide con formato seleccionado "112 — Juan Perez", no reiniciar búsqueda
    if (clean.includes('—')) {
      return;
    }

    executeSearch(clean);

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
      // Revisar primero en memoria
      const local = effectiveClients.find((c) => String(c.cuenta).trim() === clean);
      if (local) {
        setInputText(formatClienteLabel(local.cuenta, local.nombre));
        setAccountNotFound(false);
        onSelect(local);
        return;
      }
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
      const local = effectiveClients.find((c) => String(c.cuenta).trim() === cuentaNum);
      if (local) {
        setAccountNotFound(false);
        onSelect(local);
        return;
      }
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
    setSearchError(false);
    onSelect(null);
  };

  // Clientes a mostrar en dropdown: si inputText está vacío y se hace click, mostrar primeros de caché
  const displaySuggestions =
    inputText.trim() && !inputText.includes('—')
      ? suggestions
      : !inputText.trim()
      ? effectiveClients.slice(0, 15)
      : [];

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
      {isOpen && !disabled && !inputText.includes('—') && (
        <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-slate-300 rounded shadow-lg text-xs">
          {isSearching ? (
            <div className="px-3 py-3 text-center text-slate-600 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-800" />
              <span className="text-[11px] font-medium">Buscando clientes...</span>
            </div>
          ) : searchError ? (
            <div className="px-3 py-3 text-center text-red-600 flex flex-col items-center gap-1">
              <span className="text-[11px]">No se pudo cargar la información.</span>
              <button
                type="button"
                onClick={() => executeSearch(inputText.trim())}
                className="text-[10px] text-red-800 font-semibold underline hover:no-underline cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : displaySuggestions.length > 0 ? (
            <div className="py-1 divide-y divide-slate-100">
              {displaySuggestions.map((cliente) => (
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
          ) : inputText.trim() ? (
            <div className="px-3 py-3 text-center text-slate-500">
              <span className="text-[11px]">No se encontraron coincidencias para "{inputText}"</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
