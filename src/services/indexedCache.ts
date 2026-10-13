/**
 * CACHÉ PERSISTENTE TEMPORAL EN INDEXEDDB
 * Registro de Garantía de Terrenos — Asoc. Civil "Colonia Chihuahua"
 *
 * REGLAS:
 * 1. Google Sheets es la ÚNICA fuente de verdad.
 * 2. IndexedDB es exclusivamente para caché temporal en el dispositivo del usuario autorizado.
 * 3. NO almacena contraseñas, tokens ni datos sensibles.
 * 4. Se limpia automáticamente al cerrar sesión.
 */

const DB_NAME = 'colonia_chihuahua_garantias_db';
const STORE_NAME = 'cache_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        request.onsuccess = (event: Event) => {
          resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }

  return dbPromise;
}

export async function getIndexedCache<T>(key: string): Promise<T | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data !== undefined) {
            resolve(result.data as T);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function setIndexedCache<T>(key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put({ data, timestamp: new Date().toISOString() }, key);

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          resolve();
        };
      } catch {
        resolve();
      }
    });
  } catch {
    // Fallback silencioso
  }
}

export async function clearIndexedCache(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.clear();

        transaction.oncomplete = () => {
          resolve();
        };

        transaction.onerror = () => {
          resolve();
        };
      } catch {
        resolve();
      }
    });
  } catch {
    // Fallback silencioso
  }
}
