'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { generateCaseId, getTodayStr } from '@/lib/utils-lawyer';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';

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
};

export default function AddCaseForm() {
  const addCase = useLawyerStore(s => s.addCase);
  const cases = useLawyerStore(s => s.cases);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const existingIds = useMemo(() => cases.map(c => c.caseId), [cases]);
  const autoCaseId = useMemo(() => generateCaseId(existingIds), [existingIds]);

  const updateField = useCallback((field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!form.lawyerName.trim()) { toast.error('Lawyer name is required'); return; }
    if (!form.partyName.trim()) { toast.error('Party name is required'); return; }
    if (!form.nextDate) { toast.error('Next date is required'); return; }

    setSaving(true);
    const ok = addCase({
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
    });

    setTimeout(() => {
      if (!mountedRef.current) return;
      setSaving(false);
      if (ok) {
        toast.success('Case added successfully!', { description: `Case #${autoCaseId}` });
        setForm(INITIAL_FORM);
        setCurrentView('all');
      } else {
        toast.error('Failed to add case. Storage may be full.');
      }
    }, 100);
  }, [form, autoCaseId, addCase, setCurrentView]);

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-violet-500/50 transition-colors";

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button
          onClick={() => setCurrentView('today')}
          className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <h2 className="text-lg font-bold text-white">Add New Case</h2>
      </div>

      <div className="px-3 sm:px-4 pb-4 max-h-[calc(100vh-120px)] overflow-y-auto">
        <div className="glass-card rounded-2xl p-4 space-y-3">
          {/* Case ID */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Case ID (Auto)</label>
            <input type="text" value={autoCaseId} readOnly className={`${inputClass} opacity-60`} />
          </div>

          {/* Lawyer Name */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Lawyer Name *</label>
            <input type="text" value={form.lawyerName} onChange={e => updateField('lawyerName', e.target.value)} placeholder="Enter lawyer name" className={inputClass} />
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

          {/* Judge Remarks */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Judge Remarks</label>
            <textarea value={form.judgeRemarks} onChange={e => updateField('judgeRemarks', e.target.value)} placeholder="Enter judge remarks" rows={2} className={inputClass} />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="feature-box w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-2"
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