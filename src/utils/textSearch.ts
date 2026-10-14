/**
 * Utilidades para búsqueda inteligente con tolerancia de acentos,
 * mayúsculas/minúsculas y coincidencias parciales.
 */

/**
 * Normaliza un texto para búsqueda:
 * Convierte a minúsculas y elimina diacríticos/acentos (á -> a, é -> e, etc.)
 */
export function normalizeText(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Comprueba si un texto objetivo coincide con el término de búsqueda.
 */
export function matchesQuery(target: string | number | null | undefined, query: string): boolean {
  if (!query) return true;
  const cleanTarget = normalizeText(target);
  const cleanQuery = normalizeText(query);
  return cleanTarget.includes(cleanQuery);
}

/**
 * Comprueba si alguna propiedad de un objeto coincide con el término de búsqueda.
 */
export function matchesAnyField<T extends Record<string, any>>(item: T, fields: (keyof T)[], query: string): boolean {
  if (!query || !query.trim()) return true;
  const cleanQuery = normalizeText(query);
  return fields.some((field) => {
    const val = item[field];
    return normalizeText(val).includes(cleanQuery);
  });
}

/**
 * Formatea la etiqueta de cliente según la norma de la aplicación:
 * "Cuenta — Nombre"
 */
export function formatClienteLabel(cuenta: string | number, nombre: string): string {
  return `${cuenta} — ${nombre}`;
}

/**
 * Formatea la etiqueta de propietario para terrenos y bienes:
 * "Nombre (Cuenta XXX)" según requisito oficial.
 * Ej: "Klas Rempel (Cuenta 100)"
 */
export function formatPropietario(propietario?: string, cuenta?: string | number): string {
  const nombre = (propietario || '').trim();
  const cta =
    cuenta !== undefined && cuenta !== null && String(cuenta).trim() !== ''
      ? String(cuenta).trim()
      : '';

  if (nombre && cta) {
    return `${nombre} (Cuenta ${cta})`;
  }
  if (nombre) return nombre;
  if (cta) return `Cuenta ${cta}`;
  return '—';
}

/**
 * Formato numérico para hectáreas con hasta 6 decimales reales sin ceros innecesarios al final
 * Ejemplos: 11.4336 -> "11,4336 ha", 50 -> "50 ha", 0.000125 -> "0,000125 ha"
 */
export function formatHectareas(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '—';
  const val = Number(num);
  return `${val.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 6 })} ha`;
}

/**
 * Parsea un valor numérico decimal admitiendo coma y punto, manteniendo hasta 6 decimales
 */
export function parseDecimal(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Formato de fecha estándar DD/MM/AAAA
 */
export function formatFecha(fechaStr: string | null | undefined): string {
  if (!fechaStr || fechaStr === '—' || String(fechaStr).trim() === '') return '—';
  const cleanDate = String(fechaStr).split('T')[0].split(' ')[0].trim();
  if (cleanDate.includes('-')) {
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      return `${parts[2].slice(0, 2)}/${parts[1]}/${parts[0]}`;
    }
  }
  if (cleanDate.includes('/')) {
    const parts = cleanDate.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return cleanDate;
    }
  }
  return cleanDate;
}

/**
 * Obtiene la fecha actual en formato ISO AAAA-MM-DD
 */
export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcula el estado de vencimiento según la regla de la institución y backend:
 * - 'Sin vencimiento' si no tiene fecha
 * - 'Vencida' si la fecha ya pasó (< 0 días)
 * - 'Próxima a vencer' si vence dentro de los próximos 30 días (0 a 30 días)
 * - 'Vigente' si faltan más de 30 días
 */
export function calcularEstadoVencimiento(fechaVencimientoStr?: string | null): {
  estado: 'Vigente' | 'Próxima a vencer' | 'Vencida' | 'Sin vencimiento';
  diasRestantes?: number;
} {
  if (!fechaVencimientoStr || !fechaVencimientoStr.trim() || fechaVencimientoStr === '—') {
    return { estado: 'Sin vencimiento' };
  }

  let y = 0,
    m = 0,
    d = 0;
  if (fechaVencimientoStr.includes('-')) {
    const parts = fechaVencimientoStr.split('-').map(Number);
    y = parts[0];
    m = parts[1] - 1;
    d = parts[2];
  } else if (fechaVencimientoStr.includes('/')) {
    const parts = fechaVencimientoStr.split('/').map(Number);
    d = parts[0];
    m = parts[1] - 1;
    y = parts[2];
  } else {
    return { estado: 'Sin vencimiento' };
  }

  if (isNaN(y) || isNaN(m) || isNaN(d) || y <= 0 || d <= 0) {
    return { estado: 'Sin vencimiento' };
  }

  const targetDate = new Date(y, m, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = targetDate.getTime() - today.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return { estado: 'Vencida', diasRestantes };
  } else if (diasRestantes <= 30) {
    return { estado: 'Próxima a vencer', diasRestantes };
  } else {
    return { estado: 'Vigente', diasRestantes };
  }
}
