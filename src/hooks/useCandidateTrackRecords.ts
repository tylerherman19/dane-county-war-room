'use client';

import { useEffect, useState } from 'react';
import { Election } from '@/lib/api';
import { CandidateRaceRecord, searchCandidateHistory } from '@/lib/candidate-history';

/**
 * Looks up each candidate's electoral track record (past races found by last
 * name across every election the county API serves) so the Primary Focus
 * view can show more than a single snapshot vote count — how each candidate
 * has actually performed before, not just today's tally.
 *
 * Runs once per distinct candidate set (keyed by name, joined) rather than
 * per render. `searchCandidateHistory` caches bulk election fetches at module
 * scope, so results for a second candidate come back near-instantly once the
 * first has warmed the cache.
 */
export function useCandidateTrackRecords(
    elections: Election[] | undefined,
    candidateNames: string[],
    excludeElectionId: string | null | undefined,
    excludeRaceId: string | null | undefined,
) {
    const [records, setRecords] = useState<Record<string, CandidateRaceRecord[]>>({});
    const [loading, setLoading] = useState(false);
    const key = candidateNames.join('|');

    useEffect(() => {
        if (!elections || candidateNames.length === 0) {
            setRecords({});
            return;
        }
        let cancelled = false;
        setLoading(true);

        (async () => {
            const out: Record<string, CandidateRaceRecord[]> = {};
            for (const name of candidateNames) {
                const lastName = name.trim().split(/\s+/).slice(-1)[0];
                if (!lastName || lastName.length < 3) continue;
                const res = await searchCandidateHistory(elections, lastName);
                if (cancelled) return;
                out[name] = res
                    .filter(r => r.candidateName.toLowerCase().includes(lastName.toLowerCase()))
                    .filter(r => !(r.electionId === excludeElectionId && r.raceId === excludeRaceId))
                    .slice(0, 3);
            }
            if (!cancelled) setRecords(out);
            if (!cancelled) setLoading(false);
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [elections, key, excludeElectionId, excludeRaceId]);

    return { records, loading };
}
