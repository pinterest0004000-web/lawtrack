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
import LoginScreen from '@/components/lawyer/LoginScreen';
import { reportError } from '@/lib/firebase';
import { LogOut, Users, Menu, X } from 'lucide-react';
import { toast } from 'sonner';

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

function HeaderMenu() {
  const [open, setOpen] = React.useState(false);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const logout = useAuthStore(s => s.logout);
  const showManageUsers = useAuthStore(s => s.showManageUsers);
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const currentUserName = useAuthStore(s => s.currentUserName);

  const handleRestore = () => {
    try {
      const raw = localStorage.getItem(`lw_autobak_${currentUserName || '_'}`);
      if (!raw) { toast.error('Koi backup nahi mila'); return; }
      const data = JSON.parse(raw);
      if (!data.cases || !Array.isArray(data.cases)) { toast.error('Backup galat hai'); return; }
      const mc = (c: Record<string, unknown>) => ({ caseId: String(c.caseId||''), lawyerName: String(c.lawyerName||''), partyName: String(c.partyName||''), opponentName: String(c.opponentName||''), caseType: String(c.caseType||''), section: String(c.section||''), policeStation: String(c.policeStation||''), enteringDate: String(c.enteringDate||''), nextDate: String(c.nextDate||''), phone: String(c.phone||''), judgeRemarks: String(c.judgeRemarks||''), pendingFee: Number(c.pendingFee)||0, totalFeeReceived: Number(c.totalFeeReceived)||0, createdAt: Number(c.createdAt)||0, updatedAt: Number(c.updatedAt)||0, history: Array.isArray(c.history)?c.history:[] });
      const me = (e: Record<string, unknown>) => ({ id: String(e.id||''), caseId: String(e.caseId||''), lawyerName: String(e.lawyerName||''), partyName: String(e.partyName||''), description: String(e.description||''), amount: Number(e.amount)||0, date: String(e.date||''), createdAt: Number(e.createdAt)||0, category: String(e.category||'case_expense') });
      importFromSync(data.cases.map(mc) as never[], (data.expenses||[]).map(me) as never[]);
      toast.success('Data restore ho gaya!', { description: `${data.cases.length} cases` });
    } catch { toast.error('Restore fail'); }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-9 h-9 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center active:bg-zinc-700/80 transition-colors"
        aria-label="Menu">
        <Menu className="w-4 h-4 text-zinc-400" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute right-3 top-3 w-56 bg-[#141420] border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Menu</span>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
            {isAdmin && (
              <button onClick={() => { setOpen(false); showManageUsers(); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800/50 transition-colors">
                <Users className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-white">Admin Panel</p>
                  <p className="text-[10px] text-zinc-500">Users manage karo</p>
                </div>
              </button>
            )}
            <button onClick={() => { setOpen(false); handleRestore(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-zinc-800/50 transition-colors">
              <RestoreIcon />
              <div>
                <p className="text-sm font-medium text-white">Restore Backup</p>
                <p className="text-[10px] text-zinc-500">Auto-backup se data wapas karo</p>
              </div>
            </button>
            <div className="border-t border-zinc-800" />
            <button onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-red-500/10 transition-colors">
                <LogOut className="w-4 h-4 text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-400">Exit</p>
                  <p className="text-[10px] text-zinc-500">App lock karo</p>
                </div>
              </button>
          </div>
        </div>
      )}
    </>
  );
}

function RestoreIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
    </svg>
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
      <header className="flex items-center justify-center px-4 py-3 border-b border-white/5 flex-shrink-0 relative">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">⚖️</span>
          <h1 className="text-[22px] font-black text-white tracking-tight leading-none">LawTrack</h1>
        </div>
        {!initialized && <span className="absolute left-1/2 -translate-x-1/2 bottom-0.5 w-3 h-3 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <HeaderMenu />
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