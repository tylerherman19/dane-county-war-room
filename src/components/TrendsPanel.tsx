'use client';

import { useState } from 'react';
import { Search, ArrowLeft, Trophy, TrendingUp } from 'lucide-react';
import { Election } from '@/lib/api';
import { CandidateRaceRecord, searchCandidateHistory, groupByCandidate } from '@/lib/candidate-history';

export interface ShiftPair {
    candidateName: string;
    from: CandidateRaceRecord;
    to: CandidateRaceRecord;
}

interface TrendsPanelProps {
    elections: Election[] | undefined;
    onShiftPair: (pair: ShiftPair | null) => void;
}

function yearOf(dateStr: string): string {
    return dateStr.slice(0, 4);
}

function recordKey(r: CandidateRaceRecord): string {
    return `${r.electionId}|${r.raceId}`;
}

/**
 * TRENDS mode sidebar: search any candidate across every election the county
 * API serves, see their full race history, and pick two races to paint
 * gained/lost ground per ward on the map.
 */
export default function TrendsPanel({ elections, onShiftPair }: TrendsPanelProps) {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [records, setRecords] = useState<CandidateRaceRecord[] | null>(null);
    const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
    const [fromKey, setFromKey] = useState<string>('');
    const [toKey, setToKey] = useState<string>('');

    async function runSearch() {
        if (!elections || query.trim().length < 3 || searching) return;
        setSearching(true);
        setRecords(null);
        setSelectedCandidate(null);
        onShiftPair(null);
        try {
            const res = await searchCandidateHistory(elections, query, (done, total) => setProgress({ done, total }));
            setRecords(res);
            const grouped = groupByCandidate(res);
            if (grouped.length === 1) selectCandidate(grouped[0].name, res);
        } finally {
            setSearching(false);
            setProgress(null);
        }
    }

    function selectCandidate(name: string, source?: CandidateRaceRecord[]) {
        setSelectedCandidate(name);
        const races = (source ?? records ?? []).filter(r => r.candidateName === name);
        // Default map comparison: the two most recent races (newest = "to")
        if (races.length >= 2) {
            const from = races[1];
            const to = races[0];
            setFromKey(recordKey(from));
            setToKey(recordKey(to));
            onShiftPair({ candidateName: name, from, to });
        } else {
            setFromKey(''); setToKey('');
            onShiftPair(null);
        }
    }

    function updatePair(nextFromKey: string, nextToKey: string) {
        setFromKey(nextFromKey);
        setToKey(nextToKey);
        const races = candidateRaces;
        const from = races.find(r => recordKey(r) === nextFromKey);
        const to = races.find(r => recordKey(r) === nextToKey);
        if (selectedCandidate && from && to && from !== to) {
            onShiftPair({ candidateName: selectedCandidate, from, to });
        } else {
            onShiftPair(null);
        }
    }

    const grouped = records ? groupByCandidate(records) : [];
    const candidateRaces = selectedCandidate
        ? (records ?? []).filter(r => r.candidateName === selectedCandidate)
        : [];
    const wins = candidateRaces.filter(r => r.won).length;

    return (
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── Search ── */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Candidate History</h3>
                    <p className="text-xs text-slate-500 mb-3">
                        Search every Dane County election — state, county, and local races combined.
                    </p>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Candidate name (min 3 letters)…"
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                            />
                        </div>
                        <button
                            onClick={runSearch}
                            disabled={searching || query.trim().length < 3}
                            className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {searching ? '…' : 'Search'}
                        </button>
                    </div>
                    {searching && progress && (
                        <div className="mt-3">
                            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                                Scanning election {progress.done} of {progress.total}…
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Candidate list (search results) ── */}
                {!selectedCandidate && records && (
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700/40 text-xs text-slate-500">
                            {grouped.length === 0
                                ? 'No candidates found — try fewer letters or a last name.'
                                : `${grouped.length} candidate${grouped.length === 1 ? '' : 's'} found`}
                        </div>
                        {grouped.map(g => (
                            <button
                                key={g.name}
                                onClick={() => selectCandidate(g.name)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0"
                            >
                                <div className="text-sm font-medium text-slate-200">{g.name}</div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {g.races.length} race{g.races.length === 1 ? '' : 's'} · {yearOf(g.races[g.races.length - 1].electionDate)}–{yearOf(g.races[0].electionDate)}
                                    {g.races[0].party && g.races[0].party !== 'Non-Partisan' ? ` · ${g.races[0].party}` : ''}
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Candidate timeline ── */}
                {selectedCandidate && (
                    <>
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                            <button
                                onClick={() => { setSelectedCandidate(null); onShiftPair(null); }}
                                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-2"
                            >
                                <ArrowLeft className="w-3 h-3" /> All results
                            </button>
                            <div className="text-lg font-bold text-white leading-tight">{selectedCandidate}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {candidateRaces.length} race{candidateRaces.length === 1 ? '' : 's'} · {wins} won ·{' '}
                                {yearOf(candidateRaces[candidateRaces.length - 1]?.electionDate ?? '')}–{yearOf(candidateRaces[0]?.electionDate ?? '')}
                            </div>
                        </div>

                        {/* Map comparison pair */}
                        {candidateRaces.length >= 2 && (
                            <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <TrendingUp className="w-3.5 h-3.5" /> Gained / Lost Ground
                                </h3>
                                <p className="text-[10px] text-slate-500 mb-3">
                                    Map colors each ward by {selectedCandidate.split(' ')[0]}&apos;s share change between two races.
                                    Green = gained, red = lost. Hover a ward for details.
                                </p>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 w-8 shrink-0">From</span>
                                        <select
                                            className="flex-1 min-w-0 bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                                            value={fromKey}
                                            onChange={e => updatePair(e.target.value, toKey)}
                                        >
                                            {candidateRaces.map(r => (
                                                <option key={recordKey(r)} value={recordKey(r)}>
                                                    {yearOf(r.electionDate)} — {r.raceName} ({r.percentage.toFixed(1)}%)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 w-8 shrink-0">To</span>
                                        <select
                                            className="flex-1 min-w-0 bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                                            value={toKey}
                                            onChange={e => updatePair(fromKey, e.target.value)}
                                        >
                                            {candidateRaces.map(r => (
                                                <option key={recordKey(r)} value={recordKey(r)}>
                                                    {yearOf(r.electionDate)} — {r.raceName} ({r.percentage.toFixed(1)}%)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                {fromKey === toKey && (
                                    <div className="mt-2 text-[10px] text-amber-400">Pick two different races to compare.</div>
                                )}
                            </div>
                        )}

                        {/* Race-by-race timeline */}
                        <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-700/40">
                                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Race History</h3>
                            </div>
                            {candidateRaces.map(r => (
                                <div key={recordKey(r)} className="px-4 py-3 border-b border-slate-800 last:border-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-slate-200 truncate" title={r.raceName}>{r.raceName}</div>
                                            <div className="text-xs text-slate-500 mt-0.5 truncate">{r.electionName}</div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className="flex items-center gap-1.5 justify-end">
                                                {r.won && <Trophy className="w-3 h-3 text-amber-400" />}
                                                <span className={`text-sm font-bold ${r.won ? 'text-white' : 'text-slate-400'}`}>
                                                    {r.percentage.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-[10px] text-slate-500">
                                                {r.votes.toLocaleString()} votes{r.candidateCount > 1 ? ` · ${r.won ? 'won' : `${r.place}${['th', 'st', 'nd', 'rd'][r.place % 10] && r.place < 4 ? ['th', 'st', 'nd', 'rd'][r.place] : 'th'} of ${r.candidateCount}`}` : ' · uncontested'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-2 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${r.won ? 'bg-emerald-500' : 'bg-slate-500'}`}
                                            style={{ width: `${Math.min(100, r.percentage)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Empty state */}
                {!records && !searching && (
                    <div className="text-center text-slate-600 text-xs px-6 py-8 leading-relaxed">
                        Type a candidate&apos;s name to pull every race they&apos;ve run in Dane County —
                        then compare two races on the map to see where they gained or lost ground.
                    </div>
                )}
            </div>
        </div>
    );
}
