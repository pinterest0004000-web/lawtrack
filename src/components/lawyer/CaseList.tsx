'use client';

import React, { useMemo, useCallback, useRef, useState } from 'react';
import { useLawyerStore } from '@/store/lawyer-store';
import { groupByLawyer, searchCases, formatDate } from '@/lib/utils-lawyer';
import { ArrowLeft, Search, Share2 } from 'lucide-react';
import { toast } from '@/components/AppToaster';
import type { CaseEntry } from '@/lib/types';

interface CaseListProps {
  title: string;
  getCases: () => CaseEntry[];
  showSearch?: boolean;
}

function CaseItem({ caseData }: { caseData: CaseEntry }) {
  const setSelectedCaseId = useLawyerStore(s => s.setSelectedCaseId);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const lastTap = useRef(0);
  const [sharing, setSharing] = useState(false);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current > 300) {
      lastTap.current = now;
      setSelectedCaseId(caseData.caseId);
      setCurrentView('case-detail');
    }
  }, [caseData.caseId, setSelectedCaseId, setCurrentView]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      const { shareCasePDF } = await import('@/components/lawyer/CaseDetail');
      const result = await shareCasePDF(caseData);
      toast.success(result === 'shared' ? 'WhatsApp pe share ho gaya!' : 'PDF download ho gaya!');
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') toast.error('PDF share fail');
    } finally { setSharing(false); }
  }, [caseData, sharing]);

  const { caseId, partyName, opponentName, caseType, section, nextDate } = caseData;

  return (
    <div className="feature-box w-full text-left bg-[#141c2b] rounded-xl p-3 relative">
      <button onClick={handleTap} className="absolute inset-0 z-0 rounded-xl" aria-label={`Open case ${caseId}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-[#D4A843]">#{caseId}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500">{formatDate(nextDate)}</span>
            <button onClick={handleShare} disabled={sharing} className="w-7 h-7 rounded-lg bg-[#D4A843]/10 flex items-center justify-center active:bg-[#D4A843]/20 transition-colors disabled:opacity-40" aria-label="Share PDF">
              <Share2 className="w-3 h-3 text-[#D4A843]" />
            </button>
          </div>
        </div>
        <p className="text-sm font-semibold text-white mt-1 truncate">{partyName}</p>
        <p className="text-xs text-zinc-500 truncate">vs {opponentName}</p>
        <div className="flex items-center gap-2 mt-1.5">
          {caseType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">{caseType}</span>}
          {section && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400">Sec {section}</span>}
        </div>
      </div>
    </div>
  );
}

function LawyerGroup({ lawyerName, items }: { lawyerName: string; items: CaseEntry[] }) {
  return (
    <div className="mb-4 animate-slide-up">
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="w-7 h-7 rounded-full bg-[#D4A843]/30 flex items-center justify-center">
          <span className="text-xs font-bold text-amber-300">{lawyerName.charAt(0).toUpperCase()}</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{lawyerName}</h3>
          <p className="text-[10px] text-zinc-500">{items.length} case{items.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {items.map(c => (
          <CaseItem key={c.caseId} caseData={c} />
        ))}
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

export default function CaseList({ title, getCases, showSearch = false }: CaseListProps) {
  const cases = useLawyerStore(s => s.cases);
  const setCurrentView = useLawyerStore(s => s.setCurrentView);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const base = getCases();
    if (!query.trim()) return base;
    return searchCases(base, query);
  }, [cases, getCases, query]);

  const grouped = useMemo(() => groupByLawyer(filtered), [filtered]);
  const lawyerNames = useMemo(() => Object.keys(grouped), [grouped]);

  // Calculate visible lawyers with pagination
  const { visibleLawyers, hasMore } = useMemo(() => {
    let count = 0;
    const result: string[] = [];
    const limit = PAGE_SIZE * (page + 1);

    for (const name of lawyerNames) {
      if (count >= limit) break;
      result.push(name);
      count += grouped[name].length;
    }

    return {
      visibleLawyers: result,
      hasMore: count < filtered.length,
    };
  }, [lawyerNames, grouped, page, filtered.length]);

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setPage(0);
    // Debounced search not needed since searchCases is fast (O(n) with early exit)
  }, []);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    setLoading(true);
    // Use requestAnimationFrame to not block UI
    requestAnimationFrame(() => {
      setPage(p => p + 1);
      setLoading(false);
    });
  }, [loading, hasMore]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 pt-3 pb-2">
        <button
          onClick={() => setCurrentView('home')}
          className="feature-box w-9 h-9 rounded-xl bg-[#141c2b] flex items-center justify-center"
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
          <div className="bg-[#141c2b] rounded-xl flex items-center gap-2 px-3 py-2.5">
            <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
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
              <LawyerGroup key={name} lawyerName={name} items={grouped[name]} />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full text-center py-3 text-sm text-[#D4A843] font-medium disabled:opacity-50"
              >
                {loading ? 'Loading...' : `Load more (${filtered.length - visibleLawyers.reduce((s, n) => s + grouped[n].length, 0)} remaining)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}