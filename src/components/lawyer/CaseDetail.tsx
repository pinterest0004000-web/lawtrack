'use client';

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { formatCurrency, formatDate, getTodayStr } from '@/lib/utils-lawyer';
import { ArrowLeft, Phone, Calendar, MapPin, Scale, Shield, FileText, IndianRupee, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { pauseCloudForUndo } from '@/lib/cloud-backup';

type TabType = 'info' | 'history' | 'fee' | 'expense';

export default function CaseDetail() {
  const selectedCaseId = useLawyerStore(s => s.selectedCaseId);
  const cases = useLawyerStore(s => s.cases);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const updateCaseNextDate = useLawyerStore(s => s.updateCaseNextDate);
  const addFeeRecord = useLawyerStore(s => s.addFeeRecord);
  const addExpense = useLawyerStore(s => s.addExpense);
  const deleteCase = useLawyerStore(s => s.deleteCase);
  const restoreCase = useLawyerStore(s => s.restoreCase);

  const [tab, setTab] = useState<TabType>('info');
  const [remark, setRemark] = useState('');
  const [newNextDate, setNewNextDate] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeType, setFeeType] = useState<'pending' | 'received'>('received');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const caseData = useMemo(() => {
    if (!selectedCaseId) return null;
    return cases.find(c => c.caseId === selectedCaseId) || null;
  }, [cases, selectedCaseId]);

  const sortedHistory = useMemo(() => {
    if (!caseData?.history) return [];
    return [...caseData.history].sort((a, b) => b.timestamp - a.timestamp);
  }, [caseData]);

  const visibleHistory = useMemo(() => {
    return sortedHistory.slice(0, (historyPage + 1) * 30);
  }, [sortedHistory, historyPage]);

  const hasMoreHistory = visibleHistory.length < sortedHistory.length;

  // Show "Enter New Next Date" field ONLY when typing judge remarks
  const showNewNextDateField = remark.trim().length > 0;

  const handleSaveRemarks = useCallback(async () => {
    if (!caseData) return;
    if (!remark.trim()) { toast.error('Enter judge remarks first'); return; }
    if (!newNextDate) { toast.error('Please enter new next date'); return; }

    setSaving(true);
    const ok = await updateCaseNextDate(caseData.caseId, remark.trim(), newNextDate);

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      toast.success('Remarks saved & next date updated');
      setRemark('');
      setNewNextDate('');
    } else {
      toast.error('Failed to save');
    }
  }, [caseData, remark, newNextDate, updateCaseNextDate]);

  const handleAddFee = useCallback(async () => {
    if (!caseData) return;
    const amt = parseFloat(feeAmount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }

    setSaving(true);
    const ok = await addFeeRecord(caseData.caseId, amt, feeType === 'pending');

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      toast.success(feeType === 'pending' ? 'Pending fee added' : 'Fee received recorded');
      setFeeAmount('');
    } else {
      toast.error('Failed to add fee');
    }
  }, [caseData, feeAmount, feeType, addFeeRecord]);

  const handleAddExpense = useCallback(async () => {
    if (!caseData) return;
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    if (!expDesc.trim()) { toast.error('Enter description'); return; }

    setSaving(true);
    const ok = await addExpense(caseData.caseId, caseData.lawyerName, caseData.partyName, expDesc.trim(), amt, getTodayStr(), 'case_expense');

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      toast.success('Expense added');
      setExpDesc('');
      setExpAmount('');
    } else {
      toast.error('Failed to add expense');
    }
  }, [caseData, expDesc, expAmount, addExpense]);

  const handleDelete = useCallback(async () => {
    if (!caseData) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }

    setSaving(true);
    pauseCloudForUndo();
    const deletedCase = { ...caseData };
    const ok = await deleteCase(caseData.caseId);

    if (!mountedRef.current) return;
    setSaving(false);
    if (ok) {
      setConfirmDelete(false);
      toast('Case deleted', {
        description: `10s me undo kar sakte ho — ${deletedCase.partyName} vs ${deletedCase.opponentName}`,
        duration: 10000,
        action: {
          label: 'Undo',
          onClick: async () => {
            await restoreCase(deletedCase);
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
        },
      });
      setConfirmDelete(false);
    } else {
      toast.error('Failed to delete');
    }
  }, [caseData, confirmDelete, deleteCase, restoreCase]);

  if (!caseData) {
    return (
      <div className="animate-fade-in px-4 pt-3">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setCurrentView('home')} className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
          <h2 className="text-lg font-bold text-white">Case Not Found</h2>
        </div>
        <p className="text-zinc-500 text-sm">This case may have been deleted.</p>
      </div>
    );
  }

  const isToday = caseData.nextDate === getTodayStr();
  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-violet-500/50 transition-colors";

  const tabs: { key: TabType; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'history', label: `History (${sortedHistory.length})` },
    { key: 'fee', label: 'Fee' },
    { key: 'expense', label: 'Expense' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button onClick={() => setCurrentView('home')} className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center" aria-label="Go back">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white truncate">#{caseData.caseId}</h2>
            {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold flex-shrink-0">TODAY</span>}
          </div>
          <p className="text-xs text-zinc-500 truncate">{caseData.partyName} vs {caseData.opponentName}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 sm:px-4 mb-3 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`feature-box px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-violet-600 text-white' : 'glass-card text-zinc-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-3 sm:px-4 pb-4 max-h-[calc(100vh-180px)] overflow-y-auto">
        {/* INFO TAB */}
        {tab === 'info' && (
          <div className="space-y-3 animate-fade-in">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <InfoRow icon={<Scale className="w-4 h-4 text-violet-400" />} label="Lawyer" value={caseData.lawyerName} />
              <InfoRow icon={<FileText className="w-4 h-4 text-amber-400" />} label="Party" value={caseData.partyName} />
              <InfoRow icon={<FileText className="w-4 h-4 text-zinc-400" />} label="Opponent" value={caseData.opponentName} />
              {caseData.caseType && <InfoRow icon={<Shield className="w-4 h-4 text-cyan-400" />} label="Type" value={caseData.caseType} />}
              {caseData.section && <InfoRow icon={<Shield className="w-4 h-4 text-emerald-400" />} label="Section" value={caseData.section} />}
              {caseData.policeStation && <InfoRow icon={<MapPin className="w-4 h-4 text-red-400" />} label="PS" value={caseData.policeStation} />}
              <InfoRow icon={<Calendar className="w-4 h-4 text-blue-400" />} label="Entered" value={formatDate(caseData.enteringDate)} />
              <InfoRow icon={<Calendar className="w-4 h-4 text-amber-400" />} label="Next Date" value={formatDate(caseData.nextDate)} />
              {caseData.phone && <InfoRow icon={<Phone className="w-4 h-4 text-green-400" />} value={caseData.phone} />}
            </div>

            {/* Current Remarks */}
            {caseData.judgeRemarks && (
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-zinc-500 mb-1">Latest Judge Remarks</p>
                <p className="text-sm text-white">{caseData.judgeRemarks}</p>
              </div>
            )}

            {/* Fee Summary */}
            <div className="glass-card rounded-2xl p-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-zinc-500">Total Fee</p>
                  <p className="text-base font-bold text-blue-400">{formatCurrency((caseData.pendingFee || 0) + (caseData.totalFeeReceived || 0))}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Paid</p>
                  <p className="text-base font-bold text-emerald-400">{formatCurrency(caseData.totalFeeReceived)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Pending</p>
                  <p className="text-base font-bold text-red-400">{formatCurrency(caseData.pendingFee)}</p>
                </div>
              </div>
            </div>

            {/* Update Remarks & Next Date */}
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Update Remarks & Next Date</p>
              <textarea
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="Enter judge remarks..."
                rows={2}
                className={inputClass}
              />

              {/* Show "Enter New Next Date" ONLY when remarks are being typed */}
              {showNewNextDateField && (
                <div className="animate-slide-up">
                  <label className="text-xs text-zinc-500 mb-1 block">Enter New Next Date</label>
                  <input
                    type="date"
                    value={newNextDate}
                    onChange={e => setNewNextDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}

              <button
                onClick={handleSaveRemarks}
                disabled={saving || !remark.trim() || !newNextDate}
                className="feature-box w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                ) : (
                  'Save Remarks & Next Date'
                )}
              </button>
            </div>

            {/* Delete */}
            <button
              onClick={handleDelete}
              disabled={saving}
              className="feature-box w-full border border-red-500/20 text-red-400 font-medium py-2.5 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Tap Again to Confirm Delete' : 'Delete Case'}
            </button>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="space-y-2 animate-fade-in">
            {visibleHistory.length === 0 ? (
              <p className="text-center text-zinc-600 text-sm py-8">No history yet</p>
            ) : (
              visibleHistory.map(h => (
                <div key={h.id} className="glass-card rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <HistoryBadge type={h.type} />
                      <p className="text-sm text-white mt-1">{h.description}</p>
                      {h.amount !== undefined && h.amount > 0 && (
                        <p className="text-xs font-semibold mt-0.5 text-amber-400">{formatCurrency(h.amount)}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">{formatDate(h.date)}</span>
                  </div>
                </div>
              ))
            )}
            {hasMoreHistory && (
              <button onClick={() => setHistoryPage(p => p + 1)} className="w-full text-center py-3 text-sm text-violet-400 font-medium">
                Load more history...
              </button>
            )}
          </div>
        )}

        {/* FEE TAB */}
        {tab === 'fee' && (
          <div className="space-y-3 animate-fade-in">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Add Fee Record</p>

              <div className="flex gap-2">
                <button
                  onClick={() => setFeeType('received')}
                  className={`feature-box flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    feeType === 'received' ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/30' : 'glass-card text-zinc-500'
                  }`}
                >
                  Fee Received
                </button>
                <button
                  onClick={() => setFeeType('pending')}
                  className={`feature-box flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    feeType === 'pending' ? 'bg-red-600/30 text-red-400 border border-red-500/30' : 'glass-card text-zinc-500'
                  }`}
                >
                  Add Pending
                </button>
              </div>

              <input
                type="number"
                value={feeAmount}
                onChange={e => setFeeAmount(e.target.value)}
                placeholder="Amount (Rs)"
                inputMode="numeric"
                className={inputClass}
              />

              <button
                onClick={handleAddFee}
                disabled={saving || !feeAmount}
                className="feature-box w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? 'Saving...' : `Add ${feeType === 'received' ? 'Received Fee' : 'Pending Fee'}`}
              </button>
            </div>

            {/* Fee Summary */}
            <div className="glass-card rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-500">Total Received</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(caseData.totalFeeReceived)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Pending</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(caseData.pendingFee)}</p>
                </div>
              </div>
            </div>

            {/* Fee History */}
            {sortedHistory.filter(h => h.type === 'fee').length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-zinc-500 mb-2">Fee History</p>
                {sortedHistory.filter(h => h.type === 'fee').slice(0, 20).map(h => (
                  <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <p className="text-sm text-zinc-300 truncate flex-1 mr-2">{h.description}</p>
                    <span className="text-sm font-semibold text-amber-400 flex-shrink-0">
                      {h.amount ? formatCurrency(h.amount) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EXPENSE TAB */}
        {tab === 'expense' && (
          <div className="space-y-3 animate-fade-in">
            <div className="glass-card rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-white">Add Today&apos;s Expense</p>
              <input
                type="text"
                value={expDesc}
                onChange={e => setExpDesc(e.target.value)}
                placeholder="Description (e.g. Court fee, Travel)"
                className={inputClass}
              />
              <input
                type="number"
                value={expAmount}
                onChange={e => setExpAmount(e.target.value)}
                placeholder="Amount (Rs)"
                inputMode="numeric"
                className={inputClass}
              />
              <button
                onClick={handleAddExpense}
                disabled={saving || !expDesc.trim() || !expAmount}
                className="feature-box w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Add Expense'}
              </button>
            </div>

            {/* Recent Expenses for this case */}
            {sortedHistory.filter(h => h.type === 'expense' || h.type === 'case_expense').length > 0 && (
              <div className="glass-card rounded-2xl p-4">
                <p className="text-xs text-zinc-500 mb-2">Recent Expenses</p>
                {sortedHistory.filter(h => h.type === 'expense' || h.type === 'case_expense').slice(0, 20).map(h => (
                  <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <p className="text-sm text-zinc-300 truncate flex-1 mr-2">{h.description}</p>
                    <span className="text-sm font-semibold text-red-400 flex-shrink-0">
                      {h.amount ? formatCurrency(h.amount) : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label?: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        {label && <p className="text-[10px] text-zinc-600">{label}</p>}
        <p className="text-sm text-white truncate">{value}</p>
      </div>
    </div>
  );
}

function HistoryBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    created: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Created' },
    remark: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Remark' },
    fee: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Fee' },
    expense: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Expense' },
    case_expense: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Expense' },
    chamber_expense: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Chamber' },
    next_date: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Next Date' },
  };
  const c = config[type] || config.created;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text} font-medium inline-block`}>{c.label}</span>;
}