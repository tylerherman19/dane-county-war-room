'use client';

import { RaceResult, HistoricalTurnout, PrecinctResult } from '@/lib/api';
import { Search, Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { getExpectedTotalVotes, isHistoricalDataLoaded, getWardAnalysis, getHistoricalRaceInfo } from '@/lib/analysis-data';

interface SidebarProps {
    raceResult: RaceResult | undefined;
    turnoutData: HistoricalTurnout | undefined;
    precinctResults: PrecinctResult[] | undefined;
    isLoading: boolean;
    onSelectWard: (ward: { name: string; num: string }) => void;
    isArchive?: boolean;
    focusedCandidate?: string | null;
    onFocusCandidate?: (name: string | null) => void;
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

export default function Sidebar({ raceResult, turnoutData, precinctResults, isLoading, onSelectWard, isArchive, focusedCandidate, onFocusCandidate }: SidebarProps) {
    const [searchTerm, setSearchTerm] = useState('');

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

    const sortedCandidates = [...raceResult.candidates].sort((a, b) => b.votes - a.votes);
    const leader = sortedCandidates[0];
    const runnerUp = sortedCandidates[1];
    const totalVotes = raceResult.totalVotes;
    const margin = leader && runnerUp && totalVotes > 0
        ? ((leader.votes - runnerUp.votes) / totalVotes * 100)
        : 0;
    const leaderColor = getPartyColor(leader?.party);
    const reportingPct = raceResult.totalPrecincts > 0
        ? Math.round((raceResult.precinctsReporting / raceResult.totalPrecincts) * 100)
        : 0;

    // Outstanding ballots
    const historicalLoaded = isHistoricalDataLoaded();
    const historicalExpected = getExpectedTotalVotes();
    const expectedBallots = historicalLoaded && historicalExpected > 0
        ? historicalExpected
        : (turnoutData?.expectedBallots ?? 0);
    const outstanding = Math.max(0, expectedBallots - totalVotes);
    const pct = expectedBallots > 0 ? Math.min(100, (totalVotes / expectedBallots) * 100) : 0;

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
            // Find party for winner from raceResult candidates
            const winnerParty = raceResult.candidates.find(
                c => c.candidateName === winner?.candidateName
            )?.party;
            return { name, num, total, winner, winnerParty };
        })
        .sort((a, b) => {
            const nc = a.name.localeCompare(b.name);
            return nc !== 0 ? nc : parseInt(a.num) - parseInt(b.num);
        });

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

                {/* ── Ballots Card ── */}
                {isArchive ? (
                    /* Archive: race is over — show final totals only for contested races (2+ candidates).
                       Uncontested races have no meaningful margin to report, so the card is omitted. */
                    totalVotes > 0 && sortedCandidates.length >= 2 && (
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                                Final Results
                            </h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-white">{totalVotes.toLocaleString()}</span>
                                <span className="text-slate-400 text-sm">total ballots cast</span>
                            </div>
                            <div className="mt-2 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full rounded-full" style={{ width: '100%' }} />
                            </div>
                            <div className="flex justify-between mt-1.5 text-xs text-slate-500">
                                <span>Certified Final</span>
                                <span>{raceResult?.precinctsReporting}/{raceResult?.totalPrecincts} precincts</span>
                            </div>
                        </div>
                    )
                ) : (
                    /* Live: show estimated outstanding ballots + county-wide turnout chip */
                    expectedBallots > 0 && (
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40">
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">
                                {historicalLoaded ? 'Outstanding Ballots' : 'Estimated Outstanding'}
                            </h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-white">{outstanding.toLocaleString()}</span>
                                <span className="text-slate-400 text-sm">remaining</span>
                            </div>
                            <div className="mt-2 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between mt-1.5 text-xs text-slate-500">
                                <span>{pct.toFixed(0)}% counted</span>
                                <span>{historicalLoaded ? '' : 'Est. '}Expected: {expectedBallots.toLocaleString()}</span>
                            </div>
                            {/* County-wide turnout vs historical chip */}
                            {historicalLoaded && historicalExpected > 0 && (() => {
                                const deltaPct = ((totalVotes - historicalExpected) / historicalExpected) * 100;
                                const isAbove = deltaPct >= 0;
                                const raceInfo = getHistoricalRaceInfo();
                                return (
                                    <div className={`mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between`}>
                                        <span className="text-xs text-slate-500">
                                            vs {raceInfo?.year ?? 'prior'} baseline
                                        </span>
                                        <span className={`text-xs font-semibold ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                                            {isAbove ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(0)}% county-wide
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )
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
                            // Per-ward turnout badge vs historical baseline
                            const wardHistory = historicalLoaded ? getWardAnalysis(ward.num, ward.name) : null;
                            const turnoutBadge = wardHistory && wardHistory.historicalVotes > 0 && ward.total > 0
                                ? (ward.total >= wardHistory.historicalVotes ? '↑' : '↓')
                                : null;
                            const turnoutBadgeColor = turnoutBadge === '↑' ? '#4ade80' : '#f87171';
                            return (
                                <button
                                    key={`${ward.name}-${ward.num}`}
                                    onClick={() => onSelectWard({ name: ward.name, num: ward.num })}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-700/40 rounded-lg transition-colors flex items-center gap-3"
                                >
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: ward.winner ? color.dot : '#334155' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-slate-200 truncate">{ward.name} Ward {ward.num}</div>
                                        {ward.winner && (
                                            <div className="text-xs text-slate-500 truncate">{ward.winner.candidateName}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {turnoutBadge && (
                                            <span className="text-xs font-bold leading-none" style={{ color: turnoutBadgeColor }}>{turnoutBadge}</span>
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
                    <button className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors">
                        <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Share
                    </button>
                </div>
            </div>
        </div>
    );
}
