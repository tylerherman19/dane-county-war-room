'use client';
import { useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import Layout, { ViewMode } from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import MapWrapper from '@/components/MapWrapper';
import RaceSelector from '@/components/RaceSelector';
import ElectionSelector from '@/components/ElectionSelector';
import ResultsPanel from '@/components/ResultsPanel';
import Watchboard from '@/components/Watchboard';
import TrendsPanel, { ShiftPair } from '@/components/TrendsPanel';
import { useElections, useRaces, useRaceResults, usePrecinctResults, useElectionBoard } from '@/hooks/useElectionData';
import type { PrecinctResult } from '@/lib/api';

function shares(rows: PrecinctResult[], candidate: string) {
    const tally: Record<string, {votes: number; total: number}> = {};
    for (const row of rows) {
        const key = `${row.precinctName}|${Number(row.wardNumber)}`;
        const entry = tally[key] ??= {votes:0,total:0};
        entry.total += row.votes;
        if (row.candidateName === candidate) entry.votes += row.votes;
    }
    return Object.fromEntries(Object.entries(tally).filter(([,v]) => v.total > 0).map(([k,v]) => [k,100*v.votes/v.total]));
}

export default function Home() {
    const [mode, setMode] = useState<ViewMode>('LIVE');
    const [selection, setSelection] = useState<{e: string | null; r: string | null; ready: boolean}>({e:null,r:null,ready:false});
    const [ward, setWard] = useState<{name:string;num:string} | null>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const [pair, setPair] = useState<ShiftPair | null>(null);
    const {mutate} = useSWRConfig();
    const {elections, isError: electionError} = useElections();
    const isResults = mode === 'LIVE' || mode === 'ARCHIVE';
    const {races, isError: racesError, isLoading: racesLoading} = useRaces(isResults ? selection.e : null);
    // Never query a stale race ID against a newly selected election.
    const raceId = races?.some(r => r.id === selection.r) ? selection.r : races?.[0]?.id ?? null;
    const {results, isLoading: resultLoading, isError: resultError} = useRaceResults(isResults ? selection.e : null, raceId, mode === 'LIVE');
    const {precinctResults, isLoading: precinctLoading, isError: precinctError} = usePrecinctResults(isResults ? selection.e : null, raceId, mode === 'LIVE');
    const {board, isLoading: boardLoading, isError: boardError} = useElectionBoard(mode === 'BOARD' ? selection.e : null, mode === 'BOARD');
    const {precinctResults: from, isError: fromError} = usePrecinctResults(mode === 'TRENDS' ? pair?.from.electionId ?? null : null, pair?.from.raceId ?? null, false);
    const {precinctResults: to, isError: toError} = usePrecinctResults(mode === 'TRENDS' ? pair?.to.electionId ?? null : null, pair?.to.raceId ?? null, false);

    useEffect(() => {
        if (!elections?.length || selection.ready) return;
        const params = new URLSearchParams(window.location.search);
        const requested = elections.find(e => e.electionId === params.get('e'));
        const chosen = requested ?? elections[0];
        // Synchronize the initial client state with an external shared URL.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (requested) setMode('ARCHIVE');
        setSelection({e:chosen.electionId,r:requested ? params.get('r') : null,ready:true});
    }, [elections, selection.ready]);
    useEffect(() => {
        if (!selection.ready || !selection.e || !isResults || !raceId) return;
        const params = new URLSearchParams({e:selection.e,r:raceId});
        window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    }, [selection, raceId, isResults]);

    const shifts = useMemo(() => {
        if (!pair || !from || !to) return undefined;
        const a = shares(from, pair.candidateName), b = shares(to, pair.candidateName);
        return Object.fromEntries(Object.keys(b).filter(k => a[k] !== undefined).map(k => [k,{from:a[k],to:b[k]}]));
    }, [pair,from,to]);
    function chooseElection(e: string) {setSelection({e,r:null,ready:true});setWard(null);setFocus(null);}
    function chooseArchiveRace(e: string,r: string) {setMode('ARCHIVE');setSelection({e,r,ready:true});setWard(null);setFocus(null);}
    function chooseRace(r: string) {setSelection(s => ({...s,r}));setWard(null);setFocus(null);}
    function chooseMode(next: ViewMode) {
        setMode(next);setWard(null);setFocus(null);
        if (next !== 'TRENDS') setPair(null);
        if ((next === 'LIVE' || next === 'BOARD') && elections?.length && selection.e !== elections[0].electionId) chooseElection(elections[0].electionId);
    }
    const election = elections?.find(e => e.electionId === selection.e);
    const error = !!electionError || (isResults && (!!racesError || !!resultError || !!precinctError)) || (mode === 'BOARD' && !!boardError) || (mode === 'TRENDS' && (!!fromError || !!toError));
    const loading = racesLoading || resultLoading || precinctLoading;
    return <Layout viewMode={mode} onToggleViewMode={chooseMode} elections={elections} selectedElectionId={selection.e} onSelectElection={chooseElection}
        lastUpdated={election?.lastPublished} hasError={error} onRetry={() => {void mutate(() => true);}}
        selectors={isResults ? <>
            {mode === 'ARCHIVE' ? <ElectionSelector elections={elections} selectedElectionId={selection.e} onSelectElection={chooseElection}/> : <span className="latest-election-label">{election?.electionName ?? 'Latest election'}</span>}
            <RaceSelector key={selection.e} races={races} selectedRaceId={raceId} onSelectRace={chooseRace} elections={elections} election={election} onSelectArchiveRace={chooseArchiveRace} archive={mode === 'ARCHIVE'}/>
        </> : null}
        sidebar={mode === 'BOARD' ? null : <ErrorBoundary key={mode} label="Results">
            {mode === 'TRENDS' ? <TrendsPanel elections={elections} onShiftPair={setPair} /> : <>
                <ResultsPanel result={results} rows={precinctResults} loading={loading} selectedWard={ward} onSelectWard={setWard} focusedCandidate={focus} onFocusCandidate={setFocus} />
            </>}
        </ErrorBoundary>}>
        <ErrorBoundary key={mode} label="Map">
            {mode === 'BOARD' ? <Watchboard board={board} isLoading={boardLoading} isLive={true} electionName={election?.electionName} onSelectRace={r => {setMode('LIVE');chooseRace(r);}} /> :
                <MapWrapper precinctResults={mode === 'TRENDS' ? to ?? [] : precinctResults ?? []} isLoading={isResults && loading}
                    selectedWard={ward} raceResult={isResults ? results : undefined} focusedCandidate={focus} onCandidateReset={() => setFocus(null)}
                    fitKey={`${mode}|${selection.e}|${raceId}|${pair?.from.electionId ?? ''}|${pair?.to.electionId ?? ''}|${pair?.to.raceId ?? ''}`} onSelectWard={setWard}
                    trendsMode={mode === 'TRENDS'} shiftByWard={shifts} shiftLabel={pair ? `${pair.candidateName}: ${pair.from.electionDate.slice(0,10)} to ${pair.to.electionDate.slice(0,10)}` : undefined} />}
        </ErrorBoundary>
    </Layout>;
}
