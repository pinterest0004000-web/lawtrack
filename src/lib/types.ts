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
  judgeRemarks: string;
  pendingFee: number;
  totalFeeReceived: number;
  createdAt: number;
  updatedAt: number;
  history: CaseHistoryEntry[];
}

export interface CaseHistoryEntry {
  id: string;
  type: 'fee' | 'expense' | 'remark' | 'next_date' | 'created';
  date: string;
  timestamp: number;
  description: string;
  amount?: number;
  remark?: string;
  newNextDate?: string;
}

export interface ExpenseEntry {
  id: string;
  caseId: string;
  lawyerName: string;
  partyName: string;
  description: string;
  amount: number;
  date: string;
  createdAt: number;
}

export type ViewType = 'today' | 'all' | 'pending-fee' | 'expenses' | 'add-case' | 'case-detail';

export interface AppState {
  cases: CaseEntry[];
  expenses: ExpenseEntry[];
  currentView: ViewType;
  selectedCaseId: string | null;
  searchQuery: string;
}