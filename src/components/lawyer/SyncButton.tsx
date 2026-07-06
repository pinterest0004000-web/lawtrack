'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { useAuthStore } from '@/store/auth-store';
import { Download, Upload, Loader2, Check, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

// Check if auto-backup exists for current user
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
  const cases = useLawyerStore(s => s.cases);
  const expenses = useLawyerStore(s => s.expenses);
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const currentUserName = useAuthStore(s => s.currentUserName);
  const [importing, setImporting] = useState(false);
  const [justExported, setJustExported] = useState(false);
  const [showAutoRestore, setShowAutoRestore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const autoBak = currentUserName ? getAutoBackup(currentUserName) : null;

  const handleExport = useCallback(() => {
    try {
      const data = {
        _v: 1,
        _user: currentUserName,
        _date: new Date().toISOString(),
        cases,
        expenses,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lawtrack_backup_${currentUserName || 'data'}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setJustExported(true);
      setTimeout(() => setJustExported(false), 2000);
      toast.success('Backup saved!', { description: `${cases.length} cases, ${expenses.length} expenses` });
    } catch {
      toast.error('Backup failed');
    }
  }, [cases, expenses, currentUserName]);

  const doImport = useCallback(async (importCases: unknown[], importExpenses: unknown[]) => {
    await importFromSync(importCases as never[], importExpenses as never[]);
    toast.success('Data restored!', { description: `${importCases.length} cases, ${importExpenses.length} expenses` });
  }, [importFromSync]);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.cases || !Array.isArray(data.cases)) { toast.error('Invalid backup file'); return; }
      await doImport(data.cases.map(mapCase), (data.expenses || []).map(mapExpense));
    } catch {
      toast.error('Import failed', { description: 'Galat file hai' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [doImport]);

  const handleAutoRestore = useCallback(async () => {
    if (!autoBak || !currentUserName) return;
    setImporting(true);
    try {
      await doImport(autoBak.cases.map(mapCase), autoBak.expenses.map(mapExpense));
      setShowAutoRestore(false);
    } catch { toast.error('Auto-restore failed'); }
    finally { setImporting(false); }
  }, [autoBak, currentUserName, doImport]);

  return (
    <>
      <div className="flex items-center gap-1">
        {autoBak && (
          <button onClick={() => setShowAutoRestore(true)} disabled={importing}
            className="h-8 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1.5 active:bg-emerald-500/20 transition-colors disabled:opacity-50"
            aria-label="Auto-backup available">
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] sm:text-xs text-emerald-400 hidden sm:inline">Auto</span>
          </button>
        )}
        <button onClick={handleExport} disabled={justExported}
          className="h-8 px-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center gap-1.5 active:bg-zinc-700/80 transition-colors disabled:opacity-50"
          aria-label="Backup data">
          {justExported ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-zinc-400" />}
          <span className="text-[10px] sm:text-xs text-zinc-400">Save</span>
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileImport} />
        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="h-8 px-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center gap-1.5 active:bg-zinc-700/80 transition-colors disabled:opacity-50"
          aria-label="Restore data">
          {importing ? <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-zinc-400" />}
          <span className="text-[10px] sm:text-xs text-zinc-400">Load</span>
        </button>
      </div>

      {/* Auto-restore confirmation */}
      {showAutoRestore && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-6" onClick={() => setShowAutoRestore(false)}>
          <div className="bg-[#0f0f18] border border-zinc-800 rounded-2xl p-5 max-w-[320px] w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white mb-2">Auto-Backup se Restore?</h3>
            <p className="text-xs text-zinc-400 mb-1">Last backup: {autoBak?.time}</p>
            <p className="text-xs text-zinc-500 mb-4">{autoBak?.cases.length} cases, {autoBak?.expenses.length} expenses</p>
            <div className="flex gap-2">
              <button onClick={() => setShowAutoRestore(false)} className="flex-1 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-sm text-zinc-300">Nahi</button>
              <button onClick={handleAutoRestore} disabled={importing} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-sm text-white font-medium disabled:opacity-50 flex items-center justify-center gap-1.5">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Haan, Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}