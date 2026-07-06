'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { getLastSyncTime, setLastSyncTime } from '@/lib/storage';
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SyncButton() {
  const getCasesForSync = useLawyerStore(s => s.getCasesForSync);
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number>(0);
  const [justSynced, setJustSynced] = useState(false);
  const mountedRef = useRef(true);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getLastSyncTime().then(t => { if (mountedRef.current) setLastSync(t); });
    return () => { mountedRef.current = false; };
  }, []);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setJustSynced(false);

    try {
      // First, try to pull from server
      let hasServerData = false;
      try {
        const pullRes = await fetch('/api/sync');
        if (pullRes.ok) {
          const pullData = await pullRes.json();
          if (pullData.cases && Array.isArray(pullData.cases) && pullData.cases.length > 0) {
            const serverCases = pullData.cases.map((c: Record<string, unknown>) => ({
              caseId: String(c.caseId || ''),
              lawyerName: String(c.lawyerName || ''),
              partyName: String(c.partyName || ''),
              opponentName: String(c.opponentName || ''),
              caseType: String(c.caseType || ''),
              section: String(c.section || ''),
              policeStation: String(c.policeStation || ''),
              enteringDate: String(c.enteringDate || ''),
              nextDate: String(c.nextDate || ''),
              phone: String(c.phone || ''),
              judgeRemarks: String(c.judgeRemarks || ''),
              pendingFee: Number(c.pendingFee) || 0,
              totalFeeReceived: Number(c.totalFeeReceived) || 0,
              createdAt: new Date(String(c.createdAt)).getTime() || 0,
              updatedAt: new Date(String(c.updatedAt)).getTime() || 0,
              history: typeof c.history === 'string'
                ? (() => { try { return JSON.parse(c.history); } catch { return []; } })()
                : (Array.isArray(c.history) ? c.history : []),
            }));
            const serverExpenses = (pullData.expenses || []).map((e: Record<string, unknown>) => ({
              id: String(e.id || ''),
              caseId: String(e.caseId || ''),
              lawyerName: String(e.lawyerName || ''),
              partyName: String(e.partyName || ''),
              description: String(e.description || ''),
              amount: Number(e.amount) || 0,
              date: String(e.date || ''),
              createdAt: new Date(String(e.createdAt)).getTime() || 0,
            }));
            await importFromSync(serverCases, serverExpenses);
            hasServerData = true;
          }
        }
      } catch {
        // Pull failed, continue with push
      }

      // Push local data to server
      try {
        const { cases, expenses } = getCasesForSync();
        const pushRes = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cases: cases.map(c => ({ ...c, history: JSON.stringify(c.history) })),
            expenses,
          }),
        });

        if (pushRes.ok) {
          const now = Date.now();
          setLastSync(now);
          await setLastSyncTime(now);
          setJustSynced(true);
          toast.success(hasServerData ? 'Data synced & merged!' : 'Data backed up!', {
            description: new Date(now).toLocaleTimeString('en-IN'),
          });

          // Reset justSynced after 3 seconds
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          syncTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setJustSynced(false);
          }, 3000);
        } else {
          toast.error('Sync failed', { description: 'Server error' });
        }
      } catch {
        toast.error('Sync failed', { description: 'Network error' });
      }
    } catch {
      toast.error('Sync failed');
    } finally {
      if (mountedRef.current) setSyncing(false);
    }
  }, [syncing, getCasesForSync, importFromSync]);

  return (
    <button
      onClick={handleSync}
      disabled={syncing}
      className="feature-box flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-card text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
      aria-label="Sync data"
    >
      {syncing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : justSynced ? (
        <Check className="w-4 h-4 text-emerald-400" />
      ) : lastSync > 0 ? (
        <Cloud className="w-4 h-4 text-emerald-400" />
      ) : (
        <CloudOff className="w-4 h-4" />
      )}
      <span className="text-[10px] sm:text-xs">
        {syncing ? 'Syncing...' : justSynced ? 'Done!' : 'Sync'}
      </span>
    </button>
  );
}