import { TipoGarantiaCon } from '../types';

export interface ResumenAcreedores {
  tieneItems: boolean;
  esMultiple: boolean;
  acreedorUnico: {
    tipo: TipoGarantiaCon;
    cuenta: string;
    nombre: string;
  } | null;
}

/**
 * Analiza los acreedores de todos los lotes y bienes:
 * - Compara por tipo ('Farmer Rechnung', 'Campo Grande', 'Cliente').
 * - Para tipo 'Cliente', compara estrictamente también por número de cuenta.
 * - Determina si todos tienen el mismo acreedor o si existen múltiples acreedores.
 */
export function analizarAcreedoresItems(
  lotes: Array<{ garantiaConTipo?: string; garantiaConCuenta?: string | number; garantiaConNombre?: string }>,
  bienes: Array<{ garantiaConTipo?: string; garantiaConCuenta?: string | number; garantiaConNombre?: string }>
): ResumenAcreedores {
  const items = [...(lotes || []), ...(bienes || [])];
  if (items.length === 0) {
    return { tieneItems: false, esMultiple: false, acreedorUnico: null };
  }

  const map = new Map<string, { tipo: TipoGarantiaCon; cuenta: string; nombre: string }>();

  for (const it of items) {
    const rawTipo = (it.garantiaConTipo || '').trim();
    let tipo: TipoGarantiaCon = 'Farmer Rechnung';
    if (rawTipo === 'Campo Grande' || rawTipo.toLowerCase().includes('campo')) {
      tipo = 'Campo Grande';
    } else if (rawTipo === 'Cliente' || (rawTipo !== 'Farmer Rechnung' && !rawTipo.toLowerCase().includes('farmer') && it.garantiaConCuenta)) {
      tipo = 'Cliente';
    } else {
      tipo = 'Farmer Rechnung';
    }

    const cuenta = tipo === 'Cliente' ? String(it.garantiaConCuenta || '').trim() : '';
    const nombre = tipo === 'Cliente' ? String(it.garantiaConNombre || '').trim() : tipo;
    const key = tipo === 'Cliente' ? `Cliente:${cuenta}` : tipo;

    if (!map.has(key)) {
      map.set(key, { tipo, cuenta, nombre });
    }
  }

  if (map.size > 1) {
    return { tieneItems: true, esMultiple: true, acreedorUnico: null };
  }

  const unico = Array.from(map.values())[0];
  return { tieneItems: true, esMultiple: false, acreedorUnico: unico };
}
