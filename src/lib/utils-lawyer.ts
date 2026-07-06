import type { CaseEntry, ExpenseEntry } from './types';

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function groupByLawyer<T extends { lawyerName: string }>(items: T[]): Record<string, T[]> {
  const map: Record<string, T[]> = {};
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = item.lawyerName || 'Unknown';
    if (!map[key]) map[key] = [];
    map[key].push(item);
  }
  return map;
}

export function getTodayCases(cases: CaseEntry[]): CaseEntry[] {
  const today = getTodayStr();
  return cases.filter(c => c.nextDate === today);
}

export function getCasesWithPendingFee(cases: CaseEntry[]): CaseEntry[] {
  return cases.filter(c => c.pendingFee > 0);
}

export function getTodayExpenses(expenses: ExpenseEntry[]): ExpenseEntry[] {
  const today = getTodayStr();
  return expenses.filter(e => e.date === today);
}

export function formatCurrency(amount: number): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN');
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function searchCases(cases: CaseEntry[], query: string): CaseEntry[] {
  if (!query.trim()) return cases;
  const q = query.toLowerCase().trim();
  return cases.filter(c =>
    (c.caseId || '').toLowerCase().includes(q) ||
    (c.partyName || '').toLowerCase().includes(q) ||
    (c.opponentName || '').toLowerCase().includes(q) ||
    (c.lawyerName || '').toLowerCase().includes(q) ||
    (c.caseType || '').toLowerCase().includes(q) ||
    (c.section || '').toLowerCase().includes(q) ||
    (c.policeStation || '').toLowerCase().includes(q) ||
    (c.phone || '').includes(q)
  );
}

export function generateCaseId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const num = parseInt(id.replace(/\D/g, ''), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return String(max + 1).padStart(4, '0');
}