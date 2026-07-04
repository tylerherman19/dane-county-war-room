'use client';

import { RaceResult, PrecinctResult, Election, ElectionTurnout } from '@/lib/api';
import { Search, Download, ExternalLink, Check } from 'lucide-react';
import { useMemo, useState } from 'react';

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
}

// Party → tailwind / hex color
function getPartyColor(party: string | undefined): { bg: string; text: string; dot: string } {
    const p = (party || '').toLowerCase();
    if (p.includes('democrat')) return { bg: '#2563eb', text: '#93c5fd', dot: '#3b82f6' };
    if (p.includes('republican')) return { bg: '#dc2626', text: '#fca5a5', dot: '#ef4444' };
    if (p.includes('green')) return { bg: '#16a34a', text: '#86efac', dot: '#22c55e' };
    if (p.includes('libertarian')) return { bg: '#ca8a04', text: '#fde047', dot: '#eab308' };
    return { bg: '#475569', text: '#cbd5e1', dot: '#64748b' };
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
            <div className="h-full bg-slate-900 border-l border-slate-800 p-5 space-y-4 animate-pulse">
                <div className="h-36 bg-slate-800 rounded-xl" />
                <div className="h-40 bg-slate-800 rounded-xl" />
                <div className="h-24 bg-slate-800 rounded-xl" />
                <div className="h-64 bg-slate-800 rounded-xl" />
            </div>
        );
    }

    if (!raceResult) {
        return (
            <div className="h-full bg-slate-900 border-l border-slate-800 flex items-center justify-center text-slate-500 text-sm">
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
            return { name, num, total, winner, winnerParty, ballots, prevBallots, turnoutDelta };
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
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── Winner Hero Card ── */}
                {leader && (
                    <div
                        className="rounded-xl p-5 relative overflow-hidden"
                        style={{ background: `linear-gradient(135deg, ${leaderColor.bg}22 0%, #0f172a 100%)`, border: `1px solid ${leaderColor.bg}44` }}
                    >
                        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: leaderColor.text }}>
                            {totalVotes > 0 ? (isArchive || reportingPct === 100 ? 'Winner' : 'Leading') : 'Awaiting Results'}
                            {scopeLabel && <span className="ml-2 normal-case tracking-normal font-semibold text-blue-400">in {scopeLabel}</span>}
                        </div>
                        <div className="text-xl font-bold text-white leading-tight truncate">{leader.candidateName}</div>
                        <div className="flex items-baseline gap-3 mt-2">
                            <span className="text-4xl font-black text-white">{leader.percentage.toFixed(1)}%</span>
                            {runnerUp && (
                                <span className="text-slate-400 text-sm">
                                    +{margin.toFixed(1)} over {runnerUp.candidateName.split(' ').slice(-1)[0]}
                                </span>
                            )}
                        </div>
                        {/* Margin bar */}
                        {runnerUp && (
                            <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${leader.percentage}%`, background: leaderColor.bg }} />
                            </div>
                        )}
                        <div className="mt-2 text-xs text-slate-500">
                            {raceResult.precinctsReporting > 0
                                ? `${raceResult.precinctsReporting} of ${raceResult.totalPrecincts} precincts reporting`
                                : 'No precincts reporting yet'
                            }
                        </div>
                    </div>
                )}

                {/* ── Candidate Breakdown ── */}
                <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">All Candidates</h3>
                        {focusedCandidate && (
                            <button
                                onClick={() => onFocusCandidate?.(null)}
                                className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                                ✕ Clear map filter
                            </button>
                        )}
                    </div>
                    {focusedCandidate && (
                        <div className="mb-3 px-2 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400">
                            Showing ward map for <span className="font-semibold">{focusedCandidate}</span>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        {sortedCandidates.map((candidate) => {
                            const color = getPartyColor(candidate.party);
                            const isFocused = focusedCandidate === candidate.candidateName;
                            return (
                                <button
                                    key={candidate.candidateName}
                                    onClick={() => onFocusCandidate?.(isFocused ? null : candidate.candidateName)}
                                    title={isFocused ? 'Click to clear map filter' : 'Click to highlight wards on map'}
                                    className={`w-full text-left rounded-lg px-2 py-1.5 transition-all ${
                                        isFocused
                                            ? 'bg-slate-700/60 ring-1 ring-offset-0'
                                            : 'hover:bg-slate-700/30'
                                    }`}
                                    style={isFocused ? { outlineColor: color.dot } : undefined}
                                >
                                    <div className="flex justify-between items-baseline mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color.dot }} />
                                            <span className={`text-sm font-medium truncate ${isFocused ? 'text-white' : 'text-slate-200'}`}>
                                                {candidate.candidateName}
                                            </span>
                                            {isFocused && <span className="text-[9px] text-blue-400 shrink-0">MAP</span>}
                                        </div>
                                        <div className="flex items-baseline gap-2 shrink-0 ml-2">
                                            <span className="font-bold text-white text-sm">{candidate.percentage.toFixed(1)}%</span>
                                            <span className="text-slate-500 text-xs">{candidate.votes.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${candidate.percentage}%`, background: color.bg }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {totalVotes > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500 text-right">
                            {totalVotes.toLocaleString()} total votes
                        </div>
                    )}
                </div>

                {/* ── Turnout Card (real ballots-cast data) ── */}
                {raceAreaBallots > 0 && (
                    <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                            Turnout
                        </h3>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-white">{raceAreaBallots.toLocaleString()}</span>
                            <span className="text-slate-400 text-sm">
                                ballots cast {isCountywide ? 'county-wide' : "in this race's wards"}
                            </span>
                        </div>
                        {!isCountywide && electionTurnout && (
                            <div className="mt-1 text-xs text-slate-500">
                                {electionTurnout.totalBallots.toLocaleString()} county-wide
                            </div>
                        )}
                        {/* Roll-off: ballots that skipped this race */}
                        {rolloff !== null && (
                            <>
                                <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                    <div
                                        className="bg-blue-500 h-full rounded-full transition-all duration-700"
                                        style={{ width: `${Math.min(100, (totalVotes / raceAreaBallots) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between mt-1.5 text-xs text-slate-500">
                                    <span>{totalVotes.toLocaleString()} voted in this race</span>
                                    <span>{rolloff.toFixed(1)}% skipped it</span>
                                </div>
                            </>
                        )}
                        {/* Comparison vs another election */}
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                            <div className="flex items-center justify-between gap-2">
                                <label className="text-xs text-slate-500 shrink-0">Compare vs</label>
                                <select
                                    className="flex-1 min-w-0 bg-slate-900/60 text-slate-300 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:border-blue-500"
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
                                    <span className="text-xs text-slate-500">
                                        {matchedPrev.toLocaleString()} ballots in same wards
                                    </span>
                                    <span className={`text-xs font-semibold ${areaDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {areaDelta >= 0 ? '↑' : '↓'} {Math.abs(areaDelta).toFixed(1)}% turnout
                                    </span>
                                </div>
                            ) : (
                                <div className="mt-2 text-xs text-slate-600">
                                    {comparisonElection ? 'Loading comparison…' : 'No comparison selected'}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Ward Results ── */}
                <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 flex flex-col">
                    <div className="p-4 border-b border-slate-700/40">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Ward Results</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search wards..."
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto max-h-80 p-1.5 space-y-0.5">
                        {uniqueWards.map(ward => {
                            const color = getPartyColor(ward.winnerParty);
                            const winnerPct = ward.total > 0 && ward.winner
                                ? ((ward.winner.votes / ward.total) * 100).toFixed(0)
                                : null;
                            return (
                                <button
                                    key={`${ward.name}-${ward.num}`}
                                    onClick={() => onSelectWard({ name: ward.name, num: ward.num })}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 rounded-lg transition-colors flex items-center gap-3"
                                >
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ward.winner ? color.dot : '#334155' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-slate-200 truncate">{ward.name} Ward {ward.num}</div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {ward.winner?.candidateName}
                                            {ward.ballots !== undefined && (
                                                <span className="text-slate-600"> · {ward.ballots.toLocaleString()} ballots</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {ward.turnoutDelta !== null && (
                                            <span
                                                className="text-[10px] font-semibold leading-none"
                                                style={{ color: ward.turnoutDelta >= 0 ? '#4ade80' : '#f87171' }}
                                                title={`Turnout vs ${comparisonElection?.electionName ?? 'comparison'}: ${ward.prevBallots?.toLocaleString()} → ${ward.ballots?.toLocaleString()}`}
                                            >
                                                {ward.turnoutDelta >= 0 ? '↑' : '↓'}{Math.abs(ward.turnoutDelta).toFixed(0)}%
                                            </span>
                                        )}
                                        {winnerPct && (
                                            <span className="text-xs font-mono" style={{ color: color.dot }}>{winnerPct}%</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                        {uniqueWards.length === 0 && (
                            <div className="p-6 text-center text-slate-500 text-sm">
                                {searchTerm ? 'No matching wards' : 'No ward data yet'}
                            </div>
                        )}
                    </div>
                    {uniqueWards.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-700/40 text-xs text-slate-600 text-right">
                            {uniqueWards.length} wards
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleExportCSV}
                        title="Download ward-level results + turnout as CSV"
                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button
                        onClick={handleShare}
                        title="Copy a link to this exact view"
                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors"
                    >
                        {copied ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copied</> : <><ExternalLink className="w-3.5 h-3.5" /> Share</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
