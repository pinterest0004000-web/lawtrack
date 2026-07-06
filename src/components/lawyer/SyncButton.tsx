'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { useAuthStore } from '@/store/auth-store';
import { Download, Upload, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function BackupButton() {
  const cases = useLawyerStore(s => s.cases);
  const expenses = useLawyerStore(s => s.expenses);
  const importFromSync = useLawyerStore(s => s.importFromSync);
  const currentUserName = useAuthStore(s => s.currentUserName);
  const [importing, setImporting] = useState(false);
  const [justExported, setJustExported] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      a.download = `lawtrack_backup_${currentUserName || 'data'}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setJustExported(true);
      setTimeout(() => setJustExported(false), 2000);
      toast.success('Backup saved!', { description: `${cases.length} cases, ${expenses.length} expenses` });
    } catch {
      toast.error('Backup failed');
    }
  }, [cases, expenses, currentUserName]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.cases || !Array.isArray(data.cases)) {
        toast.error('Invalid backup file');
        return;
      }
      const importCases = data.cases.map((c: Record<string, unknown>) => ({
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
      }));
      const importExpenses = (data.expenses || []).map((e: Record<string, unknown>) => ({
        id: String(e.id || ''),
        caseId: String(e.caseId || ''),
        lawyerName: String(e.lawyerName || ''),
        partyName: String(e.partyName || ''),
        description: String(e.description || ''),
        amount: Number(e.amount) || 0,
        date: String(e.date || ''),
        createdAt: Number(e.createdAt) || 0,
        category: String(e.category || 'case_expense'),
      }));
      await importFromSync(importCases, importExpenses);
      toast.success('Data restored!', { description: `${importCases.length} cases, ${importExpenses.length} expenses` });
    } catch {
      toast.error('Import failed', { description: 'Galat file hai' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [importFromSync]);

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleExport} disabled={justExported}
        className="h-8 px-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center gap-1.5 active:bg-zinc-700/80 transition-colors disabled:opacity-50"
        aria-label="Backup data">
        {justExported ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5 text-zinc-400" />}
        <span className="text-[10px] sm:text-xs text-zinc-400">Backup</span>
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      <button onClick={() => fileRef.current?.click()} disabled={importing}
        className="h-8 px-2 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center gap-1.5 active:bg-zinc-700/80 transition-colors disabled:opacity-50"
        aria-label="Restore data">
        {importing ? <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-zinc-400" />}
        <span className="text-[10px] sm:text-xs text-zinc-400">Restore</span>
      </button>
    </div>
  );
}