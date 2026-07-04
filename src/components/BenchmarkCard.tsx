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
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5" /> Benchmark
            </h3>
            <p className="text-[10px] text-slate-500 mb-3">
                Compare {isLive ? 'incoming results' : 'this race'} against a candidate&apos;s past race —
                same wards, {isLive ? 'reported wards only' : 'head to head'}.
            </p>

            {/* Candidate in the current race */}
            <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-slate-500 shrink-0 w-16">Candidate</label>
                <select
                    className="flex-1 min-w-0 bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:border-blue-500"
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
                    <div className="flex items-start justify-between gap-2 rounded-lg bg-slate-900/50 px-3 py-2 border border-slate-700/50">
                        <div className="min-w-0">
                            <div className="text-xs text-slate-300 truncate" title={benchmark.record.raceName}>
                                {benchmark.record.electionDate.slice(0, 4)} — {benchmark.record.raceName}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                                as {benchmark.record.candidateName} · {benchmark.record.percentage.toFixed(1)}% county-wide then
                            </div>
                        </div>
                        <button
                            onClick={() => onBenchmarkChange(null)}
                            className="shrink-0 text-slate-500 hover:text-white transition-colors"
                            title="Clear benchmark"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {stats && delta !== null ? (
                        <div className="mt-3">
                            <div className="flex items-end justify-between">
                                <div>
                                    <div className="text-[10px] text-slate-500">Now</div>
                                    <div className="text-xl font-bold text-white">{stats.liveShare.toFixed(1)}%</div>
                                </div>
                                <div className={`text-lg font-black ${delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {delta >= 0 ? '▲ +' : '▼ '}{delta.toFixed(1)} pts
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-500">Then</div>
                                    <div className="text-xl font-bold text-slate-300">{stats.benchShare.toFixed(1)}%</div>
                                </div>
                            </div>
                            <div className="mt-1.5 text-[10px] text-slate-500">
                                Across {stats.sharedWards} overlapping{isLive ? ' reported' : ''} ward{stats.sharedWards === 1 ? '' : 's'} ·
                                turn on the <span className="text-slate-400">Benchmark</span> map layer for ward detail
                            </div>
                        </div>
                    ) : (
                        <div className="mt-2 text-[10px] text-slate-600">
                            No overlapping wards with results yet — numbers appear as those wards report.
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {/* Find past races */}
                    <div className="flex gap-2 mt-1">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                            <input
                                type="text"
                                placeholder={`Search: ${activeCandidate.trim().split(/\s+/).slice(-1)[0] ?? 'name'}…`}
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-md pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') findPastRaces(); }}
                            />
                        </div>
                        <button
                            onClick={findPastRaces}
                            disabled={searching}
                            className="shrink-0 px-2.5 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors disabled:opacity-40"
                        >
                            {searching ? '…' : 'Find races'}
                        </button>
                    </div>
                    {searching && progress && (
                        <div className="mt-2 h-1 bg-slate-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                        </div>
                    )}
                    {options && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-700/50 divide-y divide-slate-800">
                            {options.length === 0 && (
                                <div className="px-3 py-2 text-[10px] text-slate-500">No past races found for that name.</div>
                            )}
                            {options.map(r => (
                                <button
                                    key={`${r.electionId}|${r.raceId}|${r.candidateName}`}
                                    onClick={() => onBenchmarkChange({ currentCandidate: activeCandidate, record: r })}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors"
                                >
                                    <div className="text-xs text-slate-200 truncate" title={r.raceName}>
                                        {r.electionDate.slice(0, 4)} — {r.raceName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
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
