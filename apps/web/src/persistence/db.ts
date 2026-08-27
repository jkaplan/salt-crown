/**
 * A minimal IndexedDB key-value wrapper — the one piece of persistence in
 * the whole app, everything else lives and dies with a run. IndexedDB
 * rather than localStorage: real object storage instead of one string blob,
 * no ~5-10MB ceiling, and it's the natural home for what's coming next
 * (a growing list of run records) without a rewrite later. Still entirely
 * client-side — no server, no accounts, per-browser only. That's a real
 * limitation (a different device starts empty) accepted on purpose rather
 * than reaching for a backend nothing else in this app needs.
 *
 * Deliberately hand-rolled instead of a dependency: the whole surface is
 * "get a value, set a value", which is a few dozen lines either way.
 */
const DB_NAME = 'salt-crown'
const DB_VERSION = 1
const STORE = 'kv'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/**
 * Every call degrades to "nothing persisted" rather than throwing — private
 * browsing, blocked storage, or a browser with IndexedDB disabled should
 * make unlocks reset every session, not crash the app.
 */
export async function dbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return undefined
  }
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // Best-effort. Losing unlock persistence for one session isn't worth
    // surfacing an error over.
  }
}
