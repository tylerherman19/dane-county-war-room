'use client';

import { RaceResult, PrecinctResult, Election, ElectionTurnout } from '@/lib/api';
import { Search, Download, ExternalLink, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import BenchmarkCard, { BenchmarkSelection, BenchmarkStats } from './BenchmarkCard';

interface SidebarProps {
    raceResult: RaceResult | undefined;
    precinctResults: PrecinctResult[] | undefined;
    isLoading: boolean;
    onSelectWard: (ward: { name: string; num: string }) => void;
    isArchive?: boolean;
    focusedCandidate?: string | null;
    onFocusCandidate?: (name: string | null) => void;
    // Real turnout (county BALLOTS CAST tally) + comparison election
    electionTurnout?: ElectionTurnout;
    comparisonTurnout?: ElectionTurnout;
    comparisonElection?: Election;
    elections?: Election[];
    selectedElectionId?: string | null;
    onSelectComparison?: (electionId: string | null) => void;
    // When set, precinctResults are pre-filtered to one district's wards
    scopeLabel?: string | null;
    // Election-night benchmark (current race vs a candidate's past race)
    isLive?: boolean;
    benchmark?: BenchmarkSelection | null;
    onBenchmarkChange?: (b: BenchmarkSelection | null) => void;
    benchmarkStats?: BenchmarkStats | null;
}

// Party → fill color (bars, chips) and a darker text-safe variant
function getPartyColor(party: string | undefined): { bg: string; text: string; dot: string } {
    const p = (party || '').toLowerCase();
    if (p.includes('democrat')) return { bg: '#008fd5', text: '#00729c', dot: '#008fd5' };
    if (p.includes('republican')) return { bg: '#fc4f30', text: '#c73a1d', dot: '#fc4f30' };
    if (p.includes('green')) return { bg: '#6d904f', text: '#567a3a', dot: '#6d904f' };
    if (p.includes('libertarian')) return { bg: '#e5ae38', text: '#a16207', dot: '#e5ae38' };
    return { bg: '#8b8b8b', text: '#666666', dot: '#8b8b8b' };
}

function turnoutKey(name: string, num: string): string {
    return `${name}|${parseInt(num) || 0}`;
}

function toWardMap(turnout: ElectionTurnout | undefined): Record<string, number> {
    const m: Record<string, number> = {};
    turnout?.byWard.forEach(w => {
        const k = turnoutKey(w.precinctName, w.wardNumber);
        m[k] = (m[k] ?? 0) + w.ballotsCast;
    });
    return m;
}

function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export default function Sidebar({
    raceResult, precinctResults, isLoading, onSelectWard, isArchive,
    focusedCandidate, onFocusCandidate,
    electionTurnout, comparisonTurnout, comparisonElection,
    elections, selectedElectionId, onSelectComparison,
    scopeLabel,
    isLive, benchmark, onBenchmarkChange, benchmarkStats,
}: SidebarProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [copied, setCopied] = useState(false);

    const wardTurnoutMap = useMemo(() => toWardMap(electionTurnout), [electionTurnout]);
    const comparisonWardMap = useMemo(() => toWardMap(comparisonTurnout), [comparisonTurnout]);

    // When a seat filter is active, candidate totals come from the scoped
    // precinct rows rather than the county-wide race result.
    const scopedCandidates = useMemo(() => {
        if (!scopeLabel || !raceResult || !precinctResults?.length) return null;
        const totals = new Map<string, number>();
        precinctResults.forEach(r => {
            const name = r.candidateName.trim();
            totals.set(name, (totals.get(name) ?? 0) + r.votes);
        });
        const total = [...totals.values()].reduce((a, b) => a + b, 0);
        if (total === 0) return null;
        return [...totals.entries()].map(([name, votes]) => ({
            candidateName: name,
            votes,
            percentage: (votes / total) * 100,
            party: raceResult.candidates.find(c => c.candidateName.trim() === name)?.party,
        }));
    }, [scopeLabel, raceResult, precinctResults]);

    if (isLoading) {
        return (
            <div className="h-full bg-white p-5 space-y-4 animate-pulse">
                <div className="h-36 bg-[#f0f0f0]" />
                <div className="h-40 bg-[#f0f0f0]" />
                <div className="h-24 bg-[#f0f0f0]" />
                <div className="h-64 bg-[#f0f0f0]" />
            </div>
        );
    }

    if (!raceResult) {
        return (
            <div className="h-full bg-white flex items-center justify-center text-[#999] text-sm">
                Select a race to view results
            </div>
        );
    }

    const sortedCandidates = [...(scopedCandidates ?? raceResult.candidates)].sort((a, b) => b.votes - a.votes);
    const leader = sortedCandidates[0];
    const runnerUp = sortedCandidates[1];
    const totalVotes = scopedCandidates
        ? scopedCandidates.reduce((s, c) => s + c.votes, 0)
        : raceResult.totalVotes;
    const margin = leader && runnerUp && totalVotes > 0
        ? ((leader.votes - runnerUp.votes) / totalVotes * 100)
        : 0;
    const leaderColor = getPartyColor(leader?.party);
    const reportingPct = raceResult.totalPrecincts > 0
        ? Math.round((raceResult.precinctsReporting / raceResult.totalPrecincts) * 100)
        : 0;

    // Ward list
    const DELIM = '|||';
    const filteredWards = precinctResults?.filter(w =>
        w.precinctName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.wardNumber.toString().includes(searchTerm)
    ) || [];

    const uniqueWards = Array.from(new Set(filteredWards.map(w => `${w.precinctName}${DELIM}${w.wardNumber}`)))
        .map(key => {
            const delimIdx = key.indexOf(DELIM);
            const name = key.slice(0, delimIdx);
            const num = key.slice(delimIdx + DELIM.length);
            const wardResults = filteredWards.filter(w => w.precinctName === name && w.wardNumber === num);
            const total = wardResults[0]?.ballotscast || 0;
            const sorted = [...wardResults].sort((a, b) => b.votes - a.votes);
            const winner = sorted[0];
            const winnerParty = raceResult.candidates.find(
                c => c.candidateName === winner?.candidateName
            )?.party;
            const tk = turnoutKey(name, num);
            const ballots = wardTurnoutMap[tk];
            const prevBallots = comparisonWardMap[tk];
            const turnoutDelta = ballots !== undefined && prevBallots !== undefined && prevBallots > 0
                ? ((ballots - prevBallots) / prevBallots) * 100
                : null;
            const reported = wardResults.some(w => w.reported);
            return { name, num, total, winner, winnerParty, ballots, prevBallots, turnoutDelta, reported };
        })
        .sort((a, b) => {
            const nc = a.name.localeCompare(b.name);
            return nc !== 0 ? nc : parseInt(a.num) - parseInt(b.num);
        });

    // ── Turnout math (real ballots-cast data, scoped to this race's wards) ──
    // For district races (alder, supervisor...) county-wide turnout is the wrong
    // denominator, so sum ballots over just the wards that appear in this race.
    const raceWardKeys = Array.from(new Set(
        (precinctResults ?? []).map(w => turnoutKey(w.precinctName, w.wardNumber))
    ));
    const raceAreaBallots = raceWardKeys.reduce((sum, k) => sum + (wardTurnoutMap[k] ?? 0), 0);
    const isCountywide = electionTurnout
        ? raceAreaBallots >= electionTurnout.totalBallots * 0.98
        : false;
    // Apples-to-apples comparison: only wards present in BOTH elections
    const matchedKeys = raceWardKeys.filter(k => wardTurnoutMap[k] !== undefined && comparisonWardMap[k] !== undefined);
    const matchedCurrent = matchedKeys.reduce((s, k) => s + wardTurnoutMap[k], 0);
    const matchedPrev = matchedKeys.reduce((s, k) => s + comparisonWardMap[k], 0);
    const areaDelta = matchedPrev > 0 ? ((matchedCurrent - matchedPrev) / matchedPrev) * 100 : null;
    // Roll-off: voters who cast a ballot but skipped this race
    const rolloff = raceAreaBallots > 0 && totalVotes > 0 && totalVotes <= raceAreaBallots
        ? (1 - totalVotes / raceAreaBallots) * 100
        : null;

    // Election night: estimate outstanding vote from unreported wards using
    // the comparison election's turnout in those same wards
    const unreportedWardKeys = (() => {
        const seen = new Map<string, boolean>();
        (precinctResults ?? []).forEach(r => {
            const k = turnoutKey(r.precinctName, r.wardNumber);
            seen.set(k, (seen.get(k) ?? false) || r.reported);
        });
        return [...seen.entries()].filter(([, rep]) => !rep).map(([k]) => k);
    })();
    const estOutstanding = unreportedWardKeys.reduce((s, k) => s + (comparisonWardMap[k] ?? 0), 0);

    // Comparison picker options: every election except the selected one
    const comparisonOptions = (elections ?? []).filter(e => e.electionId !== selectedElectionId);

    // ── CSV export: ward-level targeting sheet ──────────────────────────────
    function handleExportCSV() {
        if (!raceResult) return;
        const candidateNames = sortedCandidates.map(c => c.candidateName);
        const header = [
            'Municipality', 'Ward',
            ...candidateNames.map(n => `"${n.replace(/"/g, '""')}" votes`),
            'Race votes total', 'Ballots cast',
            comparisonElection ? `Ballots cast (${comparisonElection.electionName})` : 'Ballots cast (comparison)',
            'Turnout change %',
        ];
        const allWards = Array.from(new Set((precinctResults ?? []).map(w => `${w.precinctName}${DELIM}${w.wardNumber}`)));
        const rows = allWards.map(key => {
            const delimIdx = key.indexOf(DELIM);
            const name = key.slice(0, delimIdx);
            const num = key.slice(delimIdx + DELIM.length);
            const wardRows = (precinctResults ?? []).filter(w => w.precinctName === name && w.wardNumber === num);
            const votesByCandidate = candidateNames.map(cn =>
                wardRows.find(w => w.candidateName === cn)?.votes ?? 0
            );
            const raceTotal = wardRows.reduce((s, w) => s + w.votes, 0);
            const tk = turnoutKey(name, num);
            const ballots = wardTurnoutMap[tk];
            const prev = comparisonWardMap[tk];
            const delta = ballots !== undefined && prev !== undefined && prev > 0
                ? (((ballots - prev) / prev) * 100).toFixed(1)
                : '';
            return [`"${name}"`, num, ...votesByCandidate, raceTotal, ballots ?? '', prev ?? '', delta].join(',');
        });
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slugify(raceResult.raceName)}-by-ward.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleShare() {
        navigator.clipboard?.writeText(window.location.href).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {});
    }

    return (
        <div className="h-full bg-white flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">

                {/* ── Leader ── */}
                {leader && (
                    <div className="px-4 py-4 border-b border-[#e0e0e0]">
                        <div className="kicker mb-1" style={{ color: leaderColor.text }}>
                            {totalVotes > 0 ? (isArchive || reportingPct === 100 ? 'Winner' : 'Leading') : 'Awaiting Results'}
                            {scopeLabel && <span className="ml-2 normal-case tracking-normal text-[#008fd5]">in {scopeLabel}</span>}
                        </div>
                        <div className="text-xl font-bold text-[#222] leading-tight truncate">{leader.candidateName}</div>
                        <div className="flex items-baseline gap-3 mt-1">
                            <span className="text-4xl font-bold num text-[#222]">{leader.percentage.toFixed(1)}%</span>
                            {runnerUp && (
                                <span className="text-[#666] text-sm">
                                    +{margin.toFixed(1)} over {runnerUp.candidateName.split(' ').slice(-1)[0]}
                                </span>
                            )}
                        </div>
                        {/* Margin bar */}
                        {runnerUp && (
                            <div className="mt-3 h-2 bg-[#e8e8e8] flex">
                                <div className="h-full transition-all duration-700"
                                    style={{ width: `${leader.percentage}%`, background: leaderColor.bg }} />
                            </div>
                        )}
                        <div className="mt-2 text-xs text-[#999] num">
                            {raceResult.precinctsReporting > 0
                                ? `${raceResult.precinctsReporting} of ${raceResult.totalPrecincts} precincts reporting`
                                : 'No precincts reporting yet'
                            }
                        </div>
                    </div>
                )}

                {/* ── Candidate Breakdown ── */}
                <div className="px-4 py-4 border-b border-[#e0e0e0]">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="kicker">All Candidates</h3>
                        {focusedCandidate && (
                            <button
                                onClick={() => onFocusCandidate?.(null)}
                                className="text-[11px] text-[#008fd5] hover:underline transition-colors"
                            >
                                Clear map filter
                            </button>
                        )}
                    </div>
                    {focusedCandidate && (
                        <div className="mb-3 px-2 py-1.5 bg-[#f2f9fd] border-l-2 border-[#008fd5] text-xs text-[#00729c]">
                            Showing ward map for <span className="font-bold">{focusedCandidate}</span>
                        </div>
                    )}
                    <div className="space-y-1">
                        {sortedCandidates.map((candidate) => {
                            const color = getPartyColor(candidate.party);
                            const isFocused = focusedCandidate === candidate.candidateName;
                            return (
                                <button
                                    key={candidate.candidateName}
                                    onClick={() => onFocusCandidate?.(isFocused ? null : candidate.candidateName)}
                                    title={isFocused ? 'Click to clear map filter' : 'Click to highlight wards on map'}
                                    className={`w-full text-left px-2 py-1.5 transition-colors border-l-2 ${
                                        isFocused
                                            ? 'bg-[#f7f7f7]'
                                            : 'border-transparent hover:bg-[#f7f7f7]'
                                    }`}
                                    style={isFocused ? { borderLeftColor: color.dot } : undefined}
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-2.5 h-2.5 shrink-0" style={{ background: color.dot }} />
                                            <span className={`text-sm truncate text-[#222] ${isFocused ? 'font-bold' : 'font-medium'}`}>
                                                {candidate.candidateName}
                                            </span>
                                            {isFocused && <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[#008fd5] shrink-0">Map</span>}
                                        </div>
                                        <div className="flex items-baseline gap-2 shrink-0 ml-2">
                                            <span className="font-bold text-[#222] text-sm num">{candidate.percentage.toFixed(1)}%</span>
                                            <span className="text-[#999] text-xs num">{candidate.votes.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-[#e8e8e8]">
                                        <div
                                            className="h-full transition-all duration-700"
                                            style={{ width: `${candidate.percentage}%`, background: color.bg }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {totalVotes > 0 && (
                        <div className="mt-3 pt-2 border-t border-[#e0e0e0] text-xs text-[#999] num text-right">
                            {totalVotes.toLocaleString()} total votes
                        </div>
                    )}
                </div>

                {/* ── Turnout (real ballots-cast data) ── */}
                {raceAreaBallots > 0 && (
                    <div className="px-4 py-4 border-b border-[#e0e0e0]">
                        <h3 className="kicker mb-3">Turnout</h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold num text-[#222]">{raceAreaBallots.toLocaleString()}</span>
                            <span className="text-[#666] text-sm">
                                ballots cast {isCountywide ? 'county-wide' : "in this race's wards"}
                            </span>
                        </div>
                        {!isCountywide && electionTurnout && (
                            <div className="mt-1 text-xs text-[#999] num">
                                {electionTurnout.totalBallots.toLocaleString()} county-wide
                            </div>
                        )}
                        {/* Roll-off: ballots that skipped this race */}
                        {rolloff !== null && (
                            <>
                                <div className="mt-3 h-2 bg-[#e8e8e8]">
                                    <div
                                        className="bg-[#008fd5] h-full transition-all duration-700"
                                        style={{ width: `${Math.min(100, (totalVotes / raceAreaBallots) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1.5 text-xs text-[#999] num">
                                    <span>{totalVotes.toLocaleString()} voted in this race</span>
                                    <span>{rolloff.toFixed(1)}% skipped it</span>
                                </div>
                            </>
                        )}
                        {/* Comparison vs another election */}
                        <div className="mt-3 pt-3 border-t border-[#e0e0e0]">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs text-[#666] shrink-0">Compare vs</label>
                                <select
                                    className="flex-1 min-w-0 bg-white text-[#222] text-xs rounded-[3px] px-2 py-1 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                                    value={comparisonElection?.electionId ?? ''}
                                    onChange={e => onSelectComparison?.(e.target.value || null)}
                                >
                                    {comparisonOptions.map(e => (
                                        <option key={e.electionId} value={e.electionId}>
                                            {e.electionName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {areaDelta !== null ? (
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs text-[#999] num">
                                        {matchedPrev.toLocaleString()} ballots in same wards
                                    </span>
                                    <span className={`text-xs font-bold num ${areaDelta >= 0 ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                        {areaDelta >= 0 ? '▲' : '▼'} {Math.abs(areaDelta).toFixed(1)}% turnout
                                    </span>
                                </div>
                            ) : (
                                <div className="mt-2 text-xs text-[#999]">
                                    {comparisonElection ? 'Loading comparison' : 'No comparison selected'}
                                </div>
                            )}
                        </div>
                        {/* Election night: outstanding vote from unreported wards */}
                        {isLive && unreportedWardKeys.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#e0e0e0] flex items-center justify-between">
                                <span className="text-xs text-[#666]">
                                    {unreportedWardKeys.length} ward{unreportedWardKeys.length === 1 ? '' : 's'} not reported
                                </span>
                                <span className="text-xs font-bold num text-[#a16207]">
                                    ~{estOutstanding.toLocaleString()} ballots out
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Election-night benchmark vs a past race ── */}
                {onBenchmarkChange && (
                    <BenchmarkCard
                        raceResult={raceResult}
                        elections={elections}
                        isLive={!!isLive}
                        benchmark={benchmark ?? null}
                        onBenchmarkChange={onBenchmarkChange}
                        stats={benchmarkStats ?? null}
                    />
                )}

                {/* ── Ward Results ── */}
                <div className="flex flex-col">
                    <div className="px-4 py-4 border-b border-[#e0e0e0]">
                        <h3 className="kicker mb-3">Ward Results</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#999]" />
                            <input
                                type="text"
                                placeholder="Search wards"
                                className="w-full bg-white border border-[#cccccc] rounded-[3px] pl-9 pr-4 py-2 text-sm text-[#222] placeholder-[#999] focus:outline-none focus:border-[#008fd5] transition-colors"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto max-h-80">
                        {uniqueWards.map(ward => {
                            const color = getPartyColor(ward.winnerParty);
                            const winnerPct = ward.total > 0 && ward.winner
                                ? ((ward.winner.votes / ward.total) * 100).toFixed(0)
                                : null;
                            return (
                                <button
                                    key={`${ward.name}-${ward.num}`}
                                    onClick={() => onSelectWard({ name: ward.name, num: ward.num })}
                                    className="w-full text-left px-4 py-2.5 hover:bg-[#f7f7f7] border-b border-[#eeeeee] transition-colors flex items-center gap-3"
                                >
                                    <div className="w-2 h-2 shrink-0" style={{ background: ward.winner ? color.dot : '#dddddd' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-[#222] truncate">{ward.name} Ward {ward.num}</div>
                                        <div className="text-xs text-[#999] truncate">
                                            {ward.winner?.candidateName}
                                            {ward.ballots !== undefined && (
                                                <span className="num"> · {ward.ballots.toLocaleString()} ballots</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {!ward.reported ? (
                                            <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-[#a16207] border border-[#e5ae38] rounded-[2px] px-1.5 py-0.5">
                                                awaiting
                                            </span>
                                        ) : (
                                            <>
                                                {ward.turnoutDelta !== null && (
                                                    <span
                                                        className="text-[10px] font-bold leading-none num"
                                                        style={{ color: ward.turnoutDelta >= 0 ? '#567a3a' : '#c73a1d' }}
                                                        title={`Turnout vs ${comparisonElection?.electionName ?? 'comparison'}: ${ward.prevBallots?.toLocaleString()} → ${ward.ballots?.toLocaleString()}`}
                                                    >
                                                        {ward.turnoutDelta >= 0 ? '▲' : '▼'}{Math.abs(ward.turnoutDelta).toFixed(0)}%
                                                    </span>
                                                )}
                                                {winnerPct && (
                                                    <span className="text-xs num font-bold" style={{ color: color.text }}>{winnerPct}%</span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        {uniqueWards.length === 0 && (
                            <div className="p-6 text-center text-[#999] text-sm">
                                {searchTerm ? 'No matching wards' : 'No ward data yet'}
                            </div>
                        )}
                    </div>
                    {uniqueWards.length > 0 && (
                        <div className="px-4 py-2 border-t border-[#e0e0e0] text-xs text-[#999] num text-right">
                            {uniqueWards.length} wards
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-[#e0e0e0] bg-white">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleExportCSV}
                        title="Download ward-level results + turnout as CSV"
                        className="flex items-center justify-center gap-2 bg-white border border-[#cccccc] hover:bg-[#f7f7f7] text-[#222] text-xs font-bold py-2 px-3 rounded-[3px] transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                        onClick={handleShare}
                        title="Copy a link to this exact view"
                        className="flex items-center justify-center gap-2 bg-white border border-[#cccccc] hover:bg-[#f7f7f7] text-[#222] text-xs font-bold py-2 px-3 rounded-[3px] transition-colors"
                    >
                        {copied ? <><Check className="w-3.5 h-3.5 text-[#567a3a]" /> Copied</> : <><ExternalLink className="w-3.5 h-3.5" /> Share</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
