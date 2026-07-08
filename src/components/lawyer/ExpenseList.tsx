'use client';

import React, { useMemo } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { ArrowLeft, FileText, Building2 } from 'lucide-react';
import type { ExpenseCategory } from '@/lib/types';

export default function ExpenseList() {
  const expenses = useLawyerStore(s => s.expenses);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);

  const todayExpenses = useMemo(() => getTodayExpenses(expenses), [expenses]);

  const todayCaseExp = useMemo(
    () => todayExpenses.filter(e => e.category === 'case_expense' || (!e.category && e.caseId)),
    [todayExpenses]
  );
  const todayChamberExp = useMemo(
    () => todayExpenses.filter(e => e.category === 'chamber_expense'),
    [todayExpenses]
  );

  const totalCaseExp = useMemo(() => todayCaseExp.reduce((s, e) => s + (e.amount || 0), 0), [todayCaseExp]);
  const totalChamberExp = useMemo(() => todayChamberExp.reduce((s, e) => s + (e.amount || 0), 0), [todayChamberExp]);
  const totalToday = totalCaseExp + totalChamberExp;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button
          onClick={() => setCurrentView('home')}
          className="feature-box w-9 h-9 rounded-xl bg-[#1e2a3a] flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Today&apos;s Expenses</h2>
          <p className="text-[10px] text-zinc-500">{todayExpenses.length} expense{todayExpenses.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalToday)}</p>
        </div>
      </div>

      {/* 2 Sub-Boxes */}
      <div className="grid grid-cols-2 gap-3 px-3 sm:px-4 mb-4">
        <button
          onClick={() => setCurrentView('expenses-by-case')}
          className="feature-box bg-[#1e2a3a] rounded-2xl p-4 flex flex-col items-center justify-center gap-2"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <FileText className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-[11px] font-medium text-zinc-400 text-center">By Cases</span>
          <span className="text-lg font-bold text-white">{todayCaseExp.length}</span>
          <span className="text-[10px] text-zinc-500 font-medium">{formatCurrency(totalCaseExp)}</span>
        </button>

        <button
          onClick={() => setCurrentView('expenses-chamber')}
          className="feature-box bg-[#1e2a3a] rounded-2xl p-4 flex flex-col items-center justify-center gap-2"
        >
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-orange-400" />
          </div>
          <span className="text-[11px] font-medium text-zinc-400 text-center">Chamber</span>
          <span className="text-lg font-bold text-white">{todayChamberExp.length}</span>
          <span className="text-[10px] text-zinc-500 font-medium">{formatCurrency(totalChamberExp)}</span>
        </button>
      </div>
    </div>
  );
}