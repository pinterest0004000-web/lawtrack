import { create } from 'zustand';
import type { CaseEntry, ExpenseEntry, ViewType, CaseHistoryEntry, ExpenseCategory } from '@/lib/types';
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

  addCase: (c: Omit<CaseEntry, 'createdAt' | 'updatedAt' | 'history' | 'pendingFee' | 'totalFeeReceived'> & { totalFee?: number; paidFee?: number }) => Promise<boolean>;
  updateCaseNextDate: (caseId: string, judgeRemark: string, newNextDate: string) => Promise<boolean>;
  addFeeRecord: (caseId: string, amount: number, isPending: boolean) => Promise<boolean>;
  addExpense: (caseId: string, lawyerName: string, partyName: string, description: string, amount: number, date: string, category: ExpenseCategory) => Promise<boolean>;
  deleteCase: (caseId: string) => Promise<boolean>;
  restoreCase: (c: CaseEntry) => Promise<boolean>;

  getCasesForSync: () => { cases: CaseEntry[]; expenses: ExpenseEntry[] };
  importFromSync: (cases: CaseEntry[], expenses: ExpenseEntry[]) => Promise<boolean>;
  refreshLawyerNames: () => void;
}

export const useLawyerStore = create<LawyerStore>((set, get) => ({
  cases: [],
  expenses: [],
  currentView: 'home' as ViewType,
  selectedCaseId: null,
  searchQuery: '',
  initialized: false,
  lawyerNames: [],

  init: async () => {
    try {
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
      const totalFee = (caseData as Record<string, unknown>).totalFee as number || 0;
      const paidFee = (caseData as Record<string, unknown>).paidFee as number || 0;
      const newCase: CaseEntry = {
        ...caseData,
        pendingFee: Math.max(0, totalFee - paidFee),
        totalFeeReceived: paidFee,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        history: [historyEntry],
      };

      const newCases = [...state.cases, newCase];
      set({ cases: newCases });
      upsertCase(newCase).catch(() => {});

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

      const newCases = [...state.cases];
      newCases[idx] = updated;
      set({ cases: newCases });
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
          ? `Pending fee of Rs ${amount} added`
          : `Fee received: Rs ${amount}`,
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
      set({ cases: newCases });
      upsertCase(updated).catch(() => {});

      return true;
    } catch {
      return false;
    }
  },

  addExpense: async (caseId, lawyerName, partyName, description, amount, date, category) => {
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
        category,
      };

      const newExpenses = [...state.expenses, newExpense];
      set({ expenses: newExpenses });
      addExpenseToDB(newExpense).catch(() => {});

      // Add to case history only for case_expense (not chamber)
      if (category === 'case_expense') {
        const idx = state.cases.findIndex(c => c.caseId === caseId);
        if (idx !== -1) {
          const c = state.cases[idx];
          const historyEntry = createHistoryEntry('case_expense', {
            description: `Expense: ${description} - Rs ${amount}`,
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
      // Also remove associated expenses so they don't become orphaned
      const newExpenses = state.expenses.filter(e => e.caseId !== caseId);
      set({ cases: newCases, expenses: newExpenses, currentView: 'home' });
      deleteCaseFromDB(caseId).catch(() => {});
      return true;
    } catch {
      return false;
    }
  },

  restoreCase: async (c) => {
    try {
      const state = get();
      if (state.cases.some(x => x.caseId === c.caseId)) return false;
      const newCases = [...state.cases, c].sort((a, b) => a.caseId.localeCompare(b.caseId, undefined, { numeric: true }));
      set({ cases: newCases });
      upsertCase(c).catch(() => {});
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