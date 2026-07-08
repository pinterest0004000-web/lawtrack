'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { generateCaseId, getTodayStr, formatCurrency } from '@/lib/utils-lawyer';
import { ArrowLeft, Check, X } from 'lucide-react';
import { toast } from '@/components/AppToaster';

const INITIAL_FORM = {
  lawyerName: '',
  partyName: '',
  opponentName: '',
  caseType: '',
  section: '',
  policeStation: '',
  enteringDate: getTodayStr(),
  nextDate: '',
  phone: '',
  judgeRemarks: '',
  totalFee: '',
  paidFee: '',
};

export default function AddCaseForm() {
  const addCase = useLawyerStore(s => s.addCase);
  const cases = useLawyerStore(s => s.cases);
  const lawyerNames = useLawyerStore(s => s.lawyerNames);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [showLawyerSuggestions, setShowLawyerSuggestions] = useState(false);
  const mountedRef = useRef(true);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const existingIds = useMemo(() => cases.map(c => c.caseId), [cases]);
  const autoCaseId = useMemo(() => generateCaseId(existingIds), [existingIds]);

  const filteredLawyers = useMemo(() => {
    if (!form.lawyerName.trim()) return lawyerNames.slice(0, 5);
    const q = form.lawyerName.toLowerCase();
    return lawyerNames.filter(n => n.toLowerCase().includes(q)).slice(0, 5);
  }, [form.lawyerName, lawyerNames]);

  const updateField = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'lawyerName') {
      setShowLawyerSuggestions(true);
    }
  }, []);

  const selectLawyer = useCallback((name: string) => {
    setForm(prev => ({ ...prev, lawyerName: name }));
    setShowLawyerSuggestions(false);
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    if (!showLawyerSuggestions) return;
    const handler = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setShowLawyerSuggestions(false);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [showLawyerSuggestions]);

  const handleSubmit = useCallback(async () => {
    if (!form.lawyerName.trim()) { toast.error('Lawyer name is required'); return; }
    if (!form.partyName.trim()) { toast.error('Party name is required'); return; }
    if (!form.nextDate) { toast.error('Next date is required'); return; }

    setSaving(true);
    const ok = await addCase({
      caseId: autoCaseId,
      lawyerName: form.lawyerName.trim(),
      partyName: form.partyName.trim(),
      opponentName: form.opponentName.trim(),
      caseType: form.caseType.trim(),
      section: form.section.trim(),
      policeStation: form.policeStation.trim(),
      enteringDate: form.enteringDate,
      nextDate: form.nextDate,
      phone: form.phone.trim(),
      judgeRemarks: form.judgeRemarks.trim(),
      totalFee: parseFloat(form.totalFee) || 0,
      paidFee: parseFloat(form.paidFee) || 0,
    });

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      toast.success('Case added successfully!', { description: `Case #${autoCaseId}` });
      setForm(INITIAL_FORM);
      setCurrentView('all');
    } else {
      toast.error('Failed to add case. Storage may be full.');
    }
  }, [form, autoCaseId, addCase, setCurrentView]);

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-[#D4A843]/50 transition-colors";

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button
          onClick={() => setCurrentView('home')}
          className="feature-box w-9 h-9 rounded-xl bg-[#141c2b] flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <h2 className="text-lg font-bold text-white">Add New Case</h2>
      </div>

      <div className="px-3 sm:px-4 pb-4 max-h-[calc(100vh-120px)] overflow-y-auto" ref={formRef}>
        <div className="bg-[#141c2b] rounded-2xl p-4 space-y-3">
          {/* Case ID */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Case ID (Auto)</label>
            <input type="text" value={autoCaseId} readOnly className={`${inputClass} opacity-60`} />
          </div>

          {/* Lawyer Name with Suggestions */}
          <div className="relative">
            <label className="text-xs text-zinc-500 mb-1 block">Lawyer Name *</label>
            <div className="relative">
              <input
                type="text"
                value={form.lawyerName}
                onChange={e => updateField('lawyerName', e.target.value)}
                onFocus={() => setShowLawyerSuggestions(true)}
                placeholder="Enter lawyer name"
                className={inputClass}
                autoComplete="off"
              />
              {form.lawyerName && (
                <button
                  type="button"
                  onClick={() => { setForm(prev => ({ ...prev, lawyerName: '' })); setShowLawyerSuggestions(true); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {showLawyerSuggestions && filteredLawyers.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#141c2b] rounded-xl overflow-hidden border border-white/10 max-h-32 overflow-y-auto">
                {filteredLawyers.map(name => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectLawyer(name)}
                    className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/5 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Party Name */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Party Name *</label>
            <input type="text" value={form.partyName} onChange={e => updateField('partyName', e.target.value)} placeholder="Enter party name" className={inputClass} />
          </div>

          {/* Opponent Name */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Opponent Name</label>
            <input type="text" value={form.opponentName} onChange={e => updateField('opponentName', e.target.value)} placeholder="Enter opponent name" className={inputClass} />
          </div>

          {/* Case Type + Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Case Type</label>
              <input type="text" value={form.caseType} onChange={e => updateField('caseType', e.target.value)} placeholder="e.g. Criminal" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Section</label>
              <input type="text" value={form.section} onChange={e => updateField('section', e.target.value)} placeholder="e.g. 302" className={inputClass} />
            </div>
          </div>

          {/* Police Station */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Police Station</label>
            <input type="text" value={form.policeStation} onChange={e => updateField('policeStation', e.target.value)} placeholder="Enter police station" className={inputClass} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Entering Date</label>
              <input type="date" value={form.enteringDate} onChange={e => updateField('enteringDate', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Next Date *</label>
              <input type="date" value={form.nextDate} onChange={e => updateField('nextDate', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Phone Number</label>
            <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} placeholder="Enter phone number" className={inputClass} inputMode="numeric" />
          </div>

          {/* Total Fee + Received Fee + Pending Fee */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Total Fee</label>
              <input type="number" value={form.totalFee} onChange={e => updateField('totalFee', e.target.value)} placeholder="0" inputMode="numeric" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Received Fee</label>
              <input type="number" value={form.paidFee} onChange={e => updateField('paidFee', e.target.value)} placeholder="0" inputMode="numeric" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Pending Fee</label>
              <div className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-red-400 font-semibold">
                {formatCurrency(Math.max(0, (parseFloat(form.totalFee) || 0) - (parseFloat(form.paidFee) || 0)))}
              </div>
            </div>
          </div>

          {/* Judge Remarks */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Judge Remarks</label>
            <textarea value={form.judgeRemarks} onChange={e => updateField('judgeRemarks', e.target.value)} placeholder="Enter judge remarks" rows={2} className={inputClass} />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="feature-box w-full bg-[#D4A843] hover:bg-[#B8922E] disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Case
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}