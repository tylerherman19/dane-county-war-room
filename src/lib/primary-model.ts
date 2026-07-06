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
    projectedVotes: number;   // votes + this candidate's modeled share of outstandingRaceVotes
    projectedShare: number;   // % of the projected final total
    winNumber: WinNumberResult;
    progressToWin: number;    // votes / winNumber (can exceed 1 once clinched)
    leadOverRunnerUp: number; // this candidate's raw-vote lead over the next-closest candidate (negative if trailing)
    mathClinched: boolean;    // lead exceeds the entire modeled outstanding pool — can't be caught even if every outstanding vote went to the runner-up
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
    wardsWithHistoricalSplit: number; // unreported wards allocated using that ward's own historical candidate shares
    wardsWithUniformFallback: number; // unreported wards that fell back to the current county-wide share (no usable historical match)
}

function wardKey(name: string, num: string): string {
    return `${name}|${parseInt(num) || 0}`;
}

function isWriteIn(name: string): boolean {
    return name.trim().toLowerCase().startsWith('write-in');
}

function normalizedName(name: string): string {
    return name.trim().toLowerCase();
}

/**
 * Historical per-candidate vote shares for one ward, restricted to candidates
 * who are also on the current ballot (matched by trimmed, case-insensitive
 * name) and renormalized so those shares sum to 1. Returns null when the
 * ward has no historical rows, or none of its candidates match the current
 * field (e.g. an open seat with an entirely new slate) — callers fall back
 * to the uniform county-wide split in that case.
 */
function wardHistoricalShares(
    comparisonPrecinctResults: PrecinctResult[] | undefined,
    targetWardKey: string,
    liveCandidateNamesNormalized: Set<string>,
): Record<string, number> | null {
    if (!comparisonPrecinctResults || comparisonPrecinctResults.length === 0) return null;

    const wardVotesByCandidate = new Map<string, number>(); // normalized name -> votes, this ward only
    for (const r of comparisonPrecinctResults) {
        if (wardKey(r.precinctName, r.wardNumber) !== targetWardKey) continue;
        if (isWriteIn(r.candidateName)) continue;
        const name = normalizedName(r.candidateName);
        wardVotesByCandidate.set(name, (wardVotesByCandidate.get(name) ?? 0) + r.votes);
    }
    if (wardVotesByCandidate.size === 0) return null;

    let matchedTotal = 0;
    const matched: Record<string, number> = {};
    for (const name of liveCandidateNamesNormalized) {
        const v = wardVotesByCandidate.get(name) ?? 0;
        if (v > 0) { matched[name] = v; matchedTotal += v; }
    }
    if (matchedTotal === 0) return null;

    const shares: Record<string, number> = {};
    for (const [name, v] of Object.entries(matched)) shares[name] = v / matchedTotal;
    return shares;
}

/**
 * Build a projected-outcome model for a district race from partial results.
 *
 * Outstanding vote for unreported wards is estimated from the comparison
 * election's ballots-cast in those same wards (same technique the Sidebar
 * turnout card uses), scaled by the roll-off rate observed so far in
 * reported wards (race votes / ballots cast) to account for under-votes.
 *
 * That outstanding vote is then allocated to candidates ward by ward:
 * where `comparisonPrecinctResults` has that same ward's candidate-level
 * results from the comparison race AND at least one current candidate ran
 * in it, the ward's outstanding pool is split using that ward's own
 * historical shares (renormalized across only the matched candidates). Wards
 * without a usable historical match (new candidates, no comparison data)
 * fall back to the uniform assumption that the race's current overall share
 * holds. Either way this is a directional read, not a poll-based forecast.
 */
export function buildPrimaryModel(
    precinctResults: PrecinctResult[] | undefined,
    districtWardKeys: Set<string> | null,
    turnoutByWard: Record<string, number> | undefined,
    comparisonTurnoutByWard: Record<string, number> | undefined,
    candidateParties: Record<string, string | undefined>,
    comparisonPrecinctResults?: PrecinctResult[],
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

    // ── Ward-by-ward allocation of the outstanding pool ──────────────────────
    // originalName lets us go from the normalized (matching) key back to the
    // display name used as the voteTotals key.
    const originalNameByNormalized = new Map<string, string>();
    voteTotals.forEach((_, name) => originalNameByNormalized.set(normalizedName(name), name));
    const liveNamesNormalized = new Set(originalNameByNormalized.keys());

    const allocatedOutstanding = new Map<string, number>(); // display name -> allocated outstanding votes
    let uniformFallbackPool = 0;
    let wardsWithHistoricalSplit = 0;
    let wardsWithUniformFallback = 0;

    for (const k of unreportedKeys) {
        const wardBallots = comparisonTurnoutByWard?.[k] ?? 0;
        if (wardBallots <= 0) continue;
        const wardOutstandingVotes = wardBallots * rolloffRate;

        const shares = wardHistoricalShares(comparisonPrecinctResults, k, liveNamesNormalized);
        if (shares) {
            wardsWithHistoricalSplit++;
            for (const [normName, share] of Object.entries(shares)) {
                const displayName = originalNameByNormalized.get(normName)!;
                allocatedOutstanding.set(displayName, (allocatedOutstanding.get(displayName) ?? 0) + wardOutstandingVotes * share);
            }
        } else {
            wardsWithUniformFallback++;
            uniformFallbackPool += wardOutstandingVotes;
        }
    }

    const numCandidates = Math.max(1, voteTotals.size);
    const candidates: CandidateStanding[] = [...voteTotals.entries()]
        .map(([name, votes]) => {
            const share = currentTotalVotes > 0 ? votes / currentTotalVotes : 0;
            const historicalOutstanding = allocatedOutstanding.get(name) ?? 0;
            const uniformOutstanding = share * uniformFallbackPool;
            const projectedVotes = Math.round(votes + historicalOutstanding + uniformOutstanding);
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
                leadOverRunnerUp: 0,     // filled in below, once sorted
                mathClinched: false,     // filled in below, once sorted
            };
        })
        .sort((a, b) => b.votes - a.votes);

    // Mathematically-clinched test: the leader is unreachable only if their
    // raw-vote lead over the runner-up exceeds the entire modeled outstanding
    // pool — i.e. even if every remaining vote went to the runner-up, the
    // leader still wins. This replaces "votes >= even-split-floor win number"
    // as the clinch signal, since that floor is neither necessary nor
    // sufficient in a 3+ candidate field. It's still bounded by how accurate
    // the outstanding-vote estimate is, not a guarantee against, say, a wildly
    // undercounted absentee batch.
    if (candidates.length >= 1) {
        const leader = candidates[0];
        const runnerUp = candidates[1];
        leader.leadOverRunnerUp = runnerUp ? leader.votes - runnerUp.votes : leader.votes;
        leader.mathClinched = runnerUp ? leader.leadOverRunnerUp > outstandingRaceVotes : true;
        for (let i = 1; i < candidates.length; i++) {
            candidates[i].leadOverRunnerUp = candidates[i].votes - leader.votes;
            candidates[i].mathClinched = false;
        }
    }

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
        wardsWithHistoricalSplit,
        wardsWithUniformFallback,
    };
}
