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
} from '../types';
import {
  getFromMemoryCache,
  setToMemoryCache,
  invalidateMemoryCache,
  clearAllMemoryCache,
  hasInMemoryCache,
} from './dataCache';

export {
  getFromMemoryCache,
  setToMemoryCache,
  invalidateMemoryCache,
  clearAllMemoryCache,
  hasInMemoryCache,
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
 * Cierre de sesión (limpia el estado en memoria)
 */
export function logout(): void {
  inMemorySession.isAuthenticated = false;
  clearAllMemoryCache();
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
  const res = await callAppsScript<any>('obtenerResumenDashboard', {});
  const stats: DashboardStats = {
    garantiasActivas: typeof res?.garantiasActivas === 'number' ? res.garantiasActivas : null,
    hectareasEnGarantia: typeof res?.hectareasEnGarantia === 'number' ? res.hectareasEnGarantia : null,
    hectareasDisponibles: typeof res?.hectareasDisponibles === 'number' ? res.hectareasDisponibles : null,
    bienesEnGarantia: typeof res?.bienesEnGarantia === 'number' ? res.bienesEnGarantia : null,
    valorBienesEnGarantiaUSD:
      typeof res?.valorBienesEnGarantiaUSD === 'number'
        ? res.valorBienesEnGarantiaUSD
        : typeof res?.valorBienesEnGarantia === 'number'
        ? res.valorBienesEnGarantia
        : null,
    garantiasExternas: typeof res?.garantiasExternas === 'number' ? res.garantiasExternas : null,
    lotesBloqueados: typeof res?.lotesBloqueados === 'number' ? res.lotesBloqueados : null,
    bienesBloqueados: typeof res?.bienesBloqueados === 'number' ? res.bienesBloqueados : null,
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

  const hectareasEnGarantia =
    typeof item?.['Hectáreas en Garantía'] === 'number'
      ? item['Hectáreas en Garantía']
      : typeof item?.hectareasEnGarantia === 'number'
      ? item.hectareasEnGarantia
      : enGarantiaCalculado
      ? hectareasTotales
      : 0;

  const hectareasDisponibles =
    typeof item?.['Hectáreas Disponibles'] === 'number'
      ? item['Hectáreas Disponibles']
      : typeof item?.hectareasDisponibles === 'number'
      ? item.hectareasDisponibles
      : Math.max(0, hectareasTotales - hectareasEnGarantia);

  return {
    idLote: item?.['ID Lote'] || item?.idLote || '',
    numeroLote: item?.['N.º de Lote'] || item?.numeroLote || '',
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
    enGarantia: enGarantiaCalculado || hectareasEnGarantia > 0,
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
  };
}

export function normalizarGarantia(item: any): Garantia {
  return {
    idGarantia: item?.['ID Garantía'] || item?.idGarantia || '',
    numeroSolicitud: String(item?.['N.º Solicitud'] ?? item?.numeroSolicitud ?? ''),
    fecha: item?.['Fecha'] || item?.fecha || '',
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

export async function buscarClientes(texto: string): Promise<Cliente[]> {
  if (!texto || !texto.trim()) return [];
  const res = await callAppsScript<any>('buscarClientes', { texto: texto.trim() });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  return rawItems.map(normalizarCliente);
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
  invalidateMemoryCache('clientes');
  return result;
}

export async function editarCliente(cliente: { cuenta: string | number; nombre: string; ci?: string }): Promise<any> {
  const result = await callAppsScript('editarCliente', {
    cuenta: cliente.cuenta,
    nombre: cliente.nombre ? cliente.nombre.trim() : '',
    ci: cliente.ci ? cliente.ci.trim() : '',
  });
  invalidateMemoryCache('clientes');
  return result;
}

export async function eliminarCliente(cuenta: string | number): Promise<any> {
  const result = await callAppsScript('eliminarCliente', { cuenta });
  invalidateMemoryCache('clientes');
  return result;
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
  }
  const res = await callAppsScript<any>('obtenerLotes', {});
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map(normalizarLote);
  setToMemoryCache('lotes', items, 'all');
  return items;
}

export async function buscarLotes(texto: string): Promise<Lote[]> {
  if (!texto || !texto.trim()) return [];
  const res = await callAppsScript<any>('buscarLotes', { texto: texto.trim() });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  return rawItems.map(normalizarLote);
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
  invalidateMemoryCache(['lotes', 'dashboard']);
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
  invalidateMemoryCache(['lotes', 'dashboard']);
  return result;
}

export async function eliminarLote(idLote: string): Promise<any> {
  const result = await callAppsScript('eliminarLote', { idLote });
  invalidateMemoryCache(['lotes', 'dashboard']);
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
  }
  const res = await callAppsScript<any>('obtenerBienes', {});
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map(normalizarBien);
  setToMemoryCache('bienes', items, 'all');
  return items;
}

export async function buscarBienes(texto: string): Promise<Bien[]> {
  if (!texto || !texto.trim()) return [];
  const res = await callAppsScript<any>('buscarBienes', { texto: texto.trim() });
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  return rawItems.map(normalizarBien);
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
  });
  invalidateMemoryCache(['bienes', 'dashboard']);
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
  });
  invalidateMemoryCache(['bienes', 'dashboard']);
  return result;
}

export async function eliminarBien(idBien: string): Promise<any> {
  const result = await callAppsScript('eliminarBien', { idBien });
  invalidateMemoryCache(['bienes', 'dashboard']);
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
  const res = await callAppsScript<any>('obtenerGarantias', {});
  const rawItems = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
  const items = rawItems.map(normalizarGarantia);
  setToMemoryCache('garantias', items, 'all');
  return items;
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
  const result = await callAppsScript('crearGarantia', {
    numeroSolicitud: garantia.numeroSolicitud,
    fecha: garantia.fecha,
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
    numeroSolicitud: garantia.numeroSolicitud,
    fecha: garantia.fecha,
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
