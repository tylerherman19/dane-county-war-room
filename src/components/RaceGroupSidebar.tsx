'use client';

import { BoardRace, Race } from '@/lib/api';
import { extractDistrictNumber } from '@/lib/api';
import { useElectionBoard } from '@/hooks/useElectionData';
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
    if (p.includes('democrat')) return '#008fd5';
    if (p.includes('republican')) return '#fc4f30';
    if (p.includes('green')) return '#6d904f';
    if (p.includes('libertarian')) return '#e5ae38';
    return '#8b8b8b';
}

interface RaceGroupRowProps {
    race: Race;
    boardRace: BoardRace | undefined;
    isLoading: boolean;
    isArchive?: boolean;
    onClick: () => void;
}

function RaceGroupRow({ race, boardRace, isLoading, isArchive, onClick }: RaceGroupRowProps) {
    const districtNum = extractDistrictNumber(race.name);
    const shortLabel = districtNum > 0 ? `District ${districtNum}` : race.name;

    if (isLoading) {
        return (
            <button
                onClick={onClick}
                className="w-full text-left px-4 py-2 hover:bg-[#f7f7f7] transition-colors border-b border-[#eeeeee] last:border-0 animate-pulse"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="h-4 bg-[#f0f0f0] w-20" />
                    <div className="h-4 bg-[#f0f0f0] w-32" />
                </div>
            </button>
        );
    }

    if (!boardRace) {
        return (
            <button
                onClick={onClick}
                className="w-full text-left px-4 py-2 hover:bg-[#f7f7f7] transition-colors border-b border-[#eeeeee] last:border-0"
            >
                <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-[#222]">{shortLabel}</span>
                    <span className="text-xs text-[#999]">No data</span>
                </div>
            </button>
        );
    }

    // BoardRace.candidates already arrives sorted most-votes-first.
    const leader = boardRace.candidates[0];
    const runnerUp = boardRace.candidates[1];
    const totalVotes = boardRace.totalVotes;
    const margin = leader && runnerUp && totalVotes > 0
        ? ((leader.votes - runnerUp.votes) / totalVotes * 100)
        : null;
    const reportingPct = boardRace.totalPrecincts > 0
        ? Math.round((boardRace.precinctsReporting / boardRace.totalPrecincts) * 100)
        : 0;
    const leaderColor = getPartyColor(leader?.party);
    const isComplete = isArchive || reportingPct === 100;

    return (
        <button
            onClick={onClick}
            className="w-full text-left px-4 py-2 hover:bg-[#f7f7f7] transition-colors border-b border-[#eeeeee] last:border-0 group"
        >
            <div className="flex items-center gap-3">
                {/* District label */}
                <div className="w-20 shrink-0">
                    <span className="text-sm font-bold text-[#222]">{shortLabel}</span>
                </div>

                {/* Candidate + result */}
                <div className="flex-1 min-w-0">
                    {leader ? (
                        <>
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm truncate text-[#222]" title={leader.candidateName}>
                                    {leader.candidateName}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] text-[#999] num">
                                        {boardRace.precinctsReporting}/{boardRace.totalPrecincts}p
                                    </span>
                                    <span className="text-sm font-bold num" style={{ color: leaderColor }}>
                                        {leader.percentage.toFixed(1)}%
                                    </span>
                                    {margin !== null && (
                                        <span className="text-xs text-[#999] num">
                                            +{margin.toFixed(1)}
                                        </span>
                                    )}
                                    {isComplete && totalVotes > 0 && (
                                        <span className="text-[10px] text-[#567a3a] font-bold uppercase tracking-[0.04em]">Final</span>
                                    )}
                                </div>
                            </div>
                            {/* Thin vote bar */}
                            <div className="mt-1 h-0.5 bg-[#e8e8e8]">
                                <div
                                    className="h-full transition-all duration-500"
                                    style={{ width: `${leader.percentage}%`, background: leaderColor }}
                                />
                            </div>
                        </>
                    ) : (
                        <span className="text-xs text-[#999]">No candidates</span>
                    )}
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-[#cccccc] group-hover:text-[#666] shrink-0 transition-colors" />
            </div>
        </button>
    );
}

export default function RaceGroupSidebar({ races, electionId, groupLabel, onSelectRace, isArchive }: RaceGroupSidebarProps) {
    const sorted = [...races].sort((a, b) => extractDistrictNumber(a.name) - extractDistrictNumber(b.name));

    // One bulk request for every district's results, instead of each row
    // polling its own race individually — a "Madison Alder" group can be 20
    // districts, which was 20 separate 30s-polled requests before this.
    const { board, isLoading: boardLoading } = useElectionBoard(electionId, !isArchive);
    const boardByRaceId = new Map<string, BoardRace>((board ?? []).map(r => [r.raceId, r]));

    return (
        <div className="h-full bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#e0e0e0] shrink-0">
                <div className="kicker mb-1">Race Group</div>
                <div className="text-lg font-bold text-[#222]">{groupLabel}</div>
                <div className="text-xs text-[#999] mt-1">
                    {sorted.length} districts. Click a row to view map detail.
                </div>
            </div>

            {/* Race rows */}
            <div className="flex-1 overflow-y-auto">
                {sorted.map(race => (
                    <RaceGroupRow
                        key={race.id}
                        race={race}
                        boardRace={boardByRaceId.get(race.id)}
                        isLoading={boardLoading && !board}
                        isArchive={isArchive}
                        onClick={() => onSelectRace(race.id)}
                    />
                ))}
                {sorted.length === 0 && (
                    <div className="p-6 text-center text-[#999] text-sm">No races in this group</div>
                )}
            </div>
        </div>
    );
}
