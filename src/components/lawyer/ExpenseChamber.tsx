'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { groupByLawyer, getTodayExpenses, formatCurrency } from '@/lib/utils-lawyer';
import { ArrowLeft, Plus, X, Building2 } from 'lucide-react';
import { toast } from '@/components/AppToaster';

const PAGE_SIZE = 40;

export default function ExpenseChamber() {
  const expenses = useLawyerStore(s => s.expenses);
  const lawyerNames = useLawyerStore(s => s.lawyerNames);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const addExpense = useLawyerStore(s => s.addExpense);

  const [page, setPage] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formLawyer, setFormLawyer] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Today's chamber expenses
  const todayChamberExp = useMemo(
    () => getTodayExpenses(expenses).filter(e => e.category === 'chamber_expense'),
    [expenses]
  );
  const grouped = useMemo(() => groupByLawyer(todayChamberExp), [todayChamberExp]);
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

  const filteredLawyers = useMemo(() => {
    if (!formLawyer.trim()) return lawyerNames.slice(0, 8);
    return lawyerNames.filter(n => n.toLowerCase().includes(formLawyer.toLowerCase())).slice(0, 8);
  }, [formLawyer, lawyerNames]);

  const handleSave = useCallback(async () => {
    if (!formLawyer.trim()) { toast.error('Select lawyer'); return; }
    const amt = parseFloat(formAmount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (!formDesc.trim()) { toast.error('Enter description'); return; }

    setSaving(true);
    const ok = await addExpense(
      'CHAMBER', // special caseId for chamber expenses
      formLawyer.trim(),
      'Chamber',
      formDesc.trim(),
      amt,
      new Date().toISOString().split('T')[0],
      'chamber_expense'
    );

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      toast.success('Chamber expense added');
      setFormDesc('');
      setFormAmount('');
      setShowAddForm(false);
    } else {
      toast.error('Failed to save');
    }
  }, [formLawyer, formAmount, formDesc, addExpense]);

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/50 transition-colors";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button onClick={() => setCurrentView('expenses')} className="feature-box w-9 h-9 rounded-xl bg-[#141c2b] flex items-center justify-center" aria-label="Go back">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Chamber Expense</h2>
          <p className="text-[10px] text-zinc-500">{todayChamberExp.length} expense{todayChamberExp.length !== 1 ? 's' : ''} today</p>
        </div>
        <button
          onClick={() => setShowAddForm(f => !f)}
          className="feature-box w-9 h-9 rounded-xl bg-orange-600/20 flex items-center justify-center"
          aria-label="Add chamber expense"
        >
          <Plus className="w-5 h-5 text-orange-400" />
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="px-3 sm:px-4 mb-3 animate-slide-up">
          <div className="bg-[#141c2b] rounded-2xl p-4 space-y-3 border border-orange-500/10">
            <p className="text-sm font-semibold text-white">Add Chamber Expense</p>

            {/* Lawyer Name */}
            <div className="relative">
              <label className="text-xs text-zinc-500 mb-1 block">Lawyer Name *</label>
              <input
                type="text"
                value={formLawyer}
                onChange={e => setFormLawyer(e.target.value)}
                placeholder="Select lawyer"
                className={inputClass}
                autoComplete="off"
              />
              {formLawyer && (
                <button type="button" onClick={() => setFormLawyer('')} className="absolute right-3 top-8 text-zinc-500">
                  <X className="w-4 h-4" />
                </button>
              )}
              {formLawyer && filteredLawyers.length > 0 && !lawyerNames.includes(formLawyer.trim()) && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#141c2b] rounded-xl overflow-hidden border border-white/10 max-h-28 overflow-y-auto">
                  {filteredLawyers.map(name => (
                    <button key={name} type="button" onClick={() => setFormLawyer(name)} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5">
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <input
              type="text"
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="Description (e.g. Tea, Printing, Peon)"
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
              disabled={saving || !formLawyer.trim() || !formDesc.trim() || !formAmount}
              className="feature-box w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving...' : 'Save Chamber Expense'}
            </button>
          </div>
        </div>
      )}

      {/* Expense List by Lawyer */}
      <div className="px-3 sm:px-4 pb-4">
        {visibleLawyers.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-600 text-sm">No chamber expenses today</p>
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
                      <div className="w-7 h-7 rounded-full bg-orange-600/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-orange-300">{name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{name}</h3>
                        <p className="text-[10px] text-zinc-500">{lawyerExpenses.length} expense{lawyerExpenses.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-orange-400">{formatCurrency(lawyerTotal)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {lawyerExpenses.map(e => (
                      <div key={e.id} className="bg-[#141c2b] rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-orange-400 font-medium">Chamber</span>
                          <span className="text-sm font-bold text-orange-400">-{formatCurrency(e.amount)}</span>
                        </div>
                        <p className="text-sm text-white mt-1 truncate">{e.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {hasMore && (
              <button onClick={() => setPage(p => p + 1)} className="w-full text-center py-3 text-sm text-[#D4A843] font-medium">
                Load more...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}