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
 * Formato numérico para hectáreas con dos decimales estándar
 */
export function formatHectareas(num: number | null | undefined): string {
  if (num === null || num === undefined || isNaN(Number(num))) return '—';
  return `${Number(num).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ha`;
}

/**
 * Formato de fecha estándar DD/MM/AAAA
 */
export function formatFecha(fechaStr: string | null | undefined): string {
  if (!fechaStr) return '—';
  // Si ya viene en formato AAAA-MM-DD
  if (fechaStr.includes('-')) {
    const parts = fechaStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return fechaStr;
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
