'use client';

import { useMemo } from 'react';
import { Target, TrendingUp, History, Vote, ClipboardList, Radio } from 'lucide-react';
import { RaceResult, PrecinctResult, Race, Election } from '@/lib/api';
import { DistrictFilter, districtLabel } from '@/lib/districts';
import { buildPrimaryModel } from '@/lib/primary-model';
import { useCandidateTrackRecords } from '@/hooks/useCandidateTrackRecords';
import BenchmarkCard, { BenchmarkSelection, BenchmarkStats } from './BenchmarkCard';
import PlanningPanel, { ScenarioId } from './PlanningPanel';
import { PlanningData, TurnoutScenario, WardPower } from '@/lib/planning-data';

export type PrimaryTab = 'PLANNING' | 'NIGHT';

export interface PlanningState {
    data: PlanningData | null;
    isLoading: boolean;
    isError: boolean;
    power: WardPower | null;
    scenarios: TurnoutScenario[];
    scenarioId: ScenarioId;
    onScenarioChange: (id: ScenarioId) => void;
    numCandidates: number;
    onNumCandidatesChange: (n: number) => void;
}

interface PrimaryFocusPanelProps {
    primaryTab: PrimaryTab;
    onPrimaryTabChange: (tab: PrimaryTab) => void;
    planning: PlanningState;
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
    if (p.includes('democrat')) return { bg: '#008fd5', text: '#00729c', dot: '#008fd5' };
    if (p.includes('republican')) return { bg: '#fc4f30', text: '#c73a1d', dot: '#fc4f30' };
    if (p.includes('green')) return { bg: '#6d904f', text: '#567a3a', dot: '#6d904f' };
    if (p.includes('libertarian')) return { bg: '#e5ae38', text: '#a16207', dot: '#e5ae38' };
    return { bg: '#8b8b8b', text: '#666666', dot: '#8b8b8b' };
}

export default function PrimaryFocusPanel({
    primaryTab, onPrimaryTabChange, planning,
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
            <div className="h-full bg-white flex flex-col items-center justify-center p-6 text-center gap-4">
                <Target className="w-8 h-8 text-[#cccccc]" />
                <div>
                    <div className="text-[#222] font-bold mb-1">Primary Focus</div>
                    <p className="text-sm text-[#666] max-w-xs">
                        Pick an Assembly District to see modeled analysis for its state house primary, not just a vote count.
                    </p>
                </div>
                <button
                    onClick={() => onQuickSelectDistrict('76')}
                    className="px-4 py-2 rounded-[3px] bg-[#222] hover:bg-[#444] text-white text-sm font-bold transition-colors"
                >
                    Focus Assembly District 76
                </button>
            </div>
        );
    }

    const tabBar = (
        <div className="flex border-b border-[#e0e0e0] shrink-0">
            {([
                { id: 'PLANNING' as const, label: 'Planning', icon: ClipboardList },
                { id: 'NIGHT' as const, label: 'Election Night', icon: Radio },
            ]).map(t => (
                <button
                    key={t.id}
                    onClick={() => onPrimaryTabChange(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] border-b-[3px] transition-colors ${
                        primaryTab === t.id
                            ? 'border-[#222] text-[#222]'
                            : 'border-transparent text-[#999] hover:text-[#222]'
                    }`}
                >
                    <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
            ))}
        </div>
    );

    if (primaryTab === 'PLANNING') {
        // Only feed the readiness join returns from the district race itself —
        // pre-election the selected race is an unrelated contest whose precinct
        // rows must not read as primary returns.
        const districtRaceSelected = matchingRaces.some(r => r.id === selectedRaceId);
        return (
            <div className="h-full bg-white flex flex-col overflow-hidden">
                {tabBar}
                <div className="flex-1 overflow-y-auto">
                    <PlanningPanel
                        data={planning.data}
                        isLoading={planning.isLoading}
                        isError={planning.isError}
                        power={planning.power}
                        scenarios={planning.scenarios}
                        scenarioId={planning.scenarioId}
                        onScenarioChange={planning.onScenarioChange}
                        numCandidates={planning.numCandidates}
                        onNumCandidatesChange={planning.onNumCandidatesChange}
                        districtNum={districtFilter!.num}
                        precinctResults={districtRaceSelected ? precinctResults : undefined}
                    />
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="h-full bg-white flex flex-col overflow-hidden">
                {tabBar}
                <div className="p-5 space-y-4 animate-pulse">
                    <div className="h-36 bg-[#f0f0f0]" />
                    <div className="h-48 bg-[#f0f0f0]" />
                    <div className="h-40 bg-[#f0f0f0]" />
                </div>
            </div>
        );
    }

    if (matchingRaces.length === 0 || !raceResult) {
        return (
            <div className="h-full bg-white flex flex-col overflow-hidden">
                {tabBar}
                <div className="flex-1 flex items-center justify-center text-[#666] text-sm text-center p-6">
                    No State Assembly race found for {districtLabel(districtFilter!)} in this election yet.
                    Until the county publishes it, the Planning tab has the pre-election picture.
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-white flex flex-col overflow-hidden">
            {tabBar}
            <div className="flex-1 overflow-y-auto">

                {/* ── Header ── */}
                <div className="px-4 py-4 border-b-2 border-[#222]">
                    <div className="kicker mb-1 flex items-center gap-1.5" style={{ color: '#00729c' }}>
                        <Target className="w-3.5 h-3.5" /> Primary Focus · {districtLabel(districtFilter!)}
                    </div>
                    <div className="text-lg font-bold text-[#222] leading-tight">{raceResult.raceName}</div>
                    {matchingRaces.length > 1 && (
                        <select
                            className="mt-2 w-full bg-white text-[#222] text-xs rounded-[3px] px-2 py-1.5 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                            value={selectedRaceId ?? ''}
                            onChange={e => onSelectRace(e.target.value)}
                        >
                            {matchingRaces.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                    )}
                    {model && (
                        <div className="mt-2 text-xs text-[#999] num">
                            {model.wardsReported} of {model.wardsTotal} wards reporting
                        </div>
                    )}
                </div>

                {/* ── Candidate standings + projection ── */}
                <div className="px-4 py-4 border-b border-[#e0e0e0]">
                    <h3 className="kicker mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" /> Standings &amp; Modeled Finish
                    </h3>
                    {!model ? (
                        <div className="text-sm text-[#999] py-4 text-center">Awaiting results</div>
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
                                                <div className="w-2.5 h-2.5 shrink-0" style={{ background: color.dot }} />
                                                <span className="text-sm font-bold text-[#222] truncate">{c.candidateName}</span>
                                                {clinched && (
                                                    <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[#567a3a] border border-[#6d904f] rounded-[2px] px-1.5 py-0.5 shrink-0">
                                                        Clinched
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right shrink-0 ml-2">
                                                <span className="font-bold text-[#222] text-sm num">{c.share.toFixed(1)}%</span>
                                                <span className="text-[#999] text-xs ml-1.5 num">{c.votes.toLocaleString()}</span>
                                            </div>
                                        </div>
                                        {/* Current share bar */}
                                        <div className="h-1.5 bg-[#e8e8e8]">
                                            <div className="h-full transition-all duration-700" style={{ width: `${c.share}%`, background: color.bg }} />
                                        </div>
                                        {/* Projected finish */}
                                        <div className="flex items-center justify-between text-[11px] text-[#999]">
                                            <span className="num">
                                                Projected: <span className="text-[#222] font-bold">{c.projectedShare.toFixed(1)}%</span>
                                                {' '}({c.projectedVotes.toLocaleString()} votes)
                                            </span>
                                            {Math.abs(delta) >= 0.1 && (
                                                <span className={`num ${delta >= 0 ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                                    {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} pts as vote comes in
                                                </span>
                                            )}
                                        </div>
                                        {/* Win number progress */}
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-[#999] num">
                                                Win number: <span className="text-[#222]">{c.winNumber.winNumber.toLocaleString()}</span>
                                                {c.winNumber.isEstimate ? ' (est.)' : ''}
                                            </span>
                                            <span className={`num ${clinched ? 'text-[#567a3a] font-bold' : 'text-[#999]'}`}>
                                                {clinched
                                                    ? `+${(c.votes - c.winNumber.winNumber).toLocaleString()} over`
                                                    : `${Math.max(0, c.winNumber.winNumber - c.votes).toLocaleString()} to go`}
                                            </span>
                                        </div>
                                        <div className="h-1 bg-[#f0f0f0]">
                                            <div
                                                className="h-full transition-all duration-700"
                                                style={{ width: `${Math.min(100, c.progressToWin * 100)}%`, background: clinched ? '#6d904f' : color.dot, opacity: 0.7 }}
                                            />
                                        </div>
                                        {/* Track record */}
                                        <div className="pt-1 text-[11px] text-[#999] flex items-start gap-1.5">
                                            <History className="w-3 h-3 mt-0.5 shrink-0 text-[#cccccc]" />
                                            {trackRecordsLoading && !trackRecords[c.candidateName] ? (
                                                <span>Looking up history</span>
                                            ) : (trackRecords[c.candidateName]?.length ?? 0) === 0 ? (
                                                <span>No prior county race found on record.</span>
                                            ) : (
                                                <span className="truncate num">
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
                    <div className="px-4 py-4 border-b border-[#e0e0e0]">
                        <h3 className="kicker mb-3 flex items-center gap-1.5">
                            <Vote className="w-3.5 h-3.5" /> Outstanding Vote Model
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <div className="text-[#999] text-xs">Counted so far</div>
                                <div className="text-[#222] font-bold num">{model.currentTotalVotes.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-[#999] text-xs">Est. outstanding</div>
                                <div className="text-[#a16207] font-bold num">~{model.outstandingRaceVotes.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className="text-[#999] text-xs">Roll-off rate used</div>
                                <div className="text-[#222] font-bold num">{(model.rolloffRate * 100).toFixed(0)}%</div>
                            </div>
                            <div>
                                <div className="text-[#999] text-xs">Projected final total</div>
                                <div className="text-[#222] font-bold num">{model.projectedTotalVotes.toLocaleString()}</div>
                            </div>
                        </div>
                        {isLive && onSelectComparison && (
                            <div className="mt-3 pt-3 border-t border-[#e0e0e0] flex items-center justify-between gap-2">
                                <label className="text-xs text-[#666] shrink-0">Baseline for outstanding wards</label>
                                <select
                                    className="flex-1 min-w-0 bg-white text-[#222] text-xs rounded-[3px] px-2 py-1 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                                    value={comparisonElection?.electionId ?? ''}
                                    onChange={e => onSelectComparison(e.target.value || null)}
                                >
                                    {comparisonOptions.map(e => (
                                        <option key={e.electionId} value={e.electionId}>{e.electionName}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <p className="mt-3 text-[11px] text-[#999] leading-relaxed">
                            Outstanding ballots estimated from {comparisonElection?.electionName ?? 'the comparison election'}&apos;s
                            turnout in wards not yet reported, scaled by the roll-off rate observed in reported wards.
                            Split across candidates assuming their current share holds. A directional read, not a poll-based forecast.
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
