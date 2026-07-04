'use client';

import { PrecinctResult, RaceResult, Election } from '@/lib/api';
import { DoorOpen, Mail, ShieldCheck, Download } from 'lucide-react';
import { useMemo, useState } from 'react';

interface TargetingCardProps {
    raceResult: RaceResult;
    precinctResults: PrecinctResult[];
    wardTurnoutMap: Record<string, number>;
    comparisonWardMap: Record<string, number>;
    comparisonElection?: Election;
    scopeLabel?: string | null;
}

type Universe = 'GOTV' | 'PERSUASION' | 'BASE';

interface WardTarget {
    name: string;
    num: string;
    ballots: number | undefined;
    turnoutDelta: number | null;
    share: number;      // target candidate's share of ward race votes (0-100)
    marginPts: number;  // top-two margin in points
    universe: Universe | null;
}

const UNIVERSE_META: Record<Universe, { label: string; channel: string; icon: typeof DoorOpen; color: string }> = {
    GOTV: { label: 'Turnout (GOTV)', channel: 'Doors', icon: DoorOpen, color: '#818cf8' },
    PERSUASION: { label: 'Persuasion', channel: 'Mail & digital', icon: Mail, color: '#fbbf24' },
    BASE: { label: 'Base', channel: 'Protect & digital', icon: ShieldCheck, color: '#4ade80' },
};

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/**
 * Classifies wards into targeting universes for the chosen candidate:
 *  - PERSUASION: top-two margin under 10 pts (close wards → mail/digital)
 *  - GOTV: candidate share ≥ 55% but turnout fell ≥ 5% vs comparison (doors)
 *  - BASE: candidate share ≥ 55% with steady turnout (protect)
 */
export default function TargetingCard({
    raceResult, precinctResults, wardTurnoutMap, comparisonWardMap, comparisonElection, scopeLabel,
}: TargetingCardProps) {
    const sortedCandidates = useMemo(
        () => [...raceResult.candidates].sort((a, b) => b.votes - a.votes),
        [raceResult]
    );
    const [targetCandidate, setTargetCandidate] = useState<string | null>(null);
    const candidate = targetCandidate ?? sortedCandidates[0]?.candidateName ?? '';

    const targets = useMemo<WardTarget[]>(() => {
        const byWard = new Map<string, PrecinctResult[]>();
        precinctResults.forEach(r => {
            const k = `${r.precinctName}|||${r.wardNumber}`;
            const arr = byWard.get(k) ?? [];
            arr.push(r);
            byWard.set(k, arr);
        });

        const out: WardTarget[] = [];
        for (const [key, rows] of byWard) {
            const [name, num] = key.split('|||');
            const total = rows.reduce((s, r) => s + r.votes, 0);
            if (total === 0) continue;
            const sorted = [...rows].sort((a, b) => b.votes - a.votes);
            const marginPts = sorted.length >= 2
                ? ((sorted[0].votes - sorted[1].votes) / total) * 100
                : 100;
            const candVotes = rows.find(r => r.candidateName.trim() === candidate.trim())?.votes ?? 0;
            const share = (candVotes / total) * 100;

            const tk = `${name}|${parseInt(num) || 0}`;
            const ballots = wardTurnoutMap[tk];
            const prev = comparisonWardMap[tk];
            const turnoutDelta = ballots !== undefined && prev !== undefined && prev > 0
                ? ((ballots - prev) / prev) * 100
                : null;

            let universe: Universe | null = null;
            if (marginPts < 10) universe = 'PERSUASION';
            else if (share >= 55 && turnoutDelta !== null && turnoutDelta <= -5) universe = 'GOTV';
            else if (share >= 55) universe = 'BASE';

            out.push({ name, num, ballots, turnoutDelta, share, marginPts, universe });
        }
        return out;
    }, [precinctResults, candidate, wardTurnoutMap, comparisonWardMap]);

    const byUniverse = useMemo(() => {
        const m: Record<Universe, WardTarget[]> = { GOTV: [], PERSUASION: [], BASE: [] };
        targets.forEach(t => { if (t.universe) m[t.universe].push(t); });
        // Rank within each universe by what an organizer works first
        m.GOTV.sort((a, b) => (a.turnoutDelta ?? 0) - (b.turnoutDelta ?? 0));          // biggest drop first
        m.PERSUASION.sort((a, b) => a.marginPts - b.marginPts);                        // closest first
        m.BASE.sort((a, b) => (b.ballots ?? 0) - (a.ballots ?? 0));                    // biggest first
        return m;
    }, [targets]);

    function exportUniverse(u: Universe) {
        const rows = byUniverse[u];
        const header = [
            'Municipality', 'Ward', 'Ballots cast',
            comparisonElection ? `Turnout change % (vs ${comparisonElection.electionName})` : 'Turnout change %',
            `"${candidate.replace(/"/g, '""')}" share %`, 'Top-two margin (pts)', 'Universe',
        ];
        const lines = rows.map(t => [
            `"${t.name}"`, t.num, t.ballots ?? '',
            t.turnoutDelta !== null ? t.turnoutDelta.toFixed(1) : '',
            t.share.toFixed(1), t.marginPts.toFixed(1), UNIVERSE_META[u].label,
        ].join(','));
        const csv = [header.join(','), ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(raceResult.raceName)}-${u.toLowerCase()}-universe.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    if (targets.length === 0 || sortedCandidates.length < 2) return null;
    const hasComparison = Object.keys(comparisonWardMap).length > 0;

    return (
        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">Targeting Universes</h3>
            </div>
            {scopeLabel && (
                <div className="text-[10px] text-blue-400 mb-2">Scoped to {scopeLabel}</div>
            )}
            <div className="flex items-center gap-2 mb-3">
                <label className="text-xs text-slate-500 shrink-0">Targeting for</label>
                <select
                    className="flex-1 min-w-0 bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:border-blue-500"
                    value={candidate}
                    onChange={e => setTargetCandidate(e.target.value)}
                >
                    {sortedCandidates.map(c => (
                        <option key={c.candidateName} value={c.candidateName}>{c.candidateName}</option>
                    ))}
                </select>
            </div>

            <div className="space-y-1.5">
                {(Object.keys(UNIVERSE_META) as Universe[]).map(u => {
                    const meta = UNIVERSE_META[u];
                    const rows = byUniverse[u];
                    const Icon = meta.icon;
                    const ballots = rows.reduce((s, t) => s + (t.ballots ?? 0), 0);
                    return (
                        <div key={u} className="flex items-center gap-2.5 rounded-lg px-2 py-2 bg-slate-900/40">
                            <Icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-200 leading-tight">{meta.label}</div>
                                <div className="text-[10px] text-slate-500">{meta.channel}</div>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-sm font-bold text-white leading-tight">{rows.length}</div>
                                <div className="text-[10px] text-slate-500">{ballots > 0 ? `${ballots.toLocaleString()} ballots` : 'wards'}</div>
                            </div>
                            <button
                                onClick={() => exportUniverse(u)}
                                disabled={rows.length === 0}
                                className="shrink-0 p-1.5 rounded-md bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title={`Download ${meta.label} ward list (CSV)`}
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="mt-2.5 text-[10px] text-slate-600 leading-relaxed">
                Persuasion: margin &lt; 10 pts. GOTV: share ≥ 55% with turnout down ≥ 5%
                {comparisonElection ? ` vs ${comparisonElection.electionName}` : ''}. Base: share ≥ 55%, turnout steady.
                {!hasComparison && ' Select a comparison election to unlock GOTV.'}
            </div>
        </div>
    );
}
