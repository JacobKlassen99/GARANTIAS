/**
 * CAPA CENTRALIZADA DE SERVICIOS PARA GOOGLE APPS SCRIPT & GOOGLE SHEETS
 * Registro de Garantía de Terrenos — Asoc. Civil "Colonia Chihuahua"
 *
 * REGLAS FUNDAMENTALES:
 * 1. Google Sheets es la ÚNICA fuente real de datos.
 * 2. NO se usa localStorage ni IndexedDB como base de datos.
 * 3. NO se usan datos falsos ni simulaciones de guardado.
 * 4. Toda la comunicación pasa exclusivamente por este servicio.
 * 5. Método: POST con cuerpo JSON { accion: "...", datos: { ... } }
 *    y Content-Type: "text/plain;charset=utf-8".
 */

import {
  Cliente,
  Lote,
  Bien,
  Garantia,
  DashboardStats,
  PaginatedResponse,
  QueryParams,
  ConfiguracionSistema,
  GarantiaLoteRelacion,
  GarantiaBienRelacion,
  DetalleCliente,
  DetalleClienteGarantia,
  DetalleClienteLote,
  DetalleClienteBien,
  RelacionLoteGarantia,
  RelacionBienGarantia,
  EstadoRegistro,
} from '../types';
import { calcularEstadoVencimiento } from '../utils/textSearch';
import {
  getFromMemoryCache,
  setToMemoryCache,
  invalidateMemoryCache,
  clearAllMemoryCache,
  hasInMemoryCache,
  fetchWithDeduplication,
  findAnyCachedData,
} from './dataCache';
import { getIndexedCache, setIndexedCache, clearIndexedCache } from './indexedCache';

export {
  getFromMemoryCache,
  setToMemoryCache,
  invalidateMemoryCache,
  clearAllMemoryCache,
  hasInMemoryCache,
  fetchWithDeduplication,
  findAnyCachedData,
};

// URL del Web App de Google Apps Script proporcionada por el usuario
export const GOOGLE_APPS_SCRIPT_URL: string =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GAS_URL) ||
  'https://script.google.com/macros/s/AKfycbzyX9dvWYVONQfd0EO9RpWCHtoi8_1Bk_EjNW5eVySyMv5AEBrXCEGE2YdH59V-ea2hbQ/exec';

// Sesión en memoria (NO se guarda permanentemente en el navegador)
let inMemorySession: {
  isAuthenticated: boolean;
  institucion: string;
} = {
  isAuthenticated: false,
  institucion: 'ASOC. CIVIL "COLONIA CHIHUAHUA"',
};

let lastSyncTimestamp: string | null = null;

export function getLastSyncTime(): string | null {
  return lastSyncTimestamp;
}

function extractArrayFromResponse(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.items)) return res.items;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.registros)) return res.registros;
  if (Array.isArray(res.lotes)) return res.lotes;
  if (Array.isArray(res.bienes)) return res.bienes;
  if (Array.isArray(res.garantias)) return res.garantias;
  if (res.resultado) return extractArrayFromResponse(res.resultado);
  return [];
}

export async function preloadAllData(forceRefresh: boolean = false): Promise<void> {
  if (!forceRefresh) {
    try {
      const cached = await getIndexedCache<any>('preload_data');
      if (cached) {
        if (cached.initData) setToMemoryCache('init_data', cached.initData);
        if (cached.clientes) setToMemoryCache('clientes', cached.clientes, { page: 1, pageSize: 1000 });
        if (cached.lotes) setToMemoryCache('lotes', cached.lotes, { page: 1, pageSize: 1000 });
        if (cached.bienes) setToMemoryCache('bienes', cached.bienes, { page: 1, pageSize: 1000 });
        if (cached.garantias) setToMemoryCache('garantias', cached.garantias, { page: 1, pageSize: 1000 });
        if (cached.dashboard) setToMemoryCache('dashboard', cached.dashboard);
        if (cached.timestamp) lastSyncTimestamp = cached.timestamp;
      }
    } catch {
      // Ignorar error de IDB
    }
  }

  try {
    const [initData, clientesRes, lotesRes, bienesRes, garantiasRes] = await Promise.all([
      obtenerDatosIniciales().catch(() => null),
      listarClientes({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
      listarLotes({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
      listarBienes({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
      listarGarantias({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
    ]);

    if (initData || clientesRes || lotesRes || bienesRes || garantiasRes) {
      lastSyncTimestamp = new Date().toLocaleString('es-BO', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });

      const garantias = garantiasRes?.data || (Array.isArray(garantiasRes) ? garantiasRes : []);
      const lotes = lotesRes?.data || (Array.isArray(lotesRes) ? lotesRes : []);
      const bienes = bienesRes?.data || (Array.isArray(bienesRes) ? bienesRes : []);

      const stats: DashboardStats = {
        garantiasActivas: garantias.length,
        hectareasEnGarantia: lotes.filter((l: any) => l.enGarantia).reduce((acc: number, l: any) => acc + (l.hectareasEnGarantia || l.hectareas || 0), 0),
        hectareasDisponibles: lotes.filter((l: any) => !l.enGarantia).reduce((acc: number, l: any) => acc + (l.hectareas || 0), 0),
        bienesEnGarantia: bienes.filter((b: any) => b.enGarantia).length,
        valorBienesEnGarantiaUSD: bienes.filter((b: any) => b.enGarantia).reduce((acc: number, b: any) => acc + (b.valorGarantiaUSD || 0), 0),
        garantiasExternas: garantias.filter((g: any) => g.garantiaConTipo === 'Farmer Rechnung' || g.garantiaConTipo === 'Campo Grande').length,
        lotesBloqueados: lotes.filter((l: any) => l.estado === 'Bloqueado').length,
        bienesBloqueados: bienes.filter((b: any) => b.estado === 'Bloqueado').length,
      };
      setToMemoryCache('dashboard', stats);

      await setIndexedCache('preload_data', {
        initData,
        clientes: clientesRes,
        lotes: lotesRes,
        bienes: bienesRes,
        garantias: garantiasRes,
        dashboard: stats,
        timestamp: lastSyncTimestamp,
      });
    }
  } catch (err) {
    const cached = await getIndexedCache<any>('preload_data');
    if (cached) {
      if (cached.initData) setToMemoryCache('init_data', cached.initData);
      if (cached.clientes) setToMemoryCache('clientes', cached.clientes, { page: 1, pageSize: 1000 });
      if (cached.lotes) setToMemoryCache('lotes', cached.lotes, { page: 1, pageSize: 1000 });
      if (cached.bienes) setToMemoryCache('bienes', cached.bienes, { page: 1, pageSize: 1000 });
      if (cached.garantias) setToMemoryCache('garantias', cached.garantias, { page: 1, pageSize: 1000 });
      if (cached.dashboard) setToMemoryCache('dashboard', cached.dashboard);
      lastSyncTimestamp = cached.timestamp ? `${cached.timestamp} (Modo Offline)` : 'Sin conexión';
    } else {
      lastSyncTimestamp = 'Sin conexión (Modo offline)';
    }
  }
}

export class BackendConnectionError extends Error {
  constructor(message: string = 'No se pudo conectar con el servidor.') {
    super(message);
    this.name = 'BackendConnectionError';
  }
}

/**
 * Estado de la sesión actual en memoria
 */
export function getSessionState() {
  return { ...inMemorySession };
}

/**
 * Cierre de sesión (limpia el estado en memoria y caché IndexedDB)
 */
export function logout(): void {
  inMemorySession.isAuthenticated = false;
  clearAllMemoryCache();
  clearIndexedCache();
  lastSyncTimestamp = null;
}

/**
 * Función genérica para enviar peticiones HTTP a Google Apps Script
 * Utiliza exactamente: POST { accion, datos } con text/plain;charset=utf-8
 */
export async function callAppsScript<T>(accion: string, datos: Record<string, any> = {}): Promise<T> {
  const endpoint = GOOGLE_APPS_SCRIPT_URL;
  if (!endpoint) {
    throw new BackendConnectionError('No se ha configurado la dirección del servidor.');
  }

  const isReadOnly =
    accion.startsWith('obtener') || accion.startsWith('listar') || accion.startsWith('buscar');

  const executeRequest = async (): Promise<T> => {
    try {
      const payload = JSON.stringify({
        accion,
        datos: datos || {},
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: payload,
      });

      if (!response.ok) {
        throw new BackendConnectionError(`Error de comunicación con el servidor (${response.status}).`);
      }

      const data = await response.json();

      if (!data || data.ok === false) {
        const msg = data?.mensaje || data?.message || data?.error || 'No se pudo procesar la solicitud.';
        throw new Error(msg);
      }

      return (data.resultado !== undefined ? data.resultado : data) as T;
    } catch (error: any) {
      if (error instanceof BackendConnectionError) {
        throw error;
      }
      // Si ya es un Error lanzado desde la validación del backend, propagar su mensaje
      if (error && error.message && !error.message.includes('fetch') && !error.message.includes('Failed to fetch')) {
        throw error;
      }
      throw new BackendConnectionError('No se pudo conectar con el servidor.');
    }
  };

  if (isReadOnly) {
    const dedupKey = `${accion}:${JSON.stringify(datos || {})}`;
    return fetchWithDeduplication(dedupKey, executeRequest);
  }

  return executeRequest();
}

/**
 * SERVICIOS DE AUTENTICACIÓN
 * Valida la contraseña directamente contra la hoja 'configuracion' en Google Sheets
 * mediante la acción "verificarPassword" en Google Apps Script
 */
export async function login(password: string): Promise<{ success: boolean; message?: string }> {
  if (!password || !password.trim()) {
    return { success: false, message: 'Ingrese la contraseña del sistema.' };
  }

  const endpoint = GOOGLE_APPS_SCRIPT_URL;

  try {
    const payload = JSON.stringify({
      accion: 'verificarPassword',
      datos: {
        password: password.trim(),
      },
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: payload,
    });

    if (!response.ok) {
      throw new BackendConnectionError('No se pudo conectar con el servidor.');
    }

    const data = await response.json();

    if (data && data.ok === true && data.resultado && data.resultado.ok === true) {
      inMemorySession.isAuthenticated = true;
      return {
        success: true,
        message: data.resultado.mensaje || 'Acceso autorizado.',
      };
    }

    if (data && data.resultado && data.resultado.ok === false) {
      return {
        success: false,
        message: data.resultado.mensaje || 'Contraseña incorrecta.',
      };
    }

    if (data && data.ok === false) {
      return {
        success: false,
        message: data.mensaje || 'Error al validar la contraseña.',
      };
    }

    return {
      success: false,
      message: 'Respuesta no reconocida del servidor.',
    };
  } catch (err: any) {
    if (err instanceof BackendConnectionError) {
      throw err;
    }
    throw new BackendConnectionError('No se pudo conectar con el servidor.');
  }
}

/**
 * SERVICIOS DE INICIO / DATOS GENERALES
 * accion: obtenerDatosIniciales
 */
export interface DatosIniciales {
  institucion: string;
  tiposGarantia: string[];
  estados: string[];
  garantiaConTipos: string[];
  siguienteSolicitud: number | string;
  resumen: {
    garantiasActivas: number;
    hectareasEnGarantia: number;
    hectareasDisponibles: number;
    bienesEnGarantia: number;
    garantiasExternas: number;
    lotesBloqueados?: number;
    bienesBloqueados?: number;
  };
}

export async function obtenerDatosIniciales(): Promise<DatosIniciales> {
  const res = await callAppsScript<DatosIniciales>('obtenerDatosIniciales', {});
  if (res && res.institucion) {
    inMemorySession.institucion = res.institucion;
  }
  return res;
}

/**
 * SERVICIOS DE DASHBOARD
 * accion: obtenerResumenDashboard
 */
export async function getDashboardStats(forceRefresh: boolean = false): Promise<DashboardStats> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<DashboardStats>('dashboard');
    if (cached) return cached;
  }

  const garantiasCached = findAnyCachedData<Garantia>('garantias');
  const lotesCached = findAnyCachedData<Lote>('lotes');
  const bienesCached = findAnyCachedData<Bien>('bienes');

  let garantias: Garantia[] = garantiasCached || [];
  let lotes: Lote[] = lotesCached || [];
  let bienes: Bien[] = bienesCached || [];

  if (forceRefresh || garantias.length === 0 || lotes.length === 0 || bienes.length === 0) {
    try {
      const [gRes, lRes, bRes] = await Promise.all([
        listarGarantias({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
        listarLotes({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
        listarBienes({ page: 1, pageSize: 1000 }, forceRefresh).catch(() => null),
      ]);
      if (gRes) garantias = gRes.data || (Array.isArray(gRes) ? gRes : garantias);
      if (lRes) lotes = lRes.data || (Array.isArray(lRes) ? lRes : lotes);
      if (bRes) bienes = bRes.data || (Array.isArray(bRes) ? bRes : bienes);
    } catch {
      // Ignorar y usar lo disponible
    }
  }

  const stats: DashboardStats = {
    garantiasActivas: garantias.length,
    hectareasEnGarantia: lotes.reduce((acc, l) => acc + (l.hectareasEnGarantia || 0), 0),
    hectareasDisponibles: lotes.reduce(
      (acc, l) =>
        acc +
        (l.hectareasDisponibles !== undefined
          ? l.hectareasDisponibles
          : Math.max(0, l.hectareas - (l.hectareasEnGarantia || 0))),
      0
    ),
    bienesEnGarantia: bienes.filter((b) => b.enGarantia).length,
    valorBienesEnGarantiaUSD: bienes
      .filter((b) => b.enGarantia)
      .reduce((acc, b) => acc + (b.valorGarantiaUSD || 0), 0),
    garantiasExternas: garantias.filter(
      (g) => g.garantiaConTipo === 'Farmer Rechnung' || g.garantiaConTipo === 'Campo Grande'
    ).length,
    lotesBloqueados: lotes.filter((l) => l.estado === 'Bloqueado').length,
    bienesBloqueados: bienes.filter((b) => b.estado === 'Bloqueado').length,
  };

  setToMemoryCache('dashboard', stats);
  return stats;
}

/**
 * NORMALIZADORES DE DATOS RECIBIDOS DESDE GOOGLE SHEETS
 */
export function normalizarCliente(item: any): Cliente {
  return {
    cuenta: item?.Cuenta ?? item?.cuenta ?? '',
    nombre: item?.Nombre ?? item?.nombre ?? '',
    ci: item?.CI !== undefined && item?.CI !== null ? String(item.CI) : (item?.ci ?? ''),
  };
}

export function normalizarLote(item: any): Lote {
  const idLote = item?.['ID Lote'] || item?.idLote || '';
  const numeroLote = item?.['N.º de Lote'] || item?.numeroLote || '';

  const enGarantiaCalculado =
    typeof item?.['En Garantía'] === 'boolean'
      ? item['En Garantía']
      : item?.enGarantia === true || item?.['Disponibilidad'] === 'En garantía';

  const hectareasTotales =
    typeof item?.['Hectáreas'] === 'number'
      ? item['Hectáreas']
      : typeof item?.['Hectáreas Totales'] === 'number'
      ? item['Hectáreas Totales']
      : Number(item?.hectareas) || 0;

  const backendHaEnGarantia =
    typeof item?.['Hectáreas en Garantía'] === 'number'
      ? item['Hectáreas en Garantía']
      : typeof item?.hectareasEnGarantia === 'number'
      ? item.hectareasEnGarantia
      : undefined;

  let hectareasEnGarantia = 0;
  const garantiasCached = findAnyCachedData<Garantia>('garantias');
  let foundInGuarantees = false;

  if (garantiasCached && Array.isArray(garantiasCached) && garantiasCached.length > 0) {
    for (const g of garantiasCached) {
      if (Array.isArray(g.lotes)) {
        for (const gl of g.lotes) {
          const matchId = gl.idLote && idLote && String(gl.idLote).trim() === String(idLote).trim();
          const matchNum = gl.numeroLote && numeroLote && String(gl.numeroLote).trim().toLowerCase() === String(numeroLote).trim().toLowerCase();
          if (matchId || matchNum) {
            foundInGuarantees = true;
            hectareasEnGarantia += Number(gl.hectareas) || 0;
          }
        }
      }
    }
  }

  if (!foundInGuarantees) {
    if (backendHaEnGarantia !== undefined && backendHaEnGarantia > 0 && backendHaEnGarantia < hectareasTotales) {
      hectareasEnGarantia = backendHaEnGarantia;
    } else if (enGarantiaCalculado) {
      hectareasEnGarantia = backendHaEnGarantia !== undefined ? backendHaEnGarantia : hectareasTotales;
    } else {
      hectareasEnGarantia = 0;
    }
  }

  hectareasEnGarantia = Math.min(hectareasTotales, Math.max(0, hectareasEnGarantia));

  const hectareasDisponibles =
    typeof item?.['Hectáreas Disponibles'] === 'number' && !foundInGuarantees
      ? item['Hectáreas Disponibles']
      : typeof item?.hectareasDisponibles === 'number' && !foundInGuarantees
      ? item.hectareasDisponibles
      : Math.max(0, hectareasTotales - hectareasEnGarantia);

  const enGarantiaFinal = enGarantiaCalculado || hectareasEnGarantia > 0;

  return {
    idLote,
    numeroLote,
    cuentaPropietario: item?.['Cuenta Propietario'] ?? item?.cuentaPropietario ?? '',
    propietario: item?.['Propietario'] || item?.propietario || '',
    cuentaEncargado: item?.['Cuenta Encargado'] ?? item?.cuentaEncargado ?? '',
    encargado: item?.['Encargado'] || item?.encargado || '',
    hectareas: hectareasTotales,
    ubicacion: item?.['Ubicación'] || item?.ubicacion || '',
    estado: item?.['Estado'] || item?.estado || 'Disponible',
    motivoBloqueo: item?.['Motivo Bloqueo'] || item?.motivoBloqueo || '',
    fechaBloqueo: item?.['Fecha Bloqueo'] || item?.fechaBloqueo || '',
    observacion: item?.['Observación'] || item?.observacion || '',
    enGarantia: enGarantiaFinal,
    solicitudGarantiaActiva: item?.['Disponibilidad'] || item?.solicitudGarantiaActiva || '',
    hectareasEnGarantia,
    hectareasDisponibles,
  };
}

export function normalizarBien(item: any): Bien {
  const enGarantiaCalculado =
    typeof item?.['En Garantía'] === 'boolean'
      ? item['En Garantía']
      : item?.enGarantia === true || item?.['Disponibilidad'] === 'En garantía';

  const valorGarantiaUSD =
    typeof item?.['Valor en Garantía ($us.)'] === 'number'
      ? item['Valor en Garantía ($us.)']
      : typeof item?.valorGarantiaUSD === 'number'
      ? item.valorGarantiaUSD
      : typeof item?.['Valor en Garantía'] === 'number'
      ? item['Valor en Garantía']
      : 0;

  const rawValorBien = item?.['Valor del Bien ($us.)'] ?? item?.valorBienUSD ?? item?.['Valor del Bien'];
  let valorBienUSD: number | undefined = undefined;
  if (rawValorBien !== undefined && rawValorBien !== null && String(rawValorBien).trim() !== '') {
    const parsed = Number(rawValorBien);
    if (!isNaN(parsed)) {
      valorBienUSD = parsed;
    }
  }

  return {
    idBien: item?.['ID Bien'] || item?.idBien || '',
    numeroPoliza: item?.['N.º Póliza'] || item?.numeroPoliza || '',
    cuentaPropietario: item?.['Cuenta Propietario'] ?? item?.cuentaPropietario ?? '',
    propietario: item?.['Propietario'] || item?.propietario || '',
    cuentaEncargado: item?.['Cuenta Encargado'] ?? item?.cuentaEncargado ?? '',
    encargado: item?.['Encargado'] || item?.encargado || '',
    tipoBien: item?.['Tipo de Bien'] || item?.tipoBien || 'Otro bien',
    descripcion: item?.['Descripción'] || item?.descripcion || '',
    marca: item?.['Marca'] || item?.marca || '',
    modelo: item?.['Modelo'] || item?.modelo || '',
    placa: item?.['Placa'] || item?.placa || '',
    ubicacion: item?.['Ubicación'] || item?.ubicacion || '',
    estado: item?.['Estado'] || item?.estado || 'Disponible',
    motivoBloqueo: item?.['Motivo Bloqueo'] || item?.motivoBloqueo || '',
    fechaBloqueo: item?.['Fecha Bloqueo'] || item?.fechaBloqueo || '',
    observacion: item?.['Observación'] || item?.observacion || '',
    enGarantia: enGarantiaCalculado,
    solicitudGarantiaActiva: item?.['Disponibilidad'] || item?.solicitudGarantiaActiva || '',
    valorGarantiaUSD,
    valorBienUSD,
  };
}

export function normalizarGarantia(item: any): Garantia {
  const fechaVencimiento =
    item?.['Fecha de Vencimiento'] ||
    item?.fechaVencimiento ||
    item?.['Fecha Vencimiento'] ||
    '';

  const diasRestantes =
    typeof item?.diasRestantes === 'number'
      ? item.diasRestantes
      : typeof item?.['Días Restantes'] === 'number'
      ? item['Días Restantes']
      : undefined;

  let estadoVencimiento = item?.['Estado Vencimiento'] || item?.estadoVencimiento || '';
  if (!estadoVencimiento && fechaVencimiento) {
    estadoVencimiento = calcularEstadoVencimiento(fechaVencimiento).estado;
  } else if (!estadoVencimiento) {
    estadoVencimiento = 'Sin vencimiento';
  }

  return {
    idGarantia: item?.['ID Garantía'] || item?.idGarantia || '',
    numeroSolicitud: item?.['N.º Solicitud'] !== undefined && item?.['N.º Solicitud'] !== null
      ? String(item['N.º Solicitud'])
      : item?.numeroSolicitud !== undefined && item?.numeroSolicitud !== null
      ? String(item.numeroSolicitud)
      : '',
    fecha: item?.['Fecha'] || item?.fecha || '',
    fechaVencimiento,
    estadoVencimiento,
    diasRestantes,
    cuentaPropietario: item?.['Cuenta Propietario'] ?? item?.cuentaPropietario ?? '',
    propietario: item?.['Propietario'] || item?.propietario || '',
    cuentaPrestatario: item?.['Cuenta Prestatario'] ?? item?.cuentaPrestatario ?? '',
    prestatario: item?.['Prestatario'] || item?.prestatario || '',
    garantiaConTipo: item?.['Garantía con Tipo'] || item?.garantiaConTipo || 'Cliente',
    garantiaConCuenta: item?.['Garantía con Cuenta'] ?? item?.garantiaConCuenta ?? '',
    garantiaConNombre: item?.['Garantía con Nombre'] || item?.garantiaConNombre || '',
    tipoGarantia: item?.['Tipo de Garantía'] || item?.tipoGarantia || '',
    modalidad: item?.['Modalidad'] || item?.modalidad || 'Simple',
    observacion: item?.['Observación'] || item?.observacion || '',
    lotes: [],
    bienes: [],
    lotesResumen: item?.['Lotes'] || '',
    polizasResumen: item?.['Pólizas'] || '',
    ubicacionesResumen: item?.['Ubicaciones'] || '',
    cantidadLotes: typeof item?.['Cantidad Lotes'] === 'number' ? item['Cantidad Lotes'] : 0,
    cantidadBienes: typeof item?.['Cantidad Bienes'] === 'number' ? item['Cantidad Bienes'] : 0,
  };
}

/**
 * SERVICIOS DE CLIENTES
 */
export async function listarClientes(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Cliente>> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Cliente>>('clientes', params);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('listarClientes', {
    page: params.page || 1,
    pageSize: params.pageSize || 200,
    search: params.search || '',
    filters: params.filters || {},
    sort: params.sortField ? { field: params.sortField, direction: params.sortDirection || 'asc' } : {},
  });

  const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  const items = rawItems.map(normalizarCliente);

  const paginatedResult: PaginatedResponse<Cliente> = {
    data: items,
    page: res?.page || params.page || 1,
    pageSize: res?.pageSize || params.pageSize || 200,
    total: typeof res?.total === 'number' ? res.total : items.length,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    from: typeof res?.from === 'number' ? res.from : (params.page - 1) * 200 + 1,
    to: typeof res?.to === 'number' ? res.to : Math.min(params.page * 200, items.length),
  };

  setToMemoryCache('clientes', paginatedResult, params);
  return paginatedResult;
}

export async function buscarClientes(texto: string, forceRefresh: boolean = false): Promise<Cliente[]> {
  const clean = texto ? texto.trim() : '';
  if (!clean) return [];

  const searchKey = `search:${clean.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Cliente[]>('clientes', searchKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('buscarClientes', { texto: clean });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map(normalizarCliente);
  setToMemoryCache('clientes', items, searchKey);
  return items;
}

export async function obtenerClientePorCuenta(cuenta: string | number): Promise<Cliente | null> {
  const clean = String(cuenta).trim();
  if (!clean) return null;
  const res = await callAppsScript<any>('obtenerClientePorCuenta', { cuenta: clean });
  if (!res) return null;
  return normalizarCliente(res);
}

export async function crearCliente(cliente: { cuenta: string | number; nombre: string; ci?: string }): Promise<any> {
  const result = await callAppsScript('crearCliente', {
    cuenta: cliente.cuenta,
    nombre: cliente.nombre ? cliente.nombre.trim() : '',
    ci: cliente.ci ? cliente.ci.trim() : '',
  });
  invalidateMemoryCache(['clientes', 'client-detail']);
  return result;
}

export async function editarCliente(cliente: { cuenta: string | number; nombre: string; ci?: string }): Promise<any> {
  const result = await callAppsScript('editarCliente', {
    cuenta: cliente.cuenta,
    nombre: cliente.nombre ? cliente.nombre.trim() : '',
    ci: cliente.ci ? cliente.ci.trim() : '',
  });
  invalidateMemoryCache(['clientes', 'client-detail']);
  return result;
}

export async function eliminarCliente(cuenta: string | number): Promise<any> {
  const result = await callAppsScript('eliminarCliente', { cuenta });
  invalidateMemoryCache(['clientes', 'client-detail']);
  return result;
}

/**
 * SERVICIO VISTA INTEGRAL DE CLIENTE
 * accion: obtenerDetalleCliente
 * datos: { cuenta: "NUMERO_CUENTA" }
 */
export async function obtenerDetalleCliente(
  cuenta: string | number,
  forceRefresh: boolean = false
): Promise<DetalleCliente | null> {
  const clean = String(cuenta).trim();
  if (!clean) return null;

  const cacheKey = `client:${clean}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<DetalleCliente>('client-detail', cacheKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('obtenerDetalleCliente', { cuenta: clean });
  if (!res) return null;

  const clienteData = res.cliente || res;
  const rawGarantias = Array.isArray(res.garantias) ? res.garantias : [];

  const garantiasNormalizadas: DetalleClienteGarantia[] = rawGarantias.map((g: any) => ({
    idGarantia: g['ID Garantía'] || g.idGarantia || '',
    numeroSolicitud:
      g['N.º Solicitud'] !== undefined
        ? String(g['N.º Solicitud'])
        : g.numeroSolicitud
        ? String(g.numeroSolicitud)
        : '',
    fecha: g['Fecha'] || g.fecha || '',
    fechaVencimiento:
      g['Fecha de Vencimiento'] || g.fechaVencimiento || g['Fecha Vencimiento'] || '',
    estadoVencimiento: g['Estado Vencimiento'] || g.estadoVencimiento || '',
    garantiaConTipo: g['Garantía con Tipo'] || g.garantiaConTipo || '',
    garantiaConNombre: g['Garantía con Nombre'] || g.garantiaConNombre || '',
    modalidad: g['Modalidad'] || g.modalidad || '',
    tipoGarantia: g['Tipo de Garantía'] || g.tipoGarantia || '',
    rol: g.rol || '',
    prestatario: g['Prestatario'] || g.prestatario || '',
    propietario: g['Propietario'] || g.propietario || '',
    lotesResumen: g['Lotes'] || g.lotesResumen || '',
    polizasResumen: g['Pólizas'] || g.polizasResumen || '',
  }));

  // Obtener todos los lotes y bienes globales de Google Sheets y garantías completas en paralelo
  const [todosLosLotes, todosLosBienes, garantiasCompletas] = await Promise.all([
    obtenerLotes(forceRefresh).catch(() => [] as Lote[]),
    obtenerBienes(forceRefresh).catch(() => [] as Bien[]),
    Promise.all(
      garantiasNormalizadas.map(async (g) => {
        if (!g.idGarantia) return null;
        try {
          return await obtenerGarantiaCompleta(g.idGarantia);
        } catch {
          return null;
        }
      })
    ),
  ]);

  const lotesMap = new Map<string, DetalleClienteLote>();
  const bienesMap = new Map<string, DetalleClienteBien>();

  // A. Filtrar lotes donde el cliente figura como propietario (por número de cuenta o nombre)
  for (const l of todosLosLotes) {
    const lCuenta = String(l.cuentaPropietario || '').trim();
    const lPropietario = String(l.propietario || '').toLowerCase().trim();
    const cNombre = String(clienteData.nombre || '').toLowerCase().trim();

    const matchesCuenta = lCuenta === clean;
    const matchesNombre = cNombre && lPropietario && lPropietario.includes(cNombre);

    if (matchesCuenta || matchesNombre) {
      lotesMap.set(l.idLote, {
        idLote: l.idLote,
        numeroLote: l.numeroLote,
        ubicacion: l.ubicacion,
        propietario: l.propietario,
        cuentaPropietario: l.cuentaPropietario,
        hectareas: l.hectareas,
        hectareasEnGarantia: l.hectareasEnGarantia || 0,
        hectareasDisponibles: l.hectareasDisponibles ?? Math.max(0, l.hectareas - (l.hectareasEnGarantia || 0)),
        estado: (l.estado || 'Disponible') as EstadoRegistro,
        enGarantia: l.enGarantia || (l.hectareasEnGarantia || 0) > 0,
        relaciones: [],
      });
    }
  }

  // B. Filtrar bienes donde el cliente figura como propietario (por número de cuenta o nombre)
  for (const b of todosLosBienes) {
    const bCuenta = String(b.cuentaPropietario || '').trim();
    const bPropietario = String(b.propietario || '').toLowerCase().trim();
    const cNombre = String(clienteData.nombre || '').toLowerCase().trim();

    const matchesCuenta = bCuenta === clean;
    const matchesNombre = cNombre && bPropietario && bPropietario.includes(cNombre);

    if (matchesCuenta || matchesNombre) {
      bienesMap.set(b.idBien, {
        idBien: b.idBien,
        numeroPoliza: b.numeroPoliza,
        tipoBien: b.tipoBien,
        descripcion: b.descripcion,
        marca: b.marca,
        modelo: b.modelo,
        placa: b.placa,
        ubicacion: b.ubicacion,
        propietario: b.propietario,
        cuentaPropietario: b.cuentaPropietario,
        estado: (b.estado || 'Disponible') as EstadoRegistro,
        enGarantia: b.enGarantia || false,
        valorGarantiaUSD: 0,
        valorBienUSD: b.valorBienUSD,
        numeroSolicitud: b.solicitudGarantiaActiva || '',
        garantiaConCuenta: b.cuentaPropietario,
        garantiaConNombre: b.propietario,
        relaciones: [],
      });
    }
  }

  for (const gc of garantiasCompletas) {
    if (!gc) continue;
    // Mapear lotes desde garantia_lotes
    if (Array.isArray(gc.lotes)) {
      for (const gl of gc.lotes) {
        const idLote = gl.idLote || '';
        if (!idLote) continue;

        const rel: RelacionLoteGarantia = {
          hectareas: gl.hectareas || 0,
          garantiaConTipo: gl.garantiaConTipo || gc.garantiaConTipo,
          garantiaConCuenta: gl.garantiaConCuenta || gc.garantiaConCuenta,
          garantiaConNombre: gl.garantiaConNombre || gc.garantiaConNombre,
          numeroSolicitud: gc.numeroSolicitud,
          idGarantia: gc.idGarantia,
        };

        if (lotesMap.has(idLote)) {
          const existing = lotesMap.get(idLote)!;
          existing.relaciones = existing.relaciones || [];
          existing.relaciones.push(rel);
          existing.hectareasEnGarantia += gl.hectareas || 0;
          existing.hectareasDisponibles = Math.max(0, existing.hectareas - existing.hectareasEnGarantia);
          existing.enGarantia = true;
        } else {
          lotesMap.set(idLote, {
            idLote,
            numeroLote: gl.numeroLote || '',
            ubicacion: gl.ubicacion || '',
            propietario: gl.propietario || clienteData.nombre,
            cuentaPropietario: gl.cuentaPropietario || clean,
            hectareas: gl.hectareasTotales || gl.hectareas || 0,
            hectareasEnGarantia: gl.hectareas || 0,
            hectareasDisponibles: Math.max(0, (gl.hectareasTotales || gl.hectareas || 0) - (gl.hectareas || 0)),
            estado: 'Disponible' as EstadoRegistro,
            enGarantia: true,
            relaciones: [rel],
          });
        }
      }
    }

    // Mapear bienes desde garantia_bienes (conservando todas las relaciones sin duplicar registros principales)
    if (Array.isArray(gc.bienes)) {
      for (const gb of gc.bienes) {
        const idBien = gb.idBien || '';
        if (!idBien) continue;

        const rel: RelacionBienGarantia = {
          idGarantia: gc.idGarantia,
          numeroSolicitud: gc.numeroSolicitud,
          garantiaConTipo: gc.garantiaConTipo,
          garantiaConCuenta: gc.garantiaConCuenta,
          garantiaConNombre: gc.garantiaConNombre,
          valorGarantiaUSD: Number(gb.valorGarantiaUSD) || 0,
        };

        if (bienesMap.has(idBien)) {
          const existing = bienesMap.get(idBien)!;
          existing.relaciones = existing.relaciones || [];
          existing.relaciones.push(rel);
          existing.enGarantia = true;
          existing.valorGarantiaUSD = (existing.valorGarantiaUSD || 0) + (Number(gb.valorGarantiaUSD) || 0);
          if (!existing.numeroSolicitud) {
            existing.numeroSolicitud = gc.numeroSolicitud;
          } else if (!existing.numeroSolicitud.includes(gc.numeroSolicitud)) {
            existing.numeroSolicitud += `, ${gc.numeroSolicitud}`;
          }
          if (!existing.garantiaConNombre) {
            existing.garantiaConNombre = gc.garantiaConNombre;
          }
        } else {
          bienesMap.set(idBien, {
            idBien,
            numeroPoliza: gb.numeroPoliza || '',
            tipoBien: gb.tipoBien || '',
            descripcion: gb.descripcion || '',
            marca: gb.marca || '',
            modelo: gb.modelo || '',
            placa: gb.placa || '',
            ubicacion: gb.ubicacion || '',
            propietario: gb.propietario || clienteData.nombre,
            cuentaPropietario: gb.cuentaPropietario || clean,
            estado: 'Disponible' as EstadoRegistro,
            enGarantia: true,
            garantiaConCuenta: gb.garantiaConCuenta || gc.garantiaConCuenta,
            garantiaConNombre: gb.garantiaConNombre || gc.garantiaConNombre,
            valorGarantiaUSD: Number(gb.valorGarantiaUSD) || 0,
            valorBienUSD:
              todosLosBienes.find((b) => b.idBien === gb.idBien)?.valorBienUSD ??
              (gb.valorBienUSD !== undefined ? Number(gb.valorBienUSD) : undefined),
            numeroSolicitud: gc.numeroSolicitud,
            relaciones: [rel],
          });
        }
      }
    }
  }

  const detalle: DetalleCliente = {
    cuenta: clienteData.cuenta ?? clean,
    nombre: clienteData.nombre || '',
    ci: clienteData.ci || '',
    garantias: garantiasNormalizadas,
    lotes: Array.from(lotesMap.values()),
    bienes: Array.from(bienesMap.values()),
  };

  setToMemoryCache('client-detail', detalle, cacheKey);
  return detalle;
}

// Aliases para retrocompatibilidad
export const getClientes = listarClientes;
export const searchClientes = buscarClientes;
export const saveCliente = async (cliente: Cliente, isEdit: boolean) =>
  isEdit ? editarCliente(cliente) : crearCliente(cliente);
export const deleteCliente = eliminarCliente;

/**
 * SERVICIOS DE LOTES
 */
export async function listarLotes(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Lote>> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Lote>>('lotes', params);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('listarLotes', {
    page: params.page || 1,
    pageSize: params.pageSize || 200,
    search: params.search || '',
    filters: params.filters || {},
    sort: params.sortField ? { field: params.sortField, direction: params.sortDirection || 'asc' } : {},
  });

  const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  const items = rawItems.map(normalizarLote);

  const paginatedResult: PaginatedResponse<Lote> = {
    data: items,
    page: res?.page || params.page || 1,
    pageSize: res?.pageSize || params.pageSize || 200,
    total: typeof res?.total === 'number' ? res.total : items.length,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    from: typeof res?.from === 'number' ? res.from : (params.page - 1) * 200 + 1,
    to: typeof res?.to === 'number' ? res.to : Math.min(params.page * 200, items.length),
  };

  setToMemoryCache('lotes', paginatedResult, params);
  return paginatedResult;
}

export async function obtenerLotes(forceRefresh: boolean = false): Promise<Lote[]> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Lote[]>('lotes', 'all');
    if (cached) return cached;
    const anyCached = findAnyCachedData<Lote>('lotes');
    if (anyCached && anyCached.length > 0) return anyCached;
  }
  const paginated = await listarLotes({ page: 1, pageSize: 1000 }, forceRefresh);
  setToMemoryCache('lotes', paginated.data, 'all');
  return paginated.data;
}

export async function buscarLotes(texto: string, forceRefresh: boolean = false): Promise<Lote[]> {
  const clean = texto ? texto.trim() : '';
  if (!clean) return [];

  const searchKey = `search:${clean.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Lote[]>('lotes', searchKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('buscarLotes', { texto: clean });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map(normalizarLote);
  setToMemoryCache('lotes', items, searchKey);
  return items;
}

export async function obtenerLotePorId(idLote: string): Promise<Lote | null> {
  if (!idLote) return null;
  const res = await callAppsScript<any>('obtenerLotePorId', { idLote });
  if (!res) return null;
  return normalizarLote(res);
}

export async function crearLote(lote: Partial<Lote>): Promise<any> {
  const result = await callAppsScript('crearLote', {
    numeroLote: lote.numeroLote ? lote.numeroLote.trim() : '',
    cuentaPropietario: lote.cuentaPropietario,
    propietario: lote.propietario ? lote.propietario.trim() : '',
    cuentaEncargado: lote.cuentaEncargado || '',
    encargado: lote.encargado ? lote.encargado.trim() : '',
    hectareas: Number(lote.hectareas) || 0,
    ubicacion: lote.ubicacion ? lote.ubicacion.trim() : '',
    estado: lote.estado || 'Disponible',
    motivoBloqueo: lote.motivoBloqueo ? lote.motivoBloqueo.trim() : '',
    fechaBloqueo: lote.fechaBloqueo || '',
    observacion: lote.observacion ? lote.observacion.trim() : '',
  });
  invalidateMemoryCache(['lotes', 'dashboard', 'client-detail']);
  return result;
}

export async function editarLote(lote: Partial<Lote>): Promise<any> {
  const result = await callAppsScript('editarLote', {
    idLote: lote.idLote,
    numeroLote: lote.numeroLote ? lote.numeroLote.trim() : '',
    cuentaPropietario: lote.cuentaPropietario,
    propietario: lote.propietario ? lote.propietario.trim() : '',
    cuentaEncargado: lote.cuentaEncargado || '',
    encargado: lote.encargado ? lote.encargado.trim() : '',
    hectareas: Number(lote.hectareas) || 0,
    ubicacion: lote.ubicacion ? lote.ubicacion.trim() : '',
    estado: lote.estado || 'Disponible',
    motivoBloqueo: lote.motivoBloqueo ? lote.motivoBloqueo.trim() : '',
    fechaBloqueo: lote.fechaBloqueo || '',
    observacion: lote.observacion ? lote.observacion.trim() : '',
  });
  invalidateMemoryCache(['lotes', 'dashboard', 'client-detail']);
  return result;
}

export async function eliminarLote(idLote: string): Promise<any> {
  const result = await callAppsScript('eliminarLote', { idLote });
  invalidateMemoryCache(['lotes', 'dashboard', 'client-detail']);
  return result;
}

// Aliases para retrocompatibilidad
export const getLotes = listarLotes;
export const saveLote = async (lote: Partial<Lote>, isEdit: boolean) =>
  isEdit ? editarLote(lote) : crearLote(lote);
export const deleteLote = eliminarLote;
export const setLoteBloqueo = async (
  idLote: string,
  bloqueado: boolean,
  motivo?: string,
  fecha?: string
) => {
  const existing = await obtenerLotePorId(idLote);
  if (!existing) throw new Error('Lote no encontrado.');
  return await editarLote({
    ...existing,
    idLote,
    estado: bloqueado ? 'Bloqueado' : 'Disponible',
    motivoBloqueo: bloqueado ? motivo || '' : '',
    fechaBloqueo: bloqueado ? fecha || '' : '',
  });
};

/**
 * SERVICIOS DE BIENES
 */
export async function listarBienes(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Bien>> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Bien>>('bienes', params);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('listarBienes', {
    page: params.page || 1,
    pageSize: params.pageSize || 200,
    search: params.search || '',
    filters: params.filters || {},
    sort: params.sortField ? { field: params.sortField, direction: params.sortDirection || 'asc' } : {},
  });

  const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  const items = rawItems.map(normalizarBien);

  const paginatedResult: PaginatedResponse<Bien> = {
    data: items,
    page: res?.page || params.page || 1,
    pageSize: res?.pageSize || params.pageSize || 200,
    total: typeof res?.total === 'number' ? res.total : items.length,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    from: typeof res?.from === 'number' ? res.from : (params.page - 1) * 200 + 1,
    to: typeof res?.to === 'number' ? res.to : Math.min(params.page * 200, items.length),
  };

  setToMemoryCache('bienes', paginatedResult, params);
  return paginatedResult;
}

export async function obtenerBienes(forceRefresh: boolean = false): Promise<Bien[]> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Bien[]>('bienes', 'all');
    if (cached) return cached;
    const anyCached = findAnyCachedData<Bien>('bienes');
    if (anyCached && anyCached.length > 0) return anyCached;
  }
  const paginated = await listarBienes({ page: 1, pageSize: 1000 }, forceRefresh);
  setToMemoryCache('bienes', paginated.data, 'all');
  return paginated.data;
}

export async function buscarBienes(texto: string, forceRefresh: boolean = false): Promise<Bien[]> {
  const clean = texto ? texto.trim() : '';
  if (!clean) return [];

  const searchKey = `search:${clean.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Bien[]>('bienes', searchKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('buscarBienes', { texto: clean });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map(normalizarBien);
  setToMemoryCache('bienes', items, searchKey);
  return items;
}

export async function obtenerBienPorId(idBien: string): Promise<Bien | null> {
  if (!idBien) return null;
  const res = await callAppsScript<any>('obtenerBienPorId', { idBien });
  if (!res) return null;
  return normalizarBien(res);
}

export async function crearBien(bien: Partial<Bien>): Promise<any> {
  const result = await callAppsScript('crearBien', {
    numeroPoliza: bien.numeroPoliza ? bien.numeroPoliza.trim() : '',
    cuentaPropietario: bien.cuentaPropietario,
    propietario: bien.propietario ? bien.propietario.trim() : '',
    cuentaEncargado: bien.cuentaEncargado || '',
    encargado: bien.encargado ? bien.encargado.trim() : '',
    tipoBien: bien.tipoBien || 'Otro bien',
    descripcion: bien.descripcion ? bien.descripcion.trim() : '',
    marca: bien.marca ? bien.marca.trim() : '',
    modelo: bien.modelo ? bien.modelo.trim() : '',
    placa: bien.placa ? bien.placa.trim() : '',
    ubicacion: bien.ubicacion ? bien.ubicacion.trim() : '',
    estado: bien.estado || 'Disponible',
    motivoBloqueo: bien.motivoBloqueo ? bien.motivoBloqueo.trim() : '',
    fechaBloqueo: bien.fechaBloqueo || '',
    observacion: bien.observacion ? bien.observacion.trim() : '',
    valorBienUSD: Number(bien.valorBienUSD) || 0,
  });
  invalidateMemoryCache(['bienes', 'dashboard', 'client-detail']);
  return result;
}

export async function editarBien(bien: Partial<Bien>): Promise<any> {
  const result = await callAppsScript('editarBien', {
    idBien: bien.idBien,
    numeroPoliza: bien.numeroPoliza ? bien.numeroPoliza.trim() : '',
    cuentaPropietario: bien.cuentaPropietario,
    propietario: bien.propietario ? bien.propietario.trim() : '',
    cuentaEncargado: bien.cuentaEncargado || '',
    encargado: bien.encargado ? bien.encargado.trim() : '',
    tipoBien: bien.tipoBien || 'Otro bien',
    descripcion: bien.descripcion ? bien.descripcion.trim() : '',
    marca: bien.marca ? bien.marca.trim() : '',
    modelo: bien.modelo ? bien.modelo.trim() : '',
    placa: bien.placa ? bien.placa.trim() : '',
    ubicacion: bien.ubicacion ? bien.ubicacion.trim() : '',
    estado: bien.estado || 'Disponible',
    motivoBloqueo: bien.motivoBloqueo ? bien.motivoBloqueo.trim() : '',
    fechaBloqueo: bien.fechaBloqueo || '',
    observacion: bien.observacion ? bien.observacion.trim() : '',
    valorBienUSD: Number(bien.valorBienUSD) || 0,
  });
  invalidateMemoryCache(['bienes', 'dashboard', 'client-detail']);
  return result;
}

export async function eliminarBien(idBien: string): Promise<any> {
  const result = await callAppsScript('eliminarBien', { idBien });
  invalidateMemoryCache(['bienes', 'dashboard', 'client-detail']);
  return result;
}

// Aliases para retrocompatibilidad
export const getBienes = listarBienes;
export const saveBien = async (bien: Partial<Bien>, isEdit: boolean) =>
  isEdit ? editarBien(bien) : crearBien(bien);
export const deleteBien = eliminarBien;
export const setBienBloqueo = async (
  idBien: string,
  bloqueado: boolean,
  motivo?: string,
  fecha?: string
) => {
  const existing = await obtenerBienPorId(idBien);
  if (!existing) throw new Error('Bien no encontrado.');
  return await editarBien({
    ...existing,
    idBien,
    estado: bloqueado ? 'Bloqueado' : 'Disponible',
    motivoBloqueo: bloqueado ? motivo || '' : '',
    fechaBloqueo: bloqueado ? fecha || '' : '',
  });
};

/**
 * SERVICIOS DE GARANTÍAS
 */
export async function listarGarantias(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Garantia>> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Garantia>>('garantias', params);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('listarGarantias', {
    page: params.page || 1,
    pageSize: params.pageSize || 200,
    search: params.search || '',
    filters: params.filters || {},
    sort: params.sortField ? { field: params.sortField, direction: params.sortDirection || 'asc' } : {},
  });

  const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  const items = rawItems.map(normalizarGarantia);

  const paginatedResult: PaginatedResponse<Garantia> = {
    data: items,
    page: res?.page || params.page || 1,
    pageSize: res?.pageSize || params.pageSize || 200,
    total: typeof res?.total === 'number' ? res.total : items.length,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    from: typeof res?.from === 'number' ? res.from : (params.page - 1) * 200 + 1,
    to: typeof res?.to === 'number' ? res.to : Math.min(params.page * 200, items.length),
  };

  setToMemoryCache('garantias', paginatedResult, params);
  return paginatedResult;
}

export async function obtenerGarantias(forceRefresh: boolean = false): Promise<Garantia[]> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Garantia[]>('garantias', 'all');
    if (cached) return cached;
  }
  const paginated = await listarGarantias({ page: 1, pageSize: 1000 }, forceRefresh);
  setToMemoryCache('garantias', paginated.data, 'all');
  return paginated.data;
}

export async function obtenerGarantiaCompleta(idGarantia: string): Promise<Garantia | null> {
  if (!idGarantia) return null;
  const res = await callAppsScript<any>('obtenerGarantiaCompleta', { idGarantia });
  if (!res || !res.garantia) return null;

  const base = normalizarGarantia(res.garantia);
  base.modalidad = res.garantia?.['Modalidad'] || res.garantia?.modalidad || 'Simple';

  // Mapear lotes relacionados
  const lotesRelacionados: GarantiaLoteRelacion[] = [];
  if (Array.isArray(res.lotes)) {
    for (const item of res.lotes) {
      if (item && item.lote) {
        lotesRelacionados.push({
          idGarantia: item.relacion?.['ID Garantía'] || item.relacion?.idGarantia || base.idGarantia,
          idLote: item.lote?.['ID Lote'] || item.lote?.idLote || item.relacion?.['ID Lote'] || '',
          numeroLote: item.lote?.['N.º de Lote'] || item.lote?.numeroLote || '',
          hectareas:
            typeof item.relacion?.['Hectáreas'] === 'number'
              ? item.relacion['Hectáreas']
              : typeof item.lote?.['Hectáreas'] === 'number'
              ? item.lote['Hectáreas']
              : Number(item.relacion?.hectareas || item.lote?.hectareas) || 0,
          hectareasTotales: typeof item.lote?.['Hectáreas'] === 'number' ? item.lote['Hectáreas'] : undefined,
          propietario: item.lote?.['Propietario'] || item.lote?.propietario || '',
          cuentaPropietario: item.lote?.['Cuenta Propietario'] ?? item.lote?.cuentaPropietario ?? '',
          ubicacion: item.lote?.['Ubicación'] || item.lote?.ubicacion || '',
          encargado: item.lote?.['Encargado'] || item.lote?.encargado || '',
          garantiaConTipo: item.relacion?.['Garantía con Tipo'] || item.relacion?.garantiaConTipo || base.garantiaConTipo,
          garantiaConCuenta: item.relacion?.['Garantía con Cuenta'] ?? item.relacion?.garantiaConCuenta ?? base.garantiaConCuenta,
          garantiaConNombre: item.relacion?.['Garantía con Nombre'] || item.relacion?.garantiaConNombre || base.garantiaConNombre,
        });
      }
    }
  }

  // Mapear bienes relacionados
  const bienesRelacionados: GarantiaBienRelacion[] = [];
  if (Array.isArray(res.bienes)) {
    for (const item of res.bienes) {
      if (item && item.bien) {
        const valUSD =
          typeof item.relacion?.['Valor en Garantía ($us.)'] === 'number'
            ? item.relacion['Valor en Garantía ($us.)']
            : typeof item.relacion?.valorGarantiaUSD === 'number'
            ? item.relacion.valorGarantiaUSD
            : Number(item.relacion?.['Valor en Garantía ($us.)']) || 0;

        bienesRelacionados.push({
          idGarantia: item.relacion?.['ID Garantía'] || item.relacion?.idGarantia || base.idGarantia,
          idBien: item.bien?.['ID Bien'] || item.bien?.idBien || item.relacion?.['ID Bien'] || '',
          numeroPoliza: item.bien?.['N.º Póliza'] || item.bien?.numeroPoliza || '',
          tipoBien: item.bien?.['Tipo de Bien'] || item.bien?.tipoBien || '',
          descripcion: item.bien?.['Descripción'] || item.bien?.descripcion || '',
          marca: item.bien?.['Marca'] || item.bien?.marca || '',
          modelo: item.bien?.['Modelo'] || item.bien?.modelo || '',
          placa: item.bien?.['Placa'] || item.bien?.placa || '',
          propietario: item.bien?.['Propietario'] || item.bien?.propietario || '',
          cuentaPropietario: item.bien?.['Cuenta Propietario'] ?? item.bien?.cuentaPropietario ?? '',
          ubicacion: item.bien?.['Ubicación'] || item.bien?.ubicacion || '',
          valorGarantiaUSD: valUSD,
          garantiaConTipo: item.relacion?.['Garantía con Tipo'] || item.relacion?.garantiaConTipo || base.garantiaConTipo,
          garantiaConCuenta: item.relacion?.['Garantía con Cuenta'] ?? item.relacion?.garantiaConCuenta ?? base.garantiaConCuenta,
          garantiaConNombre: item.relacion?.['Garantía con Nombre'] || item.relacion?.garantiaConNombre || base.garantiaConNombre,
        });
      }
    }
  }

  base.lotes = lotesRelacionados;
  base.bienes = bienesRelacionados;
  base.cantidadLotes = lotesRelacionados.length;
  base.cantidadBienes = bienesRelacionados.length;

  return base;
}

export async function crearGarantia(garantia: Partial<Garantia>): Promise<any> {
  // Verificar disponibilidad actual en el servidor antes de enviar
  try {
    const lotesActuales = await listarLotes({ page: 1, pageSize: 1000 }, true);
    if (Array.isArray(garantia.lotes)) {
      for (const reqLote of garantia.lotes) {
        const serverLote = lotesActuales.data.find((l) => String(l.idLote) === String(reqLote.idLote));
        if (!serverLote) {
          throw new Error(`El lote ${reqLote.numeroLote} ya no existe en el sistema.`);
        }
        if (serverLote.estado === 'Bloqueado' || serverLote.estado === 'Inactivo') {
          throw new Error(`El lote ${serverLote.numeroLote} se encuentra ${serverLote.estado.toLowerCase()} y no puede ser dado en garantía.`);
        }
        const disp = serverLote.hectareasDisponibles !== undefined ? serverLote.hectareasDisponibles : serverLote.hectareas;
        if (Number(reqLote.hectareas) > Number(disp)) {
          throw new Error(`El lote ${serverLote.numeroLote} solo tiene ${disp} hectáreas disponibles en el servidor.`);
        }
      }
    }
  } catch (err: any) {
    if (err && err.message && !err.message.includes('BackendConnectionError')) {
      throw err;
    }
  }

  const result = await callAppsScript('crearGarantia', {
    numeroSolicitud: garantia.numeroSolicitud || '',
    fecha: garantia.fecha,
    fechaVencimiento: garantia.fechaVencimiento || '',
    cuentaPropietario: garantia.cuentaPropietario,
    propietario: garantia.propietario,
    cuentaPrestatario: garantia.cuentaPrestatario,
    prestatario: garantia.prestatario,
    garantiaConTipo: garantia.garantiaConTipo,
    garantiaConCuenta: garantia.garantiaConCuenta || '',
    garantiaConNombre: garantia.garantiaConNombre,
    tipoGarantia: garantia.tipoGarantia,
    modalidad: garantia.modalidad || 'Simple',
    observacion: garantia.observacion || '',
    lotes: Array.isArray(garantia.lotes)
      ? garantia.lotes.map((l) => ({
          idLote: l.idLote,
          numeroLote: l.numeroLote,
          hectareas: typeof l.hectareas === 'number' ? l.hectareas : Number(l.hectareas) || 0,
          garantiaConTipo: l.garantiaConTipo || garantia.garantiaConTipo || '',
          garantiaConCuenta: l.garantiaConCuenta || garantia.garantiaConCuenta || '',
          garantiaConNombre: l.garantiaConNombre || garantia.garantiaConNombre || '',
        }))
      : [],
    bienes: Array.isArray(garantia.bienes)
      ? garantia.bienes.map((b) => ({
          idBien: b.idBien,
          numeroPoliza: b.numeroPoliza,
          tipoBien: b.tipoBien,
          valorGarantiaUSD: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
          valorEnGarantia: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
          garantiaConTipo: b.garantiaConTipo || garantia.garantiaConTipo || '',
          garantiaConCuenta: b.garantiaConCuenta || garantia.garantiaConCuenta || '',
          garantiaConNombre: b.garantiaConNombre || garantia.garantiaConNombre || '',
        }))
      : [],
  });
  invalidateMemoryCache(['garantias', 'lotes', 'bienes', 'dashboard', 'reportes']);
  return result;
}

export async function editarGarantia(garantia: Partial<Garantia>): Promise<any> {
  const result = await callAppsScript('editarGarantia', {
    idGarantia: garantia.idGarantia,
    numeroSolicitud: garantia.numeroSolicitud || '',
    fecha: garantia.fecha,
    fechaVencimiento: garantia.fechaVencimiento || '',
    cuentaPropietario: garantia.cuentaPropietario,
    propietario: garantia.propietario,
    cuentaPrestatario: garantia.cuentaPrestatario,
    prestatario: garantia.prestatario,
    garantiaConTipo: garantia.garantiaConTipo,
    garantiaConCuenta: garantia.garantiaConCuenta || '',
    garantiaConNombre: garantia.garantiaConNombre,
    tipoGarantia: garantia.tipoGarantia,
    modalidad: garantia.modalidad || 'Simple',
    observacion: garantia.observacion || '',
    lotes: Array.isArray(garantia.lotes)
      ? garantia.lotes.map((l) => ({
          idLote: l.idLote,
          numeroLote: l.numeroLote,
          hectareas: typeof l.hectareas === 'number' ? l.hectareas : Number(l.hectareas) || 0,
          garantiaConTipo: l.garantiaConTipo || garantia.garantiaConTipo || '',
          garantiaConCuenta: l.garantiaConCuenta || garantia.garantiaConCuenta || '',
          garantiaConNombre: l.garantiaConNombre || garantia.garantiaConNombre || '',
        }))
      : [],
    bienes: Array.isArray(garantia.bienes)
      ? garantia.bienes.map((b) => ({
          idBien: b.idBien,
          numeroPoliza: b.numeroPoliza,
          tipoBien: b.tipoBien,
          valorGarantiaUSD: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
          valorEnGarantia: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
          garantiaConTipo: b.garantiaConTipo || garantia.garantiaConTipo || '',
          garantiaConCuenta: b.garantiaConCuenta || garantia.garantiaConCuenta || '',
          garantiaConNombre: b.garantiaConNombre || garantia.garantiaConNombre || '',
        }))
      : [],
  });
  invalidateMemoryCache(['garantias', 'lotes', 'bienes', 'dashboard', 'reportes']);
  return result;
}

export async function liberarGarantia(idGarantia: string): Promise<any> {
  const result = await callAppsScript('liberarGarantia', { idGarantia });
  invalidateMemoryCache(['garantias', 'lotes', 'bienes', 'dashboard', 'reportes']);
  return result;
}

// Aliases para retrocompatibilidad
export const getGarantias = listarGarantias;
export const getGarantiaById = obtenerGarantiaCompleta;
export const saveGarantia = async (garantia: Partial<Garantia>, isEdit: boolean) =>
  isEdit ? editarGarantia(garantia) : crearGarantia(garantia);

export async function getNextSolicitudNumber(): Promise<string> {
  try {
    const data = await obtenerDatosIniciales();
    if (data && data.siguienteSolicitud !== undefined && data.siguienteSolicitud !== null) {
      return String(data.siguienteSolicitud);
    }
    return '—';
  } catch {
    return '—';
  }
}

/**
 * SERVICIOS DE REPORTES
 * accion: obtenerReporte
 * Tipos soportados: general, farmer, campoGrande, clientes, propietario, prestatario
 */
export async function getReporte(
  tipo: string,
  search?: string,
  cuenta?: string,
  forceRefresh: boolean = false
): Promise<{
  tipo: string;
  generado: string;
  totalGarantias: number;
  hectareasEnGarantia: number;
  registros: any[];
  columnas?: string[];
  filas?: (string | number)[][];
}> {
  const cacheParams = { tipo, search: search || '', cuenta: cuenta || '' };
  if (!forceRefresh) {
    const cached = getFromMemoryCache<any>('reportes', cacheParams);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('obtenerReporte', {
    tipo,
    search: search || '',
    cuenta: cuenta || '',
  });

  const registros = Array.isArray(res?.registros) ? res.registros : [];

  // Mapear columnas dinámicamente según los registros reales
  let columnas: string[] = [];
  if (registros.length > 0 && typeof registros[0] === 'object' && registros[0] !== null) {
    columnas = Object.keys(registros[0]);
  } else {
    columnas = ['N.º Solicitud', 'Fecha', 'Propietario', 'Prestatario', 'Garantía con', 'Tipo'];
  }

  const filas: (string | number)[][] = registros.map((r: any) =>
    columnas.map((c) => (r[c] !== undefined && r[c] !== null ? r[c] : '—'))
  );

  const reportResult = {
    tipo: res?.tipo || tipo,
    generado: res?.generado || new Date().toISOString(),
    totalGarantias: typeof res?.totalGarantias === 'number' ? res.totalGarantias : registros.length,
    hectareasEnGarantia: typeof res?.hectareasEnGarantia === 'number' ? res.hectareasEnGarantia : 0,
    registros,
    columnas,
    filas,
  };

  setToMemoryCache('reportes', reportResult, cacheParams);
  return reportResult;
}

/**
 * SERVICIO REPORTE DE VENCIMIENTOS
 * accion: obtenerReporteVencimientos
 * Filtros soportados: TODAS, VENCIDAS, VIGENTES, PRÓXIMAS A VENCER, SIN VENCIMIENTO
 */
export async function obtenerReporteVencimientos(
  filtro: 'TODAS' | 'VENCIDAS' | 'VIGENTES' | 'PRÓXIMAS A VENCER' | 'SIN VENCIMIENTO' | string = 'TODAS',
  forceRefresh: boolean = false
): Promise<{
  filtro: string;
  generado: string;
  totalGarantias: number;
  registros: any[];
  columnas: string[];
  filas: (string | number)[][];
}> {
  const filtroUpper = (filtro || 'TODAS').toUpperCase();
  const cacheKey = `vencimientos:${filtroUpper}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<any>('reportes', cacheKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('obtenerReporteVencimientos', {
    filtro: filtroUpper,
    estado: filtroUpper,
  });

  const rawRegistros = Array.isArray(res?.registros)
    ? res.registros
    : Array.isArray(res?.items)
    ? res.items
    : Array.isArray(res?.data)
    ? res.data
    : Array.isArray(res)
    ? res
    : [];

  const registros = rawRegistros.map((item: any) => {
    const norm = normalizarGarantia(item);
    return {
      'N.º Solicitud': norm.numeroSolicitud || '—',
      'Fecha': norm.fecha || '—',
      'Fecha de Vencimiento': norm.fechaVencimiento || '—',
      'Estado Vencimiento': norm.estadoVencimiento || (norm.fechaVencimiento ? 'Vigente' : 'Sin vencimiento'),
      'Propietario': norm.propietario || '—',
      'Prestatario': norm.prestatario || '—',
      'Garantía con': norm.garantiaConNombre || norm.garantiaConTipo || '—',
      'Lotes/Bienes': norm.lotesResumen || norm.polizasResumen || (norm.tipoGarantia || '—'),
      ...item,
    };
  });

  const columnas = Array.isArray(res?.columnas) && res.columnas.length > 0
    ? res.columnas
    : [
        'N.º Solicitud',
        'Fecha',
        'Fecha de Vencimiento',
        'Estado Vencimiento',
        'Propietario',
        'Prestatario',
        'Garantía con',
        'Lotes/Bienes',
      ];

  const filas: (string | number)[][] = Array.isArray(res?.filas) && res.filas.length > 0
    ? res.filas
    : registros.map((r: any) =>
        columnas.map((c: string) => (r[c] !== undefined && r[c] !== null ? r[c] : '—'))
      );

  const reportResult = {
    filtro: res?.filtro || filtroUpper,
    generado: res?.generado || new Date().toISOString(),
    totalGarantias:
      typeof res?.total === 'number'
        ? res.total
        : typeof res?.totalGarantias === 'number'
        ? res.totalGarantias
        : registros.length,
    registros,
    columnas,
    filas,
  };

  setToMemoryCache('reportes', reportResult, cacheKey);
  return reportResult;
}

/**
 * SERVICIOS DE CONFIGURACIÓN
 * acciones: obtenerConfiguracionPublica, guardarConfiguracion
 */
export async function getConfiguracion(forceRefresh: boolean = false): Promise<ConfiguracionSistema> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<ConfiguracionSistema>('configuracion');
    if (cached) return cached;
  }

  try {
    const res = await callAppsScript<{ institucion: string }>('obtenerConfiguracionPublica', {});
    if (res && res.institucion) {
      inMemorySession.institucion = res.institucion;
      const cfg = {
        nombreInstitucion: res.institucion,
      };
      setToMemoryCache('configuracion', cfg);
      return cfg;
    }
    const cfg = {
      nombreInstitucion: inMemorySession.institucion,
    };
    setToMemoryCache('configuracion', cfg);
    return cfg;
  } catch {
    return {
      nombreInstitucion: inMemorySession.institucion,
    };
  }
}

export async function updateConfiguracion(params: {
  contrasenaActual?: string;
  nuevaContrasena?: string;
  nombreInstitucion?: string;
}): Promise<void> {
  const datos: Record<string, any> = {};
  if (params.nombreInstitucion) {
    datos.institucion = params.nombreInstitucion.trim();
  }
  if (params.nuevaContrasena) {
    datos.password = params.nuevaContrasena.trim();
  }

  await callAppsScript('guardarConfiguracion', datos);
  if (params.nombreInstitucion) {
    inMemorySession.institucion = params.nombreInstitucion.trim();
  }
  invalidateMemoryCache('configuracion');
}
