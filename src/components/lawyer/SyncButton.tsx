'use client';

import React, { useState, useCallback } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { useAuthStore } from '@/store/auth-store';
import { RotateCcw, Loader2 } from 'lucide-react';
import { toast } from '@/components/AppToaster';

function getAutoBackup(userName: string): { cases: unknown[]; expenses: unknown[]; time: string } | null {
  try {
    const key = `lw_autobak_${userName || '_'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.cases || !Array.isArray(data.cases)) return null;
    return { cases: data.cases, expenses: data.expenses || [], time: new Date(data._t).toLocaleString('en-PK') };
  } catch { return null; }
}

const mapCase = (c: Record<string, unknown>) => ({
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
  judgeName: String(c.judgeName || ''),
  judgeRemarks: String(c.judgeRemarks || ''),
  pendingFee: Number(c.pendingFee) || 0,
  totalFeeReceived: Number(c.totalFeeReceived) || 0,
  createdAt: Number(c.createdAt) || 0,
  updatedAt: Number(c.updatedAt) || 0,
  history: Array.isArray(c.history) ? c.history : [],
});

const mapExpense = (e: Record<string, unknown>) => ({
  id: String(e.id || ''),
  caseId: String(e.caseId || ''),
  lawyerName: String(e.lawyerName || ''),
  partyName: String(e.partyName || ''),
  description: String(e.description || ''),
  amount: Number(e.amount) || 0,
  date: String(e.date || ''),
  createdAt: Number(e.createdAt) || 0,
  category: String(e.category || 'case_expense'),
});

export default function BackupButton() {
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const currentUserName = useAuthStore(s => s.currentUserName);
  const [showRestore, setShowRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const autoBak = currentUserName ? getAutoBackup(currentUserName) : null;

  const handleRestore = useCallback(async () => {
    if (!autoBak) return;
    setRestoring(true);
    try {
      await importFromSync(autoBak.cases.map(mapCase) as never[], autoBak.expenses.map(mapExpense) as never[]);
      toast.success('Data restore ho gaya!', { description: `${autoBak.cases.length} cases, ${autoBak.expenses.length} expenses` });
      setShowRestore(false);
    } catch { toast.error('Restore fail ho gaya'); }
    finally { setRestoring(false); }
  }, [autoBak, importFromSync]);

  if (!autoBak) return null;

  return (
    <>
      <button onClick={() => setShowRestore(true)}
        className="h-8 px-2 rounded-lg bg-[#D4A843]/10 border border-[#D4A843]/20 flex items-center gap-1.5 active:bg-emerald-500/20 transition-colors"
        aria-label="Auto-backup restore">
        <RotateCcw className="w-3.5 h-3.5 text-[#D4A843]" />
        <span className="text-[10px] sm:text-xs text-[#D4A843]">Restore</span>
      </button>

      {showRestore && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6" onClick={() => setShowRestore(false)}>
          <div className="bg-[#0f0f18] border border-zinc-800 rounded-2xl p-5 max-w-[320px] w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-2">Auto-Backup se Restore?</h3>
            <p className="text-xs text-zinc-400 mb-1">Last backup: {autoBak.time}</p>
            <p className="text-xs text-zinc-500 mb-4">{autoBak.cases.length} cases, {autoBak.expenses.length} expenses</p>
            <div className="flex gap-2">
              <button onClick={() => setShowRestore(false)} className="flex-1 py-2.5 rounded-xl bg-[#141c2b] border border-zinc-700 text-sm text-zinc-300">Nahi</button>
              <button onClick={handleRestore} disabled={restoring} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm text-white font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {restoring && <Loader2 className="w-4 h-4 animate-spin" />}
                Haan, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}