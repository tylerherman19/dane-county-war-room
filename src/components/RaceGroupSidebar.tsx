'use client';

import { Race } from '@/lib/api';
import { extractDistrictNumber } from '@/lib/api';
import { useRaceResults } from '@/hooks/useElectionData';
import { ChevronRight } from 'lucide-react';

interface RaceGroupSidebarProps {
    races: Race[];
    electionId: string;
    groupLabel: string;
    onSelectRace: (raceId: string) => void;
    isArchive?: boolean;
}

function getPartyColor(party: string | undefined): string {
    const p = (party || '').toLowerCase();
    if (p.includes('democrat')) return '#3b82f6';
    if (p.includes('republican')) return '#ef4444';
    if (p.includes('green')) return '#22c55e';
    if (p.includes('libertarian')) return '#eab308';
    return '#64748b';
}

interface RaceGroupRowProps {
    race: Race;
    electionId: string;
    isArchive?: boolean;
    onClick: () => void;
}

function RaceGroupRow({ race, electionId, isArchive, onClick }: RaceGroupRowProps) {
    const { results, isLoading } = useRaceResults(electionId, race.id);

    const districtNum = extractDistrictNumber(race.name);
    const shortLabel = districtNum > 0 ? `District ${districtNum}` : race.name;

    if (isLoading) {
        return (
            <button
                onClick={onClick}
                className="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800/60 last:border-0 animate-pulse"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="h-4 bg-slate-700 rounded w-20" />
                    <div className="h-4 bg-slate-700 rounded w-32" />
                </div>
            </button>
        );
    }

    if (!results) {
        return (
            <button
                onClick={onClick}
                className="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800/60 last:border-0"
            >
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-300">{shortLabel}</span>
                    <span className="text-xs text-slate-600">No data</span>
                </div>
            </button>
        );
    }

    const sorted = [...results.candidates].sort((a, b) => b.votes - a.votes);
    const leader = sorted[0];
    const runnerUp = sorted[1];
    const totalVotes = results.totalVotes;
    const margin = leader && runnerUp && totalVotes > 0
        ? ((leader.votes - runnerUp.votes) / totalVotes * 100)
        : null;
    const reportingPct = results.totalPrecincts > 0
        ? Math.round((results.precinctsReporting / results.totalPrecincts) * 100)
        : 0;
    const leaderColor = getPartyColor(leader?.party);
    const isComplete = isArchive || reportingPct === 100;

    return (
        <button
            onClick={onClick}
            className="w-full text-left px-4 py-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800/60 last:border-0 group"
        >
            <div className="flex items-center gap-3">
                {/* District label */}
                <div className="w-20 shrink-0">
                    <span className="text-sm font-semibold text-slate-300">{shortLabel}</span>
                </div>

                {/* Candidate + result */}
                <div className="flex-1 min-w-0">
                    {leader ? (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium truncate text-white" title={leader.candidateName}>
                                    {leader.candidateName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-sm font-bold tabular-nums" style={{ color: leaderColor }}>
                                        {leader.percentage.toFixed(1)}%
                                    </span>
                                    {margin !== null && (
                                        <span className="text-xs text-slate-500 tabular-nums">
                                            +{margin.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            {/* Thin vote bar */}
                            <div className="mt-1.5 h-1 bg-slate-700/60 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${leader.percentage}%`, background: leaderColor }}
                                />
                            </div>
                            {/* Precincts reporting */}
                            <div className="mt-1 flex items-center justify-between">
                                <span className="text-[10px] text-slate-600">
                                    {results.precinctsReporting}/{results.totalPrecincts} precincts
                                </span>
                                {isComplete && totalVotes > 0 && (
                                    <span className="text-[10px] text-green-600 font-medium">Final</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-xs text-slate-600">No candidates</span>
                    )}
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-slate-400 shrink-0 transition-colors" />
            </div>
        </button>
    );
}

export default function RaceGroupSidebar({ races, electionId, groupLabel, onSelectRace, isArchive }: RaceGroupSidebarProps) {
    const sorted = [...races].sort((a, b) => extractDistrictNumber(a.name) - extractDistrictNumber(b.name));

    return (
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 shrink-0">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Race Group</div>
                <div className="text-lg font-bold text-white">{groupLabel}</div>
                <div className="text-xs text-slate-500 mt-1">
                    {sorted.length} districts — click a row to view map detail
                </div>
            </div>

            {/* Race rows */}
            <div className="flex-1 overflow-y-auto">
                {sorted.map(race => (
                    <RaceGroupRow
                        key={race.id}
                        race={race}
                        electionId={electionId}
                        isArchive={isArchive}
                        onClick={() => onSelectRace(race.id)}
                    />
                ))}
                {sorted.length === 0 && (
                    <div className="p-6 text-center text-slate-500 text-sm">No races in this group</div>
                )}
            </div>
        </div>
    );
}
