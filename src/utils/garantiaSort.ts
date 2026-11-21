import { normalizeText } from './textSearch';

export type GarantiaSortField =
  | 'numeroSolicitud'
  | 'fecha'
  | 'fechaVencimiento'
  | 'prestatario'
  | 'cuentaPrestatario';

export type SortDirection = 'asc' | 'desc';

export interface GarantiaSortConfig {
  field: GarantiaSortField;
  direction: SortDirection;
}

export const DEFAULT_GARANTIA_SORT: GarantiaSortConfig = {
  field: 'fecha',
  direction: 'desc',
};

export interface GarantiaSortOption {
  value: GarantiaSortField;
  label: string;
}

export const GARANTIA_SORT_OPTIONS: GarantiaSortOption[] = [
  { value: 'numeroSolicitud', label: 'N.º Solicitud' },
  { value: 'fecha', label: 'Fecha de garantía' },
  { value: 'fechaVencimiento', label: 'Fecha de vencimiento' },
  { value: 'prestatario', label: 'Nombre del prestatario' },
  { value: 'cuentaPrestatario', label: 'Cuenta del prestatario' },
];

/**
 * Mapeo de campos internos a los encabezados reales de Google Sheets / Apps Script.
 */
export const GARANTIA_SORT_FIELD_TO_HEADER: Record<GarantiaSortField, string> = {
  numeroSolicitud: 'N.º Solicitud',
  fecha: 'Fecha',
  fechaVencimiento: 'Fecha de Vencimiento',
  prestatario: 'Prestatario',
  cuentaPrestatario: 'Cuenta Prestatario',
};

export function mapGarantiaSortFieldToBackendHeader(field?: string): string | undefined {
  if (!field) return undefined;
  if (field in GARANTIA_SORT_FIELD_TO_HEADER) {
    return GARANTIA_SORT_FIELD_TO_HEADER[field as GarantiaSortField];
  }
  return field;
}

export function isGarantiaSortField(field?: string): field is GarantiaSortField {
  return Boolean(field && field in GARANTIA_SORT_FIELD_TO_HEADER);
}

/**
 * Convierte fechas en formatos ISO (YYYY-MM-DD / YYYY-MM-DDTHH:mm:ssZ),
 * DD/MM/YYYY o YYYY/MM/DD a una clave numérica YYYYMMDD inmune a zonas horarias.
 * Retorna null si la fecha está vacía o no es válida.
 */
export function parseDateSortKey(fechaStr?: string | null): number | null {
  if (!fechaStr) return null;
  const raw = String(fechaStr).trim();
  if (!raw || raw === '—' || raw === '-') return null;

  const cleanDate = raw.split('T')[0].split(' ')[0].trim();

  if (cleanDate.includes('-')) {
    const parts = cleanDate.split('-').map((p) => parseInt(p, 10));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const [y, m, d] = parts[0] > 1000 ? parts : [parts[2], parts[1], parts[0]];
      if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return y * 10000 + m * 100 + d;
      }
    }
  }

  if (cleanDate.includes('/')) {
    const parts = cleanDate.split('/').map((p) => parseInt(p, 10));
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      const [y, m, d] = parts[0] > 1000 ? parts : [parts[2], parts[1], parts[0]];
      if (y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return y * 10000 + m * 100 + d;
      }
    }
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return (
      parsed.getUTCFullYear() * 10000 +
      (parsed.getUTCMonth() + 1) * 100 +
      parsed.getUTCDate()
    );
  }

  return null;
}

/**
 * Comparador natural para cuentas alfanuméricas y números con ceros iniciales.
 * Respeta el formato original sin convertir ni alterar los valores almacenados.
 */
export function compareAlphanumericNatural(
  aVal: string | number | null | undefined,
  bVal: string | number | null | undefined
): number {
  const aStr = aVal === null || aVal === undefined ? '' : String(aVal).trim();
  const bStr = bVal === null || bVal === undefined ? '' : String(bVal).trim();

  const aTokens = aStr.match(/\d+|\D+/g) || [];
  const bTokens = bStr.match(/\d+|\D+/g) || [];
  const len = Math.max(aTokens.length, bTokens.length);

  for (let i = 0; i < len; i++) {
    const ta = aTokens[i];
    const tb = bTokens[i];
    if (ta === undefined) return -1;
    if (tb === undefined) return 1;

    const aIsNum = /^\d+$/.test(ta);
    const bIsNum = /^\d+$/.test(tb);

    if (aIsNum && bIsNum) {
      const diff = Number(ta) - Number(tb);
      if (diff !== 0) return diff;
    } else {
      const cmp = normalizeText(ta).localeCompare(normalizeText(tb), 'es', {
        sensitivity: 'base',
      });
      if (cmp !== 0) return cmp;
    }
  }

  // Desempate determinista que respeta ceros iniciales (ej. "0045" vs "45")
  return aStr.localeCompare(bStr, 'es');
}

export interface SortableGarantiaLike {
  idGarantia?: string;
  numeroSolicitud?: string | number;
  fecha?: string;
  fechaVencimiento?: string;
  prestatario?: string;
  cuentaPrestatario?: string | number;
}

function isEmptyText(val: string | number | null | undefined): boolean {
  if (val === null || val === undefined) return true;
  const s = String(val).trim();
  return s === '' || s === '—';
}

function compareNumeroSolicitudValues(
  aVal: string | number | null | undefined,
  bVal: string | number | null | undefined
): number {
  const aStr = aVal === null || aVal === undefined ? '' : String(aVal).trim();
  const bStr = bVal === null || bVal === undefined ? '' : String(bVal).trim();

  const aOnlyDigits = /^\d+$/.test(aStr);
  const bOnlyDigits = /^\d+$/.test(bStr);

  if (aOnlyDigits && bOnlyDigits) {
    return Number(aStr) - Number(bStr);
  }
  return compareAlphanumericNatural(aStr, bStr);
}

/**
 * Ordena una colección de garantías (activas, pendientes o liberadas) sin mutar
 * el arreglo original ni los valores almacenados.
 * - Valores vacíos (especialmente Fecha de vencimiento) van siempre al final.
 */
export function sortGarantias<T extends SortableGarantiaLike>(
  items: T[],
  config: GarantiaSortConfig
): T[] {
  if (!Array.isArray(items) || items.length <= 1) {
    return Array.isArray(items) ? [...items] : [];
  }

  const dir = config.direction === 'asc' ? 1 : -1;

  return [...items].sort((a, b) => {
    let cmp = 0;

    switch (config.field) {
      case 'numeroSolicitud': {
        const aEmpty = isEmptyText(a.numeroSolicitud);
        const bEmpty = isEmptyText(b.numeroSolicitud);
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        cmp = compareNumeroSolicitudValues(a.numeroSolicitud, b.numeroSolicitud);
        break;
      }

      case 'fecha': {
        const aDate = parseDateSortKey(a.fecha);
        const bDate = parseDateSortKey(b.fecha);
        if (aDate === null && bDate === null) {
          cmp = compareNumeroSolicitudValues(a.numeroSolicitud, b.numeroSolicitud);
        } else if (aDate === null) {
          return 1;
        } else if (bDate === null) {
          return -1;
        } else {
          cmp = aDate - bDate;
          if (cmp === 0) {
            cmp = compareNumeroSolicitudValues(a.numeroSolicitud, b.numeroSolicitud);
          }
        }
        break;
      }

      case 'fechaVencimiento': {
        const aDate = parseDateSortKey(a.fechaVencimiento);
        const bDate = parseDateSortKey(b.fechaVencimiento);
        // Las garantías sin fecha de vencimiento aparecen SIEMPRE al final (en asc y desc)
        if (aDate === null && bDate === null) {
          return compareNumeroSolicitudValues(b.numeroSolicitud, a.numeroSolicitud);
        }
        if (aDate === null) return 1;
        if (bDate === null) return -1;
        cmp = aDate - bDate;
        if (cmp === 0) {
          cmp = compareNumeroSolicitudValues(a.numeroSolicitud, b.numeroSolicitud);
        }
        break;
      }

      case 'prestatario': {
        const aEmpty = isEmptyText(a.prestatario);
        const bEmpty = isEmptyText(b.prestatario);
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        const aNorm = normalizeText(a.prestatario);
        const bNorm = normalizeText(b.prestatario);
        cmp = aNorm.localeCompare(bNorm, 'es', { sensitivity: 'base' });
        if (cmp === 0) {
          cmp = compareNumeroSolicitudValues(a.numeroSolicitud, b.numeroSolicitud);
        }
        break;
      }

      case 'cuentaPrestatario': {
        const aEmpty = isEmptyText(a.cuentaPrestatario);
        const bEmpty = isEmptyText(b.cuentaPrestatario);
        if (aEmpty && bEmpty) return 0;
        if (aEmpty) return 1;
        if (bEmpty) return -1;
        cmp = compareAlphanumericNatural(a.cuentaPrestatario, b.cuentaPrestatario);
        if (cmp === 0) {
          cmp = compareNumeroSolicitudValues(a.numeroSolicitud, b.numeroSolicitud);
        }
        break;
      }

      default:
        return 0;
    }

    if (cmp !== 0) return cmp * dir;
    return String(a.idGarantia || '').localeCompare(String(b.idGarantia || ''));
  });
}
