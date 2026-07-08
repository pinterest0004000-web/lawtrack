'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import type { ViewType } from '@/lib/types';
import { getTodayStr, getTodayCases, getCasesWithPendingFee, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { CalendarDays, FolderOpen, Wallet, Trash2, Plus, Banknote } from 'lucide-react';

interface CardProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  count: string | number;
  subText: string;
  onClick: () => void;
}

function DashCard({ icon, iconColor, label, count, subText, onClick }: CardProps) {
  const lastTap = useRef(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current > 300) { lastTap.current = now; onClick(); }
  }, [onClick]);

  return (
    <button
      onClick={handleTap}
      className="dash-card w-full rounded-2xl p-5 text-left active:scale-[0.98] transition-all"
      style={{ '--card-accent': iconColor } as React.CSSProperties}
    >
      <div className="bg-[#1a2538] rounded-xl p-2.5 w-11 h-11 flex items-center justify-center mb-4">
        <div style={{ color: iconColor }}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white leading-none mb-1 tracking-tight">{count}</p>
      <p className="text-[13px] font-medium text-slate-300">{label}</p>
      <p className="text-[11px] text-zinc-500 mt-0.5">{subText}</p>
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
    <div className="animate-fade-in px-4 pt-3 pb-2">
      {/* Cards - single column */}
      <div className="flex flex-col gap-3 mb-4">
        <DashCard
          icon={<CalendarDays className="w-6 h-6" strokeWidth={1.8} />}
          iconColor="#D4A843"
          label="Today's Cases"
          count={todayCount}
          subText="hearings scheduled today"
          onClick={() => navigate('today')}
        />
        <DashCard
          icon={<FolderOpen className="w-6 h-6" strokeWidth={1.8} />}
          iconColor="#D4A843"
          label="All Cases"
          count={allCount}
          subText="total registered cases"
          onClick={() => navigate('all')}
        />
        <DashCard
          icon={<Wallet className="w-6 h-6" strokeWidth={1.8} />}
          iconColor="#34C759"
          label="Today's Expenses"
          count={todayExpenseAmount > 0 ? formatCurrency(todayExpenseAmount) : todayExpenseCount}
          subText={todayExpenseAmount > 0 ? `${todayExpenseCount} entries today` : "chamber + case expenses"}
          onClick={() => navigate('expenses')}
        />
        <DashCard
          icon={<Banknote className="w-6 h-6" strokeWidth={1.8} />}
          iconColor="#FF6B6B"
          label="Pending Fee"
          count={totalPendingAmount > 0 ? formatCurrency(totalPendingAmount) : pendingFeeTotal}
          subText={totalPendingAmount > 0 ? `${pendingFeeTotal} cases pending` : "across all lawyers"}
          onClick={() => navigate('pending-fee')}
        />
        <DashCard
          icon={<Trash2 className="w-6 h-6" strokeWidth={1.8} />}
          iconColor="#8E8E93"
          label="Delete Case"
          count={allCount}
          subText="manage & remove cases"
          onClick={() => navigate('delete-case')}
        />
      </div>

      {/* Add New Case Button */}
      <button
        onClick={() => navigate('add-case')}
        className="w-full rounded-2xl p-4 flex items-center justify-center gap-3 active:scale-[0.98] transition-all mb-4"
        style={{ background: 'linear-gradient(135deg, #D4A843 0%, #B8922E 100%)' }}
      >
        <Plus className="w-5 h-5 text-[#0a0f1a]" strokeWidth={2.5} />
        <span className="text-[15px] font-bold text-[#0a0f1a]">Add New Case</span>
      </button>
    </div>
  );
}