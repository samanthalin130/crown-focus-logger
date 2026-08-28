/**
 * Where your sessions live: IndexedDB, in this browser, on this device.
 *
 * There is no server behind any of this. Nothing in this file makes a network
 * request. If you clear your browser data, your sessions go with it, which is
 * exactly why the app pushes you to export a copy.
 *
 * If IndexedDB is unavailable (private windows, locked-down settings) the
 * store falls back to memory for the session and reports that it did, so the
 * UI can warn instead of silently losing work.
 */

const DB_NAME = "crown-focus-logger";
const DB_VERSION = 1;
const STORE = "sessions";

let dbPromise = null;
let memoryFallback = null;

export const storeState = { persistent: true, reason: "" };

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not offer IndexedDB."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB refused to open."));
    req.onblocked = () => reject(new Error("Another tab is holding the database open."));
  }).catch((err) => {
    storeState.persistent = false;
    storeState.reason = err.message;
    memoryFallback = new Map();
    return null;
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("The write was aborted."));
  });
}

/** Make sure the database is reachable. Resolves either way; check storeState. */
export async function init() {
  await openDb();
  return storeState;
}

export async function listSessions() {
  const db = await openDb();
  if (!db) return [...memoryFallback.values()].sort((a, b) => b.createdMs - a.createdMs);
  const all = await tx(db, "readonly", (s) => s.getAll());
  return (all || []).sort((a, b) => b.createdMs - a.createdMs);
}

export async function getSession(id) {
  const db = await openDb();
  if (!db) return memoryFallback.get(id) || null;
  return (await tx(db, "readonly", (s) => s.get(id))) || null;
}

export async function putSession(session) {
  const db = await openDb();
  if (!db) {
    memoryFallback.set(session.id, session);
    return session;
  }
  await tx(db, "readwrite", (s) => s.put(session));
  return session;
}

export async function deleteSession(id) {
  const db = await openDb();
  if (!db) {
    memoryFallback.delete(id);
    return;
  }
  await tx(db, "readwrite", (s) => s.delete(id));
}

export async function deleteAll() {
  const db = await openDb();
  if (!db) {
    memoryFallback.clear();
    return;
  }
  await tx(db, "readwrite", (s) => s.clear());
}

/** Rough size of everything stored, for the "what you are holding" line. */
export async function approximateBytes() {
  const sessions = await listSessions();
  return sessions.reduce((n, s) => n + JSON.stringify(s).length, 0);
}

let counter = 0;
export function newId() {
  counter += 1;
  return `s-${Date.now().toString(36)}-${counter.toString(36)}`;
}
