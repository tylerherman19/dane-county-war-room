'use client';

import useSWR from 'swr';
import {
    getElections,
    getRaces,
    getRaceResults,
    getPrecinctResults,
    getElectionTurnout,
    getElectionBoard,
    Election,
    Race,
    RaceResult,
    PrecinctResult,
    LastPublished,
    ElectionTurnout,
    BoardRace
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

/**
 * All races for an election in one bulk call, for the multi-race watchboard.
 * `live` enables the 30s refresh so the board updates on election night.
 */
export function useElectionBoard(electionId: string | null, live = false) {
    const { data, error, isLoading } = useSWR<BoardRace[]>(
        electionId ? ['electionBoard', electionId] : null,
        ([_, id]) => getElectionBoard(id as string),
        live ? { refreshInterval: REFRESH_INTERVAL } : { revalidateOnFocus: false }
    );
    return {
        board: data,
        isLoading,
        isError: error
    };
}

/**
 * Real turnout for an election from the county's BALLOTS CAST - TOTAL tally.
 * `live` enables periodic refresh (only useful for the current election).
 */
export function useElectionTurnout(electionId: string | null, live = false) {
    const { data, error, isLoading } = useSWR<ElectionTurnout | null>(
        electionId ? ['electionTurnout', electionId] : null,
        ([_, id]) => getElectionTurnout(id as string),
        live ? { refreshInterval: REFRESH_INTERVAL } : { revalidateOnFocus: false }
    );
    return {
        turnout: data ?? undefined,
        isLoading,
        isError: error
    };
}
