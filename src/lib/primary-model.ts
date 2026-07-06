// Election-night modeling for the PRIMARY (district focus) view.
// Extrapolates a projected final result from partial returns, rather than
// just showing the raw vote count so far.
import { PrecinctResult } from './api';
import { computeWinNumber, WinNumberResult } from './projections-data';

export interface CandidateStanding {
    candidateName: string;
    party?: string;
    votes: number;
    share: number;            // % of votes counted so far
    projectedVotes: number;   // naive extrapolation: votes + share * outstandingRaceVotes
    projectedShare: number;   // % of the projected final total
    winNumber: WinNumberResult;
    progressToWin: number;    // votes / winNumber (can exceed 1 once clinched)
}

export interface PrimaryModel {
    candidates: CandidateStanding[];
    wardsReported: number;
    wardsTotal: number;
    currentTotalVotes: number;
    reportedBallotsCast: number;   // ballots cast so far, reported wards only
    outstandingBallots: number;    // estimated ballots cast in unreported wards (comparison-election baseline)
    rolloffRate: number;           // observed (race votes / ballots cast) in reported wards, applied to outstanding ballots
    outstandingRaceVotes: number;  // outstandingBallots * rolloffRate
    projectedTotalVotes: number;
}

function wardKey(name: string, num: string): string {
    return `${name}|${parseInt(num) || 0}`;
}

function isWriteIn(name: string): boolean {
    return name.trim().toLowerCase().startsWith('write-in');
}

/**
 * Build a projected-outcome model for a district race from partial results.
 *
 * Outstanding vote for unreported wards is estimated from the comparison
 * election's ballots-cast in those same wards (same technique the Sidebar
 * turnout card uses), scaled by the roll-off rate observed so far in
 * reported wards (race votes / ballots cast) to account for under-votes.
 * That outstanding vote is then split across candidates proportional to
 * their current share — a naive uniform-swing assumption, not a poll-based
 * forecast. It's meant to give a directional read on election night, not a
 * guaranteed call.
 */
export function buildPrimaryModel(
    precinctResults: PrecinctResult[] | undefined,
    districtWardKeys: Set<string> | null,
    turnoutByWard: Record<string, number> | undefined,
    comparisonTurnoutByWard: Record<string, number> | undefined,
    candidateParties: Record<string, string | undefined>,
): PrimaryModel | null {
    if (!precinctResults || precinctResults.length === 0) return null;

    // Ward → has any row reported yet
    const seenWards = new Map<string, boolean>();
    precinctResults.forEach(r => {
        const k = wardKey(r.precinctName, r.wardNumber);
        seenWards.set(k, (seenWards.get(k) ?? false) || r.reported);
    });
    const wardKeys = districtWardKeys ?? new Set(seenWards.keys());
    const reportedKeys = [...wardKeys].filter(k => seenWards.get(k));
    const unreportedKeys = [...wardKeys].filter(k => !seenWards.get(k));

    const voteTotals = new Map<string, number>();
    precinctResults.forEach(r => {
        const name = r.candidateName.trim();
        if (isWriteIn(name)) return;
        voteTotals.set(name, (voteTotals.get(name) ?? 0) + r.votes);
    });
    const currentTotalVotes = [...voteTotals.values()].reduce((a, b) => a + b, 0);
    if (currentTotalVotes === 0 && voteTotals.size === 0) return null;

    const reportedBallotsCast = reportedKeys.reduce((s, k) => s + (turnoutByWard?.[k] ?? 0), 0);
    const outstandingBallots = unreportedKeys.reduce((s, k) => s + (comparisonTurnoutByWard?.[k] ?? 0), 0);
    const rolloffRate = reportedBallotsCast > 0
        ? Math.min(1, currentTotalVotes / reportedBallotsCast)
        : (currentTotalVotes > 0 ? 1 : 0);
    const outstandingRaceVotes = Math.round(outstandingBallots * rolloffRate);
    const projectedTotalVotes = currentTotalVotes + outstandingRaceVotes;

    const numCandidates = Math.max(1, voteTotals.size);
    const candidates: CandidateStanding[] = [...voteTotals.entries()]
        .map(([name, votes]) => {
            const share = currentTotalVotes > 0 ? votes / currentTotalVotes : 0;
            const projectedVotes = Math.round(votes + share * outstandingRaceVotes);
            const projectedShare = projectedTotalVotes > 0 ? (projectedVotes / projectedTotalVotes) * 100 : 0;
            const winNumber = computeWinNumber(projectedTotalVotes, numCandidates);
            return {
                candidateName: name,
                party: candidateParties[name],
                votes,
                share: share * 100,
                projectedVotes,
                projectedShare,
                winNumber,
                progressToWin: winNumber.winNumber > 0 ? votes / winNumber.winNumber : 0,
            };
        })
        .sort((a, b) => b.votes - a.votes);

    return {
        candidates,
        wardsReported: reportedKeys.length,
        wardsTotal: wardKeys.size,
        currentTotalVotes,
        reportedBallotsCast,
        outstandingBallots,
        rolloffRate,
        outstandingRaceVotes,
        projectedTotalVotes,
    };
}
