'use client';

import { useMemo } from 'react';
import { Target, TrendingUp, History, Vote } from 'lucide-react';
import { RaceResult, PrecinctResult, Race, Election } from '@/lib/api';
import { DistrictFilter, districtLabel } from '@/lib/districts';
import { buildPrimaryModel } from '@/lib/primary-model';
import { useCandidateTrackRecords } from '@/hooks/useCandidateTrackRecords';
import BenchmarkCard, { BenchmarkSelection, BenchmarkStats } from './BenchmarkCard';

interface PrimaryFocusPanelProps {
    districtFilter: DistrictFilter | null;
    onQuickSelectDistrict: (num: string) => void;
    matchingRaces: Race[];
    selectedRaceId: string | null;
    onSelectRace: (raceId: string) => void;
    raceResult: RaceResult | undefined;
    precinctResults: PrecinctResult[] | undefined;
    isLoading: boolean;
    districtWardKeys: Set<string> | null;
    turnoutByWard: Record<string, number> | undefined;
    comparisonTurnoutByWard: Record<string, number> | undefined;
    comparisonElection?: Election;
    elections?: Election[];
    selectedElectionId?: string | null;
    onSelectComparison?: (electionId: string | null) => void;
    isLive: boolean;
    benchmark: BenchmarkSelection | null;
    onBenchmarkChange: (b: BenchmarkSelection | null) => void;
    benchmarkStats: BenchmarkStats | null;
}

function getPartyColor(party: string | undefined): { bg: string; text: string; dot: string } {
    const p = (party || '').toLowerCase();
    if (p.includes('democrat')) return { bg: '#2563eb', text: '#93c5fd', dot: '#3b82f6' };
    if (p.includes('republican')) return { bg: '#dc2626', text: '#fca5a5', dot: '#ef4444' };
    if (p.includes('green')) return { bg: '#16a34a', text: '#86efac', dot: '#22c55e' };
    if (p.includes('libertarian')) return { bg: '#ca8a04', text: '#fde047', dot: '#eab308' };
    return { bg: '#475569', text: '#cbd5e1', dot: '#64748b' };
}

export default function PrimaryFocusPanel({
    districtFilter, onQuickSelectDistrict,
    matchingRaces, selectedRaceId, onSelectRace,
    raceResult, precinctResults, isLoading,
    districtWardKeys, turnoutByWard, comparisonTurnoutByWard,
    comparisonElection, elections, selectedElectionId, onSelectComparison,
    isLive, benchmark, onBenchmarkChange, benchmarkStats,
}: PrimaryFocusPanelProps) {
    const isAssemblyDistrict = districtFilter?.kind === 'asm';

    const candidateParties = useMemo(() => {
        const m: Record<string, string | undefined> = {};
        raceResult?.candidates.forEach(c => { m[c.candidateName.trim()] = c.party; });
        return m;
    }, [raceResult]);

    const model = useMemo(
        () => buildPrimaryModel(precinctResults, districtWardKeys, turnoutByWard, comparisonTurnoutByWard, candidateParties),
        [precinctResults, districtWardKeys, turnoutByWard, comparisonTurnoutByWard, candidateParties]
    );

    const candidateNames = useMemo(
        () => (model?.candidates ?? []).map(c => c.candidateName),
        [model]
    );
    const { records: trackRecords, loading: trackRecordsLoading } = useCandidateTrackRecords(
        elections, candidateNames, selectedElectionId, selectedRaceId
    );

    const comparisonOptions = (elections ?? []).filter(e => e.electionId !== selectedElectionId);

    if (!isAssemblyDistrict) {
        return (
            <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col items-center justify-center p-6 text-center gap-4">
                <Target className="w-8 h-8 text-slate-600" />
                <div>
                    <div className="text-slate-300 font-semibold mb-1">Primary Focus</div>
                    <p className="text-sm text-slate-500 max-w-xs">
                        Pick an Assembly District to see modeled analysis for its state house primary — not just a vote count.
                    </p>
                </div>
                <button
                    onClick={() => onQuickSelectDistrict('76')}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                >
                    Focus Assembly District 76
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="h-full bg-slate-900 border-l border-slate-800 p-5 space-y-4 animate-pulse">
                <div className="h-36 bg-slate-800 rounded-xl" />
                <div className="h-48 bg-slate-800 rounded-xl" />
                <div className="h-40 bg-slate-800 rounded-xl" />
            </div>
        );
    }

    if (matchingRaces.length === 0 || !raceResult) {
        return (
            <div className="h-full bg-slate-900 border-l border-slate-800 flex items-center justify-center text-slate-500 text-sm text-center p-6">
                No State Assembly race found for {districtLabel(districtFilter!)} in this election yet.
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── Header ── */}
                <div className="rounded-xl p-4 border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-slate-900">
                    <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Primary Focus · {districtLabel(districtFilter!)}
                    </div>
                    <div className="text-lg font-bold text-white leading-tight">{raceResult.raceName}</div>
                    {matchingRaces.length > 1 && (
                        <select
                            className="mt-2 w-full bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1.5 border border-slate-700 focus:outline-none focus:border-blue-500"
                            value={selectedRaceId ?? ''}
                            onChange={e => onSelectRace(e.target.value)}
                        >
                            {matchingRaces.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}
                    {model && (
                        <div className="mt-2 text-xs text-slate-500">
                            {model.wardsReported} of {model.wardsTotal} wards reporting
                        </div>
                    )}
                </div>

                {/* ── Candidate standings + projection ── */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Standings &amp; Modeled Finish
                    </h3>
                    {!model ? (
                        <div className="text-sm text-slate-500 py-4 text-center">Awaiting results…</div>
                    ) : (
                        <div className="space-y-4">
                            {model.candidates.map(c => {
                                const color = getPartyColor(c.party);
                                const delta = c.projectedShare - c.share;
                                const clinched = c.progressToWin >= 1;
                                return (
                                    <div key={c.candidateName} className="space-y-1.5">
                                        <div className="flex justify-between items-baseline">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color.dot }} />
                                                <span className="text-sm font-semibold text-white truncate">{c.candidateName}</span>
                                                {clinched && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-400 bg-emerald-400/10 rounded px-1.5 py-0.5 shrink-0">
                                                        Clinched
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <span className="font-bold text-white text-sm">{c.share.toFixed(1)}%</span>
                                                <span className="text-slate-500 text-xs ml-1.5">{c.votes.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {/* Current share bar */}
                                        <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.share}%`, background: color.bg }} />
                                        </div>
                                        {/* Projected finish */}
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>
                                                Projected: <span className="text-slate-300 font-semibold">{c.projectedShare.toFixed(1)}%</span>
                                                {' '}({c.projectedVotes.toLocaleString()} votes)
                                            </span>
                                            {Math.abs(delta) >= 0.1 && (
                                                <span className={delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                                                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} pts as vote comes in
                                                </span>
                                            )}
                                        </div>
                                        {/* Win number progress */}
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-500">
                                                Win #: <span className="text-slate-300">{c.winNumber.winNumber.toLocaleString()}</span>
                                                {c.winNumber.isEstimate ? ' (est.)' : ''}
                                            </span>
                                            <span className={clinched ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>
                                                {clinched
                                                    ? `+${(c.votes - c.winNumber.winNumber).toLocaleString()} over`
                                                    : `${Math.max(0, c.winNumber.winNumber - c.votes).toLocaleString()} to go`}
                                            </span>
                                        </div>
                                        <div className="h-1 bg-slate-700/30 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${Math.min(100, c.progressToWin * 100)}%`, background: clinched ? '#10b981' : color.dot, opacity: 0.7 }}
                                            />
                                        </div>
                                        {/* Track record */}
                                        <div className="pt-1 text-[11px] text-slate-500 flex items-start gap-1.5">
                                            <History className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />
                                            {trackRecordsLoading && !trackRecords[c.candidateName] ? (
                                                <span className="text-slate-600">Looking up history…</span>
                                            ) : (trackRecords[c.candidateName]?.length ?? 0) === 0 ? (
                                                <span className="text-slate-600">No prior county race found on record.</span>
                                            ) : (
                                                <span className="truncate">
                                                    {trackRecords[c.candidateName].map((r, i) => (
                                                        <span key={`${r.electionId}-${r.raceId}`}>
                                                            {i > 0 && ' · '}
                                                            {r.electionDate.slice(0, 4)} {r.raceName} — {r.percentage.toFixed(0)}%{r.won ? ' (won)' : ''}
                                                        </span>
                                                    ))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Turnout / outstanding-vote model ── */}
                {model && (
                    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Vote className="w-3.5 h-3.5" /> Outstanding Vote Model
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <div className="text-slate-500 text-xs">Counted so far</div>
                                <div className="text-white font-bold">{model.currentTotalVotes.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs">Est. outstanding</div>
                                <div className="text-amber-400 font-bold">~{model.outstandingRaceVotes.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs">Roll-off rate used</div>
                                <div className="text-slate-300 font-semibold">{(model.rolloffRate * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-xs">Projected final total</div>
                                <div className="text-slate-300 font-semibold">{model.projectedTotalVotes.toLocaleString()}</div>
                            </div>
                        </div>
                        {isLive && onSelectComparison && (
                            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between gap-2">
                                <label className="text-xs text-slate-500 shrink-0">Baseline for outstanding wards</label>
                                <select
                                    className="flex-1 min-w-0 bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:border-blue-500"
                                    value={comparisonElection?.electionId ?? ''}
                                    onChange={e => onSelectComparison(e.target.value || null)}
                                >
                                    {comparisonOptions.map(e => (
                                        <option key={e.electionId} value={e.electionId}>{e.electionName}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
                            Outstanding ballots estimated from {comparisonElection?.electionName ?? 'the comparison election'}&apos;s
                            turnout in wards not yet reported, scaled by the roll-off rate observed in reported wards.
                            Split across candidates assuming their current share holds — a directional read, not a poll-based forecast.
                        </p>
                    </div>
                )}

                {/* ── Deep dive: ward-level historical benchmark ── */}
                {raceResult && (
                    <BenchmarkCard
                        raceResult={raceResult}
                        elections={elections}
                        isLive={isLive}
                        benchmark={benchmark}
                        onBenchmarkChange={onBenchmarkChange}
                        stats={benchmarkStats}
                    />
                )}
            </div>
        </div>
    );
}
