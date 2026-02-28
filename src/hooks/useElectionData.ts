'use client';

import useSWR from 'swr';
import {
    getElections,
    getRaces,
    getRaceResults,
    getPrecinctResults,
    getHistoricalTurnout,
    Election,
    Race,
    RaceResult,
    PrecinctResult,
    LastPublished,
    HistoricalTurnout
} from '@/lib/api';

const REFRESH_INTERVAL = 30000; // 30 seconds

export function useElections() {
    const { data, error, isLoading } = useSWR<Election[]>('elections', getElections, {
        refreshInterval: REFRESH_INTERVAL,
    });
    return {
        elections: data,
        isLoading,
        isError: error
    };
}

/**
 * Derives lastPublished from the already-cached elections list.
 * No extra network request needed.
 */
export function useLastPublished(electionId: string | null) {
    const { data: elections } = useSWR<Election[]>('elections', getElections);
    const election = elections?.find(e => e.electionId === electionId);
    const lastPublished: LastPublished | undefined = election
        ? { lastPublished: election.lastPublished }
        : undefined;
    return { lastPublished };
}

export function useRaces(electionId: string | null) {
    const { data, error, isLoading } = useSWR<Race[]>(
        electionId ? ['races', electionId] : null,
        ([_, id]) => getRaces(id as string)
    );
    return {
        races: data,
        isLoading,
        isError: error
    };
}

export function useRaceResults(electionId: string | null, raceId: string | null) {
    const { data, error, isLoading } = useSWR<RaceResult>(
        electionId && raceId ? ['raceResults', electionId, raceId] : null,
        ([_, eId, rId]) => getRaceResults(eId as string, rId as string),
        { refreshInterval: REFRESH_INTERVAL }
    );
    return {
        results: data,
        isLoading,
        isError: error
    };
}

export function usePrecinctResults(electionId: string | null, raceId: string | null) {
    const { data, error, isLoading } = useSWR<PrecinctResult[]>(
        electionId && raceId ? ['precinctResults', electionId, raceId] : null,
        ([_, eId, rId]) => getPrecinctResults(eId as string, rId as string),
        { refreshInterval: REFRESH_INTERVAL }
    );
    return {
        precinctResults: data,
        isLoading,
        isError: error
    };
}

export function useHistoricalTurnout(raceId: string | null, currentVotes: number | undefined, raceName?: string) {
    // currentVotes is intentionally excluded from the SWR key — it changes every poll cycle
    // and getHistoricalTurnout uses it only to clamp the outstanding estimate, not for caching.
    const { data, error, isLoading } = useSWR<HistoricalTurnout>(
        raceId ? ['historicalTurnout', raceId, raceName] : null,
        ([_, rId, rName]) => getHistoricalTurnout(rId as string, currentVotes ?? 0, rName as string | undefined)
    );
    return {
        turnoutData: data,
        isLoading,
        isError: error
    };
}
