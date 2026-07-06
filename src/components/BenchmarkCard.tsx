'use client';

import { useState } from 'react';
import { Crosshair, Search, X } from 'lucide-react';
import { Election, RaceResult } from '@/lib/api';
import { CandidateRaceRecord, searchCandidateHistory } from '@/lib/candidate-history';

export interface BenchmarkSelection {
    currentCandidate: string;       // candidate in the current/live race
    record: CandidateRaceRecord;    // their past race to benchmark against
}

export interface BenchmarkStats {
    sharedWards: number;    // wards reported now AND present in the benchmark race
    liveShare: number;      // candidate share in those wards now (%)
    benchShare: number;     // their share in those same wards back then (%)
}

interface BenchmarkCardProps {
    raceResult: RaceResult;
    elections: Election[] | undefined;
    isLive: boolean;
    benchmark: BenchmarkSelection | null;
    onBenchmarkChange: (b: BenchmarkSelection | null) => void;
    stats: BenchmarkStats | null;
}

/**
 * Election-night benchmark: compare a candidate's incoming results against a
 * past race of theirs (e.g. an Assembly candidate vs their old Alder runs),
 * apples-to-apples in the wards that overlap and have reported.
 */
export default function BenchmarkCard({
    raceResult, elections, isLive, benchmark, onBenchmarkChange, stats,
}: BenchmarkCardProps) {
    const sortedCandidates = [...raceResult.candidates]
        .filter(c => !c.candidateName.toLowerCase().startsWith('write-in'))
        .sort((a, b) => b.votes - a.votes);
    const [candidate, setCandidate] = useState<string>('');
    const activeCandidate = candidate || sortedCandidates[0]?.candidateName || '';

    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [options, setOptions] = useState<CandidateRaceRecord[] | null>(null);

    async function findPastRaces() {
        if (!elections || searching) return;
        // Default to the candidate's last name — how the county most
        // consistently spells people across years
        const q = (query || activeCandidate.trim().split(/\s+/).slice(-1)[0] || '').trim();
        if (q.length < 3) return;
        setSearching(true);
        setOptions(null);
        try {
            const res = await searchCandidateHistory(elections, q, (done, total) => setProgress({ done, total }));
            // Exclude the currently selected race itself
            setOptions(res.filter(r => !(r.raceName === raceResult.raceName.replace(/\s*-\s*Official Canvass\s*$/i, '').trim() && r.percentage === undefined)));
        } finally {
            setSearching(false);
            setProgress(null);
        }
    }

    if (sortedCandidates.length === 0) return null;

    const delta = stats ? stats.liveShare - stats.benchShare : null;

    return (
        <div className="px-4 py-4 border-b border-[#e0e0e0]">
            <h3 className="kicker mb-1 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" /> Benchmark
            </h3>
            <p className="text-[11px] text-[#999] mb-3">
                Compare {isLive ? 'incoming results' : 'this race'} against a candidate&apos;s past race:
                same wards, {isLive ? 'reported wards only' : 'head to head'}.
            </p>

            {/* Candidate in the current race */}
            <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-[#666] shrink-0 w-16">Candidate</label>
                <select
                    className="flex-1 min-w-0 bg-white text-[#222] text-xs rounded-[3px] px-2 py-1 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                    value={activeCandidate}
                    onChange={e => {
                        setCandidate(e.target.value);
                        onBenchmarkChange(null);
                        setOptions(null);
                        setQuery('');
                    }}
                >
                    {sortedCandidates.map(c => (
                        <option key={c.candidateName} value={c.candidateName}>{c.candidateName}</option>
                    ))}
                </select>
            </div>

            {/* Benchmark chosen */}
            {benchmark ? (
                <div className="mt-2">
                    <div className="flex items-start justify-between gap-2 bg-[#f7f7f7] px-3 py-2 border border-[#e0e0e0] rounded-[3px]">
                        <div className="min-w-0">
                            <div className="text-xs text-[#222] truncate" title={benchmark.record.raceName}>
                                {benchmark.record.electionDate.slice(0, 4)} — {benchmark.record.raceName}
                            </div>
                            <div className="text-[11px] text-[#999] mt-0.5 num">
                                as {benchmark.record.candidateName} · {benchmark.record.percentage.toFixed(1)}% county-wide then
                            </div>
                        </div>
                        <button
                            onClick={() => onBenchmarkChange(null)}
                            className="shrink-0 text-[#999] hover:text-[#222] transition-colors"
                            title="Clear benchmark"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {stats && delta !== null ? (
                        <div className="mt-3">
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-[10px] uppercase tracking-[0.06em] text-[#999] font-bold">Now</div>
                                    <div className="text-xl font-bold num text-[#222]">{stats.liveShare.toFixed(1)}%</div>
                                </div>
                                <div className={`text-lg font-bold num ${delta >= 0 ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                    {delta >= 0 ? '▲ +' : '▼ '}{delta.toFixed(1)} pts
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-[0.06em] text-[#999] font-bold">Then</div>
                                    <div className="text-xl font-bold num text-[#666]">{stats.benchShare.toFixed(1)}%</div>
                                </div>
                            </div>
                            <div className="mt-1.5 text-[11px] text-[#999]">
                                Across {stats.sharedWards} overlapping{isLive ? ' reported' : ''} ward{stats.sharedWards === 1 ? '' : 's'}.
                                Turn on the <span className="text-[#666] font-bold">Benchmark</span> map layer for ward detail.
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 text-[11px] text-[#999]">
                            No overlapping wards with results yet — numbers appear as those wards report.
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Find past races */}
                    <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#999]" />
                            <input
                                type="text"
                                placeholder={`Search: ${activeCandidate.trim().split(/\s+/).slice(-1)[0] ?? 'name'}`}
                                className="w-full bg-white border border-[#cccccc] rounded-[3px] pl-8 pr-2 py-1.5 text-xs text-[#222] placeholder-[#999] focus:outline-none focus:border-[#008fd5]"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') findPastRaces(); }}
                            />
                        </div>
                        <button
                            onClick={findPastRaces}
                            disabled={searching}
                            className="shrink-0 px-2.5 py-1.5 rounded-[3px] bg-[#222] hover:bg-[#444] text-white text-xs font-bold transition-colors disabled:opacity-40"
                        >
                            {searching ? 'Searching' : 'Find races'}
                        </button>
                    </div>
                    {searching && progress && (
                        <div className="mt-2 h-1 bg-[#e8e8e8] overflow-hidden">
                            <div className="h-full bg-[#008fd5] transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                        </div>
                    )}
                    {options && (
                        <div className="mt-2 max-h-48 overflow-y-auto border border-[#e0e0e0] rounded-[3px] divide-y divide-[#eeeeee]">
                            {options.length === 0 && (
                                <div className="px-3 py-2 text-[11px] text-[#999]">No past races found for that name.</div>
                            )}
                            {options.map(r => (
                                <button
                                    key={`${r.electionId}|${r.raceId}|${r.candidateName}`}
                                    onClick={() => onBenchmarkChange({ currentCandidate: activeCandidate, record: r })}
                                    className="w-full text-left px-3 py-2 hover:bg-[#f7f7f7] transition-colors"
                                >
                                    <div className="text-xs text-[#222] truncate" title={r.raceName}>
                                        {r.electionDate.slice(0, 4)} — {r.raceName}
                                    </div>
                                    <div className="text-[11px] text-[#999] mt-0.5 truncate num">
                                        {r.candidateName} · {r.percentage.toFixed(1)}% · {r.votes.toLocaleString()} votes{r.won ? ' · won' : ''}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
