import LZString from 'lz-string';
import type { CaseEntry, ExpenseEntry, CaseHistoryEntry } from './types';

const DB_NAME = 'lawtrack_db';
const DB_VERSION = 2;
const CASES_STORE = 'cases';
const EXPENSES_STORE = 'expenses';
const META_STORE = 'meta';
const META_KEY_SYNC = 'last_sync';
const META_KEY_LAWYERS = 'lawyer_names';

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        dbInstance = req.result;
        resolve(req.result);
      };
      req.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CASES_STORE)) {
          const cs = db.createObjectStore(CASES_STORE, { keyPath: 'caseId' });
          cs.createIndex('lawyerName', 'lawyerName', { unique: false });
          cs.createIndex('nextDate', 'nextDate', { unique: false });
          cs.createIndex('pendingFee', 'pendingFee', { unique: false });
          cs.createIndex('updatedAt', 'updatedAt', { unique: false });
          cs.createIndex('partyName', 'partyName', { unique: false });
          cs.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(EXPENSES_STORE)) {
          const es = db.createObjectStore(EXPENSES_STORE, { keyPath: 'id' });
          es.createIndex('lawyerName', 'lawyerName', { unique: false });
          es.createIndex('date', 'date', { unique: false });
          es.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'key' });
        }
      };
    } catch (e) {
      reject(e);
    }
  });

  return dbInitPromise;
}

function safeCompress(data: string): string {
  try { return LZString.compressToUTF16(data); } catch { return data; }
}

function safeDecompress(data: string): string {
  try { return LZString.decompressFromUTF16(data) ?? data; } catch { return data; }
}

// ============ CASES ============

export async function loadCases(): Promise<CaseEntry[]> {
  try {
    if (typeof window === 'undefined') return [];
    const db = await openDB();
    const tx = db.transaction(CASES_STORE, 'readonly');
    const store = tx.objectStore(CASES_STORE);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const raw = req.result;
        if (!Array.isArray(raw)) { resolve([]); return; }
        // Decompress history for each case
        const cases: CaseEntry[] = [];
        for (let i = 0; i < raw.length; i++) {
          try {
            const c = raw[i];
            let history = c.history;
            if (typeof history === 'string') {
              history = JSON.parse(safeDecompress(history));
            }
            if (!Array.isArray(history)) history = [];
            cases.push({ ...c, history });
          } catch { /* skip corrupted */ }
        }
        resolve(cases);
      };
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

export async function saveCases(cases: CaseEntry[]): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openDB();
    const tx = db.transaction(CASES_STORE, 'readwrite');
    const store = tx.objectStore(CASES_STORE);

    // Clear and rewrite in batches of 200
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    const BATCH = 200;
    for (let i = 0; i < cases.length; i += BATCH) {
      const batch = cases.slice(i, i + BATCH);
      await new Promise<void>((resolve, reject) => {
        const tx2 = db.transaction(CASES_STORE, 'readwrite');
        const store2 = tx2.objectStore(CASES_STORE);
        for (let j = 0; j < batch.length; j++) {
          const c = batch[j];
          const historyStr = safeCompress(JSON.stringify(c.history || []));
          const toStore = { ...c, history: historyStr };
          store2.put(toStore);
        }
        tx2.oncomplete = () => resolve();
        tx2.onerror = () => reject(tx2.error);
      });
    }

    // Update lawyer names cache
    const lawyerSet = new Set<string>();
    for (let i = 0; i < cases.length; i++) {
      if (cases[i].lawyerName) lawyerSet.add(cases[i].lawyerName);
    }
    await setMeta(META_KEY_LAWYERS, JSON.stringify([...lawyerSet]));

    return true;
  } catch { return false; }
}

export async function upsertCase(c: CaseEntry): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openDB();
    const historyStr = safeCompress(JSON.stringify(c.history || []));
    const toStore = { ...c, history: historyStr };
    return new Promise((resolve) => {
      const tx = db.transaction(CASES_STORE, 'readwrite');
      const store = tx.objectStore(CASES_STORE);
      store.put(toStore);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

export async function deleteCaseFromDB(caseId: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(CASES_STORE, 'readwrite');
      const store = tx.objectStore(CASES_STORE);
      store.delete(caseId);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

// ============ EXPENSES ============

export async function loadExpenses(): Promise<ExpenseEntry[]> {
  try {
    if (typeof window === 'undefined') return [];
    const db = await openDB();
    const tx = db.transaction(EXPENSES_STORE, 'readonly');
    const store = tx.objectStore(EXPENSES_STORE);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => {
        resolve(Array.isArray(req.result) ? req.result : []);
      };
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

export async function saveExpenses(expenses: ExpenseEntry[]): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openDB();
    const tx = db.transaction(EXPENSES_STORE, 'readwrite');
    const store = tx.objectStore(EXPENSES_STORE);

    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    const BATCH = 200;
    for (let i = 0; i < expenses.length; i += BATCH) {
      const batch = expenses.slice(i, i + BATCH);
      await new Promise<void>((resolve, reject) => {
        const tx2 = db.transaction(EXPENSES_STORE, 'readwrite');
        const store2 = tx2.objectStore(EXPENSES_STORE);
        for (let j = 0; j < batch.length; j++) {
          store2.put(batch[j]);
        }
        tx2.oncomplete = () => resolve();
        tx2.onerror = () => reject(tx2.error);
      });
    }
    return true;
  } catch { return false; }
}

export async function addExpenseToDB(e: ExpenseEntry): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(EXPENSES_STORE, 'readwrite');
      const store = tx.objectStore(EXPENSES_STORE);
      store.put(e);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

// ============ META ============

async function setMeta(key: string, value: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      store.put({ key, value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

async function getMeta(key: string): Promise<string> {
  try {
    if (typeof window === 'undefined') return '';
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const store = tx.objectStore(META_STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value ?? '');
      req.onerror = () => resolve('');
    });
  } catch { return ''; }
}

// ============ SYNC TIME ============

export async function getLastSyncTime(): Promise<number> {
  try {
    const val = await getMeta(META_KEY_SYNC);
    return val ? parseInt(val, 10) : 0;
  } catch { return 0; }
}

export async function setLastSyncTime(ts: number): Promise<boolean> {
  return setMeta(META_KEY_SYNC, String(ts));
}

// ============ LAWYER NAMES CACHE ============

export async function getLawyerNames(): Promise<string[]> {
  try {
    const val = await getMeta(META_KEY_LAWYERS);
    if (!val) return [];
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ============ HISTORY ============

export function createHistoryEntry(
  type: CaseHistoryEntry['type'],
  data: { description: string; amount?: number; remark?: string; newNextDate?: string }
): CaseHistoryEntry {
  return {
    id: crypto.randomUUID?.() ?? String(Date.now()) + String(Math.random()).slice(2, 8),
    type,
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now(),
    description: data.description,
    amount: data.amount,
    remark: data.remark,
    newNextDate: data.newNextDate,
  };
}

// ============ MIGRATION ============

export async function migrateFromLocalStorage(): Promise<{ cases: number; expenses: number }> {
  try {
    if (typeof window === 'undefined') return { cases: 0, expenses: 0 };
    const oldCases = localStorage.getItem('lw_cases');
    const oldExpenses = localStorage.getItem('lw_expenses');

    if (!oldCases && !oldExpenses) return { cases: 0, expenses: 0 };

    let caseCount = 0;
    let expenseCount = 0;

    if (oldCases) {
      try {
        const json = safeDecompress(oldCases);
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const db = await openDB();
          const BATCH = 200;
          for (let i = 0; i < parsed.length; i += BATCH) {
            const batch = parsed.slice(i, i + BATCH);
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(CASES_STORE, 'readwrite');
              const store = tx.objectStore(CASES_STORE);
              for (let j = 0; j < batch.length; j++) {
                const c = batch[j];
                const historyStr = safeCompress(JSON.stringify(c.history || []));
                store.put({ ...c, history: historyStr });
              }
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
          }
          caseCount = parsed.length;
          localStorage.removeItem('lw_cases');
        }
      } catch { /* migration failed for cases */ }
    }

    if (oldExpenses) {
      try {
        const json = safeDecompress(oldExpenses);
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const db = await openDB();
          const BATCH = 200;
          for (let i = 0; i < parsed.length; i += BATCH) {
            const batch = parsed.slice(i, i + BATCH);
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(EXPENSES_STORE, 'readwrite');
              const store = tx.objectStore(EXPENSES_STORE);
              for (let j = 0; j < batch.length; j++) {
                store.put(batch[j]);
              }
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
          }
          expenseCount = parsed.length;
          localStorage.removeItem('lw_expenses');
        }
      } catch { /* migration failed for expenses */ }
    }

    return { cases: caseCount, expenses: expenseCount };
  } catch { return { cases: 0, expenses: 0 }; }
}