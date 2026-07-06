'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { getTodayCases } from '@/lib/utils-lawyer';
import HomeScreen from '@/components/lawyer/HomeScreen';
import CaseList from '@/components/lawyer/CaseList';
import PendingFeeList from '@/components/lawyer/PendingFeeList';
import ExpenseList from '@/components/lawyer/ExpenseList';
import ExpenseByCase from '@/components/lawyer/ExpenseByCase';
import ExpenseChamber from '@/components/lawyer/ExpenseChamber';
import AddCaseForm from '@/components/lawyer/AddCaseForm';
import CaseDetail from '@/components/lawyer/CaseDetail';
import SyncButton from '@/components/lawyer/SyncButton';
import { reportError } from '@/lib/firebase';

function ViewRouter() {
  const currentView = useLawyerStore(s => s.currentView);
  const cases = useLawyerStore(s => s.cases);

  const getTodayCasesMemo = useCallback(() => getTodayCases(cases), [cases]);

  switch (currentView) {
    case 'home':
      return <HomeScreen />;
    case 'today':
      return <CaseList title="Today's Cases" getCases={getTodayCasesMemo} showSearch />;
    case 'all':
      return <CaseList title="All Cases" getCases={() => cases} showSearch />;
    case 'pending-fee':
      return <PendingFeeList />;
    case 'expenses':
      return <ExpenseList />;
    case 'expenses-by-case':
      return <ExpenseByCase />;
    case 'expenses-chamber':
      return <ExpenseChamber />;
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
  const initRef = useRef(false);

  // Init immediately, don't wait for effect
  if (!initRef.current) {
    initRef.current = true;
    init().catch((e) => {
      reportError(e instanceof Error ? e : new Error(String(e)), 'StoreInit');
    });
  }

  // Global error handler for Crashlytics
  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      reportError(e.error instanceof Error ? e.error : new Error(String(e.error)), 'GlobalError');
    };
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      reportError(
        e.reason instanceof Error ? e.reason : new Error(String(e.reason)),
        'UnhandledRejection'
      );
    };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    return () => {
      window.removeEventListener('error', handler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <span className="text-sm">⚖️</span>
          </div>
          <h1 className="text-sm font-bold text-white tracking-tight">LawTrack</h1>
          {!initialized && <span className="w-3 h-3 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin ml-2" />}
        </div>
        <SyncButton />
      </header>

      {/* Main Content - always show UI, data loads in background */}
      <main className="flex-1 overflow-y-auto">
        <ViewRouter />
      </main>

      {/* Sticky Footer */}
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Lawyer Case Manager</p>
      </footer>
    </div>
  );
}