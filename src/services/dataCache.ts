/**
 * CACHÉ TEMPORAL EXCLUSIVAMENTE EN MEMORIA RAM (JavaScript / React)
 * Registro de Garantía de Terrenos — Asoc. Civil "Colonia Chihuahua"
 *
 * REGLAS FUNDAMENTALES Y OBLIGATORIAS:
 * 1. Google Sheets sigue siendo la ÚNICA base de datos y fuente real de verdad.
 * 2. Google Apps Script sigue siendo el backend.
 * 3. NO se usa localStorage ni sessionStorage como base de datos.
 * 4. NO se usa IndexedDB.
 * 5. La caché es estrictamente temporal y vive en memoria RAM mientras dure la sesión.
 * 6. La navegación entre módulos es instantánea una vez que los datos fueron consultados o precargados.
 * 7. Deduplica peticiones idénticas en vuelo (in-flight) para evitar consultas duplicadas al backend.
 */

// Almacén principal en memoria RAM volátil (desaparece al cerrar la pestaña o recargar)
const memoryCache = new Map<string, any>();

// Promesas en vuelo para deduplicar peticiones idénticas concurrentes al backend
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Deduplica peticiones idénticas en curso (evita duplicados por clics rápidos o renderizados simultáneos)
 */
export async function fetchWithDeduplication<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  const promise = (async () => {
    try {
      return await fetcher();
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Comprueba si una petición con la clave dada está en curso
 */
export function isRequestInFlight(key: string): boolean {
  return inFlightRequests.has(key);
}

/**
 * Obtiene la promesa en vuelo si existe
 */
export function getInFlightRequest<T>(key: string): Promise<T> | undefined {
  return inFlightRequests.get(key) as Promise<T> | undefined;
}

/**
 * Genera una clave única normalizada para almacenar resultados de consultas
 */
export function getCacheKey(namespace: string, params?: Record<string, any> | string): string {
  if (!params) return namespace;
  if (typeof params === 'string') return `${namespace}:${params}`;
  try {
    const sortedKey = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return `${namespace}:${sortedKey}`;
  } catch {
    return `${namespace}:${String(params)}`;
  }
}

/**
 * Obtiene un valor desde la caché en memoria RAM
 */
export function getFromMemoryCache<T>(namespace: string, params?: Record<string, any> | string): T | null {
  const key = getCacheKey(namespace, params);
  if (memoryCache.has(key)) {
    return memoryCache.get(key) as T;
  }
  return null;
}

/**
 * Guarda un valor en la caché en memoria RAM
 */
export function setToMemoryCache<T>(namespace: string, data: T, params?: Record<string, any> | string): void {
  const key = getCacheKey(namespace, params);
  memoryCache.set(key, data);
}

/**
 * Elimina una clave puntual o un subelemento de la caché en memoria RAM
 */
export function deleteFromMemoryCache(namespace: string, params?: Record<string, any> | string): void {
  const key = getCacheKey(namespace, params);
  memoryCache.delete(key);
}

/**
 * Comprueba si existe un valor en la caché en memoria RAM
 */
export function hasInMemoryCache(namespace: string, params?: Record<string, any> | string): boolean {
  const key = getCacheKey(namespace, params);
  return memoryCache.has(key);
}

/**
 * Invalida selectivamente un módulo o grupo de módulos
 * Se llama cuando se crean, editan o eliminan registros en Google Sheets
 */
export function invalidateMemoryCache(namespaces: string | string[]): void {
  const list = Array.isArray(namespaces) ? [...namespaces] : [namespaces];
  if (list.includes('dashboard') && !list.includes('estadisticas_panel')) {
    list.push('estadisticas_panel');
  }
  for (const ns of list) {
    const prefix = `${ns}`;
    for (const key of Array.from(memoryCache.keys())) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        memoryCache.delete(key);
      }
    }
  }
}

/**
 * Limpia toda la memoria RAM (al cerrar sesión)
 */
export function clearAllMemoryCache(): void {
  memoryCache.clear();
  inFlightRequests.clear();
}

/**
 * Busca si ya existen elementos en caché para un módulo determinado
 * (reutiliza lotes, bienes, clientes o garantías ya cargados en cualquier consulta previa)
 */
export function findAnyCachedData<T>(namespace: string): T[] | null {
  // Primero revisar clave directa 'all'
  const allKey = `${namespace}:all`;
  if (memoryCache.has(allKey)) {
    const val = memoryCache.get(allKey);
    if (Array.isArray(val) && val.length > 0) return val as T[];
  }

  // Buscar en cualquier clave del namespace que contenga registros
  for (const [key, value] of memoryCache.entries()) {
    if (key === namespace || key.startsWith(`${namespace}:`)) {
      if (Array.isArray(value) && value.length > 0) {
        return value as T[];
      }
      if (value && typeof value === 'object' && Array.isArray((value as any).data) && (value as any).data.length > 0) {
        return (value as any).data as T[];
      }
    }
  }

  return null;
}
