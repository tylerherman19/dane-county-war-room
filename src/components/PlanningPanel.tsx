'use client';

import { useMemo } from 'react';
import { Target, BarChart3, History, Minus, Plus, Radio } from 'lucide-react';
import { PrecinctResult } from '@/lib/api';
import {
    PlanningData,
    TurnoutScenario,
    WardPower,
    computeReadiness,
    computeScenarioOutcome,
    findContestedAnchor,
} from '@/lib/planning-data';

export type ScenarioId = 'LOW' | 'MID' | 'HIGH';

interface PlanningPanelProps {
    data: PlanningData | null;
    isLoading: boolean;
    isError: boolean;
    power: WardPower | null;
    scenarios: TurnoutScenario[];
    scenarioId: ScenarioId;
    onScenarioChange: (id: ScenarioId) => void;
    numCandidates: number;
    onNumCandidatesChange: (n: number) => void;
    districtNum: string;
    /** Live returns for the district race, once election night starts. */
    precinctResults: PrecinctResult[] | undefined;
}

export default function PlanningPanel({
    data, isLoading, isError,
    power, scenarios, scenarioId, onScenarioChange,
    numCandidates, onNumCandidatesChange,
    districtNum, precinctResults,
}: PlanningPanelProps) {
    const scenario = scenarios.find(s => s.id === scenarioId) ?? scenarios[0];
    const outcome = scenario ? computeScenarioOutcome(scenario, numCandidates) : null;
    const anchor = data ? findContestedAnchor(data) : null;
    const anchorWinner = anchor?.candidates[0];

    const readiness = useMemo(
        () => (power && scenario ? computeReadiness(power, scenario.totalVotes, precinctResults) : null),
        [power, scenario, precinctResults]
    );
    const anyReported = (readiness?.summary.wardsReported ?? 0) > 0;

    if (isLoading) {
        return (
            <div className="p-5 space-y-4 animate-pulse">
                <div className="h-36 bg-[#f0f0f0]" />
                <div className="h-64 bg-[#f0f0f0]" />
            </div>
        );
    }

    if (isError || !data || data.years.length === 0) {
        return (
            <div className="flex items-center justify-center text-[#666] text-sm text-center p-6">
                Planning data hasn&apos;t been built yet. Run <code className="mx-1 px-1 bg-[#f0f0f0]">npm run build:planning</code> and reload.
            </div>
        );
    }

    if (districtNum !== String(data.district)) {
        return (
            <div className="flex items-center justify-center text-[#666] text-sm text-center p-6">
                Pre-election planning data is currently baked for Assembly District {data.district} only.
            </div>
        );
    }

    const wardsToHalf = power?.wardsToHalf ?? 0;

    return (
        <div>
            {/* ── Header ── */}
            <div className="px-4 py-4 border-b-2 border-[#222]">
                <div className="kicker mb-1 flex items-center gap-1.5" style={{ color: '#00729c' }}>
                    <Target className="w-3.5 h-3.5" /> Pre-Election Plan · AD{data.district}
                </div>
                <div className="text-lg font-bold text-[#222] leading-tight">
                    Democratic Primary Playbook
                </div>
                <p className="mt-1.5 text-[11px] text-[#999] leading-relaxed">
                    Built from the last four August primaries in this seat. Ward-level pattern uses the{' '}
                    {power ? `${power.baselineYear} primary — the only cycle on the current district lines` : 'most recent cycle'}.
                </p>
            </div>

            {/* ── Turnout scenarios & win number ── */}
            <div className="px-4 py-4 border-b border-[#e0e0e0]">
                <h3 className="kicker mb-3 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" /> Turnout Scenarios &amp; Win Number
                </h3>

                <div className="grid grid-cols-3 gap-2">
                    {scenarios.map(s => {
                        const active = s.id === scenarioId;
                        return (
                            <button
                                key={s.id}
                                onClick={() => onScenarioChange(s.id)}
                                className={`px-2 py-2 rounded-[3px] border text-left transition-colors ${
                                    active
                                        ? 'border-[#008fd5] bg-[#f2f9fd]'
                                        : 'border-[#e0e0e0] hover:border-[#cccccc]'
                                }`}
                            >
                                <div className={`text-[10px] font-bold uppercase tracking-[0.06em] ${active ? 'text-[#00729c]' : 'text-[#999]'}`}>
                                    {s.label}
                                </div>
                                <div className="text-sm font-bold text-[#222] num">{s.totalVotes.toLocaleString()}</div>
                                <div className="text-[9px] text-[#999] leading-tight mt-0.5">{s.anchor}</div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-[#666]">Candidates on the ballot</span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onNumCandidatesChange(Math.max(2, numCandidates - 1))}
                            disabled={numCandidates <= 2}
                            className="w-7 h-7 flex items-center justify-center rounded-[3px] border border-[#cccccc] text-[#666] hover:bg-[#f7f7f7] disabled:opacity-30"
                            aria-label="Fewer candidates"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-[#222] num">{numCandidates}</span>
                        <button
                            onClick={() => onNumCandidatesChange(Math.min(9, numCandidates + 1))}
                            disabled={numCandidates >= 9}
                            className="w-7 h-7 flex items-center justify-center rounded-[3px] border border-[#cccccc] text-[#666] hover:bg-[#f7f7f7] disabled:opacity-30"
                            aria-label="More candidates"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {outcome && (
                    <div className="mt-3 border border-[#e0e0e0] rounded-[3px] px-3 py-3 bg-[#fafafa]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#999]">
                            Votes to win{outcome.winNumber.isEstimate ? ' (est.)' : ''}
                        </div>
                        <div className="text-2xl font-extrabold text-[#222] num leading-tight">
                            ~{outcome.winNumber.winNumber.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-[#999] mt-1 num">{outcome.winNumber.explanation}</div>
                    </div>
                )}

                {anchor && anchorWinner && (
                    <p className="mt-3 text-[11px] text-[#666] leading-relaxed">
                        <span className="font-bold">Reality check:</span> in the {anchor.year}{' '}
                        {anchor.candidates.length}-way open-seat primary, {anchorWinner.name} won with{' '}
                        <span className="num font-bold">{anchorWinner.votes.toLocaleString()}</span> votes
                        ({anchorWinner.pct.toFixed(1)}%) of {anchor.totalVotes.toLocaleString()} cast.
                    </p>
                )}
            </div>

            {/* ── Election-night readiness (live) ── */}
            {anyReported && readiness && (
                <div className="px-4 py-4 border-b border-[#e0e0e0] bg-[#f2f9fd]">
                    <h3 className="kicker mb-2 flex items-center gap-1.5" style={{ color: '#00729c' }}>
                        <Radio className="w-3.5 h-3.5" /> Returns vs Expectation
                    </h3>
                    <div className="text-sm text-[#222]">
                        <span className="font-bold num">{readiness.summary.wardsReported}</span> of{' '}
                        <span className="num">{readiness.summary.wardsTotal}</span> wards in — expected{' '}
                        <span className="font-bold num">{readiness.summary.expectedInReported.toLocaleString()}</span> votes
                        from these wards, actual{' '}
                        <span className="font-bold num">{readiness.summary.actualInReported.toLocaleString()}</span>
                        {readiness.summary.deltaPct !== null && (
                            <span className={`font-bold num ${readiness.summary.deltaPct >= 0 ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                {' '}({readiness.summary.deltaPct >= 0 ? '+' : ''}{readiness.summary.deltaPct.toFixed(0)}%)
                            </span>
                        )}
                    </div>
                    <div className="text-[11px] text-[#999] mt-1">
                        Reported wards hold {(readiness.summary.expectedShareIn * 100).toFixed(0)}% of the district&apos;s expected vote.
                    </div>
                </div>
            )}

            {/* ── Ward power ranking ── */}
            {power && readiness && (
                <div className="px-4 py-4 border-b border-[#e0e0e0]">
                    <h3 className="kicker mb-2 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" /> Where the Votes Are
                    </h3>
                    <p className="text-[11px] text-[#666] mb-3 leading-relaxed">
                        The top <span className="font-bold num">{wardsToHalf}</span> of{' '}
                        <span className="num">{power.rows.length}</span> wards cast half the district&apos;s
                        primary vote. Expected votes scale each ward&apos;s {power.baselineYear} share to the{' '}
                        {scenario?.label.toLowerCase()} scenario ({scenario?.totalVotes.toLocaleString()}).
                    </p>

                    <table className="w-full text-[11px]">
                        <thead>
                            <tr className="text-[#999] uppercase tracking-[0.05em] text-[9px] border-b border-[#e0e0e0]">
                                <th className="text-left py-1 pr-1 font-bold">#</th>
                                <th className="text-left py-1 pr-2 font-bold">Ward</th>
                                <th className="text-right py-1 pr-2 font-bold">Exp.</th>
                                {anyReported && <th className="text-right py-1 pr-2 font-bold">Act.</th>}
                                <th className="text-right py-1 pr-2 font-bold">Share</th>
                                <th className="text-right py-1 font-bold">Cum.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {readiness.rows.map(r => {
                                const inHalf = r.rank <= wardsToHalf;
                                const delta = r.actualVotes !== null && r.expectedVotes > 0
                                    ? (r.actualVotes / r.expectedVotes - 1) * 100
                                    : null;
                                return (
                                    <tr
                                        key={r.wardKey}
                                        className={`border-b border-[#f0f0f0] ${anyReported && !r.reported ? 'opacity-45' : ''}`}
                                    >
                                        <td className={`py-1.5 pr-1 num ${inHalf ? 'font-bold text-[#00729c]' : 'text-[#999]'}`}>{r.rank}</td>
                                        <td className="py-1.5 pr-2 text-[#222] whitespace-nowrap">
                                            {r.displayName}
                                            {inHalf && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-[#008fd5] align-middle" />}
                                        </td>
                                        <td className="py-1.5 pr-2 text-right num font-bold text-[#222]">{r.expectedVotes.toLocaleString()}</td>
                                        {anyReported && (
                                            <td className="py-1.5 pr-2 text-right num">
                                                {r.actualVotes !== null ? (
                                                    <span className={delta !== null && delta < 0 ? 'text-[#c73a1d] font-bold' : 'text-[#567a3a] font-bold'}>
                                                        {r.actualVotes.toLocaleString()}
                                                    </span>
                                                ) : (
                                                    <span className="text-[#cccccc]">—</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="py-1.5 pr-2 text-right num text-[#666]">{(r.share * 100).toFixed(1)}%</td>
                                        <td className="py-1.5 text-right num text-[#999]">{(r.cumulativeShare * 100).toFixed(0)}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <p className="mt-2 text-[10px] text-[#999]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#008fd5] align-middle mr-1" />
                        Wards that together decide half the vote — the canvass core. The map shades the district by these shares.
                    </p>
                </div>
            )}

            {/* ── Turnout history ── */}
            <div className="px-4 py-4">
                <h3 className="kicker mb-3 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> This Seat&apos;s Primary Turnout
                </h3>
                <div className="space-y-2">
                    {data.years.map(y => {
                        const maxTotal = Math.max(...data.years.map(v => v.totalVotes), 1);
                        return (
                            <div key={y.year}>
                                <div className="flex items-baseline justify-between text-xs">
                                    <span className="text-[#222] font-bold num">
                                        {y.year}
                                        {y.contested && (
                                            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[#a16207] border border-[#e5ae38] rounded-[2px] px-1 py-px">
                                                Contested
                                            </span>
                                        )}
                                    </span>
                                    <span className="num text-[#666]">{y.totalVotes.toLocaleString()} votes</span>
                                </div>
                                <div className="h-1.5 bg-[#e8e8e8] mt-1">
                                    <div
                                        className="h-full bg-[#008fd5]"
                                        style={{ width: `${(y.totalVotes / maxTotal) * 100}%`, opacity: y.contested ? 1 : 0.45 }}
                                    />
                                </div>
                                <div className="text-[10px] text-[#999] mt-0.5 truncate">
                                    {y.candidates[0]
                                        ? `${y.candidates[0].name} — ${y.candidates[0].pct.toFixed(1)}%`
                                        : 'No candidate data'}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-3 text-[11px] text-[#999] leading-relaxed">
                    2026 is a midterm year: 2018 and 2022 are the turnout-level comparables, but an
                    open, contested seat (like 2020) pulls turnout toward the high end.
                </p>
            </div>
        </div>
    );
}
