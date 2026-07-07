'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import type { CaseEntry } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils-lawyer';
import { ArrowLeft, Trash2, Search, AlertTriangle } from 'lucide-react';
import { toast } from '@/components/AppToaster';
import { pauseCloudForUndo } from '@/lib/cloud-backup';

export default function DeleteCaseScreen() {
  const cases = useLawyerStore(s => s.cases);
  const deleteCase = useLawyerStore(s => s.deleteCase);
  const restoreCase = useLawyerStore(s => s.restoreCase);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (confirmId) {
      timerRef.current = setTimeout(() => setConfirmId(null), 3000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [confirmId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter(c =>
      c.caseId.toLowerCase().includes(q) ||
      c.partyName.toLowerCase().includes(q) ||
      c.opponentName.toLowerCase().includes(q) ||
      c.lawyerName.toLowerCase().includes(q) ||
      c.caseType.toLowerCase().includes(q) ||
      c.section.toLowerCase().includes(q)
    );
  }, [cases, search]);

  const handleDelete = useCallback(async (caseId: string) => {
    if (confirmId !== caseId) {
      setConfirmId(caseId);
      return;
    }
    const caseData = cases.find(c => c.caseId === caseId);
    if (!caseData) return;

    setDeleting(caseId);
    pauseCloudForUndo();
    const ok = await deleteCase(caseId);
    if (ok) {
      setConfirmId(null);
      // Undo toast — 10 second window
      toast('Case deleted', {
        description: `10s me undo kar sakte ho — ${caseData.partyName} vs ${caseData.opponentName}`,
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await restoreCase(caseData);
            toast.success('Case wapis aa gaya!');
          },
        },
        actionButtonStyle: {
          backgroundColor: '#7c3aed',
          color: 'white',
          fontWeight: 600,
          borderRadius: '8px',
          paddingLeft: '12px',
          paddingRight: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        },
      });
    } else {
      toast.error('Delete failed');
    }
    setDeleting(null);
  }, [confirmId, cases, deleteCase, restoreCase]);

  const grouped = useMemo(() => {
    const map = new Map<string, CaseEntry[]>();
    filtered.forEach(c => {
      const key = c.lawyerName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return map;
  }, [filtered]);

  return (
    <div className="animate-fade-in px-3 sm:px-4 pt-3 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setCurrentView('home')} className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center" aria-label="Back">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Delete Case</h2>
          <p className="text-[11px] text-zinc-500">{cases.length} total cases</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
          <Trash2 className="w-4 h-4 text-red-400" />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search case ID, party, lawyer, type..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-red-500/50 transition-colors"
        />
      </div>

      {/* Warning */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <p className="text-[11px] text-amber-400/80">Tap twice to delete • Undo available for 10 sec</p>
      </div>

      {/* List */}
      <div className="space-y-3">
        {grouped.size === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-8">No cases found</p>
        ) : (
          Array.from(grouped.entries()).map(([lawyer, items]) => (
            <div key={lawyer}>
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <div className="w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-violet-400">{lawyer.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-xs font-semibold text-zinc-300">{lawyer}</span>
                <span className="text-[10px] text-zinc-600">({items.length})</span>
              </div>
              <div className="space-y-1.5">
                {items.map(c => (
                  <div key={c.caseId} className="glass-card rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-500">#{c.caseId}</span>
                        {c.caseType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400">{c.caseType}</span>}
                      </div>
                      <p className="text-sm font-medium text-white truncate mt-0.5">{c.partyName} <span className="text-zinc-500 font-normal">vs</span> {c.opponentName}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-zinc-600">Next: {formatDate(c.nextDate)}</span>
                        {c.pendingFee > 0 && <span className="text-[10px] text-red-400">{formatCurrency(c.pendingFee)} pending</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(c.caseId)}
                      disabled={deleting === c.caseId}
                      className={`feature-box w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        confirmId === c.caseId
                          ? 'bg-red-600 animate-pulse'
                          : 'bg-red-500/15 hover:bg-red-500/30'
                      }`}
                    >
                      {deleting === c.caseId ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-red-400" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}