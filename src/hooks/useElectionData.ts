'use client';

import useSWR from 'swr';
import {
    getElections,
    getRaces,
    getRaceResults,
    getPrecinctResults,
    getLastPublished,
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
    const { data, error, isLoading } = useSWR<Election[]>('elections', getElections);
    return {
        elections: data,
        isLoading,
        isError: error
    };
}

export function useLastPublished(electionId: string | null) {
    const { data, error } = useSWR<LastPublished>(
        electionId ? ['lastPublished', electionId] : null,
        ([_, id]) => getLastPublished(id as string),
        { refreshInterval: REFRESH_INTERVAL }
    );
    return {
        lastPublished: data,
        isError: error
    };
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

export function useHistoricalTurnout(raceId: string | null, currentVotes: number | undefined) {
    const { data, error, isLoading } = useSWR<HistoricalTurnout>(
        raceId && currentVotes !== undefined ? ['historicalTurnout', raceId, currentVotes] : null,
        ([_, rId, votes]) => getHistoricalTurnout(rId as string, votes as number)
    );
    return {
        turnoutData: data,
        isLoading,
        isError: error
    };
}
