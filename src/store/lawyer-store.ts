import { create } from 'zustand';
import type { CaseEntry, ExpenseEntry, ViewType, CaseHistoryEntry } from '@/lib/types';
import {
  loadCases, saveCases, loadExpenses, saveExpenses,
  createHistoryEntry, upsertCase, deleteCaseFromDB,
  addExpenseToDB, migrateFromLocalStorage, getLawyerNames,
} from '@/lib/storage';

interface LawyerStore {
  cases: CaseEntry[];
  expenses: ExpenseEntry[];
  currentView: ViewType;
  selectedCaseId: string | null;
  searchQuery: string;
  initialized: boolean;
  lawyerNames: string[];

  init: () => Promise<void>;
  setCurrentView: (view: ViewType) => void;
  setSelectedCaseId: (id: string | null) => void;
  setSearchQuery: (q: string) => void;

  addCase: (c: Omit<CaseEntry, 'createdAt' | 'updatedAt' | 'history' | 'pendingFee' | 'totalFeeReceived'>) => Promise<boolean>;
  updateCaseNextDate: (caseId: string, judgeRemark: string, newNextDate: string) => Promise<boolean>;
  addFeeRecord: (caseId: string, amount: number, isPending: boolean) => Promise<boolean>;
  addExpense: (caseId: string, lawyerName: string, partyName: string, description: string, amount: number, date: string) => Promise<boolean>;
  deleteCase: (caseId: string) => Promise<boolean>;

  getCasesForSync: () => { cases: CaseEntry[]; expenses: ExpenseEntry[] };
  importFromSync: (cases: CaseEntry[], expenses: ExpenseEntry[]) => Promise<boolean>;
  refreshLawyerNames: () => void;
}

export const useLawyerStore = create<LawyerStore>((set, get) => ({
  cases: [],
  expenses: [],
  currentView: 'today',
  selectedCaseId: null,
  searchQuery: '',
  initialized: false,
  lawyerNames: [],

  init: async () => {
    try {
      // Migrate from localStorage if needed
      await migrateFromLocalStorage();

      const [cases, expenses] = await Promise.all([loadCases(), loadExpenses()]);
      const lawyerNames = await getLawyerNames();
      set({ cases, expenses, initialized: true, lawyerNames });
    } catch {
      set({ initialized: true });
    }
  },

  setCurrentView: (view) => set({ currentView: view }),
  setSelectedCaseId: (id) => set({ selectedCaseId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  addCase: async (caseData) => {
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

      // Optimistic update for instant UI
      const newCases = [...state.cases, newCase];
      set({ cases: newCases });

      // Persist to IndexedDB in background
      upsertCase(newCase).catch(() => {});

      // Update lawyer names
      const nameSet = new Set(state.lawyerNames);
      if (newCase.lawyerName) nameSet.add(newCase.lawyerName);
      set({ lawyerNames: [...nameSet] });

      return true;
    } catch {
      return false;
    }
  },

  updateCaseNextDate: async (caseId, judgeRemark, newNextDate) => {
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

      // Optimistic update
      const newCases = [...state.cases];
      newCases[idx] = updated;
      set({ cases: newCases });

      // Persist in background
      upsertCase(updated).catch(() => {});

      return true;
    } catch {
      return false;
    }
  },

  addFeeRecord: async (caseId, amount, isPending) => {
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

      // Optimistic update
      const newCases = [...state.cases];
      newCases[idx] = updated;
      set({ cases: newCases });

      // Persist in background
      upsertCase(updated).catch(() => {});

      return true;
    } catch {
      return false;
    }
  },

  addExpense: async (caseId, lawyerName, partyName, description, amount, date) => {
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

      // Optimistic update for expenses
      const newExpenses = [...state.expenses, newExpense];
      set({ expenses: newExpenses });

      // Persist expense
      addExpenseToDB(newExpense).catch(() => {});

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
        set({ cases: newCases });
        upsertCase(updated).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  },

  deleteCase: async (caseId) => {
    try {
      const state = get();
      const newCases = state.cases.filter(c => c.caseId !== caseId);
      set({ cases: newCases, currentView: 'all' });

      // Persist in background
      deleteCaseFromDB(caseId).catch(() => {});

      return true;
    } catch {
      return false;
    }
  },

  getCasesForSync: () => {
    const state = get();
    return { cases: state.cases, expenses: state.expenses };
  },

  importFromSync: async (cases, expenses) => {
    try {
      set({ cases, expenses });
      await saveCases(cases);
      await saveExpenses(expenses);
      const lawyerNames = await getLawyerNames();
      set({ lawyerNames });
      return true;
    } catch {
      return false;
    }
  },

  refreshLawyerNames: () => {
    try {
      const state = get();
      const nameSet = new Set<string>();
      for (let i = 0; i < state.cases.length; i++) {
        if (state.cases[i].lawyerName) nameSet.add(state.cases[i].lawyerName);
      }
      set({ lawyerNames: [...nameSet] });
    } catch { /* silent */ }
  },
}));