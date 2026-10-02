/**
 * CAPA CENTRALIZADA DE SERVICIOS PARA GOOGLE APPS SCRIPT & GOOGLE SHEETS
 * Registro de Garantía de Terrenos — Asoc. Civil "Colonia Chihuahua"
 *
 * REGLAS FUNDAMENTALES:
 * 1. Google Sheets es la ÚNICA fuente real de datos (hojas: configuracion, clientes, lotes, bienes, garantias, garantia_lotes, garantia_bienes).
 * 2. NO se usa localStorage ni IndexedDB como base de datos.
 * 3. NO se usan datos falsos ni simulaciones de guardado.
 * 4. Toda la comunicación futura pasará exclusivamente por este servicio.
 * 5. La URL de Google Apps Script se lee de VITE_GAS_URL.
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
} from '../types';

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
  constructor(message: string = 'Esta función requiere conexión con Google Apps Script.') {
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
}

/**
 * Función genérica para enviar peticiones HTTP a Google Apps Script
 * Maneja los errores de CORS, redirecciones típicas de Apps Script y estado de conexión
 */
async function callAppsScript<T>(action: string, payload: Record<string, any> = {}): Promise<T> {
  if (!GOOGLE_APPS_SCRIPT_URL) {
    throw new BackendConnectionError('No se ha configurado la URL de Google Apps Script en VITE_GAS_URL.');
  }

  try {
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Recomendado para evitar pre-flight CORS con GAS
      },
      body: JSON.stringify({
        action,
        ...payload,
      }),
    });

    if (!response.ok) {
      throw new BackendConnectionError(`Error HTTP del servidor Apps Script: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data && (data.success === false || data.ok === false)) {
      throw new Error(data.error || data.mensaje || data.message || 'No se pudo cargar la información.');
    }

    return data.resultado !== undefined ? data.resultado : (data.result !== undefined ? data.result : data);
  } catch (error: any) {
    if (error instanceof BackendConnectionError) {
      throw error;
    }
    console.warn(`[Backend GAS] Error en llamada "${action}":`, error);
    throw new BackendConnectionError('No se pudo conectar con Google Apps Script.');
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

  const endpoint = GOOGLE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzyX9dvWYVONQfd0EO9RpWCHtoi8_1Bk_EjNW5eVySyMv5AEBrXCEGE2YdH59V-ea2hbQ/exec';

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
      throw new BackendConnectionError('No se pudo conectar con Google Apps Script.');
    }

    const data = await response.json();

    // Verificación de la estructura devuelta por Apps Script
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
      message: 'Respuesta no reconocida de Google Apps Script.',
    };
  } catch (err: any) {
    if (err instanceof BackendConnectionError) {
      throw err;
    }
    console.error('[Backend GAS] Error en login:', err);
    throw new BackendConnectionError('No se pudo conectar con Google Apps Script.');
  }
}

/**
 * SERVICIOS DE DASHBOARD
 * Consulta métricas consolidadas reales desde Google Sheets
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    return await callAppsScript<DashboardStats>('getDashboardStats');
  } catch (err) {
    // Cuando aún no hay conexión, se devuelve null en cada campo para que el UI muestre "—"
    return {
      garantiasActivas: null,
      hectareasEnGarantia: null,
      hectareasDisponibles: null,
      bienesEnGarantia: null,
      garantiasExternas: null,
      lotesBloqueados: null,
      bienesBloqueados: null,
    };
  }
}

/**
 * SERVICIOS DE CLIENTES (Hoja: clientes)
 * Columnas: Cuenta, Nombre, CI
 */
export async function getClientes(params: QueryParams): Promise<PaginatedResponse<Cliente>> {
  try {
    const res = await callAppsScript<any>('getClientes', { params });
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return {
      data: list,
      total: typeof res?.total === 'number' ? res.total : list.length,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    };
  } catch (err) {
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: 1,
    };
  }
}

export async function searchClientes(query: string): Promise<Cliente[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await callAppsScript<any>('searchClientes', { query });
    return Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
  } catch (err) {
    return [];
  }
}

export async function saveCliente(cliente: Cliente, isEdit: boolean): Promise<Cliente> {
  return await callAppsScript<Cliente>(isEdit ? 'updateCliente' : 'createCliente', { cliente });
}

export async function deleteCliente(cuenta: string | number): Promise<void> {
  await callAppsScript<void>('deleteCliente', { cuenta });
}

/**
 * SERVICIOS DE LOTES (Hoja: lotes)
 * Columnas: ID Lote, N.º de Lote, Cuenta Propietario, Propietario, Cuenta Encargado,
 * Encargado, Hectáreas, Ubicación, Estado, Motivo Bloqueo, Fecha Bloqueo, Observación
 */
export async function getLotes(params: QueryParams): Promise<PaginatedResponse<Lote>> {
  try {
    const res = await callAppsScript<any>('getLotes', { params });
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return {
      data: list,
      total: typeof res?.total === 'number' ? res.total : list.length,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    };
  } catch (err) {
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: 1,
    };
  }
}

export async function saveLote(lote: Partial<Lote>, isEdit: boolean): Promise<Lote> {
  return await callAppsScript<Lote>(isEdit ? 'updateLote' : 'createLote', { lote });
}

export async function deleteLote(idLote: string): Promise<void> {
  await callAppsScript<void>('deleteLote', { idLote });
}

export async function setLoteBloqueo(
  idLote: string,
  bloqueado: boolean,
  motivo?: string,
  fecha?: string
): Promise<void> {
  await callAppsScript<void>('setLoteBloqueo', { idLote, bloqueado, motivo, fecha });
}

/**
 * SERVICIOS DE BIENES (Hoja: bienes)
 * Columnas: ID Bien, N.º Póliza, Cuenta Propietario, Propietario, Cuenta Encargado,
 * Encargado, Tipo de Bien, Descripción, Marca, Modelo, Placa, Ubicación,
 * Estado, Motivo Bloqueo, Fecha Bloqueo, Observación
 */
export async function getBienes(params: QueryParams): Promise<PaginatedResponse<Bien>> {
  try {
    const res = await callAppsScript<any>('getBienes', { params });
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return {
      data: list,
      total: typeof res?.total === 'number' ? res.total : list.length,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    };
  } catch (err) {
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: 1,
    };
  }
}

export async function saveBien(bien: Partial<Bien>, isEdit: boolean): Promise<Bien> {
  return await callAppsScript<Bien>(isEdit ? 'updateBien' : 'createBien', { bien });
}

export async function deleteBien(idBien: string): Promise<void> {
  await callAppsScript<void>('deleteBien', { idBien });
}

export async function setBienBloqueo(
  idBien: string,
  bloqueado: boolean,
  motivo?: string,
  fecha?: string
): Promise<void> {
  await callAppsScript<void>('setBienBloqueo', { idBien, bloqueado, motivo, fecha });
}

/**
 * SERVICIOS DE GARANTÍAS (Hojas: garantias, garantia_lotes, garantia_bienes)
 */
export async function getGarantias(params: QueryParams): Promise<PaginatedResponse<Garantia>> {
  try {
    const res = await callAppsScript<any>('getGarantias', { params });
    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
    return {
      data: list,
      total: typeof res?.total === 'number' ? res.total : list.length,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: typeof res?.totalPages === 'number' ? res.totalPages : 1,
    };
  } catch (err) {
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      pageSize: params.pageSize || 200,
      totalPages: 1,
    };
  }
}

export async function getGarantiaById(idGarantia: string): Promise<Garantia | null> {
  try {
    return await callAppsScript<Garantia>('getGarantiaById', { idGarantia });
  } catch (err) {
    return null;
  }
}

export async function getNextSolicitudNumber(): Promise<string> {
  try {
    const res = await callAppsScript<{ numeroSolicitud: string }>('getNextSolicitudNumber');
    return res.numeroSolicitud;
  } catch (err) {
    return '—';
  }
}

export async function saveGarantia(garantia: Partial<Garantia>, isEdit: boolean): Promise<Garantia> {
  return await callAppsScript<Garantia>(isEdit ? 'updateGarantia' : 'createGarantia', { garantia });
}

export async function liberarGarantia(idGarantia: string): Promise<void> {
  await callAppsScript<void>('liberarGarantia', { idGarantia });
}

/**
 * SERVICIOS DE REPORTES
 * Ejecutan agregaciones reales sobre la totalidad de los datos en Google Sheets
 */
export async function getReporte(
  tipoReporte: string,
  filtros?: Record<string, any>
): Promise<{
  titulo: string;
  columnas: string[];
  filas: (string | number)[][];
  resumen?: Record<string, string | number>;
}> {
  return await callAppsScript('getReporte', { tipoReporte, filtros });
}

/**
 * SERVICIOS DE CONFIGURACIÓN (Hoja: configuracion)
 * Parámetros admitidos: Contraseña, Nombre de la institución
 */
export async function getConfiguracion(): Promise<ConfiguracionSistema> {
  try {
    return await callAppsScript<ConfiguracionSistema>('getConfiguracion');
  } catch (err) {
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
  await callAppsScript<void>('updateConfiguracion', params);
}
