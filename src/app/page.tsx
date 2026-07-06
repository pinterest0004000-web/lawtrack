'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { useAuthStore } from '@/store/auth-store';
import { getTodayCases } from '@/lib/utils-lawyer';
import { saveCases, saveExpenses } from '@/lib/storage';
import { hasEncryptionKey } from '@/lib/auth';
import HomeScreen from '@/components/lawyer/HomeScreen';
import CaseList from '@/components/lawyer/CaseList';
import PendingFeeList from '@/components/lawyer/PendingFeeList';
import ExpenseList from '@/components/lawyer/ExpenseList';
import ExpenseByCase from '@/components/lawyer/ExpenseByCase';
import ExpenseChamber from '@/components/lawyer/ExpenseChamber';
import AddCaseForm from '@/components/lawyer/AddCaseForm';
import CaseDetail from '@/components/lawyer/CaseDetail';
import BackupButton from '@/components/lawyer/SyncButton';
import LoginScreen from '@/components/lawyer/LoginScreen';
import { reportError } from '@/lib/firebase';
import { LogOut, Users } from 'lucide-react';

function ViewRouter() {
  const currentView = useLawyerStore(s => s.currentView);
  const cases = useLawyerStore(s => s.cases);
  const getTodayCasesMemo = useCallback(() => getTodayCases(cases), [cases]);

  switch (currentView) {
    case 'home': return <HomeScreen />;
    case 'today': return <CaseList title="Today's Cases" getCases={getTodayCasesMemo} showSearch />;
    case 'all': return <CaseList title="All Cases" getCases={() => cases} showSearch />;
    case 'pending-fee': return <PendingFeeList />;
    case 'expenses': return <ExpenseList />;
    case 'expenses-by-case': return <ExpenseByCase />;
    case 'expenses-chamber': return <ExpenseChamber />;
    case 'add-case': return <AddCaseForm />;
    case 'case-detail': return <CaseDetail />;
    default: return <HomeScreen />;
  }
}

function LockButton() {
  const logout = useAuthStore(s => s.logout);
  return (
    <button onClick={logout}
      className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center active:bg-zinc-700/80 transition-colors"
      aria-label="Lock app">
      <LogOut className="w-3.5 h-3.5 text-zinc-400" />
    </button>
  );
}

function ManageUsersButton() {
  const showManageUsers = useAuthStore(s => s.showManageUsers);
  return (
    <button onClick={showManageUsers}
      className="h-8 px-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center gap-1.5 active:bg-zinc-700/80 transition-colors"
      aria-label="Manage users">
      <Users className="w-3.5 h-3.5 text-amber-400" />
      <span className="text-[11px] font-medium text-zinc-300 hidden sm:inline">Users</span>
    </button>
  );
}

// These statuses show as overlay on top of the unlocked app
const OVERLAY_STATUSES = ['manage-users', 'add-user', 'user-created'] as const;

function isOverlayStatus(s: string): boolean {
  return (OVERLAY_STATUSES as readonly string[]).includes(s);
}

// Auto-backup: silently saves latest data snapshot per-user
const autoBackup = (() => {
  let lastJson = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (cases: unknown[], expenses: unknown[], userName: string) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const data = JSON.stringify({ cases, expenses, _u: userName, _t: Date.now() });
      if (data === lastJson) return; // no change
      lastJson = data;
      try {
        const key = `lw_autobak_${userName || '_'}`;
        localStorage.setItem(key, data);
      } catch { /* storage full — ignore */ }
    }, 500); // debounce 500ms
  };
})();

export default function Home() {
  const init = useLawyerStore(s => s.init);
  const initialized = useLawyerStore(s => s.initialized);
  const cases = useLawyerStore(s => s.cases);
  const expenses = useLawyerStore(s => s.expenses);
  const authStatus = useAuthStore(s => s.authStatus);
  const currentUserName = useAuthStore(s => s.currentUserName);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const checkAuth = useAuthStore(s => s.checkAuth);
  const recordActivity = useAuthStore(s => s.recordActivity);
  const checkAutoLock = useAuthStore(s => s.checkAutoLock);
  const initDoneRef = useRef(false);
  const reencryptRef = useRef(false);
  const autoLockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Init data store after auth becomes unlocked, reset on user change
  useEffect(() => {
    if (authStatus !== 'unlocked' && !isOverlayStatus(authStatus)) {
      initDoneRef.current = false;
      reencryptRef.current = false;
      return;
    }
    if (!initDoneRef.current) {
      initDoneRef.current = true;
      init().catch((e) => {
        reportError(e instanceof Error ? e : new Error(String(e)), 'StoreInit');
      });
    }
  }, [authStatus, init]);

  // Re-encrypt + auto-backup after init
  useEffect(() => {
    if (!initialized || !hasEncryptionKey()) return;
    if (reencryptRef.current) {
      // Auto-backup on every data change (skip first run which is re-encrypt)
      autoBackup(cases, expenses, currentUserName);
      return;
    }
    if (cases.length === 0 && expenses.length === 0) { reencryptRef.current = true; return; }
    reencryptRef.current = true;
    Promise.all([saveCases(cases), saveExpenses(expenses)]).catch(() => {});
  }, [initialized, cases, expenses, currentUserName]);

  // Auto-lock timer
  useEffect(() => {
    if (authStatus !== 'unlocked' && !isOverlayStatus(authStatus)) {
      if (autoLockRef.current) { clearInterval(autoLockRef.current); autoLockRef.current = null; }
      return;
    }
    autoLockRef.current = setInterval(() => { checkAutoLock(); }, 30_000);
    return () => { if (autoLockRef.current) clearInterval(autoLockRef.current); };
  }, [authStatus, checkAutoLock]);

  // Track activity
  const handleActivity = useCallback(() => { recordActivity(); }, [recordActivity]);
  useEffect(() => {
    if (authStatus !== 'unlocked' && !isOverlayStatus(authStatus)) return;
    const events = ['touchstart', 'mousedown', 'keydown', 'scroll'] as const;
    for (const evt of events) window.addEventListener(evt, handleActivity, { passive: true });
    return () => { for (const evt of events) window.removeEventListener(evt, handleActivity); };
  }, [authStatus, handleActivity]);

  // Global error handler
  useEffect(() => {
    const handler = (e: ErrorEvent) => { reportError(e.error instanceof Error ? e.error : new Error(String(e.error)), 'GlobalError'); };
    const rej = (e: PromiseRejectionEvent) => { reportError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)), 'UnhandledRejection'); };
    window.addEventListener('error', handler);
    window.addEventListener('unhandledrejection', rej);
    return () => { window.removeEventListener('error', handler); window.removeEventListener('unhandledrejection', rej); };
  }, []);

  // Full auth screens (not overlay)
  if (authStatus !== 'unlocked' && !isOverlayStatus(authStatus)) return <LoginScreen />;

  const showOverlay = isOverlayStatus(authStatus);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600/20 flex items-center justify-center">
            <span className="text-sm">⚖️</span>
          </div>
          <h1 className="text-sm font-bold text-white tracking-tight">LawTrack</h1>
          {currentUserName && <span className="text-[10px] text-zinc-500 ml-1">• {currentUserName}</span>}
          {isAdmin && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1">ADMIN</span>}
          {!initialized && <span className="w-3 h-3 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin ml-2" />}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <ManageUsersButton />}
          <BackupButton />
          <LockButton />
        </div>
      </header>
      <main className="flex-1 overflow-y-auto"><ViewRouter /></main>
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Lawyer Case Manager • Secured</p>
      </footer>

      {/* Overlay screens (manage users, add user, user created) */}
      {showOverlay && <LoginScreen />}
    </div>
  );
}