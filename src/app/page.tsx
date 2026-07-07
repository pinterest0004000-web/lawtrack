'use client';

import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { useAuthStore } from '@/store/auth-store';
import { getTodayCases } from '@/lib/utils-lawyer';
import { saveCases, saveExpenses } from '@/lib/storage';
import { hasEncryptionKey, getCurrentUserId } from '@/lib/auth';
import { saveToCloud, loadFromCloud, getCloudInfo, isCloudReady, isUndoPaused, clearCloudUndoTimer, type CloudBackupInfo } from '@/lib/cloud-backup';
import HomeScreen from '@/components/lawyer/HomeScreen';
import CaseList from '@/components/lawyer/CaseList';
import PendingFeeList from '@/components/lawyer/PendingFeeList';
import ExpenseList from '@/components/lawyer/ExpenseList';
import ExpenseByCase from '@/components/lawyer/ExpenseByCase';
import ExpenseChamber from '@/components/lawyer/ExpenseChamber';
import AddCaseForm from '@/components/lawyer/AddCaseForm';
import CaseDetail from '@/components/lawyer/CaseDetail';
import DeleteCaseScreen from '@/components/lawyer/DeleteCaseScreen';
import LoginScreen from '@/components/lawyer/LoginScreen';
import { reportError } from '@/lib/firebase';
import { LogOut, Users, Cloud, CloudOff, HardDriveDownload } from 'lucide-react';
import AppToaster, { toast } from '@/components/AppToaster';

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
    case 'delete-case': return <DeleteCaseScreen />;
    default: return <HomeScreen />;
  }
}

function HeaderMenu() {
  const [open, setOpen] = React.useState(false);
  const [cloudInfo, setCloudInfo] = useState<CloudBackupInfo | null>(null);
  const [restoring, setRestoring] = useState(false);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const logout = useAuthStore(s => s.logout);
  const showManageUsers = useAuthStore(s => s.showManageUsers);
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const currentUserName = useAuthStore(s => s.currentUserName);

  const cloudReady = isCloudReady();

  // Fetch cloud info when menu opens
  useEffect(() => {
    if (!open) return;
    const userId = getCurrentUserId();
    if (!userId) return;
    getCloudInfo(userId).then(setCloudInfo);
  }, [open]);

  const handleCloudRestore = async () => {
    const userId = getCurrentUserId();
    if (!userId) return;
    if (!confirm('Cloud se data restore karna hai? Current data replace hoga.')) return;
    setRestoring(true);
    try {
      const data = await loadFromCloud(userId);
      if (!data) { toast.error('Cloud pe data nahi mila'); setRestoring(false); return; }
      const mc = (c: Record<string, unknown>) => ({ caseId: String(c.caseId||''), lawyerName: String(c.lawyerName||''), partyName: String(c.partyName||''), opponentName: String(c.opponentName||''), caseType: String(c.caseType||''), section: String(c.section||''), policeStation: String(c.policeStation||''), enteringDate: String(c.enteringDate||''), nextDate: String(c.nextDate||''), phone: String(c.phone||''), judgeRemarks: String(c.judgeRemarks||''), pendingFee: Number(c.pendingFee)||0, totalFeeReceived: Number(c.totalFeeReceived)||0, createdAt: Number(c.createdAt)||0, updatedAt: Number(c.updatedAt)||0, history: Array.isArray(c.history)?c.history:[] });
      const me = (e: Record<string, unknown>) => ({ id: String(e.id||''), caseId: String(e.caseId||''), lawyerName: String(e.lawyerName||''), partyName: String(e.partyName||''), description: String(e.description||''), amount: Number(e.amount)||0, date: String(e.date||''), createdAt: Number(e.createdAt)||0, category: String(e.category||'case_expense') });
      await importFromSync(data.cases.map(mc) as never[], (data.expenses||[]).map(me) as never[]);
      toast.success('Cloud se restore ho gaya!', { description: `${data.cases.length} cases` });
      // Refresh cloud info
      getCloudInfo(userId).then(setCloudInfo);
    } catch { toast.error('Cloud restore fail'); }
    setRestoring(false);
  };

  const handleLocalRestore = () => {
    if (!confirm('Local backup se data restore karna hai? Current data replace hoga.')) return;
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

  const formatTime = (ts: number | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 60_000) return 'Abhi';
    if (diff < 3600_000) return `${Math.floor(diff/60000)} min pehle`;
    if (diff < 86400_000) return `${Math.floor(diff/3600000)} hr pehle`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const hasLocalBackup = typeof window !== 'undefined' && !!localStorage.getItem(`lw_autobak_${currentUserName || '_'}`);

  return (
    <>
      <button onClick={() => setOpen(o => !o)}
        className="w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-[4px] active:bg-zinc-700/40 transition-colors"
        aria-label="Menu">
        <span className="block w-[18px] h-[3px] rounded-full bg-zinc-400" />
        <span className="block w-[18px] h-[3px] rounded-full bg-zinc-400" />
        <span className="block w-[18px] h-[3px] rounded-full bg-zinc-400" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute left-2.5 top-14 w-64 bg-[#16162a] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 animate-in fade-in slide-in-from-top-2 duration-150" onClick={e => e.stopPropagation()}>
            {/* Cloud Backup Status */}
            <div className="px-4 py-3 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                {cloudReady ? (
                  <Cloud className="w-4 h-4 text-sky-400" />
                ) : (
                  <CloudOff className="w-4 h-4 text-zinc-600" />
                )}
                <span className="text-xs font-semibold text-zinc-400">Cloud Backup</span>
              </div>
              {cloudReady ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[11px] text-zinc-500">
                    {cloudInfo?.exists
                      ? `${cloudInfo.caseCount} cases • ${formatTime(cloudInfo.timestamp)}`
                      : 'Pehli baar backup hoga'}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-[10px] text-zinc-600">Firebase config nahi hai</p>
              )}
            </div>

            {isAdmin && (
              <button onClick={() => { setOpen(false); showManageUsers(); }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-amber-500/5 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Admin</p>
                  <p className="text-[10px] text-zinc-500">Users manage karo</p>
                </div>
              </button>
            )}

            {cloudReady && cloudInfo?.exists && (
              <button onClick={() => { setOpen(false); handleCloudRestore(); }}
                disabled={restoring}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-sky-500/5 transition-colors disabled:opacity-50">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                  {restoring ? (
                    <span className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4 text-sky-400" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Cloud Se Restore</p>
                  <p className="text-[10px] text-zinc-500">{cloudInfo.caseCount} cases cloud pe hain</p>
                </div>
              </button>
            )}

            {hasLocalBackup && (
              <button onClick={() => { setOpen(false); handleLocalRestore(); }}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-emerald-500/5 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <HardDriveDownload className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Local Backup Restore</p>
                  <p className="text-[10px] text-zinc-500">Phone mein se wapas karo</p>
                </div>
              </button>
            )}

            <div className="border-t border-zinc-800/60" />
            <button onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-red-500/5 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-400">Exit</p>
                <p className="text-[10px] text-zinc-500">App lock karo</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// These statuses show as overlay on top of the unlocked app
const OVERLAY_STATUSES = ['manage-users', 'add-user', 'user-created'] as const;

function isOverlayStatus(s: string): boolean {
  return (OVERLAY_STATUSES as readonly string[]).includes(s);
}

const autoBackup = (() => {
  let lastLocalJson = '';
  let localTimer: ReturnType<typeof setTimeout> | null = null;

  let lastCloudJson = '';
  let cloudTimer: ReturnType<typeof setTimeout> | null = null;

  return (cases: unknown[], expenses: unknown[], userName: string, userId: string | null) => {
    const data = JSON.stringify({ cases, expenses });

    // Local backup — 500ms debounce
    if (localTimer) clearTimeout(localTimer);
    localTimer = setTimeout(() => {
      if (data === lastLocalJson) return;
      lastLocalJson = data;
      try {
        const key = `lw_autobak_${userName || '_'}`;
        localStorage.setItem(key, JSON.stringify({ cases, expenses, _u: userName, _t: Date.now() }));
      } catch { /* storage full */ }
    }, 500);

    // Cloud backup — 10s when undo active (give user time), else 3s
    if (!userId) return;
    if (cloudTimer) clearTimeout(cloudTimer);
    clearCloudUndoTimer();
    const cloudDelay = isUndoPaused() ? 10000 : 3000;
    cloudTimer = setTimeout(() => {
      if (data === lastCloudJson) return;
      lastCloudJson = data;
      saveToCloud(userId, cases, expenses).catch(() => {});
    }, cloudDelay);
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
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const initDoneRef = useRef(false);
  const reencryptRef = useRef(false);
  const autoLockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cloudRestoring, setCloudRestoring] = useState(false);
  const [showCloudPrompt, setShowCloudPrompt] = useState(false);
  const [cloudCaseCount, setCloudCaseCount] = useState(0);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  // Register service worker for offline support
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

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

  // After init: if local is empty, check cloud for restore
  useEffect(() => {
    if (!initialized || !hasEncryptionKey()) return;
    if (reencryptRef.current) return;

    // Mark re-encrypt done
    reencryptRef.current = true;

    // If both empty, check cloud
    if (cases.length === 0 && expenses.length === 0) {
      const userId = getCurrentUserId();
      if (!userId || !isCloudReady()) return;

      getCloudInfo(userId).then(async (info) => {
        if (info.exists && info.caseCount > 0) {
          setCloudCaseCount(info.caseCount);
          setShowCloudPrompt(true);
        }
      });
      return;
    }

    // Data exists locally — re-encrypt + save
    Promise.all([saveCases(cases), saveExpenses(expenses)]).catch(() => {});
  }, [initialized, cases, expenses]);

  // Re-encrypt + auto-backup on every data change (after first init)
  useEffect(() => {
    if (!initialized || !hasEncryptionKey() || !reencryptRef.current) return;
    const userId = getCurrentUserId();
    autoBackup(cases, expenses, currentUserName, userId);
  }, [initialized, cases, expenses, currentUserName]);

  // Cloud restore handler
  const handleCloudRestorePrompt = async () => {
    const userId = getCurrentUserId();
    if (!userId) { setShowCloudPrompt(false); return; }
    setCloudRestoring(true);
    try {
      const data = await loadFromCloud(userId);
      if (!data) { toast.error('Cloud pe data nahi mila'); setCloudRestoring(false); setShowCloudPrompt(false); return; }
      const mc = (c: Record<string, unknown>) => ({ caseId: String(c.caseId||''), lawyerName: String(c.lawyerName||''), partyName: String(c.partyName||''), opponentName: String(c.opponentName||''), caseType: String(c.caseType||''), section: String(c.section||''), policeStation: String(c.policeStation||''), enteringDate: String(c.enteringDate||''), nextDate: String(c.nextDate||''), phone: String(c.phone||''), judgeRemarks: String(c.judgeRemarks||''), pendingFee: Number(c.pendingFee)||0, totalFeeReceived: Number(c.totalFeeReceived)||0, createdAt: Number(c.createdAt)||0, updatedAt: Number(c.updatedAt)||0, history: Array.isArray(c.history)?c.history:[] });
      const me = (e: Record<string, unknown>) => ({ id: String(e.id||''), caseId: String(e.caseId||''), lawyerName: String(e.lawyerName||''), partyName: String(e.partyName||''), description: String(e.description||''), amount: Number(e.amount)||0, date: String(e.date||''), createdAt: Number(e.createdAt)||0, category: String(e.category||'case_expense') });
      await importFromSync(data.cases.map(mc) as never[], (data.expenses||[]).map(me) as never[]);
      toast.success('Cloud se restore ho gaya!', { description: `${data.cases.length} cases` });
    } catch { toast.error('Restore fail'); }
    setCloudRestoring(false);
    setShowCloudPrompt(false);
  };

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
  if (authStatus !== 'unlocked' && !isOverlayStatus(authStatus)) return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <LoginScreen />
      <AppToaster />
    </div>
  );

  const showOverlay = isOverlayStatus(authStatus);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <header className="flex items-center px-4 py-3 border-b border-white/5 flex-shrink-0 relative">
        {/* Left: hamburger menu */}
        <div className="w-10 flex-shrink-0 flex justify-start">
          <HeaderMenu />
        </div>
        {/* Center: INSAF + icon */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="text-[26px] leading-none">⚖️</span>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none" style={{ textShadow: '0 0 30px rgba(255,255,255,0.06)' }}>INSAF</h1>
        </div>
        {/* Right spacer for centering */}
        <div className="w-10 flex-shrink-0" />
      </header>
      <main className="flex-1 overflow-y-auto"><ViewRouter /></main>
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">Lawyer Case Manager • Secured</p>
      </footer>

      {/* Cloud restore prompt — when local empty but cloud has data */}
      {showCloudPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#16162a] border border-zinc-800/80 rounded-2xl p-5 w-full max-w-xs text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-sky-500/10 flex items-center justify-center mx-auto mb-3">
              <Cloud className="w-6 h-6 text-sky-400" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Cloud pe Data Hai</h3>
            <p className="text-xs text-zinc-400 mb-4">
              {cloudCaseCount} cases cloud mein mile. Restore karna hai?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowCloudPrompt(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-sm font-medium text-zinc-300 active:bg-zinc-700 transition-colors">
                Nahi
              </button>
              <button onClick={handleCloudRestorePrompt} disabled={cloudRestoring}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 text-sm font-medium text-white active:bg-sky-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {cloudRestoring && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Haan Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay screens (manage users, add user, user created) */}
      {showOverlay && <LoginScreen />}
      <AppToaster />
    </div>
  );
}