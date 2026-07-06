'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { groupByLawyer, getTodayExpenses, formatCurrency, formatDate } from '@/lib/utils-lawyer';
import { ArrowLeft, Search, Plus, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 40;

export default function ExpenseByCase() {
  const cases = useLawyerStore(s => s.cases);
  const expenses = useLawyerStore(s => s.expenses);
  const lawyerNames = useLawyerStore(s => s.lawyerNames);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const addExpense = useLawyerStore(s => s.addExpense);
  const setSelectedCaseId = useLawyerStore(s => s.setSelectedCaseId);

  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formLawyer, setFormLawyer] = useState('');
  const [formCaseId, setFormCaseId] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Today's case expenses, grouped by lawyer
  const todayCaseExp = useMemo(
    () => getTodayExpenses(expenses).filter(e => e.category === 'case_expense' || (!e.category && e.caseId)),
    [expenses]
  );
  const grouped = useMemo(() => groupByLawyer(todayCaseExp), [todayCaseExp]);
  const lawyerKeys = useMemo(() => Object.keys(grouped), [grouped]);

  const visibleLawyers = useMemo(() => {
    let count = 0;
    const result: string[] = [];
    for (const name of lawyerKeys) {
      if (count >= PAGE_SIZE * (page + 1)) break;
      result.push(name);
      count += grouped[name].length;
    }
    return result;
  }, [lawyerKeys, grouped, page]);

  const hasMore = useMemo(() => {
    let count = 0;
    for (const name of lawyerKeys) {
      count += grouped[name].length;
      if (count > PAGE_SIZE * (page + 1)) return true;
    }
    return false;
  }, [lawyerKeys, grouped, page]);

  // Case suggestions based on selected lawyer
  const filteredCases = useMemo(() => {
    if (!formLawyer.trim()) return [];
    return cases.filter(c => c.lawyerName === formLawyer);
  }, [cases, formLawyer]);

  // Filtered lawyer suggestions
  const filteredLawyers = useMemo(() => {
    if (!formLawyer.trim()) return lawyerNames.slice(0, 8);
    return lawyerNames.filter(n => n.toLowerCase().includes(formLawyer.toLowerCase())).slice(0, 8);
  }, [formLawyer, lawyerNames]);

  const selectedCaseData = useMemo(() => {
    if (!formCaseId) return null;
    return cases.find(c => c.caseId === formCaseId) || null;
  }, [cases, formCaseId]);

  const openCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('case-detail');
  }, [setSelectedCaseId, setCurrentView]);

  const handleSave = useCallback(async () => {
    if (!formLawyer.trim()) { toast.error('Select lawyer'); return; }
    if (!formCaseId) { toast.error('Select case'); return; }
    const amt = parseFloat(formAmount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (!formDesc.trim()) { toast.error('Enter description'); return; }

    setSaving(true);
    const partyName = selectedCaseData?.partyName || '';
    const ok = await addExpense(formCaseId, formLawyer.trim(), partyName, formDesc.trim(), amt, new Date().toISOString().split('T')[0], 'case_expense');

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      toast.success('Case expense added');
      setFormDesc('');
      setFormAmount('');
      setShowAddForm(false);
    } else {
      toast.error('Failed to save');
    }
  }, [formLawyer, formCaseId, formAmount, formDesc, selectedCaseData, addExpense]);

  const selectLawyer = useCallback((name: string) => {
    setFormLawyer(name);
    setFormCaseId('');
  }, []);

  const selectCase = useCallback((caseId: string) => {
    setFormCaseId(caseId);
  }, []);

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-violet-500/50 transition-colors";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button onClick={() => setCurrentView('expenses')} className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center" aria-label="Go back">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Expense By Cases</h2>
          <p className="text-[10px] text-zinc-500">{todayCaseExp.length} expense{todayCaseExp.length !== 1 ? 's' : ''} today</p>
        </div>
        <button
          onClick={() => setShowAddForm(f => !f)}
          className="feature-box w-9 h-9 rounded-xl bg-emerald-600/20 flex items-center justify-center"
          aria-label="Add expense"
        >
          <Plus className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="px-3 sm:px-4 mb-3 animate-slide-up">
          <div className="glass-card rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Add Case Expense</p>

            {/* Lawyer Name */}
            <div className="relative">
              <label className="text-xs text-zinc-500 mb-1 block">Lawyer Name *</label>
              <input
                type="text"
                value={formLawyer}
                onChange={e => { setFormLawyer(e.target.value); setFormCaseId(''); }}
                placeholder="Select lawyer"
                className={inputClass}
                autoComplete="off"
              />
              {formLawyer && (
                <button type="button" onClick={() => { setFormLawyer(''); setFormCaseId(''); }} className="absolute right-3 top-8 text-zinc-500">
                  <X className="w-4 h-4" />
                </button>
              )}
              {formLawyer && filteredLawyers.length > 0 && !cases.find(c => c.lawyerName === formLawyer) && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 glass-card rounded-xl overflow-hidden border border-white/10 max-h-28 overflow-y-auto">
                  {filteredLawyers.map(name => (
                    <button key={name} type="button" onClick={() => selectLawyer(name)} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5">
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Case Select */}
            {formLawyer && filteredCases.length > 0 && (
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Select Case *</label>
                <div className="glass-card rounded-xl max-h-36 overflow-y-auto">
                  {filteredCases.map(c => (
                    <button
                      key={c.caseId}
                      type="button"
                      onClick={() => selectCase(c.caseId)}
                      className={`w-full text-left px-3 py-2.5 border-b border-white/5 last:border-0 transition-colors ${formCaseId === c.caseId ? 'bg-violet-600/20' : 'hover:bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-violet-400">#{c.caseId}</span>
                        <span className="text-[10px] text-zinc-500">{formatDate(c.nextDate)}</span>
                      </div>
                      <p className="text-sm text-white truncate">{c.partyName} vs {c.opponentName}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <input
              type="text"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Description (e.g. Court fee, Travel)"
              className={inputClass}
            />

            {/* Amount */}
            <input
              type="number"
              value={formAmount}
              onChange={e => setFormAmount(e.target.value)}
              placeholder="Amount (Rs)"
              inputMode="numeric"
              className={inputClass}
            />

            <button
              onClick={handleSave}
              disabled={saving || !formLawyer || !formCaseId || !formDesc.trim() || !formAmount}
              className="feature-box w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save Expense'}
            </button>
          </div>
        </div>
      )}

      {/* Expense List by Lawyer */}
      <div className="px-3 sm:px-4 pb-4">
        {visibleLawyers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">No case expenses today</p>
          </div>
        ) : (
          <>
            {visibleLawyers.map(name => {
              const lawyerExpenses = grouped[name];
              const lawyerTotal = lawyerExpenses.reduce((s, e) => s + (e.amount || 0), 0);
              return (
                <div key={name} className="mb-4 animate-slide-up">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-emerald-600/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-300">{name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{name}</h3>
                        <p className="text-[10px] text-zinc-500">{lawyerExpenses.length} expense{lawyerExpenses.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(lawyerTotal)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {lawyerExpenses.map(e => (
                      <button
                        key={e.id}
                        onClick={() => openCase(e.caseId)}
                        className="feature-box w-full text-left glass-card rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-emerald-400">#{e.caseId}</span>
                          <span className="text-sm font-bold text-emerald-400">-{formatCurrency(e.amount)}</span>
                        </div>
                        <p className="text-sm text-white mt-1 truncate">{e.description}</p>
                        <p className="text-xs text-zinc-500 truncate">{e.partyName}</p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <button onClick={() => setPage(p => p + 1)} className="w-full text-center py-3 text-sm text-violet-400 font-medium">
                Load more...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}