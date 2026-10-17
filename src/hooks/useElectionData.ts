'use client';

import useSWR, { SWRConfiguration } from 'swr';
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

const REFRESH_INTERVAL = 30000;
function useCheckedSWR<T>(key:string|[string,...(string|null)[]]|null,load:(key:string|string[])=>Promise<T>,config?:SWRConfiguration) {
    const swr=useSWR<{value:T;checkedAt:string}>(key,async k=>({value:await load(k as string|string[]),checkedAt:new Date().toISOString()}),config);
    return {...swr,data:swr.data?.value,checkedAt:swr.data?.checkedAt};
}

export function useElections() {
    const { data, error, isLoading, checkedAt, isValidating } = useCheckedSWR<Election[]>('elections', getElections, {
        refreshInterval: REFRESH_INTERVAL,
    });
    return {
        elections: data,
        isLoading,
        isError: error,
        checkedAt,
        isValidating
    };
}

/**
 * Derives lastPublished from the already-cached elections list.
 * No extra network request needed.
 */
export function useLastPublished(electionId: string | null) {
    const { data: elections } = useCheckedSWR<Election[]>('elections', getElections);
    const election = elections?.find(e => e.electionId === electionId);
    const lastPublished: LastPublished | undefined = election
        ? { lastPublished: election.lastPublished }
        : undefined;
    return { lastPublished };
}

export function useRaces(electionId: string | null) {
    const { data, error, isLoading, checkedAt, isValidating } = useCheckedSWR<Race[]>(
        electionId ? ['races', electionId] : null,
        ([, id]) => getRaces(id as string)
    );
    return {
        races: data,
        isLoading,
        isError: error,
        checkedAt,
        isValidating
    };
}

export function useRaceResults(electionId: string | null, raceId: string | null, live = true) {
    const { data, error, isLoading, checkedAt, isValidating } = useCheckedSWR<RaceResult>(
        electionId && raceId ? ['raceResults', electionId, raceId] : null,
        ([, eId, rId]) => getRaceResults(eId as string, rId as string),
        { refreshInterval: live ? REFRESH_INTERVAL : 0, revalidateOnFocus: live }
    );
    return {
        results: data,
        isLoading,
        isError: error,
        checkedAt,
        isValidating
    };
}

export function usePrecinctResults(electionId: string | null, raceId: string | null, live = true) {
    const { data, error, isLoading, checkedAt, isValidating } = useCheckedSWR<PrecinctResult[]>(
        electionId && raceId ? ['precinctResults', electionId, raceId] : null,
        ([, eId, rId]) => getPrecinctResults(eId as string, rId as string),
        { refreshInterval: live ? REFRESH_INTERVAL : 0, revalidateOnFocus: live }
    );
    return {
        precinctResults: data,
        isLoading,
        isError: error,
        checkedAt,
        isValidating
    };
}

/**
 * All races for an election in one bulk call, for the multi-race watchboard.
 * `live` enables the 30s refresh so the board updates on election night.
 */
export function useElectionBoard(electionId: string | null, live = false) {
    const { data, error, isLoading, checkedAt, isValidating } = useCheckedSWR<BoardRace[]>(
        electionId ? ['electionBoard', electionId] : null,
        ([, id]) => getElectionBoard(id as string),
        live ? { refreshInterval: live ? REFRESH_INTERVAL : 0, revalidateOnFocus: live } : { revalidateOnFocus: false }
    );
    return {
        board: data,
        isLoading,
        isError: error,
        checkedAt,
        isValidating
    };
}

/**
 * Real turnout for an election from the county's BALLOTS CAST - TOTAL tally.
 * `live` enables periodic refresh (only useful for the current election).
 */
export function useElectionTurnout(electionId: string | null, live = false) {
    const { data, error, isLoading, checkedAt, isValidating } = useCheckedSWR<ElectionTurnout | null>(
        electionId ? ['electionTurnout', electionId] : null,
        ([, id]) => getElectionTurnout(id as string),
        live ? { refreshInterval: live ? REFRESH_INTERVAL : 0, revalidateOnFocus: live } : { revalidateOnFocus: false }
    );
    return {
        turnout: data ?? undefined,
        isLoading,
        isError: error,
        checkedAt,
        isValidating
    };
}
