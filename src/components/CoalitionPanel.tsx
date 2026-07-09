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

function partyColor(party?: string): string {
    if (party === 'Republican') return '#fc4f30';
    if (party === 'Democratic') return '#008fd5';
    return '#8b5cf6';
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
        <div className="h-full bg-white flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Intro */}
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222] mb-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Coalition Builder
                    </h3>
                    <p className="text-xs text-[#666]">
                        Add supportive candidates — a mayor&apos;s slate, an allied ticket — to map where their
                        combined coalition is strong and see how similarly their wards vote.
                    </p>
                </div>

                {/* Search */}
                <div className="border border-[#e0e0e0] rounded-[3px] p-3">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
                            <input
                                type="text"
                                placeholder="Candidate name (min 3 letters)…"
                                className="w-full bg-white border border-[#cccccc] rounded-[3px] pl-9 pr-3 py-2 text-sm text-[#222] placeholder-[#999] focus:outline-none focus:border-[#008fd5]"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                            />
                        </div>
                        <button
                            onClick={runSearch}
                            disabled={searching || query.trim().length < 3}
                            className="shrink-0 px-3 py-2 rounded-[3px] bg-[#222] hover:bg-black text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {searching ? '…' : 'Search'}
                        </button>
                    </div>
                    {searching && progress && (
                        <div className="mt-3">
                            <div className="h-1.5 bg-[#ececec] rounded-full overflow-hidden">
                                <div className="h-full bg-[#008fd5] rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                            </div>
                            <div className="mt-1 text-[10px] text-[#999]">Scanning election {progress.done} of {progress.total}…</div>
                        </div>
                    )}
                    {records && (
                        <div className="mt-3 max-h-52 overflow-y-auto rounded-[3px] border border-[#e0e0e0] divide-y divide-[#e0e0e0]">
                            {grouped.length === 0 && (
                                <div className="px-3 py-2 text-xs text-[#999]">No candidates found.</div>
                            )}
                            {grouped.map(g => {
                                const m = toMember(records, g.name);
                                const already = m ? slateKeys.has(m.key) : false;
                                return (
                                    <button
                                        key={g.name}
                                        onClick={() => addCandidate(g.name)}
                                        disabled={already}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f4f4f4] transition-colors disabled:opacity-40"
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block text-sm text-[#222] truncate">{g.name}</span>
                                            <span className="block text-[10px] text-[#999] truncate">
                                                {g.races.length} race{g.races.length === 1 ? '' : 's'} · latest {yearOf(g.races[0].electionDate)} {g.races[0].raceName}
                                            </span>
                                        </span>
                                        {already
                                            ? <span className="text-[10px] text-[#567a3a] font-bold shrink-0">Added</span>
                                            : <Plus className="w-4 h-4 text-[#008fd5] shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* The slate */}
                {slate.length > 0 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] overflow-hidden">
                        <div className="px-3 py-2.5 border-b border-[#e0e0e0] flex items-center justify-between bg-[#fafafa]">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222]">
                                Slate ({slate.length}){computing && <span className="ml-2 text-[#008fd5] normal-case font-normal tracking-normal">loading…</span>}
                            </h3>
                            <button onClick={() => setSlate([])} className="text-[10px] text-[#999] hover:text-[#222]">Clear</button>
                        </div>
                        {slate.map(m => (
                            <div key={m.key} className="px-3 py-2.5 border-b border-[#e0e0e0] last:border-0 flex items-center gap-2">
                                <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: partyColor(m.party) }} />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-[#222] truncate">{m.candidateName}</div>
                                    <div className="text-[10px] text-[#999] truncate">{yearOf(m.electionDate)} · {m.raceName}</div>
                                </div>
                                <button onClick={() => removeMember(m.key)} className="shrink-0 p-1 rounded hover:bg-[#f4f4f4] text-[#999] hover:text-[#222]" aria-label="Remove">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        <label className="flex items-center gap-2 px-3 py-2.5 text-[11px] text-[#666] cursor-pointer select-none border-t border-[#e0e0e0] bg-[#fafafa]">
                            <input type="checkbox" checked={sharedOnly} onChange={e => setSharedOnly(e.target.checked)} className="accent-[#008fd5]" />
                            Only wards every member contested
                        </label>
                    </div>
                )}

                {/* Coalition summary */}
                {summary && summary.wardCount > 0 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] p-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222] mb-2">Coalition Strength</h3>
                        <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-3xl font-bold text-[#222] num">{summary.avg.toFixed(1)}%</span>
                            <span className="text-xs text-[#999]">avg ward support · {summary.wardCount} wards</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[10px] font-bold text-[#567a3a] uppercase tracking-wide mb-1">Base (strongest)</div>
                                {summary.strong.slice(0, 5).map(w => (
                                    <div key={w.key} className="flex justify-between text-[11px] py-0.5">
                                        <span className="text-[#666] truncate pr-1">{w.key.replace('|', ' Wd ')}</span>
                                        <span className="text-[#222] num">{w.value.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-[#c73a1d] uppercase tracking-wide mb-1">Weakest turf</div>
                                {summary.weak.slice(0, 5).map(w => (
                                    <div key={w.key} className="flex justify-between text-[11px] py-0.5">
                                        <span className="text-[#666] truncate pr-1">{w.key.replace('|', ' Wd ')}</span>
                                        <span className="text-[#222] num">{w.value.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="mt-3 text-[10px] text-[#999]">Map shades each ward by combined slate support — green strong, red weak.</div>
                    </div>
                )}

                {/* Who they vote with */}
                {slate.length >= 2 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] p-3">
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222] mb-1 flex items-center gap-1.5">
                            <Link2 className="w-3.5 h-3.5" /> Who They Vote With
                        </h3>
                        <p className="text-[10px] text-[#999] mb-3">
                            How similarly each pair&apos;s wards vote. +100 = identical coalition, −100 = mirror opposites.
                        </p>
                        {affinities.length === 0 && (
                            <div className="text-[11px] text-[#999]">Not enough shared wards to compare yet.</div>
                        )}
                        <div className="space-y-2">
                            {affinities.map((p, i) => {
                                const pct = Math.round(p.r * 100);
                                const strong = p.r >= 0.5;
                                const color = p.r >= 0 ? '#567a3a' : '#c73a1d';
                                return (
                                    <div key={i} className="text-[11px]">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[#222] truncate flex items-center gap-1">
                                                {strong && <Trophy className="w-3 h-3 text-[#e5ae38] shrink-0" />}
                                                {short(p.a.candidateName)} ↔ {short(p.b.candidateName)}
                                            </span>
                                            <span className="num font-bold shrink-0" style={{ color }}>
                                                {pct >= 0 ? '+' : ''}{pct}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-1.5 rounded-full bg-[#ececec] overflow-hidden relative">
                                            <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#cccccc]" />
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
                    <div className="text-center text-[#999] text-xs px-6 py-8 leading-relaxed">
                        Search for a candidate and add them to your slate. Add two or more allied candidates
                        to see their shared coalition on the map and how aligned their voters are.
                    </div>
                )}
            </div>
        </div>
    );
}
