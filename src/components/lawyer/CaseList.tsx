'use client';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { groupByLawyer, searchCases, formatDate } from '@/lib/utils-lawyer';
import { ArrowLeft, Search, ChevronRight } from 'lucide-react';

interface CaseListProps {
  title: string;
  getCases: () => ReturnType<typeof useLawyerStore.getState>['cases'];
  showSearch?: boolean;
}

function CaseItem({ caseId, partyName, opponentName, lawyerName, caseType, section, nextDate }: {
  caseId: string; partyName: string; opponentName: string; lawyerName: string; caseType: string; section: string; nextDate: string;
}) {
  const setSelectedCaseId = useLawyerStore(s => s.setSelectedCaseId);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const lastTap = useRef(0);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current > 300) {
      lastTap.current = now;
      setSelectedCaseId(caseId);
      setCurrentView('case-detail');
    }
  }, [caseId, setSelectedCaseId, setCurrentView]);

  return (
    <button onClick={handleTap} className="feature-box w-full text-left glass-card rounded-xl p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-violet-400">#{caseId}</span>
        <span className="text-[10px] text-zinc-500">{formatDate(nextDate)}</span>
      </div>
      <p className="text-sm font-semibold text-white mt-1 truncate">{partyName}</p>
      <p className="text-xs text-zinc-500 truncate">vs {opponentName}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {caseType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{caseType}</span>}
        {section && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Sec {section}</span>}
      </div>
    </button>
  );
}

function LawyerGroup({ lawyerName, cases }: { lawyerName: string; cases: ReturnType<typeof useLawyerStore.getState>['cases'] }) {
  return (
    <div className="mb-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-7 h-7 rounded-full bg-violet-600/30 flex items-center justify-center">
          <span className="text-xs font-bold text-violet-300">{lawyerName.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{lawyerName}</h3>
          <p className="text-[10px] text-zinc-500">{cases.length} case{cases.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {cases.map(c => (
          <CaseItem key={c.caseId} {...c} />
        ))}
      </div>
    </div>
  );
}

export default function CaseList({ title, getCases, showSearch = false }: CaseListProps) {
  const cases = useLawyerStore(s => s.cases);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 40;

  const filtered = useMemo(() => {
    const base = getCases();
    return query.trim() ? searchCases(base, query) : base;
  }, [cases, getCases, query]);

  const grouped = useMemo(() => groupByLawyer(filtered), [filtered]);
  const lawyerNames = useMemo(() => Object.keys(grouped), [grouped]);

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

  const loadMore = useCallback(() => {
    setPage(p => p + 1);
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button
          onClick={() => setCurrentView('today')}
          className="feature-box w-9 h-9 rounded-xl glass-card flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-[10px] text-zinc-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="px-3 sm:px-4 mb-3">
          <div className="glass-card rounded-xl flex items-center gap-2 px-3 py-2.5">
            <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(0); }}
              placeholder="Search by name, ID, type..."
              className="bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none flex-1 min-w-0"
            />
          </div>
        </div>
      )}

      {/* Case List by Lawyer */}
      <div className="px-3 sm:px-4 pb-4">
        {visibleLawyers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-600 text-sm">No cases found</p>
          </div>
        ) : (
          <>
            {visibleLawyers.map(name => (
              <LawyerGroup key={name} lawyerName={name} cases={grouped[name]} />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full text-center py-3 text-sm text-violet-400 font-medium"
              >
                Load more...
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}