import LZString from 'lz-string';
import type { CaseEntry, ExpenseEntry, CaseHistoryEntry } from './types';
import { encryptData, decryptData } from './auth';

const DB_NAME = 'lawtrack_db';
const DB_VERSION = 3;
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
          es.createIndex('category', 'category', { unique: false });
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

// ============ Encryption Helpers ============

async function encryptCase(c: CaseEntry): Promise<{ caseId: string; _d: string }> {
  const historyStr = safeCompress(JSON.stringify(c.history || []));
  const dataToEncrypt = JSON.stringify({
    lawyerName: c.lawyerName,
    partyName: c.partyName,
    opponentName: c.opponentName,
    caseType: c.caseType,
    section: c.section,
    policeStation: c.policeStation,
    enteringDate: c.enteringDate,
    nextDate: c.nextDate,
    phone: c.phone,
    judgeRemarks: c.judgeRemarks,
    pendingFee: c.pendingFee,
    totalFeeReceived: c.totalFeeReceived,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    history: historyStr,
  });
  const encrypted = await encryptData(dataToEncrypt);
  return { caseId: c.caseId, _d: encrypted };
}

async function decryptCase(record: { caseId: string; _d?: string; [key: string]: unknown }): Promise<CaseEntry | null> {
  try {
    if (record._d) {
      // Encrypted format
      const decrypted = await decryptData(record._d);
      const data = JSON.parse(decrypted);
      let history = data.history;
      if (typeof history === 'string') {
        history = JSON.parse(safeDecompress(history));
      }
      if (!Array.isArray(history)) history = [];
      return {
        caseId: record.caseId,
        lawyerName: data.lawyerName || '',
        partyName: data.partyName || '',
        opponentName: data.opponentName || '',
        caseType: data.caseType || '',
        section: data.section || '',
        policeStation: data.policeStation || '',
        enteringDate: data.enteringDate || '',
        nextDate: data.nextDate || '',
        phone: data.phone || '',
        judgeRemarks: data.judgeRemarks || '',
        pendingFee: data.pendingFee || 0,
        totalFeeReceived: data.totalFeeReceived || 0,
        createdAt: data.createdAt || 0,
        updatedAt: data.updatedAt || 0,
        history,
      };
    } else {
      // Legacy unencrypted format - migrate on read
      const c = record as Record<string, unknown>;
      let history = c.history;
      if (typeof history === 'string') {
        history = JSON.parse(safeDecompress(history));
      }
      if (!Array.isArray(history)) history = [];
      return {
        caseId: c.caseId as string,
        lawyerName: (c.lawyerName as string) || '',
        partyName: (c.partyName as string) || '',
        opponentName: (c.opponentName as string) || '',
        caseType: (c.caseType as string) || '',
        section: (c.section as string) || '',
        policeStation: (c.policeStation as string) || '',
        enteringDate: (c.enteringDate as string) || '',
        nextDate: (c.nextDate as string) || '',
        phone: (c.phone as string) || '',
        judgeRemarks: (c.judgeRemarks as string) || '',
        pendingFee: (c.pendingFee as number) || 0,
        totalFeeReceived: (c.totalFeeReceived as number) || 0,
        createdAt: (c.createdAt as number) || 0,
        updatedAt: (c.updatedAt as number) || 0,
        history,
      };
    }
  } catch {
    return null;
  }
}

async function encryptExpense(e: ExpenseEntry): Promise<{ id: string; _d: string }> {
  const dataToEncrypt = JSON.stringify({
    caseId: e.caseId,
    lawyerName: e.lawyerName,
    partyName: e.partyName,
    description: e.description,
    amount: e.amount,
    date: e.date,
    createdAt: e.createdAt,
    category: e.category,
  });
  const encrypted = await encryptData(dataToEncrypt);
  return { id: e.id, _d: encrypted };
}

async function decryptExpense(record: { id: string; _d?: string; [key: string]: unknown }): Promise<ExpenseEntry | null> {
  try {
    if (record._d) {
      const decrypted = await decryptData(record._d);
      const data = JSON.parse(decrypted);
      return {
        id: record.id,
        caseId: data.caseId || '',
        lawyerName: data.lawyerName || '',
        partyName: data.partyName || '',
        description: data.description || '',
        amount: data.amount || 0,
        date: data.date || '',
        createdAt: data.createdAt || 0,
        category: data.category || 'case_expense',
      };
    } else {
      // Legacy unencrypted format
      const e = record as Record<string, unknown>;
      return {
        id: e.id as string,
        caseId: (e.caseId as string) || '',
        lawyerName: (e.lawyerName as string) || '',
        partyName: (e.partyName as string) || '',
        description: (e.description as string) || '',
        amount: (e.amount as number) || 0,
        date: (e.date as string) || '',
        createdAt: (e.createdAt as number) || 0,
        category: (e.category as string) || (e.caseId === 'CHAMBER' ? 'chamber_expense' : 'case_expense'),
      };
    }
  } catch {
    return null;
  }
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
      req.onsuccess = async () => {
        try {
          const raw = req.result;
          if (!Array.isArray(raw)) { resolve([]); return; }

          const cases: CaseEntry[] = [];
          for (let i = 0; i < raw.length; i++) {
            const c = await decryptCase(raw[i]);
            if (c) cases.push(c);
          }
          resolve(cases);
        } catch {
          resolve([]);
        }
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

    // Clear existing data
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    // Encrypt and save in batches
    const BATCH = 200;
    for (let i = 0; i < cases.length; i += BATCH) {
      const batch = cases.slice(i, i + BATCH);
      const encrypted = await Promise.all(batch.map(encryptCase));
      await new Promise<void>((resolve, reject) => {
        const tx2 = db.transaction(CASES_STORE, 'readwrite');
        const store2 = tx2.objectStore(CASES_STORE);
        for (let j = 0; j < encrypted.length; j++) {
          store2.put(encrypted[j]);
        }
        tx2.oncomplete = () => resolve();
        tx2.onerror = () => reject(tx2.error);
      });
    }

    // Update lawyer names cache (encrypted)
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
    const encrypted = await encryptCase(c);
    return new Promise((resolve) => {
      const tx = db.transaction(CASES_STORE, 'readwrite');
      const store = tx.objectStore(CASES_STORE);
      store.put(encrypted);
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
      req.onsuccess = async () => {
        try {
          const raw = Array.isArray(req.result) ? req.result : [];
          const expenses: ExpenseEntry[] = [];
          for (let i = 0; i < raw.length; i++) {
            const e = await decryptExpense(raw[i]);
            if (e) expenses.push(e);
          }
          resolve(expenses);
        } catch {
          resolve([]);
        }
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
      const encrypted = await Promise.all(batch.map(encryptExpense));
      await new Promise<void>((resolve, reject) => {
        const tx2 = db.transaction(EXPENSES_STORE, 'readwrite');
        const store2 = tx2.objectStore(EXPENSES_STORE);
        for (let j = 0; j < encrypted.length; j++) {
          store2.put(encrypted[j]);
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
    const encrypted = await encryptExpense(e);
    return new Promise((resolve) => {
      const tx = db.transaction(EXPENSES_STORE, 'readwrite');
      const store = tx.objectStore(EXPENSES_STORE);
      store.put(encrypted);
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
          const BATCH = 200;
          for (let i = 0; i < parsed.length; i += BATCH) {
            const batch = parsed.slice(i, i + BATCH);
            const encrypted = await Promise.all(batch.map((c: CaseEntry) => encryptCase(c)));
            const db = await openDB();
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(CASES_STORE, 'readwrite');
              const store = tx.objectStore(CASES_STORE);
              for (let j = 0; j < encrypted.length; j++) {
                store.put(encrypted[j]);
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
          const BATCH = 200;
          for (let i = 0; i < parsed.length; i += BATCH) {
            const batch = parsed.slice(i, i + BATCH);
            const encrypted = await Promise.all(batch.map((e: ExpenseEntry) => encryptExpense(e)));
            const db = await openDB();
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(EXPENSES_STORE, 'readwrite');
              const store = tx.objectStore(EXPENSES_STORE);
              for (let j = 0; j < encrypted.length; j++) {
                store.put(encrypted[j]);
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