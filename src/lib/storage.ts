import LZString from 'lz-string';
import type { CaseEntry, ExpenseEntry, CaseHistoryEntry } from './types';

const CASES_KEY = 'lw_cases';
const EXPENSES_KEY = 'lw_expenses';
const SYNC_KEY = 'lw_last_sync';

function safeCompress(data: string): string {
  try {
    return LZString.compressToUTF16(data);
  } catch {
    return data;
  }
}

function safeDecompress(data: string): string {
  try {
    const result = LZString.decompressFromUTF16(data);
    return result ?? data;
  } catch {
    return data;
  }
}

export function loadCases(): CaseEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(CASES_KEY);
    if (!raw) return [];
    const json = safeDecompress(raw);
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      localStorage.removeItem(CASES_KEY);
    } catch { /* silent */ }
    return [];
  }
}

export function saveCases(cases: CaseEntry[]): void {
  try {
    if (typeof window === 'undefined') return;
    const json = JSON.stringify(cases);
    const compressed = safeCompress(json);
    localStorage.setItem(CASES_KEY, compressed);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('Storage full');
    }
  }
}

export function loadExpenses(): ExpenseEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(EXPENSES_KEY);
    if (!raw) return [];
    const json = safeDecompress(raw);
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    try {
      localStorage.removeItem(EXPENSES_KEY);
    } catch { /* silent */ }
    return [];
  }
}

export function saveExpenses(expenses: ExpenseEntry[]): void {
  try {
    if (typeof window === 'undefined') return;
    const json = JSON.stringify(expenses);
    const compressed = safeCompress(json);
    localStorage.setItem(EXPENSES_KEY, compressed);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      console.error('Storage full');
    }
  }
}

export function getLastSyncTime(): number {
  try {
    const val = localStorage.getItem(SYNC_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

export function setLastSyncTime(ts: number): void {
  try {
    localStorage.setItem(SYNC_KEY, String(ts));
  } catch { /* silent */ }
}

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