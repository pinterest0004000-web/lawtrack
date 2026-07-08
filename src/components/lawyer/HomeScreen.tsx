'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import type { ViewType } from '@/lib/types';
import { getTodayStr, getTodayCases, getCasesWithPendingFee, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { CalendarDays, FolderOpen, Wallet, Trash2, Plus, Banknote } from 'lucide-react';

interface CardProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  count: string | number;
  subText: string;
  onClick: () => void;
}

function DashCard({ icon, iconColor, iconBg, label, count, subText, onClick }: CardProps) {
  const lastTap = useRef(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current > 300) { lastTap.current = now; onClick(); }
  }, [onClick]);

  return (
    <button
      onClick={handleTap}
      className="dash-card w-full rounded-2xl p-4 text-left active:scale-[0.97] transition-all bg-[#141c2b]"
      style={{ '--card-accent': iconColor } as React.CSSProperties}
    >
      <div className="rounded-xl p-2 w-10 h-10 flex items-center justify-center mb-3" style={{ background: iconBg }}>
        <div style={{ color: iconColor }}>{icon}</div>
      </div>
      <p className="text-xl font-bold text-white leading-none mb-0.5 tracking-tight">{count}</p>
      <p className="text-[12px] font-medium text-slate-300 leading-tight">{label}</p>
      <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{subText}</p>
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

  const dateText = useMemo(() => new Date(todayStr + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }), [todayStr]);

  const navigate = useCallback((view: ViewType) => { setCurrentView(view); }, [setCurrentView]);

  return (
    <div className="animate-fade-in px-4 pt-3 pb-2">
      {/* Date */}
      <p className="text-[11px] text-zinc-500 mb-3 h-4">
        {dateText}
      </p>

      {/* 2x2 Grid - Top 4 cards */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <DashCard
          icon={<CalendarDays className="w-5 h-5" strokeWidth={1.8} />}
          iconColor="#D4A843"
          iconBg="rgba(212,168,67,0.12)"
          label="Today's Cases"
          count={todayCount}
          subText="hearings scheduled"
          onClick={() => navigate('today')}
        />
        <DashCard
          icon={<FolderOpen className="w-5 h-5" strokeWidth={1.8} />}
          iconColor="#D4A843"
          iconBg="rgba(212,168,67,0.12)"
          label="All Cases"
          count={allCount}
          subText="total cases"
          onClick={() => navigate('all')}
        />
        <DashCard
          icon={<Banknote className="w-5 h-5" strokeWidth={1.8} />}
          iconColor="#FF6B6B"
          iconBg="rgba(255,107,107,0.12)"
          label="Pending Fee"
          count={totalPendingAmount > 0 ? formatCurrency(totalPendingAmount) : pendingFeeTotal}
          subText={totalPendingAmount > 0 ? `${pendingFeeTotal} cases` : "across all lawyers"}
          onClick={() => navigate('pending-fee')}
        />
        <DashCard
          icon={<Wallet className="w-5 h-5" strokeWidth={1.8} />}
          iconColor="#34C759"
          iconBg="rgba(52,199,89,0.12)"
          label="Today's Expenses"
          count={todayExpenseAmount > 0 ? formatCurrency(todayExpenseAmount) : todayExpenseCount}
          subText={todayExpenseAmount > 0 ? `${todayExpenseCount} entries` : "chamber + case"}
          onClick={() => navigate('expenses')}
        />
      </div>

      {/* Delete Case - full width */}
      <button
        onClick={() => navigate('delete-case')}
        className="dash-card w-full rounded-2xl p-3.5 text-left active:scale-[0.97] transition-all bg-[#141c2b] mb-3 flex items-center gap-3"
      >
        <div className="rounded-xl p-2 w-10 h-10 flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(142,142,147,0.12)' }}>
          <Trash2 className="w-5 h-5 text-[#8E8E93]" strokeWidth={1.8} />
        </div>
        <div>
          <p className="text-[13px] font-medium text-slate-300">Delete Case</p>
          <p className="text-[10px] text-zinc-500">{allCount} cases • manage & remove</p>
        </div>
      </button>

      {/* Add New Case Button */}
      <button
        onClick={() => navigate('add-case')}
        className="w-full rounded-2xl p-3.5 flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all mb-4"
        style={{ background: 'linear-gradient(135deg, #D4A843 0%, #B8922E 100%)' }}
      >
        <Plus className="w-5 h-5 text-[#0a0f1a]" strokeWidth={2.5} />
        <span className="text-[14px] font-bold text-[#0a0f1a]">Add New Case</span>
      </button>
    </div>
  );
}