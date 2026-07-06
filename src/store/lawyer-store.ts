import { create } from 'zustand';
import type { CaseEntry, ExpenseEntry, ViewType, CaseHistoryEntry } from '@/lib/types';
import { loadCases, saveCases, loadExpenses, saveExpenses, createHistoryEntry } from '@/lib/storage';

interface LawyerStore {
  cases: CaseEntry[];
  expenses: ExpenseEntry[];
  currentView: ViewType;
  selectedCaseId: string | null;
  searchQuery: string;
  initialized: boolean;

  init: () => void;
  setCurrentView: (view: ViewType) => void;
  setSelectedCaseId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;

  addCase: (c: Omit<CaseEntry, 'createdAt' | 'updatedAt' | 'history' | 'pendingFee' | 'totalFeeReceived'>) => boolean;
  updateCaseNextDate: (caseId: string, judgeRemark: string, newNextDate: string) => boolean;
  addFeeRecord: (caseId: string, amount: number, isPending: boolean) => boolean;
  addExpense: (caseId: string, lawyerName: string, partyName: string, description: string, amount: number, date: string) => boolean;
  deleteCase: (caseId: string) => boolean;

  getCasesForSync: () => { cases: CaseEntry[]; expenses: ExpenseEntry[] };
  importFromSync: (cases: CaseEntry[], expenses: ExpenseEntry[]) => boolean;
}

export const useLawyerStore = create<LawyerStore>((set, get) => ({
  cases: [],
  expenses: [],
  currentView: 'today',
  selectedCaseId: null,
  searchQuery: '',
  initialized: false,

  init: () => {
    try {
      const cases = loadCases();
      const expenses = loadExpenses();
      set({ cases, expenses, initialized: true });
    } catch {
      set({ initialized: true });
    }
  },

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedCaseId: (id) => set({ selectedCaseId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  addCase: (caseData) => {
    try {
      const state = get();
      const historyEntry = createHistoryEntry('created', {
        description: `Case ${caseData.caseId} created for ${caseData.partyName} vs ${caseData.opponentName}`
      });
      const newCase: CaseEntry = {
        ...caseData,
        pendingFee: 0,
        totalFeeReceived: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: [historyEntry],
      };
      const newCases = [...state.cases, newCase];
      saveCases(newCases);
      set({ cases: newCases });
      return true;
    } catch {
      return false;
    }
  },

  updateCaseNextDate: (caseId, judgeRemark, newNextDate) => {
    try {
      const state = get();
      const idx = state.cases.findIndex(c => c.caseId === caseId);
      if (idx === -1) return false;
      const c = state.cases[idx];
      const historyEntry = createHistoryEntry('remark', {
        description: `Judge remarks: ${judgeRemark}. Next date set to ${newNextDate}`,
        remark: judgeRemark,
        newNextDate,
      });
      const updated: CaseEntry = {
        ...c,
        judgeRemarks: judgeRemark,
        nextDate: newNextDate,
        updatedAt: Date.now(),
        history: [...(c.history || []), historyEntry],
      };
      const newCases = [...state.cases];
      newCases[idx] = updated;
      saveCases(newCases);
      set({ cases: newCases });
      return true;
    } catch {
      return false;
    }
  },

  addFeeRecord: (caseId, amount, isPending) => {
    try {
      const state = get();
      const idx = state.cases.findIndex(c => c.caseId === caseId);
      if (idx === -1) return false;
      const c = state.cases[idx];
      const historyEntry = createHistoryEntry('fee', {
        description: isPending
          ? `Pending fee of ₹${amount} added`
          : `Fee received: ₹${amount}`,
        amount,
      });
      const updated: CaseEntry = {
        ...c,
        pendingFee: isPending ? c.pendingFee + amount : Math.max(0, c.pendingFee - amount),
        totalFeeReceived: isPending ? c.totalFeeReceived : c.totalFeeReceived + amount,
        updatedAt: Date.now(),
        history: [...(c.history || []), historyEntry],
      };
      const newCases = [...state.cases];
      newCases[idx] = updated;
      saveCases(newCases);
      set({ cases: newCases });
      return true;
    } catch {
      return false;
    }
  },

  addExpense: (caseId, lawyerName, partyName, description, amount, date) => {
    try {
      const state = get();
      const newExpense: ExpenseEntry = {
        id: crypto.randomUUID?.() ?? String(Date.now()) + String(Math.random()).slice(2, 8),
        caseId,
        lawyerName,
        partyName,
        description,
        amount,
        date,
        createdAt: Date.now(),
      };
      const newExpenses = [...state.expenses, newExpense];
      saveExpenses(newExpenses);
      set({ expenses: newExpenses });

      // Also add to case history
      const idx = state.cases.findIndex(c => c.caseId === caseId);
      if (idx !== -1) {
        const c = state.cases[idx];
        const historyEntry = createHistoryEntry('expense', {
          description: `Expense: ${description} - ₹${amount}`,
          amount,
        });
        const updated: CaseEntry = {
          ...c,
          updatedAt: Date.now(),
          history: [...(c.history || []), historyEntry],
        };
        const newCases = [...state.cases];
        newCases[idx] = updated;
        saveCases(newCases);
        set({ cases: newCases });
      }
      return true;
    } catch {
      return false;
    }
  },

  deleteCase: (caseId) => {
    try {
      const state = get();
      const newCases = state.cases.filter(c => c.caseId !== caseId);
      saveCases(newCases);
      set({ cases: newCases, currentView: 'all' });
      return true;
    } catch {
      return false;
    }
  },

  getCasesForSync: () => {
    const state = get();
    return { cases: state.cases, expenses: state.expenses };
  },

  importFromSync: (cases, expenses) => {
    try {
      saveCases(cases);
      saveExpenses(expenses);
      set({ cases, expenses });
      return true;
    } catch {
      return false;
    }
  },
}));