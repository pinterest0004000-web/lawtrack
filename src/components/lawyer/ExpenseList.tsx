'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { groupByLawyer, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { ArrowLeft } from 'lucide-react';

export default function ExpenseList() {
  const expenses = useLawyerStore(s => s.expenses);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const todayExpenses = useMemo(() => getTodayExpenses(expenses), [expenses]);
  const grouped = useMemo(() => groupByLawyer(todayExpenses), [todayExpenses]);
  const lawyerNames = useMemo(() => Object.keys(grouped), [grouped]);
  const totalToday = useMemo(() => todayExpenses.reduce((s, e) => s + (e.amount || 0), 0), [todayExpenses]);

  const visibleLawyers = useMemo(() => {
    let count = 0;
    const result: string[] = [];
    for (const name of lawyerNames) {
      if (count >= PAGE_SIZE * (page + 1)) break;
      result.push(name);
      count += grouped[name].length;
    }
    return result;
  }, [lawyerNames, grouped, page]);

  const hasMore = useMemo(() => {
    let count = 0;
    for (const name of lawyerNames) {
      count += grouped[name].length;
      if (count > PAGE_SIZE * (page + 1)) return true;
    }
    return false;
  }, [lawyerNames, grouped, page]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button
          onClick={() => setCurrentView('today')}
          className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Today&apos;s Expenses</h2>
          <p className="text-[10px] text-zinc-500">{todayExpenses.length} expense{todayExpenses.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalToday)}</p>
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-4">
        {visibleLawyers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">No expenses today</p>
          </div>
        ) : (
          <>
            {visibleLawyers.map(name => {
              const lawyerExpenses = grouped[name];
              const lawyerTotal = lawyerExpenses.reduce((s, e) => s + (e.amount || 0), 0);
              return (
                <div key={name} className="mb-4 animate-slide-up">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-300">{name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{name}</h3>
                        <p className="text-[10px] text-zinc-500">{lawyerExpenses.length} expense{lawyerExpenses.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(lawyerTotal)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {lawyerExpenses.map(e => (
                      <div key={e.id} className="glass-card rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-emerald-400">#{e.caseId}</span>
                          <span className="text-sm font-bold text-emerald-400">-{formatCurrency(e.amount)}</span>
                        </div>
                        <p className="text-sm text-white mt-1 truncate">{e.description}</p>
                        <p className="text-xs text-zinc-500 truncate">{e.partyName}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <button onClick={() => setPage(p => p + 1)} className="w-full text-center py-3 text-sm text-violet-400 font-medium">
                Load more...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}