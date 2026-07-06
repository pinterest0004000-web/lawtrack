'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import type { ViewType } from '@/lib/types';
import { getTodayStr, getTodayCases, getCasesWithPendingFee, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { CalendarDays, FolderOpen, IndianRupee, Receipt, Plus } from 'lucide-react';

interface FeatureBoxProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}

function FeatureBox({ icon, label, count, color, onClick }: FeatureBoxProps) {
  const lastTap = useRef(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current > 300) {
      lastTap.current = now;
      onClick();
    }
  }, [onClick]);

  return (
    <button
      onClick={handleTap}
      className="feature-box glass-card rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center gap-1.5 sm:gap-2 flex-1 min-h-0"
      aria-label={`${label}: ${count}`}
    >
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <span className="text-[10px] sm:text-xs font-medium text-zinc-400 leading-tight text-center">
        {label}
      </span>
      <span className="text-lg sm:text-2xl font-bold text-white">
        {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
      </span>
    </button>
  );
}

export default function HomeScreen() {
  const cases = useLawyerStore(s => s.cases);
  const expenses = useLawyerStore(s => s.expenses);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);

  const todayCount = useMemo(() => getTodayCases(cases).length, [cases]);
  const allCount = useMemo(() => cases.length, [cases]);
  const pendingFeeTotal = useMemo(
    () => getCasesWithPendingFee(cases).length,
    [cases]
  );
  const todayExpenseCount = useMemo(() => getTodayExpenses(expenses).length, [expenses]);
  const todayStr = useMemo(() => getTodayStr(), []);

  const navigate = useCallback((view: ViewType) => {
    setCurrentView(view);
  }, [setCurrentView]);

  return (
    <div className="animate-fade-in px-3 sm:px-4 pt-3 pb-2">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-white">LawTrack</h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
          {new Date(todayStr + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>

      {/* 4 Feature Boxes */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
        <FeatureBox
          icon={<CalendarDays className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />}
          label="Today Cases"
          count={todayCount}
          color="bg-amber-500/15"
          onClick={() => navigate('today')}
        />
        <FeatureBox
          icon={<FolderOpen className="w-5 h-5 sm:w-6 sm:h-6 text-violet-400" />}
          label="All Cases"
          count={allCount}
          color="bg-violet-500/15"
          onClick={() => navigate('all')}
        />
        <FeatureBox
          icon={<IndianRupee className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />}
          label="Pending Fee"
          count={pendingFeeTotal}
          color="bg-red-500/15"
          onClick={() => navigate('pending-fee')}
        />
        <FeatureBox
          icon={<Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />}
          label="Today Expense"
          count={todayExpenseCount}
          color="bg-emerald-500/15"
          onClick={() => navigate('expenses')}
        />
      </div>

      {/* Add Case Button */}
      <button
        onClick={() => navigate('add-case')}
        className="feature-box w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-3 border border-violet-500/20 hover:border-violet-500/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <span className="text-base font-semibold text-white">Add New Case</span>
      </button>

      {/* Quick Stats */}
      {(todayCount > 0 || pendingFeeTotal > 0) && (
        <div className="mt-4 glass-card rounded-2xl p-4">
          {todayCount > 0 && (
            <p className="text-sm text-zinc-400">
              <span className="text-amber-400 font-semibold">{todayCount}</span> cases listed for today
            </p>
          )}
          {pendingFeeTotal > 0 && (
            <p className="text-sm text-zinc-400 mt-1">
              <span className="text-red-400 font-semibold">{pendingFeeTotal}</span> cases have pending fees
              {' '}
              (Total: <span className="text-red-400 font-semibold">
                {formatCurrency(cases.reduce((s, c) => s + (c.pendingFee || 0), 0))}
              </span>)
            </p>
          )}
        </div>
      )}
    </div>
  );
}