'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Star, ChevronRight, Search } from 'lucide-react';
import { BoardRace } from '@/lib/api';

const WATCHLIST_KEY = 'dcwr.watchlist';

// Classic-538 accent palette
const PARTY_COLOR: Record<string, string> = {
    Democratic: '#008fd5',
    Republican: '#fc4f30',
    Green: '#6d904f',
    Libertarian: '#e5ae38',
    Independent: '#8b5cf6',
    Nonpartisan: '#8b8b8b',
};

function leaderColor(party?: string): string {
    return (party && PARTY_COLOR[party]) || '#008fd5';
}

function lastName(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : name;
}

interface Snapshot {
    leader: string;
    leaderPct: number;
    marginPct: number;
    reporting: number;
}

interface TickerEntry {
    id: number;
    raceId: string;
    text: string;
}

interface WatchboardProps {
    board: BoardRace[] | undefined;
    isLoading: boolean;
    isLive: boolean;
    electionName?: string;
    onSelectRace: (raceId: string) => void;
}

function snapshotOf(r: BoardRace): Snapshot {
    const leader = r.candidates[0];
    const runnerUp = r.candidates[1];
    const marginPct = leader && runnerUp && r.totalVotes > 0
        ? ((leader.votes - runnerUp.votes) / r.totalVotes) * 100
        : leader ? 100 : 0;
    return {
        leader: leader?.candidateName ?? '—',
        leaderPct: leader?.percentage ?? 0,
        marginPct,
        reporting: r.totalPrecincts > 0 ? (r.precinctsReporting / r.totalPrecincts) * 100 : 0,
    };
}

export default function Watchboard({ board, isLoading, isLive, electionName, onSelectRace }: WatchboardProps) {
    const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
    const [watchingOnly, setWatchingOnly] = useState(false);
    const [query, setQuery] = useState('');
    const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
    const [ticker, setTicker] = useState<TickerEntry[]>([]);
    const prevSnaps = useRef<Map<string, Snapshot>>(new Map());
    const tickerSeq = useRef(0);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(WATCHLIST_KEY);
            if (raw) setWatchlist(new Set(JSON.parse(raw)));
        } catch { /* ignore */ }
    }, []);
    useEffect(() => {
        try { localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...watchlist])); } catch { /* ignore */ }
    }, [watchlist]);

    function toggleWatch(raceId: string) {
        setWatchlist(prev => {
            const next = new Set(prev);
            if (next.has(raceId)) next.delete(raceId); else next.add(raceId);
            return next;
        });
    }

    // Detect changes between board refreshes → flash cards + push ticker rows
    useEffect(() => {
        if (!board) return;
        const changed: string[] = [];
        const newTicker: TickerEntry[] = [];
        board.forEach(r => {
            const cur = snapshotOf(r);
            const prev = prevSnaps.current.get(r.raceId);
            if (prev) {
                const flipped = prev.leader !== cur.leader && cur.leader !== '—';
                const moved = Math.abs(prev.leaderPct - cur.leaderPct) >= 0.1
                    || Math.abs(prev.reporting - cur.reporting) >= 0.5;
                if (flipped || moved) {
                    changed.push(r.raceId);
                    if (flipped) {
                        newTicker.push({ id: tickerSeq.current++, raceId: r.raceId, text: `${r.raceName}: lead flips to ${lastName(cur.leader)}` });
                    } else if (Math.abs(prev.leaderPct - cur.leaderPct) >= 0.1) {
                        const d = cur.leaderPct - prev.leaderPct;
                        newTicker.push({ id: tickerSeq.current++, raceId: r.raceId, text: `${r.raceName}: ${lastName(cur.leader)} ${d >= 0 ? '+' : ''}${d.toFixed(1)} → ${cur.leaderPct.toFixed(1)}%` });
                    } else {
                        newTicker.push({ id: tickerSeq.current++, raceId: r.raceId, text: `${r.raceName}: now ${cur.reporting.toFixed(0)}% reporting` });
                    }
                }
            }
            prevSnaps.current.set(r.raceId, cur);
        });
        if (changed.length > 0) {
            setFlashIds(new Set(changed));
            const t = setTimeout(() => setFlashIds(new Set()), 2200);
            setTicker(prev => [...newTicker.reverse(), ...prev].slice(0, 14));
            return () => clearTimeout(t);
        }
    }, [board]);

    const rows = useMemo(() => {
        if (!board) return [];
        const q = query.trim().toLowerCase();
        let list = board.filter(r => r.candidates.length > 0);
        if (q) list = list.filter(r => r.raceName.toLowerCase().includes(q)
            || r.candidates.some(c => c.candidateName.toLowerCase().includes(q)));
        if (watchingOnly) list = list.filter(r => watchlist.has(r.raceId));
        return [...list].sort((a, b) => {
            const aw = watchlist.has(a.raceId) ? 1 : 0;
            const bw = watchlist.has(b.raceId) ? 1 : 0;
            if (aw !== bw) return bw - aw;
            const sa = snapshotOf(a), sb = snapshotOf(b);
            const aDone = sa.reporting >= 100 ? 1 : 0;
            const bDone = sb.reporting >= 100 ? 1 : 0;
            if (aDone !== bDone) return aDone - bDone;
            return sa.marginPct - sb.marginPct;
        });
    }, [board, query, watchingOnly, watchlist]);

    const watchedCount = board ? board.filter(r => watchlist.has(r.raceId)).length : 0;

    return (
        <div className="absolute inset-0 flex flex-col bg-[#f0f0f0]">
            {/* Controls + ticker */}
            <div className="shrink-0 border-b border-[#e0e0e0] bg-white">
                <div className="flex flex-wrap items-center gap-2 px-3 md:px-5 py-2.5">
                    <div className="flex items-center gap-2 mr-1">
                        {isLive
                            ? <span className="bg-[#fc4f30] text-white text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 leading-none rounded-[2px]">Live Board</span>
                            : <span className="text-[11px] font-bold text-[#222] uppercase tracking-[0.08em]">Big Board</span>}
                        <span className="text-xs text-[#666] truncate max-w-[40vw]">{electionName}</span>
                    </div>
                    <div className="relative flex-1 min-w-[140px] max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Filter races…"
                            className="w-full bg-white border border-[#cccccc] rounded-[3px] pl-8 pr-2 py-1.5 text-xs text-[#222] placeholder:text-[#999] focus:outline-none focus:border-[#008fd5]"
                        />
                    </div>
                    <button
                        onClick={() => setWatchingOnly(v => !v)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] text-xs font-bold uppercase tracking-[0.04em] border transition-colors ${
                            watchingOnly
                                ? 'bg-[#fff8e6] border-[#e5ae38] text-[#8a6d00]'
                                : 'bg-white border-[#cccccc] text-[#666] hover:text-[#222]'
                        }`}
                    >
                        <Star className={`w-3.5 h-3.5 ${watchingOnly ? 'fill-[#e5ae38] text-[#e5ae38]' : ''}`} />
                        Watching ({watchedCount})
                    </button>
                </div>
                {ticker.length > 0 && (
                    <div className="flex items-center gap-2 px-3 md:px-5 py-1.5 border-t border-[#e0e0e0] overflow-x-auto">
                        <span className="shrink-0 text-[10px] font-bold text-[#567a3a] uppercase tracking-[0.08em]">Updates</span>
                        <div className="flex items-center gap-2">
                            {ticker.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => onSelectRace(t.raceId)}
                                    className="shrink-0 text-[11px] text-[#222] bg-[#f4f4f4] hover:bg-[#eaeaea] border border-[#e0e0e0] rounded-full px-2.5 py-0.5 whitespace-nowrap"
                                >
                                    {t.text}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-3 md:p-5">
                {isLoading && !board && (
                    <div className="h-full flex items-center justify-center text-[#999] text-sm">Loading races…</div>
                )}
                {board && rows.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[#999] text-sm">
                        {watchingOnly ? 'No watched races yet — star some below.' : 'No races match your filter.'}
                    </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {rows.map(r => {
                        const snap = snapshotOf(r);
                        const leader = r.candidates[0];
                        const runnerUp = r.candidates[1];
                        const done = snap.reporting >= 100;
                        const flashing = flashIds.has(r.raceId);
                        const watched = watchlist.has(r.raceId);
                        return (
                            <div
                                key={r.raceId}
                                onClick={() => onSelectRace(r.raceId)}
                                className={`group relative cursor-pointer rounded-[3px] border bg-white p-3 transition-colors hover:border-[#999] ${
                                    flashing ? 'board-flash border-[#6d904f]' : 'border-[#e0e0e0]'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-bold text-[#222] leading-tight line-clamp-2" title={r.raceName}>
                                            {r.raceName}
                                        </div>
                                        <div className="mt-0.5 text-[10px] text-[#999] num">
                                            {done
                                                ? <span className="text-[#567a3a] font-bold">✓ 100% in</span>
                                                : `${snap.reporting.toFixed(0)}% in · ${r.precinctsReporting}/${r.totalPrecincts}`}
                                        </div>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); toggleWatch(r.raceId); }}
                                        aria-label={watched ? 'Unwatch' : 'Watch'}
                                        className="shrink-0 p-1 rounded hover:bg-[#f4f4f4]"
                                    >
                                        <Star className={`w-4 h-4 ${watched ? 'fill-[#e5ae38] text-[#e5ae38]' : 'text-[#cccccc] group-hover:text-[#999]'}`} />
                                    </button>
                                </div>

                                <div className="h-1 rounded-full bg-[#ececec] overflow-hidden mb-2.5">
                                    <div className="h-full rounded-full" style={{ width: `${snap.reporting}%`, background: done ? '#6d904f' : '#008fd5' }} />
                                </div>

                                <div className="space-y-1.5">
                                    {[leader, runnerUp].filter(Boolean).map((c, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: leaderColor(c!.party) }} />
                                            <span className={`flex-1 truncate text-[13px] ${i === 0 ? 'text-[#222] font-bold' : 'text-[#666]'}`} title={c!.candidateName}>
                                                {c!.candidateName}
                                            </span>
                                            <span className={`num text-[13px] ${i === 0 ? 'text-[#222] font-bold' : 'text-[#999]'}`}>
                                                {c!.percentage.toFixed(1)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-2.5 flex items-center justify-between border-t border-[#e0e0e0] pt-2">
                                    <span className={`text-[11px] font-bold ${done ? 'text-[#567a3a]' : 'text-[#666]'}`}>
                                        {runnerUp ? `${done ? 'Won by' : 'Lead'} +${snap.marginPct.toFixed(1)}` : 'Unopposed'}
                                    </span>
                                    <span className="text-[10px] text-[#999] flex items-center gap-0.5 group-hover:text-[#222]">
                                        Open <ChevronRight className="w-3 h-3" />
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
