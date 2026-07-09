'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, X, Users, Link2, Trophy } from 'lucide-react';
import { Election } from '@/lib/api';
import { CandidateRaceRecord, searchCandidateHistory, groupByCandidate } from '@/lib/candidate-history';
import {
    SlateMember, memberKey, getMemberShares, combineCoalition,
    wardCorrelation, coalitionSummary,
} from '@/lib/coalition-data';

export interface CoalitionUpdate {
    coalitionByWard: Record<string, number> | null;
    label: string | null;
}

interface CoalitionPanelProps {
    elections: Election[] | undefined;
    onCoalitionUpdate: (u: CoalitionUpdate) => void;
}

function yearOf(d: string): string { return d.slice(0, 4); }
function short(name: string): string {
    const p = name.trim().split(/\s+/);
    return p.length > 1 ? p[p.length - 1] : name;
}

/** Most recent race for a candidate becomes their slate contribution. */
function toMember(records: CandidateRaceRecord[], name: string): SlateMember | null {
    const races = records.filter(r => r.candidateName === name);
    if (races.length === 0) return null;
    const r = races[0]; // records are sorted newest-first
    return {
        key: memberKey(r.electionId, r.raceId, r.candidateName),
        electionId: r.electionId,
        raceId: r.raceId,
        candidateName: r.candidateName,
        raceName: r.raceName,
        electionDate: r.electionDate,
        party: r.party,
    };
}

export default function CoalitionPanel({ elections, onCoalitionUpdate }: CoalitionPanelProps) {
    const [query, setQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [records, setRecords] = useState<CandidateRaceRecord[] | null>(null);

    const [slate, setSlate] = useState<SlateMember[]>([]);
    const [sharedOnly, setSharedOnly] = useState(false);
    const [computing, setComputing] = useState(false);
    const [memberShares, setMemberShares] = useState<Record<string, Record<string, number>>>({});
    const reqId = useRef(0);

    async function runSearch() {
        if (!elections || query.trim().length < 3 || searching) return;
        setSearching(true);
        setRecords(null);
        try {
            const res = await searchCandidateHistory(elections, query, (done, total) => setProgress({ done, total }));
            setRecords(res);
        } finally {
            setSearching(false);
            setProgress(null);
        }
    }

    function addCandidate(name: string) {
        if (!records) return;
        const m = toMember(records, name);
        if (!m) return;
        setSlate(prev => prev.some(x => x.key === m.key) ? prev : [...prev, m]);
    }
    function removeMember(key: string) {
        setSlate(prev => prev.filter(m => m.key !== key));
    }

    // Fetch each member's ward shares whenever the slate changes.
    useEffect(() => {
        const id = ++reqId.current;
        const missing = slate.filter(m => !memberShares[m.key]);
        if (missing.length === 0) return;
        setComputing(true);
        Promise.all(missing.map(async m => [m.key, await getMemberShares(m)] as const))
            .then(pairs => {
                if (id !== reqId.current) return;
                setMemberShares(prev => {
                    const next = { ...prev };
                    pairs.forEach(([k, v]) => { next[k] = v; });
                    return next;
                });
            })
            .catch(() => {})
            .finally(() => { if (id === reqId.current) setComputing(false); });
    }, [slate, memberShares]);

    // Build the coalition map + push it to the map overlay.
    const coalition = useMemo(() => {
        const shares = slate.map(m => memberShares[m.key]).filter(Boolean) as Record<string, number>[];
        if (shares.length === 0) return null;
        return combineCoalition(shares, sharedOnly ? shares.length : 1);
    }, [slate, memberShares, sharedOnly]);

    useEffect(() => {
        if (!coalition || Object.keys(coalition).length === 0) {
            onCoalitionUpdate({ coalitionByWard: null, label: null });
            return;
        }
        const label = slate.length === 1
            ? `${short(slate[0].candidateName)} coalition`
            : `${slate.length}-candidate slate`;
        onCoalitionUpdate({ coalitionByWard: coalition, label });
    }, [coalition, slate, onCoalitionUpdate]);

    const summary = useMemo(() => coalition ? coalitionSummary(coalition) : null, [coalition]);

    // Pairwise "who they vote with" — how aligned each pair's wards are.
    const affinities = useMemo(() => {
        const out: { a: SlateMember; b: SlateMember; r: number; shared: number }[] = [];
        for (let i = 0; i < slate.length; i++) {
            for (let j = i + 1; j < slate.length; j++) {
                const sa = memberShares[slate[i].key];
                const sb = memberShares[slate[j].key];
                if (!sa || !sb) continue;
                const c = wardCorrelation(sa, sb);
                if (c) out.push({ a: slate[i], b: slate[j], r: c.r, shared: c.shared });
            }
        }
        return out.sort((x, y) => y.r - x.r);
    }, [slate, memberShares]);

    const grouped = records ? groupByCandidate(records) : [];
    const slateKeys = new Set(slate.map(m => m.key));

    return (
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Intro */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Coalition Builder
                    </h3>
                    <p className="text-xs text-slate-500">
                        Add supportive candidates — a mayor&apos;s slate, an allied ticket — to map where their
                        combined coalition is strong and see how similarly their wards vote.
                    </p>
                </div>

                {/* Search */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Candidate name (min 3 letters)…"
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                            />
                        </div>
                        <button
                            onClick={runSearch}
                            disabled={searching || query.trim().length < 3}
                            className="shrink-0 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {searching ? '…' : 'Search'}
                        </button>
                    </div>
                    {searching && progress && (
                        <div className="mt-3">
                            <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">Scanning election {progress.done} of {progress.total}…</div>
                        </div>
                    )}
                    {records && (
                        <div className="mt-3 max-h-52 overflow-y-auto rounded-lg border border-slate-700/40 divide-y divide-slate-800">
                            {grouped.length === 0 && (
                                <div className="px-3 py-2 text-xs text-slate-500">No candidates found.</div>
                            )}
                            {grouped.map(g => {
                                const m = toMember(records, g.name);
                                const already = m ? slateKeys.has(m.key) : false;
                                return (
                                    <button
                                        key={g.name}
                                        onClick={() => addCandidate(g.name)}
                                        disabled={already}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-800 transition-colors disabled:opacity-40"
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm text-slate-200 truncate">{g.name}</span>
                                            <span className="block text-[10px] text-slate-500 truncate">
                                                {g.races.length} race{g.races.length === 1 ? '' : 's'} · latest {yearOf(g.races[0].electionDate)} {g.races[0].raceName}
                                            </span>
                                        </span>
                                        {already
                                            ? <span className="text-[10px] text-violet-400 shrink-0">Added</span>
                                            : <Plus className="w-4 h-4 text-violet-400 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* The slate */}
                {slate.length > 0 && (
                    <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                                Slate ({slate.length}){computing && <span className="ml-2 text-violet-400 normal-case font-normal">loading…</span>}
                            </h3>
                            <button onClick={() => setSlate([])} className="text-[10px] text-slate-500 hover:text-slate-300">Clear</button>
                        </div>
                        {slate.map(m => (
                            <div key={m.key} className="px-4 py-2.5 border-b border-slate-800 last:border-0 flex items-center gap-2">
                                <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: m.party === 'Republican' ? 'hsl(0,90%,55%)' : m.party === 'Democratic' ? 'hsl(215,90%,55%)' : 'hsl(280,60%,62%)' }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-slate-200 truncate">{m.candidateName}</div>
                                    <div className="text-[10px] text-slate-500 truncate">{yearOf(m.electionDate)} · {m.raceName}</div>
                                </div>
                                <button onClick={() => removeMember(m.key)} className="shrink-0 p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-200" aria-label="Remove">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        <label className="flex items-center gap-2 px-4 py-2.5 text-[11px] text-slate-400 cursor-pointer select-none border-t border-slate-800">
                            <input type="checkbox" checked={sharedOnly} onChange={e => setSharedOnly(e.target.checked)} className="accent-violet-500" />
                            Only wards every member contested
                        </label>
                    </div>
                )}

                {/* Coalition summary */}
                {summary && summary.wardCount > 0 && (
                    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Coalition Strength</h3>
                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-3xl font-bold text-white">{summary.avg.toFixed(1)}%</span>
                            <span className="text-xs text-slate-500">avg ward support · {summary.wardCount} wards</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide mb-1">Base (strongest)</div>
                                {summary.strong.slice(0, 5).map(w => (
                                    <div key={w.key} className="flex justify-between text-[11px] py-0.5">
                                        <span className="text-slate-400 truncate pr-1">{w.key.replace('|', ' Wd ')}</span>
                                        <span className="text-slate-200 font-mono">{w.value.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <div className="text-[10px] font-semibold text-rose-400 uppercase tracking-wide mb-1">Weakest turf</div>
                                {summary.weak.slice(0, 5).map(w => (
                                    <div key={w.key} className="flex justify-between text-[11px] py-0.5">
                                        <span className="text-slate-400 truncate pr-1">{w.key.replace('|', ' Wd ')}</span>
                                        <span className="text-slate-200 font-mono">{w.value.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 text-[10px] text-slate-600">Map shades each ward by combined slate support — green strong, red weak.</div>
                    </div>
                )}

                {/* Who they vote with */}
                {slate.length >= 2 && (
                    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" /> Who They Vote With
                        </h3>
                        <p className="text-[10px] text-slate-500 mb-3">
                            How similarly each pair&apos;s wards vote. +100 = identical coalition, −100 = mirror opposites.
                        </p>
                        {affinities.length === 0 && (
                            <div className="text-[11px] text-slate-500">Not enough shared wards to compare yet.</div>
                        )}
                        <div className="space-y-2">
                            {affinities.map((p, i) => {
                                const pct = Math.round(p.r * 100);
                                const strong = p.r >= 0.5;
                                const color = p.r >= 0 ? 'hsl(150,65%,45%)' : 'hsl(0,75%,58%)';
                                return (
                                    <div key={i} className="text-[11px]">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-slate-300 truncate flex items-center gap-1">
                                                {strong && <Trophy className="w-3 h-3 text-amber-400 shrink-0" />}
                                                {short(p.a.candidateName)} ↔ {short(p.b.candidateName)}
                                            </span>
                                            <span className="font-mono font-semibold shrink-0" style={{ color }}>
                                                {pct >= 0 ? '+' : ''}{pct}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden relative">
                                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600" />
                                            <div
                                                className="absolute top-0 bottom-0 rounded-full"
                                                style={{
                                                    background: color,
                                                    left: p.r >= 0 ? '50%' : `${50 + (p.r * 50)}%`,
                                                    width: `${Math.abs(p.r) * 50}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {slate.length === 0 && !records && !searching && (
                    <div className="text-center text-slate-600 text-xs px-6 py-8 leading-relaxed">
                        Search for a candidate and add them to your slate. Add two or more allied candidates
                        to see their shared coalition on the map and how aligned their voters are.
                    </div>
                )}
            </div>
        </div>
    );
}
