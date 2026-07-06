'use client';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { groupByLawyer, searchCases, formatCurrency, formatDate } from '@/lib/utils-lawyer';
import { ArrowLeft, Search } from 'lucide-react';

export default function PendingFeeList() {
  const cases = useLawyerStore(s => s.cases);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const setSelectedCaseId = useLawyerStore(s => s.setSelectedCaseId);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const pendingCases = useMemo(() => {
    const base = cases.filter(c => (c.pendingFee || 0) > 0);
    return query.trim() ? searchCases(base, query) : base;
  }, [cases, query]);

  const grouped = useMemo(() => groupByLawyer(pendingCases), [pendingCases]);
  const lawyerNames = useMemo(() => Object.keys(grouped), [grouped]);
  const totalPending = useMemo(() => cases.reduce((s, c) => s + (c.pendingFee || 0), 0), [cases]);

  const visibleLawyers = useMemo(() => {
    let count = 0;
    const result: string[] = [];
    for (const name of lawyerNames) {
      if (count >= PAGE_SIZE * (page + 1)) break;
      result.push(name);
      count += grouped[name].length;
    }
    return result;
  }, [lawyerNames, grouped, page]);

  const hasMore = useMemo(() => {
    let count = 0;
    for (const name of lawyerNames) {
      count += grouped[name].length;
      if (count > PAGE_SIZE * (page + 1)) return true;
    }
    return false;
  }, [lawyerNames, grouped, page]);

  const openCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('case-detail');
  }, [setSelectedCaseId, setCurrentView]);

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
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">Pending Fee</h2>
          <p className="text-[10px] text-zinc-500">{pendingCases.length} case{pendingCases.length !== 1 ? 's' : ''} • Total: {formatCurrency(totalPending)}</p>
        </div>
      </div>

      <div className="px-3 sm:px-4 mb-3">
        <div className="glass-card rounded-xl flex items-center gap-2 px-3 py-2.5">
          <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search..."
            className="bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none flex-1 min-w-0"
          />
        </div>
      </div>

      <div className="px-3 sm:px-4 pb-4">
        {visibleLawyers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">No pending fees</p>
          </div>
        ) : (
          <>
            {visibleLawyers.map(name => {
              const lawyerCases = grouped[name];
              const lawyerTotal = lawyerCases.reduce((s, c) => s + (c.pendingFee || 0), 0);
              return (
                <div key={name} className="mb-4 animate-slide-up">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-600/30 flex items-center justify-center">
                        <span className="text-xs font-bold text-red-300">{name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{name}</h3>
                        <p className="text-[10px] text-zinc-500">{lawyerCases.length} case{lawyerCases.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-400">{formatCurrency(lawyerTotal)}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {lawyerCases.map(c => (
                      <button
                        key={c.caseId}
                        onClick={() => openCase(c.caseId)}
                        className="feature-box w-full text-left glass-card rounded-xl p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-violet-400">#{c.caseId}</span>
                          <span className="text-sm font-bold text-red-400">{formatCurrency(c.pendingFee)}</span>
                        </div>
                        <p className="text-sm font-semibold text-white mt-1 truncate">{c.partyName}</p>
                        <p className="text-xs text-zinc-500 truncate">vs {c.opponentName}</p>
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