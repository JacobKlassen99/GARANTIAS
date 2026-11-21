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
  GarantiaLiberada,
  DashboardStats,
  UbicacionEstadistica,
  GarantiaProximaVencer,
  ClienteEstadistica,
  EstadisticasPanel,
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
  TipoGarantiaCon,
} from '../types';
import {
  calcularEstadoVencimiento,
  calcularDiasPendientes,
  parseDecimal,
  formatHectareas,
  matchesAnyField,
} from '../utils/textSearch';
import {
  DEFAULT_GARANTIA_SORT,
  GarantiaSortConfig,
  isGarantiaSortField,
  mapGarantiaSortFieldToBackendHeader,
  sortGarantias,
} from '../utils/garantiaSort';

import {
  getFromMemoryCache,
  setToMemoryCache,
  invalidateMemoryCache,
  clearAllMemoryCache,
  hasInMemoryCache,
  fetchWithDeduplication,
  findAnyCachedData,
  deleteFromMemoryCache,
} from './dataCache';

export {
  getFromMemoryCache,
  setToMemoryCache,
  invalidateMemoryCache,
  clearAllMemoryCache,
  hasInMemoryCache,
  fetchWithDeduplication,
  findAnyCachedData,
  deleteFromMemoryCache,
};

// URL del Web App de Google Apps Script configurada para el proyecto
export const GOOGLE_APPS_SCRIPT_URL: string =
  'https://script.google.com/macros/s/AKfycbzyX9dvWYVONQfd0EO9RpWCHtoi8_1Bk_EjNW5eVySyMv5AEBrXCEGE2YdH59V-ea2hbQ/exec';

const SESSION_STORAGE_KEY = 'colonia_chihuahua_auth_session';

interface SessionData {
  token: string;
  timestamp: number;
  institucion: string;
}

function getStoredSession(): SessionData | null {
  try {
    let raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(SESSION_STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && typeof parsed.timestamp === 'number') {
      // Expiración por inactividad prolongada (24 horas)
      const maxAgeMs = 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > maxAgeMs) {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredSession(institucion: string): string {
  const token = 'tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const data: SessionData = {
    token,
    timestamp: Date.now(),
    institucion: institucion || 'ASOC. CIVIL "COLONIA CHIHUAHUA"',
  };
  try {
    const serialized = JSON.stringify(data);
    sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    localStorage.setItem(SESSION_STORAGE_KEY, serialized);
  } catch {}
  return token;
}

function clearStoredSession(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

const initialStoredSession = getStoredSession();

// Sesión protegida: no guarda contraseñas, solo token de sesión temporal en sessionStorage
let inMemorySession: {
  isAuthenticated: boolean;
  institucion: string;
} = {
  isAuthenticated: Boolean(initialStoredSession),
  institucion: initialStoredSession?.institucion || 'ASOC. CIVIL "COLONIA CHIHUAHUA"',
};

/**
 * Comprueba si la sesión del usuario está activa y es válida.
 * Permite mantener la sesión entre pestañas y al recargar la página
 * sin almacenar nunca contraseñas en el navegador.
 */
export function isSessionActive(): boolean {
  if (inMemorySession.isAuthenticated) return true;
  const stored = getStoredSession();
  if (stored) {
    inMemorySession.isAuthenticated = true;
    if (stored.institucion) inMemorySession.institucion = stored.institucion;
    return true;
  }
  return false;
}

let lastSyncTimestamp: string | null = null;
let isPreloading = false;

export function getLastSyncTime(): string | null {
  return lastSyncTimestamp;
}

export function isPreloadRunning(): boolean {
  return isPreloading;
}

/**
 * PRECARGA AUTOMÁTICA EN SEGUNDO PLANO (RAM ÚNICAMENTE)
 * 1. Google Sheets es la única base de datos y fuente real de verdad.
 * 2. Se ejecuta en segundo plano SIN bloquear la interfaz de Inicio ni al usuario.
 * 3. Concurrencia limitada y orden estricto de prioridades:
 *    - Prioridad 1: Dashboard y Estadísticas + Garantías Activas (lista principal)
 *    - Prioridad 2: Clientes (para vista y modales de selección)
 *    - Prioridad 3: Lotes (para vista y asignación en garantías)
 *    - Prioridad 4: Vehículos y demás Bienes
 *    - Prioridad 5: Garantías Liberadas (historial)
 *    - Prioridad 6: Precarga gradual y limitada de detalles completos de garantías activas
 * 4. Reutiliza peticiones en curso (deduplicación in-flight) si el usuario cambia de sección.
 */
export async function preloadDataInBackground(forceRefresh: boolean = false): Promise<void> {
  if (isPreloading && !forceRefresh) return;
  isPreloading = true;

  try {
    if (forceRefresh) {
      invalidateMemoryCache([
        'garantias',
        'garantias-pendientes',
        'clientes',
        'lotes',
        'bienes',
        'garantias-liberadas',
        'dashboard',
        'estadisticas_panel',
        'reportes',
        'configuracion',
      ]);
    }

    // Prioridad 1: Métricas de Dashboard (pantalla de inicio del usuario)
    try {
      await Promise.all([
        getDashboardStats(forceRefresh).catch(() => null),
        obtenerEstadisticasPanel(forceRefresh).catch(() => null),
      ]);
    } catch {
      // Continuar con siguientes prioridades
    }

    // Prioridad 1.1: Garantías Activas (página 1 estándar usada en GarantiasList)
    try {
      const resG = await listarGarantias({ page: 1, pageSize: 200 }, forceRefresh).catch(() => null);
      if (resG?.data && Array.isArray(resG.data) && (!resG.totalPages || resG.totalPages <= 1)) {
        setToMemoryCache('garantias', resG.data, 'all');
      }
    } catch {
      // Continuar
    }

    // Prioridad 2: Clientes (página 1 y conjunto en memoria para modales)
    try {
      const resC = await listarClientes(
        { page: 1, pageSize: 200, sortField: 'cuenta', sortDirection: 'asc' },
        forceRefresh
      ).catch(() => null);
      if (resC?.data && Array.isArray(resC.data) && (!resC.totalPages || resC.totalPages <= 1)) {
        setToMemoryCache('clientes', resC.data, 'all');
      }
    } catch {
      // Continuar
    }

    // Prioridad 3: Lotes (solo guardar como 'all' si no existe ya el catálogo completo en RAM)
    try {
      const existingAllLotes = getFromMemoryCache<Lote[]>('lotes', 'all');
      const resL = await listarLotes({ page: 1, pageSize: 200 }, forceRefresh).catch(() => null);
      if (
        resL?.data &&
        Array.isArray(resL.data) &&
        (!resL.totalPages || resL.totalPages <= 1) &&
        (!existingAllLotes || existingAllLotes.length <= resL.data.length)
      ) {
        setToMemoryCache('lotes', resL.data, 'all');
      }
    } catch {
      // Continuar
    }

    // Prioridad 4: Vehículos y demás Bienes
    try {
      const existingAllBienes = getFromMemoryCache<Bien[]>('bienes', 'all');
      const resB = await listarBienes({ page: 1, pageSize: 200 }, forceRefresh).catch(() => null);
      if (
        resB?.data &&
        Array.isArray(resB.data) &&
        (!resB.totalPages || resB.totalPages <= 1) &&
        (!existingAllBienes || existingAllBienes.length <= resB.data.length)
      ) {
        setToMemoryCache('bienes', resB.data, 'all');
      }
    } catch {
      // Continuar
    }

    // Prioridad 5: Garantías Liberadas, Pendientes y Configuración
    try {
      await Promise.all([
        listarGarantiasPendientes(
          { page: 1, pageSize: 200, sortField: DEFAULT_GARANTIA_SORT.field, sortDirection: DEFAULT_GARANTIA_SORT.direction },
          forceRefresh
        ).catch(() => null),
        listarGarantiasLiberadas(
          { page: 1, pageSize: 200, sortField: DEFAULT_GARANTIA_SORT.field, sortDirection: DEFAULT_GARANTIA_SORT.direction },
          forceRefresh
        ).catch(() => null),
        getConfiguracion(forceRefresh).catch(() => null),
      ]);
    } catch {
      // Continuar
    }

    lastSyncTimestamp = new Date().toLocaleString('es-BO', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });

  } finally {
    isPreloading = false;
  }
}

// Alias para retrocompatibilidad
export const preloadAllData = preloadDataInBackground;

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
 * Cierre de sesión (limpia el estado y la caché en memoria RAM)
 */
export function logout(): void {
  clearStoredSession();
  inMemorySession.isAuthenticated = false;
  clearAllMemoryCache();
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

      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new BackendConnectionError('El servidor devolvió una respuesta no válida o incompleta.');
      }

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

  const executeWithRetry = async (): Promise<T> => {
    try {
      return await executeRequest();
    } catch (err: any) {
      if (isReadOnly) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return await executeRequest();
      }
      throw err;
    }
  };

  if (isReadOnly) {
    const dedupKey = `${accion}:${JSON.stringify(datos || {})}`;
    return fetchWithDeduplication(dedupKey, executeWithRetry);
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
      if (data.resultado.institucion) {
        inMemorySession.institucion = data.resultado.institucion;
      }
      saveStoredSession(inMemorySession.institucion);
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

export interface ResumenHectareasConsolidado {
  hectareasTotales: number;
  hectareasEnGarantia: number;
  hectareasDisponibles: number;
  hectareasBloqueadas: number;
  lotesBloqueados: number;
  porUbicacion: UbicacionEstadistica[];
}

/**
 * CÁLCULO UNIFICADO DE HECTÁREAS PARA TARJETAS Y TABLA POR UBICACIÓN
 * Garantiza exactamente el mismo criterio y origen de datos:
 * - Hectáreas en Garantía: suma hectáreas comprometidas (activas y pendientes),
 *   acotadas por la superficie física de cada lote para no duplicar superficies.
 * - Hectáreas Bloqueadas: superficie no comprometida en garantía de lotes con estado Bloqueado
 *   (evita descontar dos veces cuando un lote bloqueado también tiene hectáreas en garantía).
 * - Hectáreas Disponibles: superficie realmente utilizable para nuevas garantías
 *   (nunca negativa; 0 para lotes bloqueados o inactivos).
 */
export function calcularResumenHectareasLotes(lotes: Lote[]): ResumenHectareasConsolidado {
  const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
  const ubicacionesMap = new Map<
    string,
    {
      ubicacion: string;
      cantidadLotes: number;
      hectareasTotales: number;
      hectareasEnGarantia: number;
      hectareasDisponibles: number;
      hectareasBloqueadas: number;
    }
  >();

  let hectareasTotales = 0;
  let hectareasEnGarantia = 0;
  let hectareasDisponibles = 0;
  let hectareasBloqueadas = 0;
  let lotesBloqueados = 0;

  for (const lote of lotes) {
    const haTotales = Math.max(0, Number(lote.hectareas) || 0);
    const haGarantia = Math.min(haTotales, Math.max(0, Number(lote.hectareasEnGarantia) || 0));
    const estadoLower = String(lote.estado || 'Disponible').trim().toLowerCase();
    const isBloqueado = estadoLower === 'bloqueado';
    const isInactivo = estadoLower === 'inactivo';

    const haBloq = isBloqueado ? Math.max(0, haTotales - haGarantia) : 0;
    const haDisp = isBloqueado || isInactivo ? 0 : Math.max(0, haTotales - haGarantia);

    hectareasTotales += haTotales;
    hectareasEnGarantia += haGarantia;
    hectareasDisponibles += haDisp;
    hectareasBloqueadas += haBloq;
    if (isBloqueado) lotesBloqueados += 1;

    const ubicacionKey = String(lote.ubicacion || 'Sin Ubicación').trim() || 'Sin Ubicación';
    const existing = ubicacionesMap.get(ubicacionKey);
    if (existing) {
      existing.cantidadLotes += 1;
      existing.hectareasTotales += haTotales;
      existing.hectareasEnGarantia += haGarantia;
      existing.hectareasDisponibles += haDisp;
      existing.hectareasBloqueadas += haBloq;
    } else {
      ubicacionesMap.set(ubicacionKey, {
        ubicacion: ubicacionKey,
        cantidadLotes: 1,
        hectareasTotales: haTotales,
        hectareasEnGarantia: haGarantia,
        hectareasDisponibles: haDisp,
        hectareasBloqueadas: haBloq,
      });
    }
  }

  const porUbicacion: UbicacionEstadistica[] = Array.from(ubicacionesMap.values())
    .map((u) => ({
      ubicacion: u.ubicacion,
      cantidadLotes: u.cantidadLotes,
      hectareasTotales: round6(u.hectareasTotales),
      hectareasEnGarantia: round6(u.hectareasEnGarantia),
      hectareasDisponibles: round6(u.hectareasDisponibles),
      hectareasBloqueadas: round6(u.hectareasBloqueadas),
    }))
    .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));

  return {
    hectareasTotales: round6(hectareasTotales),
    hectareasEnGarantia: round6(hectareasEnGarantia),
    hectareasDisponibles: round6(hectareasDisponibles),
    hectareasBloqueadas: round6(hectareasBloqueadas),
    lotesBloqueados,
    porUbicacion,
  };
}

/**
 * SERVICIOS DE DASHBOARD
 * Utiliza totales reales de garantías activas y el cálculo unificado de lotes y bienes.
 */
export async function getDashboardStats(forceRefresh: boolean = false): Promise<DashboardStats> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<DashboardStats>('dashboard');
    if (cached) return cached;
  }

  const [firstPageGarantias, lotes, bienes] = await Promise.all([
    listarGarantias({ page: 1, pageSize: 200 }, forceRefresh).catch(() => null),
    obtenerLotes(forceRefresh).catch(() => [] as Lote[]),
    obtenerBienes(forceRefresh).catch(() => [] as Bien[]),
  ]);

  let totalGarantiasActivas = firstPageGarantias?.total ?? 0;
  let garantiasAll: Garantia[] = firstPageGarantias?.data || [];

  if (firstPageGarantias?.totalPages && firstPageGarantias.totalPages > 1) {
    const remaining = [];
    for (let p = 2; p <= firstPageGarantias.totalPages; p++) {
      remaining.push(listarGarantias({ page: p, pageSize: 200 }, forceRefresh));
    }
    const results = await Promise.all(remaining);
    for (const r of results) {
      if (r?.data) {
        garantiasAll = garantiasAll.concat(r.data);
      }
    }
  }

  totalGarantiasActivas = Math.max(totalGarantiasActivas, garantiasAll.length);
  const resumenHectareas = calcularResumenHectareasLotes(lotes);

  const stats: DashboardStats = {
    garantiasActivas: totalGarantiasActivas,
    hectareasEnGarantia: resumenHectareas.hectareasEnGarantia,
    hectareasDisponibles: resumenHectareas.hectareasDisponibles,
    bienesEnGarantia: bienes.filter((b) => b.enGarantia).length,
    valorBienesEnGarantiaUSD: bienes
      .filter((b) => b.enGarantia)
      .reduce((acc, b) => acc + (b.valorGarantiaUSD || 0), 0),
    garantiasExternas: garantiasAll.filter(
      (g) => g.garantiaConTipo === 'Farmer Rechnung' || g.garantiaConTipo === 'Campo Grande'
    ).length,
    lotesBloqueados: resumenHectareas.lotesBloqueados,
    bienesBloqueados: bienes.filter((b) => b.estado === 'Bloqueado').length,
  };

  setToMemoryCache('dashboard', stats);
  return stats;
}

/**
 * SERVICIOS DE ESTADÍSTICAS DEL PANEL (NUEVO BACKEND)
 * accion: obtenerEstadisticasPanel
 * Unifica porUbicacion con calcularResumenHectareasLotes para garantizar coincidencia
 * exacta entre las tarjetas superiores y la tabla de disponibilidad por ubicación.
 */
export async function obtenerEstadisticasPanel(forceRefresh: boolean = false): Promise<EstadisticasPanel> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<EstadisticasPanel>('estadisticas_panel');
    if (cached) return cached;
  }

  const [res, lotes] = await Promise.all([
    callAppsScript<any>('obtenerEstadisticasPanel', {}),
    obtenerLotes(forceRefresh).catch(() => [] as Lote[]),
  ]);
  const data = res?.resultado || res?.data || res || {};

  const porUbicacionBackend: UbicacionEstadistica[] = Array.isArray(data?.porUbicacion)
    ? data.porUbicacion.map((item: any) => ({
        ubicacion: String(item?.ubicacion || item?.Ubicación || item?.Ubicacion || 'Sin Ubicación'),
        cantidadLotes: typeof item?.cantidadLotes === 'number' ? item.cantidadLotes : (Number(item?.['Cantidad Lotes']) || 0),
        hectareasTotales: typeof item?.hectareasTotales === 'number' ? item.hectareasTotales : parseDecimal(item?.['Hectáreas Totales'] ?? item?.hectareasTotales),
        hectareasEnGarantia: typeof item?.hectareasEnGarantia === 'number' ? item.hectareasEnGarantia : parseDecimal(item?.['Hectáreas en Garantía'] ?? item?.hectareasEnGarantia),
        hectareasDisponibles: typeof item?.hectareasDisponibles === 'number' ? item.hectareasDisponibles : parseDecimal(item?.['Hectáreas Disponibles'] ?? item?.hectareasDisponibles),
        hectareasBloqueadas: typeof item?.hectareasBloqueadas === 'number'
          ? item.hectareasBloqueadas
          : typeof item?.hectareasNoDisponibles === 'number'
          ? item.hectareasNoDisponibles
          : parseDecimal(item?.['Hectáreas Bloqueadas'] ?? item?.['Hectáreas No Disponibles'] ?? item?.hectareasBloqueadas ?? item?.hectareasNoDisponibles ?? 0),
      }))
    : [];

  const porUbicacion: UbicacionEstadistica[] =
    lotes.length > 0 ? calcularResumenHectareasLotes(lotes).porUbicacion : porUbicacionBackend;

  const proximasAVencer: GarantiaProximaVencer[] = Array.isArray(data?.proximasAVencer)
    ? data.proximasAVencer.map((item: any) => {
        const idGarantia = String(item?.idGarantia || item?.['ID Garantía'] || '');
        const numeroSolicitud = item?.numeroSolicitud ?? item?.['N.º Solicitud'] ?? '';
        const propietario = String(item?.propietario || item?.['Propietario'] || '');
        const cuentaPropietario = item?.cuentaPropietario ?? item?.['Cuenta Propietario'] ?? '';
        const prestatario = String(item?.prestatario || item?.['Prestatario'] || '');
        const cuentaPrestatario = item?.cuentaPrestatario ?? item?.['Cuenta Prestatario'] ?? '';
        const fechaVencimiento = String(item?.fechaVencimiento || item?.['Fecha de Vencimiento'] || '');

        const calc = calcularEstadoVencimiento(fechaVencimiento);
        const diasRestantes = typeof item?.diasRestantes === 'number'
          ? item.diasRestantes
          : calc.diasRestantes;
        const estadoVencimiento = (item?.estadoVencimiento || calc.estado) as GarantiaProximaVencer['estadoVencimiento'];

        return {
          idGarantia,
          numeroSolicitud,
          propietario,
          cuentaPropietario,
          prestatario,
          cuentaPrestatario,
          fechaVencimiento,
          diasRestantes,
          estadoVencimiento,
        };
      })
    : [];

  const principalesClientes: ClienteEstadistica[] = Array.isArray(data?.principalesClientes)
    ? data.principalesClientes.map((item: any) => ({
        cuenta: item?.cuenta ?? item?.Cuenta ?? '',
        nombre: String(item?.nombre || item?.Nombre || ''),
        cantidadGarantias: typeof item?.cantidadGarantias === 'number' ? item.cantidadGarantias : (Number(item?.['Cantidad Garantías']) || 0),
        hectareasEnGarantia: typeof item?.hectareasEnGarantia === 'number' ? item.hectareasEnGarantia : parseDecimal(item?.['Hectáreas en Garantía'] ?? item?.hectareasEnGarantia),
        bienesEnGarantia: typeof item?.bienesEnGarantia === 'number' ? item.bienesEnGarantia : (Number(item?.['Bienes en Garantía']) || 0),
      }))
    : [];

  const stats: EstadisticasPanel = {
    porUbicacion,
    proximasAVencer,
    totalProximasAVencer: typeof data?.totalProximasAVencer === 'number' ? data.totalProximasAVencer : proximasAVencer.length,
    principalesClientes,
    criterioClientes: data?.criterioClientes || 'Cuenta Prestatario',
    periodoVencimientoDias: data?.periodoVencimientoDias || 30,
  };

  setToMemoryCache('estadisticas_panel', stats);
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

let mapaCompromisosLotesCache: Map<string, number> | null = null;

export interface DisponibilidadLoteInfo {
  idLote: string;
  numeroLote: string;
  cuentaPropietario: string | number;
  propietario: string;
  hectareasTotales: number;
  hectareasEnEstaGarantia: number;
  hectareasEnOtrasGarantias: number;
  hectareasDisponiblesParaEstaGarantia: number;
  relacionesGarantia: {
    idGarantia: string;
    numeroSolicitud: string | number;
    hectareas: number;
    garantiaConTipo?: string;
    garantiaConCuenta?: string | number;
    garantiaConNombre?: string;
  }[];
}

const clientDetailsCache = new Map<string, { timestamp: number; data: DetalleCliente }>();

export function invalidarCacheDetalleCliente(cuenta?: string | number) {
  if (cuenta !== undefined && cuenta !== null && String(cuenta).trim() !== '') {
    clientDetailsCache.delete(String(cuenta).trim());
  } else {
    clientDetailsCache.clear();
  }
}

export function invalidarMapaCompromisosLotes() {
  mapaCompromisosLotesCache = null;
  clientDetailsCache.clear();
}

export async function obtenerDisponibilidadLote(
  lote: {
    idLote: string | number;
    numeroLote?: string;
    hectareas?: number;
    hectareasEnGarantia?: number;
    cuentaPropietario?: string | number;
    propietario?: string;
  },
  idGarantiaActual?: string,
  hectareasOriginalesEnEstaGarantia?: number
): Promise<DisponibilidadLoteInfo> {
  let haTotales = Number(lote.hectareas) || 0;
  let enEstaGarantia = 0;
  let enOtrasGarantias = 0;
  let idOficial = String(lote.idLote || '').trim();
  let numOficial = String(lote.numeroLote || '').trim();
  let ctaOficial: string | number = lote.cuentaPropietario ?? '';
  let propOficial = lote.propietario || '';
  let relaciones: DisponibilidadLoteInfo['relacionesGarantia'] = [];

  const cta = ctaOficial !== '' && ctaOficial !== null && ctaOficial !== undefined ? String(ctaOficial).trim() : '';

  if (cta) {
    try {
      const now = Date.now();
      let detalle: DetalleCliente | null = null;
      const cached = clientDetailsCache.get(cta);
      if (cached && now - cached.timestamp < 60000) {
        detalle = cached.data;
      } else {
        detalle = await callAppsScript<DetalleCliente>('obtenerDetalleCliente', { cuenta: cta });
        if (detalle) {
          clientDetailsCache.set(cta, { timestamp: now, data: detalle });
        }
      }

      if (detalle && Array.isArray(detalle.lotes)) {
        const matched = detalle.lotes.find((cl: any) => {
          const lId = cl.idLote || cl.lote?.['ID Lote'] || cl.lote?.idLote;
          const lNum = cl.numeroLote || cl.lote?.['N.º de Lote'] || cl.lote?.['N.º Lote'] || cl.lote?.numeroLote;
          const matchId = idOficial && lId && String(lId).trim().toLowerCase() === idOficial.toLowerCase();
          const matchNum = numOficial && lNum && String(lNum).trim().toLowerCase() === numOficial.toLowerCase();
          const matchCross1 = idOficial && lNum && String(lNum).trim().toLowerCase() === idOficial.toLowerCase();
          const matchCross2 = numOficial && lId && String(lId).trim().toLowerCase() === numOficial.toLowerCase();
          return matchId || matchNum || matchCross1 || matchCross2;
        });

        if (matched) {
          const clAny = matched as any;
          const lId = clAny.idLote || clAny.lote?.['ID Lote'] || clAny.lote?.idLote;
          const lNum = clAny.numeroLote || clAny.lote?.['N.º de Lote'] || clAny.lote?.numeroLote;
          const lProp = clAny.propietario || clAny.lote?.['Propietario'] || clAny.lote?.propietario;
          if (!idOficial && lId) idOficial = String(lId);
          if (!numOficial && lNum) numOficial = String(lNum);
          if (lProp) propOficial = String(lProp);
          haTotales = Number(clAny.hectareasTotales || clAny.hectareas || haTotales) || 0;
          const rels = clAny.relacionesGarantia || clAny.relaciones || [];
          relaciones = rels.map((r: any) => ({
            idGarantia: String(r.idGarantia || ''),
            numeroSolicitud: r.numeroSolicitud || '',
            hectareas: Number(r.hectareas) || 0,
            garantiaConTipo: r.garantiaConTipo,
            garantiaConCuenta: r.garantiaConCuenta,
            garantiaConNombre: r.garantiaConNombre,
          }));
          for (const r of rels) {
            const ha = Number(r.hectareas) || 0;
            if (idGarantiaActual && String(r.idGarantia).trim().toLowerCase() === String(idGarantiaActual).trim().toLowerCase()) {
              enEstaGarantia += ha;
            } else {
              enOtrasGarantias += ha;
            }
          }
        }
      }
    } catch (err) {
      console.warn('No se pudo consultar detalle del cliente para disponibilidad de lote:', err);
    }
  }

  // Asegurar que las reservas reportadas por listarLotes (incluyendo garantías pendientes y activas) se respeten sin duplicar
  const haEnGarantiaLote = Number(lote.hectareasEnGarantia) || 0;
  if (haEnGarantiaLote > 0) {
    if (!idGarantiaActual) {
      enOtrasGarantias = Math.max(enOtrasGarantias, haEnGarantiaLote);
    } else {
      const haEnEstaRef = enEstaGarantia > 0 ? enEstaGarantia : Number(hectareasOriginalesEnEstaGarantia) || 0;
      const otrasDesdeLote = Math.max(0, Math.round((haEnGarantiaLote - haEnEstaRef) * 1e6) / 1e6);
      enOtrasGarantias = Math.max(enOtrasGarantias, otrasDesdeLote);
    }
  }

  const disp = Math.max(0, Math.round((haTotales - enOtrasGarantias) * 1e6) / 1e6);

  return {
    idLote: idOficial,
    numeroLote: numOficial,
    cuentaPropietario: ctaOficial,
    propietario: propOficial,
    hectareasTotales: haTotales,
    hectareasEnEstaGarantia: enEstaGarantia,
    hectareasEnOtrasGarantias: enOtrasGarantias,
    hectareasDisponiblesParaEstaGarantia: disp,
    relacionesGarantia: relaciones,
  };
}

export async function obtenerMapaCompromisosLotes(forceRefresh = false): Promise<Map<string, number>> {
  if (!forceRefresh && mapaCompromisosLotesCache) {
    return mapaCompromisosLotesCache;
  }

  const map = new Map<string, number>();

  try {
    const cachedActivas = findAnyCachedData<Garantia>('garantias') || [];
    const cachedPendientes = findAnyCachedData<Garantia>('garantias-pendientes') || [];
    const seenIds = new Set<string>();
    const combined: Garantia[] = [];
    for (const g of [...cachedActivas, ...cachedPendientes]) {
      const gid = String(g?.idGarantia || '').trim();
      if (gid && seenIds.has(gid)) continue;
      if (gid) seenIds.add(gid);
      combined.push(g);
    }
    for (const g of combined) {
      if (Array.isArray(g.lotes)) {
        for (const gl of g.lotes) {
          const ha = parseDecimal(gl.hectareas);
          if (ha > 0) {
            if (gl.idLote) {
              const kId = String(gl.idLote).trim();
              map.set(kId, Math.round(((map.get(kId) || 0) + ha) * 1e6) / 1e6);
            }
            if (gl.numeroLote) {
              const kNum = `num:${String(gl.numeroLote).trim().toLowerCase()}`;
              map.set(kNum, Math.round(((map.get(kNum) || 0) + ha) * 1e6) / 1e6);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error al obtener mapa de compromisos:', err);
  }

  mapaCompromisosLotesCache = map;
  return map;
}

export function normalizarLote(item: any, mapaCompromisos?: Map<string, number>): Lote {
  const idLote = item?.['ID Lote'] || item?.idLote || '';
  const numeroLote = item?.['N.º de Lote'] || item?.['N.º Lote'] || item?.numeroLote || '';

  const dispStr = String(item?.['Disponibilidad'] || '').toLowerCase();
  const enGarantiaCalculado =
    typeof item?.['En Garantía'] === 'boolean'
      ? item['En Garantía']
      : item?.enGarantia === true ||
        dispStr.includes('garant') ||
        dispStr.includes('reserv') ||
        dispStr.includes('pendient');

  const hectareasTotales =
    typeof item?.['Hectáreas'] === 'number'
      ? item['Hectáreas']
      : typeof item?.['Hectáreas Totales'] === 'number'
      ? item['Hectáreas Totales']
      : typeof item?.hectareas === 'number'
      ? item.hectareas
      : parseDecimal(item?.['Hectáreas'] ?? item?.['Hectáreas Totales'] ?? item?.hectareas);

  const backendHaEnGarantia =
    typeof item?.['Hectáreas en Garantía'] === 'number'
      ? item['Hectáreas en Garantía']
      : typeof item?.hectareasEnGarantia === 'number'
      ? item.hectareasEnGarantia
      : item?.['Hectáreas en Garantía'] !== undefined
      ? parseDecimal(item['Hectáreas en Garantía'])
      : item?.hectareasEnGarantia !== undefined
      ? parseDecimal(item.hectareasEnGarantia)
      : undefined;

  let hectareasEnGarantia = 0;

  if (mapaCompromisos) {
    const kId = idLote ? String(idLote).trim() : '';
    const kNum = numeroLote ? `num:${String(numeroLote).trim().toLowerCase()}` : '';

    const haFromMap = (kId && mapaCompromisos.get(kId)) || (kNum && mapaCompromisos.get(kNum)) || 0;
    hectareasEnGarantia = Math.max(haFromMap, backendHaEnGarantia || 0);
  } else {
    // Si hay backendHaEnGarantia enviado por Apps Script
    if (backendHaEnGarantia !== undefined && backendHaEnGarantia >= 0) {
      hectareasEnGarantia = backendHaEnGarantia;
    } else if (enGarantiaCalculado) {
      hectareasEnGarantia = hectareasTotales;
    }
  }

  const estadoNormalizado = (item?.['Estado'] || item?.estado || 'Disponible') as EstadoRegistro;
  const estadoLower = String(estadoNormalizado).trim().toLowerCase();
  const isNoDisponibleAdmin = estadoLower === 'bloqueado' || estadoLower === 'inactivo';

  // Redondear a 6 decimales para evitar artefactos de punto flotante
  hectareasEnGarantia = Math.round(Math.min(hectareasTotales, Math.max(0, hectareasEnGarantia)) * 1e6) / 1e6;

  // Un lote bloqueado administrativamente o inactivo no tiene hectáreas disponibles para nuevas garantías
  const hectareasDisponibles = isNoDisponibleAdmin
    ? 0
    : Math.round(Math.max(0, hectareasTotales - hectareasEnGarantia) * 1e6) / 1e6;

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
    estado: estadoNormalizado,
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
  const dispStr = String(item?.['Disponibilidad'] || '').toLowerCase();
  const enGarantiaCalculado =
    typeof item?.['En Garantía'] === 'boolean'
      ? item['En Garantía']
      : item?.enGarantia === true ||
        dispStr.includes('garant') ||
        dispStr.includes('reserv') ||
        dispStr.includes('pendient');

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
  const fecha = item?.['Fecha'] || item?.fecha || '';
  const fechaVencimiento =
    item?.['Fecha de Vencimiento'] ||
    item?.fechaVencimiento ||
    item?.['Fecha Vencimiento'] ||
    '';
  const fechaRegistro =
    item?.['Fecha de Registro'] ||
    item?.fechaRegistro ||
    item?.['Fecha Registro'] ||
    '';
  const fechaActivacion =
    item?.['Fecha de Activación'] ||
    item?.fechaActivacion ||
    item?.['Fecha Activación'] ||
    '';
  const estadoGarantia =
    item?.['Estado Garantía'] ||
    item?.['Estado de Garantía'] ||
    item?.estadoGarantia ||
    item?.['Estado'] ||
    item?.estado ||
    '';

  const rawDiasPendientes =
    item?.['Días Pendientes'] ??
    item?.['Días pendientes'] ??
    item?.diasPendientes;
  const diasPendientes =
    typeof rawDiasPendientes === 'number' && !isNaN(rawDiasPendientes)
      ? rawDiasPendientes
      : rawDiasPendientes !== undefined && rawDiasPendientes !== null && String(rawDiasPendientes).trim() !== '' && !isNaN(Number(rawDiasPendientes))
      ? Number(rawDiasPendientes)
      : calcularDiasPendientes(fechaRegistro || fecha);

  const alertaPendiente =
    typeof item?.alertaPendiente === 'boolean'
      ? item.alertaPendiente
      : typeof item?.['Alerta Pendiente'] === 'boolean'
      ? item['Alerta Pendiente']
      : undefined;

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
    fecha,
    fechaVencimiento,
    estadoVencimiento,
    diasRestantes,
    estadoGarantia: estadoGarantia || undefined,
    fechaRegistro: fechaRegistro || undefined,
    fechaActivacion: fechaActivacion || undefined,
    diasPendientes,
    alertaPendiente,
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

export function normalizarGarantiaLiberada(item: any): GarantiaLiberada {
  const fecha =
    item?.['Fecha'] ||
    item?.fecha ||
    item?.['Fecha de Garantía'] ||
    item?.['Fecha Garantía'] ||
    '';
  const fechaLiberacion =
    item?.['Fecha de Liberación'] ||
    item?.['Fecha Liberación'] ||
    item?.fechaLiberacion ||
    item?.['Fecha de liberacion'] ||
    item?.fecha_liberacion ||
    '';
  const fechaVencimiento =
    item?.['Fecha de Vencimiento'] ||
    item?.fechaVencimiento ||
    item?.['Fecha Vencimiento'] ||
    '';
  const fechaRegistro =
    item?.['Fecha de Registro'] ||
    item?.fechaRegistro ||
    '';
  const fechaActivacion =
    item?.['Fecha de Activación'] ||
    item?.fechaActivacion ||
    '';

  return {
    idGarantia:
      item?.['ID Garantía'] ||
      item?.idGarantia ||
      item?.['ID Liberación'] ||
      item?.idLiberacion ||
      '',
    idLiberacion: item?.['ID Liberación'] || item?.idLiberacion || undefined,
    numeroSolicitud:
      item?.['N.º Solicitud'] !== undefined && item?.['N.º Solicitud'] !== null
        ? String(item['N.º Solicitud'])
        : item?.numeroSolicitud !== undefined && item?.numeroSolicitud !== null
        ? String(item.numeroSolicitud)
        : '',
    fecha,
    fechaLiberacion,
    fechaVencimiento,
    fechaRegistro: fechaRegistro || undefined,
    fechaActivacion: fechaActivacion || undefined,
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
    motivoLiberacion:
      item?.['Motivo Liberación'] ||
      item?.['Motivo de Liberación'] ||
      item?.motivoLiberacion ||
      '',
    lotes: [],
    bienes: [],
    lotesResumen: item?.['Lotes'] || item?.lotesResumen || '',
    polizasResumen: item?.['Pólizas'] || item?.polizasResumen || '',
    ubicacionesResumen: item?.['Ubicaciones'] || item?.ubicacionesResumen || '',
    cantidadLotes:
      typeof item?.['Cantidad Lotes'] === 'number'
        ? item['Cantidad Lotes']
        : item?.cantidadLotes || 0,
    cantidadBienes:
      typeof item?.['Cantidad Bienes'] === 'number'
        ? item['Cantidad Bienes']
        : item?.cantidadBienes || 0,
    totalHectareas:
      typeof item?.['Total Hectáreas'] === 'number'
        ? item['Total Hectáreas']
        : item?.totalHectareas,
    totalValorBienesUSD:
      typeof item?.['Total Valor Bienes ($us.)'] === 'number'
        ? item['Total Valor Bienes ($us.)']
        : item?.totalValorBienesUSD,
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
export interface TotalesLotesFiltrados {
  cantidadLotes: number;
  hectareasTotales: number;
  hectareasEnGarantia: number;
  hectareasDisponibles: number;
  hectareasBloqueadas: number;
}

function normalizarFiltrosLotesParaBackend(filters?: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};
  if (!filters) return normalized;
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === 'todos') continue;
    // Apps Script filtra la hoja 'lotes' por el encabezado exacto de columna ('Estado')
    if (key.toLowerCase() === 'estado') {
      normalized['Estado'] = value;
    } else {
      normalized[key] = value;
    }
  }
  return normalized;
}

export async function listarLotes(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Lote>> {
  const backendFilters = normalizarFiltrosLotesParaBackend(params.filters);
  const cacheParams: QueryParams = {
    ...params,
    filters: Object.keys(backendFilters).length > 0 ? backendFilters : undefined,
  };

  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Lote>>('lotes', cacheParams);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('listarLotes', {
    page: params.page || 1,
    pageSize: params.pageSize || 200,
    search: params.search || '',
    filters: backendFilters,
    sort: params.sortField ? { field: params.sortField, direction: params.sortDirection || 'asc' } : {},
  });

  const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
  const items = rawItems.map((item: any) => normalizarLote(item));

  const paginatedResult: PaginatedResponse<Lote> = {
    data: items,
    page: res?.page || params.page || 1,
    pageSize: res?.pageSize || params.pageSize || 200,
    total: typeof res?.total === 'number' ? res.total : items.length,
    totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    from: typeof res?.from === 'number' ? res.from : items.length > 0 ? ((params.page || 1) - 1) * (params.pageSize || 200) + 1 : 0,
    to: typeof res?.to === 'number' ? res.to : Math.min((params.page || 1) * (params.pageSize || 200), typeof res?.total === 'number' ? res.total : items.length),
  };

  setToMemoryCache('lotes', paginatedResult, cacheParams);
  return paginatedResult;
}

export async function obtenerLotes(forceRefresh: boolean = false): Promise<Lote[]> {
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Lote[]>('lotes', 'all');
    if (cached && cached.length > 0) return cached;
    const anyCached = findAnyCachedData<Lote>('lotes');
    if (anyCached && anyCached.length > 200) return anyCached;
  }

  return fetchWithDeduplication<Lote[]>(`obtenerLotes:all:${forceRefresh ? 'refresh' : 'cache'}`, async () => {
    const firstPage = await listarLotes({ page: 1, pageSize: 200 }, forceRefresh);
    let allLotes = [...firstPage.data];
    if (firstPage.totalPages && firstPage.totalPages > 1) {
      const remainingPages = [];
      for (let p = 2; p <= firstPage.totalPages; p++) {
        remainingPages.push(listarLotes({ page: p, pageSize: 200 }, forceRefresh));
      }
      const results = await Promise.all(remainingPages);
      for (const r of results) {
        allLotes = allLotes.concat(r.data);
      }
    }
    setToMemoryCache('lotes', allLotes, 'all');
    return allLotes;
  });
}

export function getTotalesLotesFiltradosCacheKey(search?: string, estado?: string): string {
  const cleanSearch = (search || '').trim().toLowerCase();
  const cleanEstado = estado && estado !== 'todos' ? estado.trim().toLowerCase() : '';
  return `totals:${cleanSearch}|${cleanEstado}`;
}

/**
 * Calcula los totales reales de hectáreas para TODOS los lotes que coinciden con
 * la búsqueda y el filtro de estado aplicados (incluyendo resultados multipágina).
 * Reutiliza la caché en RAM y las páginas ya descargadas para evitar solicitudes innecesarias.
 */
export async function obtenerTotalesLotesFiltrados(
  params: {
    search?: string;
    estado?: string;
    pageSize?: number;
    currentPageResult?: PaginatedResponse<Lote>;
  },
  forceRefresh: boolean = false
): Promise<TotalesLotesFiltrados> {
  const cleanSearch = (params.search || '').trim();
  const cleanEstado = params.estado && params.estado !== 'todos' ? params.estado.trim() : '';
  const cacheKey = getTotalesLotesFiltradosCacheKey(cleanSearch, cleanEstado);

  if (!forceRefresh) {
    const cached = getFromMemoryCache<TotalesLotesFiltrados>('lotes', cacheKey);
    if (cached) return cached;
  }

  const dedupKey = `obtenerTotalesLotesFiltrados:${cacheKey}:${forceRefresh ? 'refresh' : 'cache'}`;
  return fetchWithDeduplication<TotalesLotesFiltrados>(dedupKey, async () => {
    const pageResult = params.currentPageResult;
    const pageSize = pageResult?.pageSize || params.pageSize || 200;

    // Caso 1: Todos los resultados filtrados caben en la página ya cargada (0 peticiones extra)
    if (pageResult && pageResult.totalPages <= 1) {
      const resumen = calcularResumenHectareasLotes(pageResult.data || []);
      const totales: TotalesLotesFiltrados = {
        cantidadLotes: (pageResult.data || []).length,
        hectareasTotales: resumen.hectareasTotales,
        hectareasEnGarantia: resumen.hectareasEnGarantia,
        hectareasDisponibles: resumen.hectareasDisponibles,
        hectareasBloqueadas: resumen.hectareasBloqueadas,
      };
      setToMemoryCache('lotes', totales, cacheKey);
      return totales;
    }

    // Caso 2: Sin búsqueda de texto (todos los lotes o filtro solo por Estado)
    // Reutiliza el catálogo completo en RAM (compartido con el Dashboard) sin descargas duplicadas
    if (!cleanSearch) {
      const allLotes = await obtenerLotes(forceRefresh);
      const filtered = cleanEstado
        ? allLotes.filter(
            (l) => String(l.estado || 'Disponible').trim().toLowerCase() === cleanEstado.toLowerCase()
          )
        : allLotes;

      if (!pageResult || filtered.length === pageResult.total) {
        const resumen = calcularResumenHectareasLotes(filtered);
        const totales: TotalesLotesFiltrados = {
          cantidadLotes: filtered.length,
          hectareasTotales: resumen.hectareasTotales,
          hectareasEnGarantia: resumen.hectareasEnGarantia,
          hectareasDisponibles: resumen.hectareasDisponibles,
          hectareasBloqueadas: resumen.hectareasBloqueadas,
        };
        setToMemoryCache('lotes', totales, cacheKey);
        return totales;
      }
    }

    // Caso 3: Búsqueda activa con múltiples páginas — intentar verificar contra catálogo en RAM primero
    if (!forceRefresh && pageResult) {
      const allCached = getFromMemoryCache<Lote[]>('lotes', 'all');
      if (allCached && allCached.length > 0) {
        const localMatches = allCached.filter((l) => {
          if (
            cleanEstado &&
            String(l.estado || 'Disponible').trim().toLowerCase() !== cleanEstado.toLowerCase()
          ) {
            return false;
          }
          if (!cleanSearch) return true;
          return matchesAnyField(
            l,
            [
              'numeroLote',
              'propietario',
              'cuentaPropietario',
              'encargado',
              'cuentaEncargado',
              'ubicacion',
              'observacion',
            ],
            cleanSearch
          );
        });

        const localIds = new Set(localMatches.map((l) => String(l.idLote)));
        const currentPageMatchesLocal =
          localMatches.length === pageResult.total &&
          (pageResult.data || []).every((l) => localIds.has(String(l.idLote)));

        if (currentPageMatchesLocal) {
          const resumen = calcularResumenHectareasLotes(localMatches);
          const totales: TotalesLotesFiltrados = {
            cantidadLotes: localMatches.length,
            hectareasTotales: resumen.hectareasTotales,
            hectareasEnGarantia: resumen.hectareasEnGarantia,
            hectareasDisponibles: resumen.hectareasDisponibles,
            hectareasBloqueadas: resumen.hectareasBloqueadas,
          };
          setToMemoryCache('lotes', totales, cacheKey);
          return totales;
        }
      }
    }

    // Caso 4: Fallback exacto — descargar únicamente las páginas faltantes del filtro actual
    // (cada página se almacena en caché RAM para acelerar también la navegación de paginación)
    const filters = cleanEstado ? { Estado: cleanEstado } : undefined;
    const basePage =
      pageResult ||
      (await listarLotes(
        {
          page: 1,
          pageSize,
          search: cleanSearch || undefined,
          filters,
        },
        forceRefresh
      ));

    const totalPages = Math.max(1, basePage.totalPages || 1);
    const pageDataByNumber = new Map<number, Lote[]>();
    pageDataByNumber.set(basePage.page || 1, basePage.data || []);

    const missingPages: Promise<{ pageNum: number; data: Lote[] }>[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (pageDataByNumber.has(p)) continue;
      missingPages.push(
        listarLotes(
          {
            page: p,
            pageSize,
            search: cleanSearch || undefined,
            filters,
          },
          forceRefresh
        ).then((r) => ({ pageNum: p, data: r.data || [] }))
      );
    }

    if (missingPages.length > 0) {
      const results = await Promise.all(missingPages);
      for (const r of results) {
        pageDataByNumber.set(r.pageNum, r.data);
      }
    }

    const seenIds = new Set<string>();
    const allFiltered: Lote[] = [];
    for (let p = 1; p <= totalPages; p++) {
      const items = pageDataByNumber.get(p) || [];
      for (const item of items) {
        const key = String(item.idLote || `${item.numeroLote}-${item.cuentaPropietario}`);
        if (seenIds.has(key)) continue;
        seenIds.add(key);
        allFiltered.push(item);
      }
    }

    const resumen = calcularResumenHectareasLotes(allFiltered);
    const totales: TotalesLotesFiltrados = {
      cantidadLotes: allFiltered.length,
      hectareasTotales: resumen.hectareasTotales,
      hectareasEnGarantia: resumen.hectareasEnGarantia,
      hectareasDisponibles: resumen.hectareasDisponibles,
      hectareasBloqueadas: resumen.hectareasBloqueadas,
    };
    setToMemoryCache('lotes', totales, cacheKey);
    return totales;
  });
}

export async function buscarLotes(texto: string, forceRefresh: boolean = false): Promise<Lote[]> {
  const clean = texto ? texto.trim() : '';
  if (!clean) return [];

  const searchKey = `search:${clean.toLowerCase()}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Lote[]>('lotes', searchKey);
    if (cached) return cached;
  }

  // Si ya tenemos todos los lotes en memoria, buscar primero ahí
  const allCached = getFromMemoryCache<Lote[]>('lotes', 'all');
  if (allCached && allCached.length > 200 && !forceRefresh) {
    const lower = clean.toLowerCase();
    const localMatches = allCached.filter(
      (l) =>
        (l.numeroLote && l.numeroLote.toLowerCase().includes(lower)) ||
        (l.idLote && String(l.idLote).toLowerCase().includes(lower)) ||
        (l.propietario && l.propietario.toLowerCase().includes(lower)) ||
        String(l.cuentaPropietario || '').includes(lower) ||
        (l.ubicacion && l.ubicacion.toLowerCase().includes(lower))
    );
    if (localMatches.length > 0) {
      setToMemoryCache('lotes', localMatches, searchKey);
      return localMatches;
    }
  }

  const res = await callAppsScript<any>('buscarLotes', { texto: clean });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map((item: any) => normalizarLote(item));
  setToMemoryCache('lotes', items, searchKey);
  return items;
}

export async function obtenerLotePorId(idLote: string): Promise<Lote | null> {
  if (!idLote) return null;
  const clean = String(idLote).trim();

  // 1. Buscar en memoria/caché
  const allCached = getFromMemoryCache<Lote[]>('lotes', 'all') || findAnyCachedData<Lote>('lotes');
  if (allCached && allCached.length > 0) {
    const found = allCached.find(
      (l) =>
        String(l.idLote).trim().toLowerCase() === clean.toLowerCase() ||
        String(l.numeroLote).trim().toLowerCase() === clean.toLowerCase()
    );
    if (found) return found;
  }

  // 2. Consultar Apps Script directamente por ID
  const res = await callAppsScript<any>('obtenerLotePorId', { idLote: clean }).catch(() => null);
  if (res) return normalizarLote(res);

  // 3. Fallback buscar por texto (puede ser N.º de Lote visible)
  const bySearch = await callAppsScript<any>('buscarLotes', { texto: clean }).catch(() => null);
  const rawSearch = Array.isArray(bySearch) ? bySearch : Array.isArray(bySearch?.items) ? bySearch.items : [];
  const matched = rawSearch.find(
    (item: any) =>
      String(item['ID Lote'] || item.idLote).trim().toLowerCase() === clean.toLowerCase() ||
      String(item['N.º de Lote'] || item['N.º Lote'] || item.numeroLote).trim().toLowerCase() === clean.toLowerCase()
  );
  if (matched) return normalizarLote(matched);
  return null;
}

export async function crearLote(lote: Partial<Lote>): Promise<any> {
  const result = await callAppsScript('crearLote', {
    numeroLote: lote.numeroLote ? lote.numeroLote.trim() : '',
    cuentaPropietario: lote.cuentaPropietario,
    propietario: lote.propietario ? lote.propietario.trim() : '',
    cuentaEncargado: lote.cuentaEncargado || '',
    encargado: lote.encargado ? lote.encargado.trim() : '',
    hectareas: parseDecimal(lote.hectareas),
    ubicacion: lote.ubicacion ? lote.ubicacion.trim() : '',
    estado: lote.estado || 'Disponible',
    motivoBloqueo: lote.motivoBloqueo ? lote.motivoBloqueo.trim() : '',
    fechaBloqueo: lote.fechaBloqueo || '',
    observacion: lote.observacion ? lote.observacion.trim() : '',
  });
  invalidateMemoryCache(['lotes', 'dashboard', 'estadisticas_panel', 'client-detail']);
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
    hectareas: parseDecimal(lote.hectareas),
    ubicacion: lote.ubicacion ? lote.ubicacion.trim() : '',
    estado: lote.estado || 'Disponible',
    motivoBloqueo: lote.motivoBloqueo ? lote.motivoBloqueo.trim() : '',
    fechaBloqueo: lote.fechaBloqueo || '',
    observacion: lote.observacion ? lote.observacion.trim() : '',
  });
  invalidateMemoryCache(['lotes', 'dashboard', 'estadisticas_panel', 'client-detail']);
  return result;
}

export async function eliminarLote(idLote: string): Promise<any> {
  const result = await callAppsScript('eliminarLote', { idLote });
  invalidateMemoryCache(['lotes', 'dashboard', 'estadisticas_panel', 'client-detail']);
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
    if (cached && cached.length > 0) return cached;
    const anyCached = findAnyCachedData<Bien>('bienes');
    if (anyCached && anyCached.length > 200) return anyCached;
  }

  return fetchWithDeduplication<Bien[]>(`obtenerBienes:all:${forceRefresh ? 'refresh' : 'cache'}`, async () => {
    const firstPage = await listarBienes({ page: 1, pageSize: 200 }, forceRefresh);
    let allBienes = [...firstPage.data];
    if (firstPage.totalPages && firstPage.totalPages > 1) {
      const remainingPages = [];
      for (let p = 2; p <= firstPage.totalPages; p++) {
        remainingPages.push(listarBienes({ page: p, pageSize: 200 }, forceRefresh));
      }
      const results = await Promise.all(remainingPages);
      for (const r of results) {
        allBienes = allBienes.concat(r.data);
      }
    }
    setToMemoryCache('bienes', allBienes, 'all');
    return allBienes;
  });
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
  invalidateMemoryCache(['bienes', 'dashboard', 'estadisticas_panel', 'client-detail']);
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
  invalidateMemoryCache(['bienes', 'dashboard', 'estadisticas_panel', 'client-detail']);
  return result;
}

export async function eliminarBien(idBien: string): Promise<any> {
  const result = await callAppsScript('eliminarBien', { idBien });
  invalidateMemoryCache(['bienes', 'dashboard', 'estadisticas_panel', 'client-detail']);
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
function resolveGarantiaSortConfig(params: QueryParams): GarantiaSortConfig {
  const field = isGarantiaSortField(params.sortField)
    ? params.sortField
    : DEFAULT_GARANTIA_SORT.field;
  const direction = params.sortDirection === 'asc' ? 'asc' : 'desc';
  return { field, direction };
}

function buildFilteredPoolCacheKey(search?: string, filters?: Record<string, any>): string {
  const cleanSearch = (search || '').trim().toLowerCase();
  const hasFilters = filters && Object.keys(filters).length > 0;
  if (!cleanSearch && !hasFilters) return 'all';
  const filtersStr = hasFilters
    ? Object.keys(filters!)
        .sort()
        .map((k) => `${k}=${String(filters![k])}`)
        .join('&')
    : '';
  return `all-filtered:${cleanSearch}|${filtersStr}`;
}

function buildPaginatedSlice<T>(
  sortedItems: T[],
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const total = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageData = sortedItems.slice(startIdx, startIdx + pageSize);

  return {
    data: pageData,
    page: safePage,
    pageSize,
    total,
    totalPages,
    from: pageData.length > 0 ? startIdx + 1 : 0,
    to: pageData.length > 0 ? startIdx + pageData.length : 0,
  };
}

export async function listarGarantias(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Garantia>> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 200;
  const cleanSearch = (params.search || '').trim();
  const sortConfig = resolveGarantiaSortConfig(params);

  const cacheParams: QueryParams = {
    ...params,
    page,
    pageSize,
    search: cleanSearch || undefined,
    sortField: sortConfig.field,
    sortDirection: sortConfig.direction,
  };

  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Garantia>>('garantias', cacheParams);
    if (cached) return cached;
  }

  const poolKey = buildFilteredPoolCacheKey(cleanSearch, params.filters);

  // Reutilizar el conjunto filtrado completo en RAM si ya fue descargado (0 peticiones al reordenar o cambiar página)
  if (!forceRefresh) {
    const cachedPool = getFromMemoryCache<Garantia[]>('garantias', poolKey);
    if (cachedPool) {
      const sorted = sortGarantias(cachedPool, sortConfig);
      const paginated = buildPaginatedSlice(sorted, page, pageSize);
      setToMemoryCache('garantias', paginated, cacheParams);
      return paginated;
    }
  }

  const backendSort = {
    field: mapGarantiaSortFieldToBackendHeader(sortConfig.field),
    direction: sortConfig.direction,
  };

  const normalizeActivePage = (res: any): Garantia[] => {
    const rawItems = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    // Garantías activas: excluir explícitamente pendientes o liberadas; conservar Activa y registros históricos sin columna estado
    return rawItems.map(normalizarGarantia).filter((g: Garantia) => {
      const st = String(g.estadoGarantia || '').trim().toLowerCase();
      return !st || st === 'activa' || st === 'activo';
    });
  };

  const fetchPoolDedupKey = `garantias-pool:${poolKey}:${forceRefresh ? 'refresh' : 'cache'}`;
  const allFiltered = await fetchWithDeduplication<Garantia[]>(fetchPoolDedupKey, async () => {
    const firstRes = await callAppsScript<any>('listarGarantias', {
      page: 1,
      pageSize,
      search: cleanSearch,
      filters: params.filters || {},
      sort: backendSort,
    });

    let combined = normalizeActivePage(firstRes);
    const totalPages = typeof firstRes?.totalPages === 'number' ? firstRes.totalPages : 1;

    if (totalPages > 1) {
      const remaining = [];
      for (let p = 2; p <= totalPages; p++) {
        remaining.push(
          callAppsScript<any>('listarGarantias', {
            page: p,
            pageSize,
            search: cleanSearch,
            filters: params.filters || {},
            sort: backendSort,
          })
        );
      }
      const restResults = await Promise.all(remaining);
      for (const r of restResults) {
        combined = combined.concat(normalizeActivePage(r));
      }
    }

    const seen = new Set<string>();
    const deduped: Garantia[] = [];
    for (const item of combined) {
      const key = String(item.idGarantia || `${item.numeroSolicitud}-${item.fecha}`);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    setToMemoryCache('garantias', deduped, poolKey);
    return deduped;
  });

  const sortedAll = sortGarantias(allFiltered, sortConfig);
  const paginatedResult = buildPaginatedSlice(sortedAll, page, pageSize);

  setToMemoryCache('garantias', paginatedResult, cacheParams);
  return paginatedResult;
}

export async function listarGarantiasPendientes(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<Garantia>> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 200;
  const cleanSearch = (params.search || '').trim();
  const sortConfig = resolveGarantiaSortConfig(params);

  const cacheParams: QueryParams = {
    ...params,
    page,
    pageSize,
    search: cleanSearch || undefined,
    sortField: sortConfig.field,
    sortDirection: sortConfig.direction,
  };

  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<Garantia>>('garantias-pendientes', cacheParams);
    if (cached) return cached;
  }

  const poolKey = buildFilteredPoolCacheKey(cleanSearch, params.filters);

  if (!forceRefresh) {
    const cachedPool = getFromMemoryCache<Garantia[]>('garantias-pendientes', poolKey);
    if (cachedPool) {
      const sorted = sortGarantias(cachedPool, sortConfig);
      const paginated = buildPaginatedSlice(sorted, page, pageSize);
      setToMemoryCache('garantias-pendientes', paginated, cacheParams);
      return paginated;
    }
  }

  const backendSort = {
    field: mapGarantiaSortFieldToBackendHeader(sortConfig.field),
    direction: sortConfig.direction,
  };

  const normalizePendingPage = (res: any): Garantia[] => {
    const rawItems = Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];

    let items: Garantia[] = rawItems.map((raw: any) => {
      const norm = normalizarGarantia(raw);
      return {
        ...norm,
        estadoGarantia: norm.estadoGarantia || 'Pendiente',
      };
    });

    if (cleanSearch) {
      items = items.filter((g: Garantia) =>
        matchesAnyField(
          g,
          [
            'numeroSolicitud',
            'propietario',
            'prestatario',
            'cuentaPropietario',
            'cuentaPrestatario',
            'garantiaConNombre',
            'tipoGarantia',
            'lotesResumen',
            'polizasResumen',
          ],
          cleanSearch
        )
      );
    }
    return items;
  };

  const fetchPoolDedupKey = `garantias-pendientes-pool:${poolKey}:${forceRefresh ? 'refresh' : 'cache'}`;
  const allFiltered = await fetchWithDeduplication<Garantia[]>(fetchPoolDedupKey, async () => {
    const firstRes = await callAppsScript<any>('listarGarantiasPendientes', {
      page: 1,
      pageSize,
      search: cleanSearch,
      filters: params.filters || {},
      sort: backendSort,
    });

    let combined = normalizePendingPage(firstRes);
    const totalPages = typeof firstRes?.totalPages === 'number' ? firstRes.totalPages : 1;

    if (totalPages > 1) {
      const remaining = [];
      for (let p = 2; p <= totalPages; p++) {
        remaining.push(
          callAppsScript<any>('listarGarantiasPendientes', {
            page: p,
            pageSize,
            search: cleanSearch,
            filters: params.filters || {},
            sort: backendSort,
          })
        );
      }
      const restResults = await Promise.all(remaining);
      for (const r of restResults) {
        combined = combined.concat(normalizePendingPage(r));
      }
    }

    const seen = new Set<string>();
    const deduped: Garantia[] = [];
    for (const item of combined) {
      const key = String(item.idGarantia || `${item.numeroSolicitud}-${item.fecha}`);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    setToMemoryCache('garantias-pendientes', deduped, poolKey);
    return deduped;
  });

  const sortedAll = sortGarantias(allFiltered, sortConfig);
  const paginatedResult = buildPaginatedSlice(sortedAll, page, pageSize);

  setToMemoryCache('garantias-pendientes', paginatedResult, cacheParams);
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

export function extraerHectareasRelacion(rel: any): number | null {
  if (!rel) return null;
  const candidatas = [
    rel['Hectáreas'],
    rel['Hectareas'],
    rel['Hectáreas Comprometidas'],
    rel['Hectareas Comprometidas'],
    rel['Hectáreas en Garantía'],
    rel['Hectareas en Garantia'],
    rel['Hectáreas Compromiso'],
    rel['Superficie'],
    rel['Superficie (ha)'],
    rel['ha'],
    rel['hectareas'],
    rel['hectareasComprometidas'],
    rel['hectareasEnGarantia'],
    rel['Hectares'],
  ];

  for (const c of candidatas) {
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      const parsed = typeof c === 'number' ? c : parseDecimal(c);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.round(parsed * 1e6) / 1e6;
      }
    }
  }
  return null;
}

export async function obtenerGarantiaCompleta(
  idGarantia: string,
  forceRefresh: boolean = false
): Promise<Garantia | null> {
  if (!idGarantia) return null;

  const cacheKey = `garantia-completa:${idGarantia}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<Garantia>('garantias', cacheKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('obtenerGarantiaCompleta', { idGarantia });
  if (!res || !res.garantia) return null;

  const base = normalizarGarantia(res.garantia);
  base.modalidad = res.garantia?.['Modalidad'] || res.garantia?.modalidad || 'Simple';

  // Mapear lotes relacionados desde garantia_lotes y lotes
  const lotesRelacionados: GarantiaLoteRelacion[] = [];
  if (Array.isArray(res.lotes)) {
    for (const item of res.lotes) {
      if (!item) continue;
      const rel = item.relacion || item;
      const loteData = item.lote || (item.relacion ? undefined : item);

      let idLote =
        loteData?.['ID Lote'] ||
        loteData?.idLote ||
        loteData?.['Id Lote'] ||
        rel?.['ID Lote'] ||
        rel?.idLote ||
        rel?.['Id Lote'] ||
        item['ID Lote'] ||
        item.idLote ||
        '';

      let numeroLote =
        loteData?.['N.º de Lote'] ||
        loteData?.['N.º Lote'] ||
        loteData?.numeroLote ||
        rel?.['N.º de Lote'] ||
        rel?.['N.º Lote'] ||
        rel?.numeroLote ||
        item['N.º de Lote'] ||
        item.numeroLote ||
        '';

      // Correlacionar con lotes en caché o memoria si loteData no vino completo desde el servidor
      if (!loteData && (numeroLote || idLote)) {
        const anyCached = findAnyCachedData<Lote>('lotes') || [];
        const found = anyCached.find((l) =>
          (idLote && String(l.idLote).trim().toLowerCase() === String(idLote).trim().toLowerCase()) ||
          (numeroLote && String(l.numeroLote).trim().toLowerCase() === String(numeroLote).trim().toLowerCase()) ||
          (idLote && String(l.numeroLote).trim().toLowerCase() === String(idLote).trim().toLowerCase())
        );
        if (found) {
          idLote = found.idLote;
          numeroLote = found.numeroLote;
        }
      }

      // Hectáreas guardadas en garantia_lotes para esta relación
      const haFromRel = extraerHectareasRelacion(rel) ?? (rel !== item ? extraerHectareasRelacion(item) : null);
      let haParsed = 0;
      let haIndeterminada = false;

      if (haFromRel !== null && haFromRel > 0) {
        haParsed = haFromRel;
      } else {
        // NUNCA sustituir por la superficie total ni usar 50 ha por defecto
        haParsed = 0;
        haIndeterminada = true;
      }

      // Superficie total del lote (desde la hoja maestra lotes)
      const haTotales =
        typeof loteData?.['Hectáreas'] === 'number'
          ? loteData['Hectáreas']
          : loteData?.['Hectáreas'] !== undefined
          ? parseDecimal(loteData['Hectáreas'])
          : typeof loteData?.hectareas === 'number'
          ? loteData.hectareas
          : undefined;

      const prop =
        loteData?.['Propietario'] ||
        loteData?.propietario ||
        rel?.['Propietario'] ||
        rel?.propietario ||
        item.propietario ||
        '';

      const ctaProp =
        loteData?.['Cuenta Propietario'] ??
        loteData?.cuentaPropietario ??
        rel?.['Cuenta Propietario'] ??
        rel?.cuentaPropietario ??
        item.cuentaPropietario ??
        '';

      lotesRelacionados.push({
        idGarantia: rel?.['ID Garantía'] || rel?.idGarantia || base.idGarantia,
        idLote,
        numeroLote,
        hectareas: haParsed,
        hectareasTotales: haTotales,
        propietario: prop,
        cuentaPropietario: ctaProp,
        ubicacion: loteData?.['Ubicación'] || loteData?.ubicacion || rel?.['Ubicación'] || rel?.ubicacion || '',
        encargado: loteData?.['Encargado'] || loteData?.encargado || '',
        garantiaConTipo: rel?.['Garantía con Tipo'] || rel?.garantiaConTipo || 'Farmer Rechnung',
        garantiaConCuenta: rel?.['Garantía con Cuenta'] ?? rel?.garantiaConCuenta ?? '',
        garantiaConNombre: rel?.['Garantía con Nombre'] || rel?.garantiaConNombre || '',
        hectareasIndeterminadas: haIndeterminada,
      });
    }
  }

  // Mapear bienes relacionados desde garantia_bienes y bienes
  const bienesRelacionados: GarantiaBienRelacion[] = [];
  if (Array.isArray(res.bienes)) {
    for (const item of res.bienes) {
      if (!item) continue;
      const rel = item.relacion || item;
      const bienData = item.bien || (item.relacion ? undefined : item);

      const idBien =
        bienData?.['ID Bien'] ||
        bienData?.idBien ||
        rel?.['ID Bien'] ||
        rel?.idBien ||
        item['ID Bien'] ||
        item.idBien ||
        '';

      const numeroPoliza =
        bienData?.['N.º Póliza'] ||
        bienData?.numeroPoliza ||
        rel?.['N.º Póliza'] ||
        rel?.numeroPoliza ||
        item['N.º Póliza'] ||
        item.numeroPoliza ||
        '';

      const tipoBien =
        bienData?.['Tipo de Bien'] ||
        bienData?.tipoBien ||
        rel?.['Tipo de Bien'] ||
        rel?.tipoBien ||
        item['Tipo de Bien'] ||
        item.tipoBien ||
        '';

      const descripcion =
        bienData?.['Descripción'] || bienData?.descripcion || rel?.['Descripción'] || rel?.descripcion || '';
      const marca = bienData?.['Marca'] || bienData?.marca || rel?.['Marca'] || rel?.marca || '';
      const modelo = bienData?.['Modelo'] || bienData?.modelo || rel?.['Modelo'] || rel?.modelo || '';
      const placa = bienData?.['Placa'] || bienData?.placa || rel?.['Placa'] || rel?.placa || '';

      const valUSD =
        typeof rel?.['Valor en Garantía ($us.)'] === 'number'
          ? rel['Valor en Garantía ($us.)']
          : typeof rel?.valorGarantiaUSD === 'number'
          ? rel.valorGarantiaUSD
          : typeof rel?.valorEnGarantia === 'number'
          ? rel.valorEnGarantia
          : typeof bienData?.['Valor en Garantía ($us.)'] === 'number'
          ? bienData['Valor en Garantía ($us.)']
          : Number(rel?.['Valor en Garantía ($us.)'] || rel?.valorGarantiaUSD || rel?.valorEnGarantia || bienData?.['Valor en Garantía ($us.)'] || 0) || 0;

      const prop =
        bienData?.['Propietario'] ||
        bienData?.propietario ||
        rel?.['Propietario'] ||
        rel?.propietario ||
        item.propietario ||
        '';

      const ctaProp =
        bienData?.['Cuenta Propietario'] ??
        bienData?.cuentaPropietario ??
        rel?.['Cuenta Propietario'] ??
        rel?.cuentaPropietario ??
        item.cuentaPropietario ??
        '';

      bienesRelacionados.push({
        idGarantia: rel?.['ID Garantía'] || rel?.idGarantia || base.idGarantia,
        idBien,
        numeroPoliza,
        tipoBien,
        descripcion,
        marca,
        modelo,
        placa,
        propietario: prop,
        cuentaPropietario: ctaProp,
        ubicacion: bienData?.['Ubicación'] || bienData?.ubicacion || rel?.['Ubicación'] || rel?.ubicacion || '',
        valorGarantiaUSD: valUSD,
        garantiaConTipo: rel?.['Garantía con Tipo'] || rel?.garantiaConTipo || 'Farmer Rechnung',
        garantiaConCuenta: rel?.['Garantía con Cuenta'] ?? rel?.garantiaConCuenta ?? '',
        garantiaConNombre: rel?.['Garantía con Nombre'] || rel?.garantiaConNombre || '',
      });
    }
  }

  base.lotes = lotesRelacionados;
  base.bienes = bienesRelacionados;
  base.cantidadLotes = lotesRelacionados.length;
  base.cantidadBienes = bienesRelacionados.length;

  setToMemoryCache('garantias', base, cacheKey);
  return base;
}

export function determinarTipoGarantiaValido(
  lotes?: any[] | null,
  bienes?: any[] | null,
  fallbackTipo?: string
): 'Terreno' | 'Vehículo' | 'Maquinaria' | 'Otro bien' {
  const hasLotes = Array.isArray(lotes) && lotes.length > 0;
  const hasBienes = Array.isArray(bienes) && bienes.length > 0;

  // REGLA 3: Si contiene al menos un terreno/lote (incluso si se combina con bienes), enviar 'Terreno'
  if (hasLotes) {
    return 'Terreno';
  }

  // REGLA 4: Si solo contiene bienes (sin lotes), clasificar según los bienes
  if (hasBienes) {
    const tieneMaquinaria = bienes.some((b) => {
      const t = (b?.tipoBien || b?.['Tipo de Bien'] || '').toString().trim().toLowerCase();
      return t === 'maquinaria';
    });
    if (tieneMaquinaria) return 'Maquinaria';

    const tieneVehiculo = bienes.some((b) => {
      const t = (b?.tipoBien || b?.['Tipo de Bien'] || '').toString().trim().toLowerCase();
      return t === 'vehículo' || t === 'vehiculo';
    });
    if (tieneVehiculo) return 'Vehículo';

    return 'Otro bien';
  }

  // Si no se pasaron listas de elementos, intentar normalizar el fallbackTipo
  if (fallbackTipo) {
    const clean = fallbackTipo.trim().toLowerCase();
    if (clean === 'terreno' || clean === 'terrenos') return 'Terreno';
    if (clean === 'vehículo' || clean === 'vehiculo') return 'Vehículo';
    if (clean === 'maquinaria') return 'Maquinaria';
    if (clean === 'otro bien' || clean === 'bien' || clean === 'bienes' || clean === 'implemento') return 'Otro bien';
  }

  return 'Terreno';
}

function resolveHeaderCuentaPropietario(
  cuentaProp: string | number | undefined,
  lotes?: Array<{ cuentaPropietario?: string | number }>,
  bienes?: Array<{ cuentaPropietario?: string | number }>,
  fallbackPrestatario?: string | number
): string | number {
  let raw = String(cuentaProp ?? '').trim();
  if (raw.includes('/') || raw.includes(' ')) {
    const parts = raw.split(/[\/\s]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      raw = parts[0];
    }
  }
  if (raw) return raw;

  if (Array.isArray(lotes)) {
    const foundLote = lotes.find((l) => l.cuentaPropietario !== undefined && l.cuentaPropietario !== null && String(l.cuentaPropietario).trim() !== '');
    if (foundLote && foundLote.cuentaPropietario !== undefined) {
      return String(foundLote.cuentaPropietario).trim();
    }
  }

  if (Array.isArray(bienes)) {
    const foundBien = bienes.find((b) => b.cuentaPropietario !== undefined && b.cuentaPropietario !== null && String(b.cuentaPropietario).trim() !== '');
    if (foundBien && foundBien.cuentaPropietario !== undefined) {
      return String(foundBien.cuentaPropietario).trim();
    }
  }

  return fallbackPrestatario !== undefined ? String(fallbackPrestatario).trim() : '';
}

export async function crearGarantia(garantia: Partial<Garantia>): Promise<any> {
  // Verificar disponibilidad actual en el servidor antes de enviar
  try {
    const lotesActuales = await obtenerLotes(false);
    if (Array.isArray(garantia.lotes)) {
      for (const reqLote of garantia.lotes) {
        let serverLote = lotesActuales.find((l) => 
          (reqLote.idLote && String(l.idLote).trim().toLowerCase() === String(reqLote.idLote).trim().toLowerCase()) ||
          (reqLote.numeroLote && String(l.numeroLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase()) ||
          (reqLote.idLote && String(l.numeroLote).trim().toLowerCase() === String(reqLote.idLote).trim().toLowerCase()) ||
          (reqLote.numeroLote && String(l.idLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase())
        );

        if (!serverLote && (reqLote.numeroLote || reqLote.idLote)) {
          if (reqLote.idLote) {
            serverLote = (await obtenerLotePorId(String(reqLote.idLote)).catch(() => null)) || undefined;
          }
          if (!serverLote && reqLote.numeroLote) {
            const found = await buscarLotes(String(reqLote.numeroLote), true).catch(() => []);
            serverLote = found.find((l) =>
              String(l.numeroLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase() ||
              String(l.idLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase()
            );
          }
        }

        if (!serverLote) {
          throw new Error(`El lote ${reqLote.numeroLote || reqLote.idLote} ya no existe en el sistema.`);
        }

        reqLote.idLote = serverLote.idLote;
        reqLote.numeroLote = serverLote.numeroLote;

        if (serverLote.estado === 'Bloqueado' || serverLote.estado === 'Inactivo') {
          throw new Error(`El lote ${serverLote.numeroLote} se encuentra ${serverLote.estado.toLowerCase()} y no puede ser dado en garantía.`);
        }

        const dispInfo = await obtenerDisponibilidadLote({
          ...serverLote,
          hectareasEnGarantia: serverLote.hectareasEnGarantia,
        });
        const maxPermitido = dispInfo.hectareasDisponiblesParaEstaGarantia;
        if (Number(reqLote.hectareas) > maxPermitido + 1e-6) {
          const enOtras = dispInfo.hectareasEnOtrasGarantias;
          const detalleOtras = enOtras > 0 ? ` (${formatHectareas(enOtras)} ha comprometidas en otra garantía)` : '';
          throw new Error(`El lote ${serverLote.numeroLote} solo tiene ${formatHectareas(maxPermitido)} hectáreas disponibles en el servidor${detalleOtras}.`);
        }
      }
    }

    if (Array.isArray(garantia.bienes) && garantia.bienes.length > 0) {
      const bienesActuales = await obtenerBienes(false);
      for (const reqBien of garantia.bienes) {
        const cleanId = String(reqBien.idBien || '').trim().toLowerCase();
        const serverBien = bienesActuales.find(
          (b) => cleanId && String(b.idBien).trim().toLowerCase() === cleanId
        );
        if (serverBien) {
          if (serverBien.estado === 'Bloqueado' || serverBien.estado === 'Inactivo') {
            throw new Error(`El bien ${serverBien.numeroPoliza || serverBien.idBien} se encuentra ${serverBien.estado.toLowerCase()} y no puede ser dado en garantía.`);
          }
          if (serverBien.enGarantia) {
            throw new Error(`El bien ${serverBien.numeroPoliza || serverBien.idBien} ya se encuentra reservado o comprometido en otra garantía.`);
          }
        }
      }
    }
  } catch (err: any) {
    if (err && err.message && !err.message.includes('BackendConnectionError')) {
      throw err;
    }
  }

  // Determinar la cabecera técnica segura y válida para Google Apps Script
  // REGLA FUNDAMENTAL: NUNCA enviar garantiaConTipo: 'Cliente' con cuenta vacía
  const rawTipo = (garantia.garantiaConTipo || '').trim() as TipoGarantiaCon;
  const rawCuenta = String(garantia.garantiaConCuenta || '').trim();
  const rawNombre = (garantia.garantiaConNombre || '').trim();

  let mainGarantiaConTipo: TipoGarantiaCon = 'Farmer Rechnung';
  let mainGarantiaConCuenta = '';
  let mainGarantiaConNombre = 'Farmer Rechnung';

  if (rawTipo === 'Campo Grande') {
    mainGarantiaConTipo = 'Campo Grande';
    mainGarantiaConCuenta = '';
    mainGarantiaConNombre = 'Campo Grande';
  } else if (rawTipo === 'Cliente' && rawCuenta) {
    mainGarantiaConTipo = 'Cliente';
    mainGarantiaConCuenta = rawCuenta;
    mainGarantiaConNombre = rawNombre || `Cliente ${rawCuenta}`;
  } else if (rawTipo === 'Farmer Rechnung') {
    mainGarantiaConTipo = 'Farmer Rechnung';
    mainGarantiaConCuenta = '';
    mainGarantiaConNombre = 'Farmer Rechnung';
  } else {
    mainGarantiaConTipo = 'Farmer Rechnung';
    mainGarantiaConCuenta = '';
    mainGarantiaConNombre = 'Farmer Rechnung';
  }

  const safeCuentaPropietario = resolveHeaderCuentaPropietario(
    garantia.cuentaPropietario,
    garantia.lotes,
    garantia.bienes,
    garantia.cuentaPrestatario
  );

  const safeTipoGarantia = determinarTipoGarantiaValido(
    garantia.lotes,
    garantia.bienes,
    garantia.tipoGarantia
  );

  const result = await callAppsScript('crearGarantia', {
    numeroSolicitud: garantia.numeroSolicitud || '',
    fecha: garantia.fecha,
    fechaVencimiento: garantia.fechaVencimiento || '',
    cuentaPropietario: safeCuentaPropietario,
    propietario: garantia.propietario,
    cuentaPrestatario: garantia.cuentaPrestatario,
    prestatario: garantia.prestatario,
    garantiaConTipo: mainGarantiaConTipo,
    garantiaConCuenta: mainGarantiaConCuenta,
    garantiaConNombre: mainGarantiaConNombre,
    tipoGarantia: safeTipoGarantia,
    modalidad: garantia.modalidad || 'Simple',
    observacion: garantia.observacion || '',
    lotes: Array.isArray(garantia.lotes)
      ? garantia.lotes.map((l) => {
          const itemTipo = (l.garantiaConTipo || 'Farmer Rechnung') as TipoGarantiaCon;
          const isInst = itemTipo === 'Farmer Rechnung' || itemTipo === 'Campo Grande';
          const itemCuenta = isInst ? '' : (l.garantiaConCuenta || '');
          const itemNombre = isInst ? itemTipo : (l.garantiaConNombre || (itemTipo === 'Cliente' ? `Cliente ${itemCuenta}` : itemTipo));
          return {
            idLote: l.idLote,
            numeroLote: l.numeroLote,
            hectareas: parseDecimal(l.hectareas),
            cuentaPropietario: l.cuentaPropietario || '',
            propietario: l.propietario || '',
            garantiaConTipo: itemTipo,
            garantiaConCuenta: itemCuenta,
            garantiaConNombre: itemNombre,
          };
        })
      : [],
    bienes: Array.isArray(garantia.bienes)
      ? garantia.bienes.map((b) => {
          const itemTipo = (b.garantiaConTipo || 'Farmer Rechnung') as TipoGarantiaCon;
          const isInst = itemTipo === 'Farmer Rechnung' || itemTipo === 'Campo Grande';
          const itemCuenta = isInst ? '' : (b.garantiaConCuenta || '');
          const itemNombre = isInst ? itemTipo : (b.garantiaConNombre || (itemTipo === 'Cliente' ? `Cliente ${itemCuenta}` : itemTipo));
          const cleanIdBien = String(b.idBien || (b as any)['ID Bien'] || '').trim();
          return {
            idBien: cleanIdBien,
            numeroPoliza: b.numeroPoliza || '',
            tipoBien: b.tipoBien || 'Otro bien',
            valorGarantiaUSD: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
            valorEnGarantia: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
            cuentaPropietario: b.cuentaPropietario !== undefined && b.cuentaPropietario !== null ? String(b.cuentaPropietario).trim() : '',
            propietario: b.propietario ? String(b.propietario).trim() : '',
            garantiaConTipo: itemTipo,
            garantiaConCuenta: itemCuenta,
            garantiaConNombre: itemNombre,
          };
        })
      : [],
  });

  invalidarMapaCompromisosLotes();
  invalidateMemoryCache([
    'garantias-pendientes',
    'garantias',
    'lotes',
    'bienes',
    'dashboard',
    'estadisticas_panel',
    'reportes',
    'client-detail',
  ]);
  return result;
}

export async function editarGarantia(garantia: Partial<Garantia>): Promise<any> {
  // Verificar disponibilidad actual en el servidor reconociendo el compromiso previo de la garantía actual
  try {
    const [lotesActuales, garantiaOriginal] = await Promise.all([
      obtenerLotes(false),
      garantia.idGarantia ? obtenerGarantiaCompleta(garantia.idGarantia, true) : Promise.resolve(null),
    ]);

    if (Array.isArray(garantia.lotes)) {
      for (const reqLote of garantia.lotes) {
        // 1. Primero verificar si el lote ya estaba registrado en esta garantía original
        let serverLote: any = null;
        const origLoteInThisGarantia =
          garantiaOriginal && Array.isArray(garantiaOriginal.lotes)
            ? garantiaOriginal.lotes.find((l) => 
                (l.idLote && reqLote.idLote && String(l.idLote).trim().toLowerCase() === String(reqLote.idLote).trim().toLowerCase()) ||
                (l.numeroLote && reqLote.numeroLote && String(l.numeroLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase()) ||
                (l.idLote && reqLote.numeroLote && String(l.idLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase()) ||
                (l.numeroLote && reqLote.idLote && String(l.numeroLote).trim().toLowerCase() === String(reqLote.idLote).trim().toLowerCase())
              )
            : undefined;

        if (origLoteInThisGarantia) {
          serverLote = {
            idLote: origLoteInThisGarantia.idLote,
            numeroLote: origLoteInThisGarantia.numeroLote,
            hectareas: origLoteInThisGarantia.hectareasTotales || origLoteInThisGarantia.hectareas,
            cuentaPropietario: origLoteInThisGarantia.cuentaPropietario,
            propietario: origLoteInThisGarantia.propietario,
            estado: 'Disponible',
          };
        }

        // 2. Si no estaba en la original, buscar en lotesActuales
        if (!serverLote) {
          serverLote = lotesActuales.find((l) => 
            (reqLote.idLote && String(l.idLote).trim().toLowerCase() === String(reqLote.idLote).trim().toLowerCase()) ||
            (reqLote.numeroLote && String(l.numeroLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase()) ||
            (reqLote.idLote && String(l.numeroLote).trim().toLowerCase() === String(reqLote.idLote).trim().toLowerCase()) ||
            (reqLote.numeroLote && String(l.idLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase())
          );
        }

        // 3. Si aún no se encuentra, buscar por ID o N.º de lote en Apps Script
        if (!serverLote && (reqLote.numeroLote || reqLote.idLote)) {
          if (reqLote.idLote) {
            serverLote = await obtenerLotePorId(String(reqLote.idLote)).catch(() => null);
          }
          if (!serverLote && reqLote.numeroLote) {
            const found = await buscarLotes(String(reqLote.numeroLote), true).catch(() => []);
            serverLote = found.find((l) =>
              String(l.numeroLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase() ||
              String(l.idLote).trim().toLowerCase() === String(reqLote.numeroLote).trim().toLowerCase()
            );
          }
        }

        if (!serverLote) {
          throw new Error(`El lote ${reqLote.numeroLote || reqLote.idLote} ya no existe en el sistema.`);
        }

        // Asignar el ID Lote oficial y N.º de Lote oficial
        reqLote.idLote = serverLote.idLote;
        reqLote.numeroLote = serverLote.numeroLote;

        if (serverLote.estado === 'Bloqueado' || serverLote.estado === 'Inactivo') {
          throw new Error(`El lote ${serverLote.numeroLote} se encuentra ${serverLote.estado.toLowerCase()} y no puede ser dado en garantía.`);
        }

        // Calcular con precisión la disponibilidad real reconociendo compromisos en otras garantías (activas o pendientes)
        const serverLoteCatalogo = lotesActuales.find(
          (l) =>
            (serverLote.idLote && String(l.idLote).trim().toLowerCase() === String(serverLote.idLote).trim().toLowerCase()) ||
            (serverLote.numeroLote && String(l.numeroLote).trim().toLowerCase() === String(serverLote.numeroLote).trim().toLowerCase())
        );

        const dispInfo = await obtenerDisponibilidadLote(
          {
            idLote: serverLote.idLote,
            numeroLote: serverLote.numeroLote,
            hectareas: serverLoteCatalogo?.hectareas ?? serverLote.hectareas,
            hectareasEnGarantia: serverLoteCatalogo?.hectareasEnGarantia ?? serverLote.hectareasEnGarantia,
            cuentaPropietario: serverLote.cuentaPropietario || reqLote.cuentaPropietario,
            propietario: serverLote.propietario || reqLote.propietario,
          },
          garantia.idGarantia,
          origLoteInThisGarantia ? Number(origLoteInThisGarantia.hectareas) || 0 : 0
        );

        const maxPermitido = dispInfo.hectareasDisponiblesParaEstaGarantia;
        if (Number(reqLote.hectareas) > maxPermitido + 1e-6) {
          const enOtras = dispInfo.hectareasEnOtrasGarantias;
          const detalleOtras = enOtras > 0 ? ` (${formatHectareas(enOtras)} ha comprometidas en otra garantía)` : '';
          throw new Error(
            `El lote ${serverLote.numeroLote} solo tiene ${formatHectareas(maxPermitido)} hectáreas disponibles para esta garantía${detalleOtras}.`
          );
        }
      }
    }
  } catch (err: any) {
    if (err && err.message && !err.message.includes('BackendConnectionError')) {
      throw err;
    }
  }

  // Determinar la cabecera técnica segura y válida para Google Apps Script
  // REGLA FUNDAMENTAL: NUNCA enviar garantiaConTipo: 'Cliente' con cuenta vacía
  const rawTipo = (garantia.garantiaConTipo || '').trim() as TipoGarantiaCon;
  const rawCuenta = String(garantia.garantiaConCuenta || '').trim();
  const rawNombre = (garantia.garantiaConNombre || '').trim();

  let mainGarantiaConTipo: TipoGarantiaCon = 'Farmer Rechnung';
  let mainGarantiaConCuenta = '';
  let mainGarantiaConNombre = 'Farmer Rechnung';

  if (rawTipo === 'Campo Grande') {
    mainGarantiaConTipo = 'Campo Grande';
    mainGarantiaConCuenta = '';
    mainGarantiaConNombre = 'Campo Grande';
  } else if (rawTipo === 'Cliente' && rawCuenta) {
    mainGarantiaConTipo = 'Cliente';
    mainGarantiaConCuenta = rawCuenta;
    mainGarantiaConNombre = rawNombre || `Cliente ${rawCuenta}`;
  } else if (rawTipo === 'Farmer Rechnung') {
    mainGarantiaConTipo = 'Farmer Rechnung';
    mainGarantiaConCuenta = '';
    mainGarantiaConNombre = 'Farmer Rechnung';
  } else {
    mainGarantiaConTipo = 'Farmer Rechnung';
    mainGarantiaConCuenta = '';
    mainGarantiaConNombre = 'Farmer Rechnung';
  }

  const safeCuentaPropietario = resolveHeaderCuentaPropietario(
    garantia.cuentaPropietario,
    garantia.lotes,
    garantia.bienes,
    garantia.cuentaPrestatario
  );

  const safeTipoGarantia = determinarTipoGarantiaValido(
    garantia.lotes,
    garantia.bienes,
    garantia.tipoGarantia
  );

  const result = await callAppsScript('editarGarantia', {
    idGarantia: garantia.idGarantia,
    numeroSolicitud: garantia.numeroSolicitud || '',
    fecha: garantia.fecha,
    fechaVencimiento: garantia.fechaVencimiento || '',
    cuentaPropietario: safeCuentaPropietario,
    propietario: garantia.propietario,
    cuentaPrestatario: garantia.cuentaPrestatario,
    prestatario: garantia.prestatario,
    garantiaConTipo: mainGarantiaConTipo,
    garantiaConCuenta: mainGarantiaConCuenta,
    garantiaConNombre: mainGarantiaConNombre,
    tipoGarantia: safeTipoGarantia,
    modalidad: garantia.modalidad || 'Simple',
    observacion: garantia.observacion || '',
    lotes: Array.isArray(garantia.lotes)
      ? garantia.lotes.map((l) => {
          const itemTipo = (l.garantiaConTipo || 'Farmer Rechnung') as TipoGarantiaCon;
          const isInst = itemTipo === 'Farmer Rechnung' || itemTipo === 'Campo Grande';
          const itemCuenta = isInst ? '' : (l.garantiaConCuenta || '');
          const itemNombre = isInst ? itemTipo : (l.garantiaConNombre || (itemTipo === 'Cliente' ? `Cliente ${itemCuenta}` : itemTipo));
          return {
            idLote: l.idLote,
            numeroLote: l.numeroLote,
            hectareas: parseDecimal(l.hectareas),
            cuentaPropietario: l.cuentaPropietario || '',
            propietario: l.propietario || '',
            garantiaConTipo: itemTipo,
            garantiaConCuenta: itemCuenta,
            garantiaConNombre: itemNombre,
          };
        })
      : [],
    bienes: Array.isArray(garantia.bienes)
      ? garantia.bienes.map((b) => {
          const itemTipo = (b.garantiaConTipo || 'Farmer Rechnung') as TipoGarantiaCon;
          const isInst = itemTipo === 'Farmer Rechnung' || itemTipo === 'Campo Grande';
          const itemCuenta = isInst ? '' : (b.garantiaConCuenta || '');
          const itemNombre = isInst ? itemTipo : (b.garantiaConNombre || (itemTipo === 'Cliente' ? `Cliente ${itemCuenta}` : itemTipo));
          const cleanIdBien = String(b.idBien || (b as any)['ID Bien'] || '').trim();
          return {
            idBien: cleanIdBien,
            numeroPoliza: b.numeroPoliza || '',
            tipoBien: b.tipoBien || 'Otro bien',
            valorGarantiaUSD: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
            valorEnGarantia: typeof b.valorGarantiaUSD === 'number' ? b.valorGarantiaUSD : Number(b.valorGarantiaUSD) || 0,
            cuentaPropietario: b.cuentaPropietario !== undefined && b.cuentaPropietario !== null ? String(b.cuentaPropietario).trim() : '',
            propietario: b.propietario ? String(b.propietario).trim() : '',
            garantiaConTipo: itemTipo,
            garantiaConCuenta: itemCuenta,
            garantiaConNombre: itemNombre,
          };
        })
      : [],
  });

  invalidarMapaCompromisosLotes();
  invalidateMemoryCache([
    'garantias-pendientes',
    'garantias',
    'lotes',
    'bienes',
    'dashboard',
    'estadisticas_panel',
    'reportes',
    'client-detail',
  ]);
  return result;
}

export async function activarGarantia(idGarantia: string): Promise<any> {
  if (!idGarantia || !idGarantia.trim()) {
    throw new Error('El ID de la garantía es requerido para activarla.');
  }
  const result = await callAppsScript('activarGarantia', { idGarantia: idGarantia.trim() });
  invalidarMapaCompromisosLotes();
  invalidateMemoryCache([
    'garantias-pendientes',
    'garantias',
    'lotes',
    'bienes',
    'dashboard',
    'estadisticas_panel',
    'reportes',
    'client-detail',
  ]);
  return result;
}

export async function reactivarGarantia(idGarantia: string): Promise<any> {
  if (!idGarantia || !idGarantia.trim()) {
    throw new Error('El ID de la garantía liberada es requerido para reactivarla.');
  }
  const result = await callAppsScript('reactivarGarantia', { idGarantia: idGarantia.trim() });
  invalidarMapaCompromisosLotes();
  invalidateMemoryCache([
    'garantias-liberadas',
    'garantias',
    'garantias-pendientes',
    'lotes',
    'bienes',
    'dashboard',
    'estadisticas_panel',
    'reportes',
    'client-detail',
  ]);
  return result;
}

export async function liberarGarantia(idGarantia: string): Promise<any> {
  const result = await callAppsScript('liberarGarantia', { idGarantia });
  invalidarMapaCompromisosLotes();
  invalidateMemoryCache([
    'garantias',
    'garantias-pendientes',
    'garantias-liberadas',
    'lotes',
    'bienes',
    'dashboard',
    'estadisticas_panel',
    'reportes',
    'client-detail',
  ]);
  return result;
}

export async function eliminarGarantia(idGarantia: string, password: string): Promise<any> {
  if (!idGarantia) throw new Error('El ID de la garantía es requerido.');
  if (!password || !password.trim()) {
    throw new Error('La contraseña de administrador es requerida.');
  }
  const result = await callAppsScript('eliminarGarantia', {
    idGarantia: idGarantia.trim(),
    password: password.trim(),
  });
  invalidarMapaCompromisosLotes();
  invalidateMemoryCache([
    'garantias',
    'garantias-pendientes',
    'garantias-liberadas',
    'lotes',
    'bienes',
    'dashboard',
    'estadisticas_panel',
    'reportes',
    'client-detail',
  ]);
  return result;
}

const eliminacionesPendientesEnCurso = new Set<string>();

/**
 * Elimina definitivamente una garantía en estado Pendiente utilizando la acción
 * existente `eliminarGarantia` de Google Apps Script.
 * - Comprueba en el servidor (sin caché) que la garantía sigue existiendo y que
 *   su estado actual es exactamente `Pendiente` antes de solicitar la eliminación.
 * - Envía `idGarantia`, `password` y el indicador `soloPendiente: true` para que
 *   Apps Script también pueda reforzar la restricción del lado del servidor.
 * - Evita ejecuciones concurrentes duplicadas para el mismo `idGarantia`.
 * - Invalida todos los cachés de garantías, lotes, bienes, dashboard y detalles.
 */
export async function eliminarGarantiaPendiente(
  idGarantia: string,
  password: string
): Promise<any> {
  const cleanId = String(idGarantia || '').trim();
  const cleanPassword = String(password || '').trim();

  if (!cleanId) {
    throw new Error('El ID de la garantía pendiente es requerido.');
  }
  if (!cleanPassword) {
    throw new Error('La contraseña de administrador es requerida.');
  }
  if (eliminacionesPendientesEnCurso.has(cleanId)) {
    throw new Error('Ya hay una eliminación en curso para esta garantía pendiente.');
  }

  eliminacionesPendientesEnCurso.add(cleanId);
  try {
    // 1. Verificar estado real actualizado directamente en Google Sheets (sin caché)
    const garantiaActual = await obtenerGarantiaCompleta(cleanId, true);
    if (!garantiaActual || String(garantiaActual.idGarantia || '').trim() !== cleanId) {
      throw new Error('La garantía pendiente seleccionada ya no existe en el registro.');
    }

    const estadoActual = String(garantiaActual.estadoGarantia || '').trim().toLowerCase();
    if (estadoActual !== 'pendiente') {
      const estadoVisible = garantiaActual.estadoGarantia || 'Activa';
      throw new Error(
        `No se puede eliminar esta garantía desde Garantías pendientes porque su estado actual es "${estadoVisible}".`
      );
    }

    // 2. Ejecutar la eliminación definitiva mediante la acción existente eliminarGarantia
    const result = await callAppsScript('eliminarGarantia', {
      idGarantia: cleanId,
      password: cleanPassword,
      soloPendiente: true,
    });

    // 3. Invalidar cachés de garantías, disponibilidad de lotes/bienes y estadísticas
    invalidarMapaCompromisosLotes();
    invalidateMemoryCache([
      'garantias-pendientes',
      'garantias',
      'garantias-liberadas',
      'lotes',
      'bienes',
      'dashboard',
      'estadisticas_panel',
      'reportes',
      'client-detail',
    ]);

    return result;
  } finally {
    eliminacionesPendientesEnCurso.delete(cleanId);
  }
}

/**
 * SERVICIOS DE HISTORIAL DE GARANTÍAS LIBERADAS
 */
export async function listarGarantiasLiberadas(
  params: QueryParams,
  forceRefresh: boolean = false
): Promise<PaginatedResponse<GarantiaLiberada>> {
  const page = params.page || 1;
  const pageSize = params.pageSize || 200;
  const cleanSearch = (params.search || '').trim();
  const sortConfig = resolveGarantiaSortConfig(params);

  const cacheParams: QueryParams = {
    ...params,
    page,
    pageSize,
    search: cleanSearch || undefined,
    sortField: sortConfig.field,
    sortDirection: sortConfig.direction,
  };

  if (!forceRefresh) {
    const cached = getFromMemoryCache<PaginatedResponse<GarantiaLiberada>>('garantias-liberadas', cacheParams);
    if (cached) return cached;
  }

  const poolKey = buildFilteredPoolCacheKey(cleanSearch, params.filters);

  if (!forceRefresh) {
    const cachedPool = getFromMemoryCache<GarantiaLiberada[]>('garantias-liberadas', poolKey);
    if (cachedPool) {
      const sorted = sortGarantias(cachedPool, sortConfig);
      const paginated = buildPaginatedSlice(sorted, page, pageSize);
      setToMemoryCache('garantias-liberadas', paginated, cacheParams);
      return paginated;
    }
  }

  const backendSort = {
    field: mapGarantiaSortFieldToBackendHeader(sortConfig.field),
    direction: sortConfig.direction,
  };

  const normalizeReleasedPage = (res: any): GarantiaLiberada[] => {
    const rawItems = Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.data)
      ? res.data
      : Array.isArray(res)
      ? res
      : [];
    let items: GarantiaLiberada[] = rawItems.map(normalizarGarantiaLiberada);

    if (cleanSearch) {
      items = items.filter((g: GarantiaLiberada) =>
        matchesAnyField(
          g,
          [
            'numeroSolicitud',
            'propietario',
            'prestatario',
            'cuentaPropietario',
            'cuentaPrestatario',
            'garantiaConNombre',
            'tipoGarantia',
          ],
          cleanSearch
        )
      );
    }
    return items;
  };

  const fetchPoolDedupKey = `garantias-liberadas-pool:${poolKey}:${forceRefresh ? 'refresh' : 'cache'}`;
  const allFiltered = await fetchWithDeduplication<GarantiaLiberada[]>(fetchPoolDedupKey, async () => {
    const firstRes = await callAppsScript<any>('listarGarantiasLiberadas', {
      page: 1,
      pageSize,
      search: cleanSearch,
      filters: params.filters || {},
      sort: backendSort,
    });

    let combined = normalizeReleasedPage(firstRes);
    const totalPages = typeof firstRes?.totalPages === 'number' ? firstRes.totalPages : 1;

    if (totalPages > 1) {
      const remaining = [];
      for (let p = 2; p <= totalPages; p++) {
        remaining.push(
          callAppsScript<any>('listarGarantiasLiberadas', {
            page: p,
            pageSize,
            search: cleanSearch,
            filters: params.filters || {},
            sort: backendSort,
          })
        );
      }
      const restResults = await Promise.all(remaining);
      for (const r of restResults) {
        combined = combined.concat(normalizeReleasedPage(r));
      }
    }

    const seen = new Set<string>();
    const deduped: GarantiaLiberada[] = [];
    for (const item of combined) {
      const key = String(item.idLiberacion || item.idGarantia || `${item.numeroSolicitud}-${item.fecha}`);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    setToMemoryCache('garantias-liberadas', deduped, poolKey);
    return deduped;
  });

  const sortedAll = sortGarantias(allFiltered, sortConfig);
  const paginatedResult = buildPaginatedSlice(sortedAll, page, pageSize);

  setToMemoryCache('garantias-liberadas', paginatedResult, cacheParams);
  return paginatedResult;
}

export async function obtenerGarantiaLiberadaCompleta(
  idGarantia: string,
  forceRefresh: boolean = false
): Promise<GarantiaLiberada | null> {
  if (!idGarantia) return null;

  const cacheKey = `garantia-liberada-completa:${idGarantia}`;
  if (!forceRefresh) {
    const cached = getFromMemoryCache<GarantiaLiberada>('garantias-liberadas', cacheKey);
    if (cached) return cached;
  }

  const res = await callAppsScript<any>('obtenerGarantiaLiberadaCompleta', { idGarantia });
  if (!res) return null;

  const rawG =
    res.garantia ||
    (res.idGarantia || res['ID Garantía'] || res.numeroSolicitud ? res : null);
  if (!rawG) return null;

  const base = normalizarGarantiaLiberada(rawG);
  base.modalidad = rawG?.['Modalidad'] || rawG?.modalidad || 'Simple';

  // Mapear relaciones de lotes históricos si existen
  const lotesRelacionados: GarantiaLoteRelacion[] = [];
  const sourceLotes = Array.isArray(res.lotes)
    ? res.lotes
    : Array.isArray(rawG.lotes)
    ? rawG.lotes
    : [];

  for (const item of sourceLotes) {
    if (!item) continue;
    const rel = item.relacion || item;
    const loteData = item.lote || (item.relacion ? undefined : item);

    const idLote =
      loteData?.['ID Lote'] ||
      loteData?.idLote ||
      rel?.['ID Lote'] ||
      rel?.idLote ||
      item['ID Lote'] ||
      item.idLote ||
      '';

    const numeroLote =
      loteData?.['N.º de Lote'] ||
      loteData?.numeroLote ||
      rel?.['N.º de Lote'] ||
      rel?.numeroLote ||
      item['N.º de Lote'] ||
      item.numeroLote ||
      '';

    // Hectáreas guardadas en garantia_lotes para esta relación
    const haFromRel = extraerHectareasRelacion(rel) ?? (rel !== item ? extraerHectareasRelacion(item) : null);
    let haParsed = 0;
    let haIndeterminada = false;

    if (haFromRel !== null && haFromRel > 0) {
      haParsed = haFromRel;
    } else {
      haParsed = 0;
      haIndeterminada = true;
    }

    const haTotales =
      typeof loteData?.['Hectáreas'] === 'number'
        ? loteData['Hectáreas']
        : loteData?.['Hectáreas'] !== undefined
        ? parseDecimal(loteData['Hectáreas'])
        : typeof loteData?.hectareas === 'number'
        ? loteData.hectareas
        : undefined;

    const prop =
      loteData?.['Propietario'] ||
      loteData?.propietario ||
      rel?.['Propietario'] ||
      rel?.propietario ||
      item.propietario ||
      '';

    const ctaProp =
      loteData?.['Cuenta Propietario'] ??
      loteData?.cuentaPropietario ??
      rel?.['Cuenta Propietario'] ??
      rel?.cuentaPropietario ??
      item.cuentaPropietario ??
      '';

    lotesRelacionados.push({
      idGarantia: rel?.['ID Garantía'] || rel?.idGarantia || base.idGarantia,
      idLote,
      numeroLote,
      hectareas: haParsed,
      hectareasTotales: haTotales,
      propietario: prop,
      cuentaPropietario: ctaProp,
      ubicacion:
        loteData?.['Ubicación'] ||
        loteData?.ubicacion ||
        rel?.['Ubicación'] ||
        rel?.ubicacion ||
        '',
      encargado: loteData?.['Encargado'] || loteData?.encargado || '',
      garantiaConTipo: rel?.['Garantía con Tipo'] || rel?.garantiaConTipo || base.garantiaConTipo,
      garantiaConCuenta: rel?.['Garantía con Cuenta'] ?? rel?.garantiaConCuenta ?? base.garantiaConCuenta,
      garantiaConNombre: rel?.['Garantía con Nombre'] || rel?.garantiaConNombre || base.garantiaConNombre,
    });
  }

  // Mapear relaciones de bienes históricos si existen
  const bienesRelacionados: GarantiaBienRelacion[] = [];
  const sourceBienes = Array.isArray(res.bienes)
    ? res.bienes
    : Array.isArray(rawG.bienes)
    ? rawG.bienes
    : [];

  for (const item of sourceBienes) {
    if (!item) continue;
    const rel = item.relacion || item;
    const bienData = item.bien || (item.relacion ? undefined : item);

    const idBien =
      bienData?.['ID Bien'] ||
      bienData?.idBien ||
      rel?.['ID Bien'] ||
      rel?.idBien ||
      item['ID Bien'] ||
      item.idBien ||
      '';

    const numeroPoliza =
      bienData?.['N.º Póliza'] ||
      bienData?.numeroPoliza ||
      rel?.['N.º Póliza'] ||
      rel?.numeroPoliza ||
      item['N.º Póliza'] ||
      item.numeroPoliza ||
      '';

    const tipoBien =
      bienData?.['Tipo de Bien'] ||
      bienData?.tipoBien ||
      rel?.['Tipo de Bien'] ||
      rel?.tipoBien ||
      item['Tipo de Bien'] ||
      item.tipoBien ||
      '';

    const descripcion =
      bienData?.['Descripción'] ||
      bienData?.descripcion ||
      rel?.['Descripción'] ||
      rel?.descripcion ||
      '';
    const marca = bienData?.['Marca'] || bienData?.marca || rel?.['Marca'] || rel?.marca || '';
    const modelo = bienData?.['Modelo'] || bienData?.modelo || rel?.['Modelo'] || rel?.modelo || '';
    const placa = bienData?.['Placa'] || bienData?.placa || rel?.['Placa'] || rel?.placa || '';

    const valUSD =
      typeof rel?.['Valor en Garantía ($us.)'] === 'number'
        ? rel['Valor en Garantía ($us.)']
        : typeof rel?.valorGarantiaUSD === 'number'
        ? rel.valorGarantiaUSD
        : typeof rel?.valorEnGarantia === 'number'
        ? rel.valorEnGarantia
        : typeof bienData?.['Valor en Garantía ($us.)'] === 'number'
        ? bienData['Valor en Garantía ($us.)']
        : Number(
            rel?.['Valor en Garantía ($us.)'] ||
              rel?.valorGarantiaUSD ||
              rel?.valorEnGarantia ||
              bienData?.['Valor en Garantía ($us.)'] ||
              0
          ) || 0;

    const prop =
      bienData?.['Propietario'] ||
      bienData?.propietario ||
      rel?.['Propietario'] ||
      rel?.propietario ||
      item.propietario ||
      '';

    const ctaProp =
      bienData?.['Cuenta Propietario'] ??
      bienData?.cuentaPropietario ??
      rel?.['Cuenta Propietario'] ??
      rel?.cuentaPropietario ??
      item.cuentaPropietario ??
      '';

    bienesRelacionados.push({
      idGarantia: rel?.['ID Garantía'] || rel?.idGarantia || base.idGarantia,
      idBien,
      numeroPoliza,
      tipoBien,
      descripcion,
      marca,
      modelo,
      placa,
      propietario: prop,
      cuentaPropietario: ctaProp,
      ubicacion:
        bienData?.['Ubicación'] ||
        bienData?.ubicacion ||
        rel?.['Ubicación'] ||
        rel?.ubicacion ||
        '',
      valorGarantiaUSD: valUSD,
      garantiaConTipo: rel?.['Garantía con Tipo'] || rel?.garantiaConTipo || base.garantiaConTipo,
      garantiaConCuenta: rel?.['Garantía con Cuenta'] ?? rel?.garantiaConCuenta ?? base.garantiaConCuenta,
      garantiaConNombre: rel?.['Garantía con Nombre'] || rel?.garantiaConNombre || base.garantiaConNombre,
    });
  }

  base.lotes = lotesRelacionados;
  base.bienes = bienesRelacionados;
  base.cantidadLotes = lotesRelacionados.length;
  base.cantidadBienes = bienesRelacionados.length;

  setToMemoryCache('garantias-liberadas', base, cacheKey);
  return base;
}

// Aliases para retrocompatibilidad
export const getGarantias = listarGarantias;
export const getGarantiaById = obtenerGarantiaCompleta;
export const getGarantiasLiberadas = listarGarantiasLiberadas;
export const getGarantiaLiberadaById = obtenerGarantiaLiberadaCompleta;
export const saveGarantia = async (garantia: Partial<Garantia>, isEdit: boolean) =>
  isEdit ? editarGarantia(garantia) : crearGarantia(garantia);
export const deleteGarantia = eliminarGarantia;

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
    const res = await callAppsScript<{
      institucion?: string;
      diasAlertaPendientes?: number | string;
    }>('obtenerConfiguracionPublica', {});

    const rawDias = res?.diasAlertaPendientes;
    const parsedDias =
      typeof rawDias === 'number' && !isNaN(rawDias) && rawDias > 0
        ? Math.floor(rawDias)
        : rawDias !== undefined && rawDias !== null && !isNaN(Number(rawDias)) && Number(rawDias) > 0
        ? Math.floor(Number(rawDias))
        : 30;

    if (res && res.institucion) {
      inMemorySession.institucion = res.institucion;
    }

    const cfg: ConfiguracionSistema = {
      nombreInstitucion: res?.institucion || inMemorySession.institucion,
      diasAlertaPendientes: parsedDias,
    };
    setToMemoryCache('configuracion', cfg);
    return cfg;
  } catch {
    return {
      nombreInstitucion: inMemorySession.institucion,
      diasAlertaPendientes: 30,
    };
  }
}

export async function updateConfiguracion(params: {
  contrasenaActual?: string;
  nuevaContrasena?: string;
  nombreInstitucion?: string;
  diasAlertaPendientes?: number;
}): Promise<void> {
  const datos: Record<string, any> = {};
  if (params.nombreInstitucion) {
    datos.institucion = params.nombreInstitucion.trim();
  }
  if (params.nuevaContrasena) {
    datos.password = params.nuevaContrasena.trim();
  }
  if (params.diasAlertaPendientes !== undefined) {
    const dias = Math.floor(Number(params.diasAlertaPendientes));
    if (isNaN(dias) || dias < 1) {
      throw new Error('Los días de alerta para garantías pendientes deben ser un número mayor o igual a 1.');
    }
    datos.diasAlertaPendientes = dias;
  }

  await callAppsScript('guardarConfiguracion', datos);
  if (params.nombreInstitucion) {
    inMemorySession.institucion = params.nombreInstitucion.trim();
  }
  invalidateMemoryCache(['configuracion', 'garantias-pendientes']);
}
