'use client';

import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { getTodayCases, getCasesWithPendingFee, getTodayExpenses } from '@/lib/utils-lawyer';
import HomeScreen from '@/components/lawyer/HomeScreen';
import CaseList from '@/components/lawyer/CaseList';
import PendingFeeList from '@/components/lawyer/PendingFeeList';
import ExpenseList from '@/components/lawyer/ExpenseList';
import AddCaseForm from '@/components/lawyer/AddCaseForm';
import CaseDetail from '@/components/lawyer/CaseDetail';
import SyncButton from '@/components/lawyer/SyncButton';

function ViewRouter() {
  const currentView = useLawyerStore(s => s.currentView);
  const cases = useLawyerStore(s => s.cases);

  const getTodayCasesMemo = useCallback(() => getTodayCases(cases), [cases]);

  switch (currentView) {
    case 'today':
      return <CaseList title="Today's Cases" getCases={getTodayCasesMemo} showSearch />;
    case 'all':
      return <CaseList title="All Cases" getCases={() => cases} showSearch />;
    case 'pending-fee':
      return <PendingFeeList />;
    case 'expenses':
      return <ExpenseList />;
    case 'add-case':
      return <AddCaseForm />;
    case 'case-detail':
      return <CaseDetail />;
    default:
      return <HomeScreen />;
  }
}

export default function Home() {
  const init = useLawyerStore(s => s.init);
  const initialized = useLawyerStore(s => s.initialized);
  const currentView = useLawyerStore(s => s.currentView);
  const initRef = useRef(false);

  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      init();
    }
  }, [init]);

  // Global error handler
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      console.error('Uncaught error:', e.error);
    };
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      console.error('Unhandled rejection:', e.reason);
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          {currentView === 'today' && (
            <h1 className="text-base font-bold text-white tracking-tight">⚖️ LawTrack</h1>
          )}
        </div>
        <SyncButton />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <ViewRouter />
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 text-center">
        <p className="text-[10px] text-zinc-700">LawTrack • Lawyer Case Manager</p>
      </footer>
    </div>
  );
}