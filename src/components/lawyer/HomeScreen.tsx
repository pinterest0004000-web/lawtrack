'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import type { ViewType } from '@/lib/types';
import { getTodayStr, getTodayCases, getCasesWithPendingFee, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { CalendarDays, FolderOpen, Receipt, Plus, Trash2, Banknote } from 'lucide-react';

interface CardProps {
  icon: React.ReactNode;
  label: string;
  count: string | number;
  subText: string;
  onClick: () => void;
}

function DashCard({ icon, label, count, subText, onClick }: CardProps) {
  const lastTap = useRef(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current > 300) { lastTap.current = now; onClick(); }
  }, [onClick]);

  return (
    <button
      onClick={handleTap}
      className="w-full rounded-2xl p-5 bg-[#1e2a3a] active:bg-[#243347] transition-colors text-left"
    >
      <div className="text-amber-400 mb-3">{icon}</div>
      <p className="text-3xl font-bold text-white leading-none mb-1">{count}</p>
      <p className="text-sm font-medium text-slate-300">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{subText}</p>
    </button>
  );
}

export default function HomeScreen() {
  const cases = useLawyerStore(s => s.cases);
  const expenses = useLawyerStore(s => s.expenses);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);

  const todayCount = useMemo(() => getTodayCases(cases).length, [cases]);
  const allCount = useMemo(() => cases.length, [cases]);
  const todayExpenseCount = useMemo(() => getTodayExpenses(expenses).length, [expenses]);
  const pendingFeeTotal = useMemo(() => getCasesWithPendingFee(cases).length, [cases]);
  const totalPendingAmount = useMemo(() => cases.reduce((s, c) => s + (c.pendingFee || 0), 0), [cases]);
  const todayExpenseAmount = useMemo(() => getTodayExpenses(expenses).reduce((s, e) => s + (e.amount || 0), 0), [expenses]);
  const todayStr = useMemo(() => getTodayStr(), []);

  const navigate = useCallback((view: ViewType) => { setCurrentView(view); }, [setCurrentView]);

  return (
    <div className="animate-fade-in px-4 pt-4 pb-2">
      {/* Date */}
      <p className="text-xs text-slate-500 mb-4">
        {new Date(todayStr + 'T00:00:00').toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })}
      </p>

      {/* Cards - single column */}
      <div className="flex flex-col gap-3 mb-4">
        <DashCard
          icon={<CalendarDays className="w-7 h-7" strokeWidth={1.5} />}
          label="Today's Cases"
          count={todayCount}
          subText="hearings scheduled today"
          onClick={() => navigate('today')}
        />
        <DashCard
          icon={<FolderOpen className="w-7 h-7" strokeWidth={1.5} />}
          label="All Cases"
          count={allCount}
          subText="total registered cases"
          onClick={() => navigate('all')}
        />
        <DashCard
          icon={<Receipt className="w-7 h-7" strokeWidth={1.5} />}
          label="Today Expense"
          count={todayExpenseAmount > 0 ? formatCurrency(todayExpenseAmount) : todayExpenseCount}
          subText={todayExpenseAmount > 0 ? `${todayExpenseCount} entries today` : "no expense today"}
          onClick={() => navigate('expenses')}
        />
        <DashCard
          icon={<Banknote className="w-7 h-7" strokeWidth={1.5} />}
          label="Pending Fee"
          count={totalPendingAmount > 0 ? formatCurrency(totalPendingAmount) : pendingFeeTotal}
          subText={totalPendingAmount > 0 ? `${pendingFeeTotal} cases pending` : "no pending fees"}
          onClick={() => navigate('pending-fee')}
        />
        <DashCard
          icon={<Trash2 className="w-7 h-7" strokeWidth={1.5} />}
          label="Delete Case"
          count={allCount}
          subText="manage & remove cases"
          onClick={() => navigate('delete-case')}
        />
      </div>

      {/* Add New Case Button */}
      <button
        onClick={() => navigate('add-case')}
        className="w-full rounded-2xl p-4 flex items-center justify-center gap-3 bg-amber-500 active:bg-amber-600 transition-colors mb-4"
      >
        <Plus className="w-5 h-5 text-[#121218]" />
        <span className="text-base font-bold text-[#121218]">Add New Case</span>
      </button>
    </div>
  );
}