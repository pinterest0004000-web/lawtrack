export interface CaseEntry {
  caseId: string;
  lawyerName: string;
  partyName: string;
  opponentName: string;
  caseType: string;
  section: string;
  policeStation: string;
  enteringDate: string;
  nextDate: string;
  phone: string;
  judgeName: string;
  judgeRemarks: string;
  pendingFee: number;
  totalFeeReceived: number;
  createdAt: number;
  updatedAt: number;
  history: CaseHistoryEntry[];
}

export interface CaseHistoryEntry {
  id: string;
  type: 'fee' | 'case_expense' | 'chamber_expense' | 'remark' | 'next_date' | 'created';
  date: string;
  timestamp: number;
  description: string;
  amount?: number;
  remark?: string;
  newNextDate?: string;
}

export type ExpenseCategory = 'case_expense' | 'chamber_expense';

export interface ExpenseEntry {
  id: string;
  caseId: string;
  lawyerName: string;
  partyName: string;
  description: string;
  amount: number;
  date: string;
  createdAt: number;
  category: ExpenseCategory;
}

export type ViewType = 'home' | 'today' | 'all' | 'pending-fee' | 'expenses' | 'expenses-by-case' | 'expenses-chamber' | 'add-case' | 'case-detail' | 'delete-case';

export interface AppState {
  cases: CaseEntry[];
  expenses: ExpenseEntry[];
  currentView: ViewType;
  selectedCaseId: string | null;
  searchQuery: string;
}