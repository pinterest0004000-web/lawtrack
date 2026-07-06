'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import type { ViewType } from '@/lib/types';
import { getTodayStr, getTodayCases, getCasesWithPendingFee, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { CalendarDays, FolderOpen, Receipt, Plus, Wallet, CircleDollarSign, AlertCircle } from 'lucide-react';

interface FeatureBoxProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  subText?: string;
  color: string;
  onClick: () => void;
}

function FeatureBox({ icon, label, count, subText, color, onClick }: FeatureBoxProps) {
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
      className="feature-box glass-card rounded-2xl p-3 flex items-center gap-3 w-full"
      aria-label={`${label}: ${subText || count}`}
    >
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 text-left min-w-0">
        <span className="text-[10px] sm:text-[11px] font-medium text-zinc-400 leading-tight block">
          {label}
        </span>
        <span className="text-base sm:text-lg font-bold text-white leading-tight block">
          {subText || (count > 9999 ? `${(count / 1000).toFixed(0)}k` : count > 999 ? `${(count / 1000).toFixed(1)}k` : count)}
        </span>
      </div>
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

  // Fee calculations
  const totalFee = useMemo(
    () => cases.reduce((s, c) => s + (c.pendingFee || 0) + (c.totalFeeReceived || 0), 0),
    [cases]
  );
  const paidFee = useMemo(
    () => cases.reduce((s, c) => s + (c.totalFeeReceived || 0), 0),
    [cases]
  );
  const pendingFeeAmount = useMemo(
    () => cases.reduce((s, c) => s + (c.pendingFee || 0), 0),
    [cases]
  );
  const pendingFeeCount = useMemo(
    () => getCasesWithPendingFee(cases).length,
    [cases]
  );

  const todayExpenseAmount = useMemo(
    () => getTodayExpenses(expenses).reduce((s, e) => s + (e.amount || 0), 0),
    [expenses]
  );
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

      {/* Feature Boxes - Vertical */}
      <div className="flex flex-col gap-2 mb-3">
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
          icon={<Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />}
          label="Today Expense"
          count={todayExpenseCount}
          subText={todayExpenseAmount > 0 ? formatCurrency(todayExpenseAmount) : undefined}
          color="bg-emerald-500/15"
          onClick={() => navigate('expenses')}
        />

        {/* Fee Summary - 3 boxes */}
        <FeatureBox
          icon={<Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />}
          label="Total Fee"
          count={0}
          subText={formatCurrency(totalFee)}
          color="bg-blue-500/15"
          onClick={() => navigate('pending-fee')}
        />
        <FeatureBox
          icon={<CircleDollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />}
          label="Paid Fee"
          count={0}
          subText={formatCurrency(paidFee)}
          color="bg-green-500/15"
          onClick={() => navigate('pending-fee')}
        />
        <FeatureBox
          icon={<AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />}
          label="Pending Fee"
          count={pendingFeeCount}
          subText={formatCurrency(pendingFeeAmount)}
          color="bg-red-500/15"
          onClick={() => navigate('pending-fee')}
        />
      </div>

      {/* Add New Case Button */}
      <button
        onClick={() => navigate('add-case')}
        className="feature-box w-full glass-card rounded-2xl p-4 flex items-center justify-center gap-3 border border-violet-500/20 hover:border-violet-500/40 transition-colors mb-4"
      >
        <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <span className="text-base font-semibold text-white">Add New Case</span>
      </button>
    </div>
  );
}