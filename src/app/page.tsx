'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import MapWrapper from '@/components/MapWrapper';
import Sidebar from '@/components/Sidebar';
import SimulationsPanel from '@/components/SimulationsPanel';
import RaceSelector from '@/components/RaceSelector';
import {
  useElections,
  useRaces,
  useRaceResults,
  usePrecinctResults,
  useHistoricalTurnout,
  useLastPublished
} from '@/hooks/useElectionData';
import { SimProjectionUpdate } from '@/lib/projections-data';
import { PrecinctResult } from '@/lib/api';

export default function Home() {
  // ── Top-level mode ───────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'LIVE' | 'ARCHIVE' | 'SIMULATE'>('LIVE');

  // ── LIVE / ARCHIVE state ─────────────────────────────────────────────────
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedWard, setSelectedWard] = useState<{ name: string; num: string } | null>(null);
  const [focusedCandidate, setFocusedCandidate] = useState<string | null>(null);

  // ── SIMULATE state ───────────────────────────────────────────────────────
  const [simUpdate, setSimUpdate] = useState<SimProjectionUpdate>({
    projectionData: {},
    highlightedWardKeys: new Set(),
    whatIfPrecinctResults: null,
    whatIfMode: false,
  });
  const [simClickedWard, setSimClickedWard] = useState<{ name: string; num: string } | null>(null);

  // ── Data Hooks (disabled in SIMULATE mode) ───────────────────────────────
  const { elections, isError: electionsError } = useElections();

  // Auto-select election: always lock to latest in LIVE, free in ARCHIVE.
  // No-op in SIMULATE mode (no live data needed).
  useEffect(() => {
    if (viewMode === 'SIMULATE') return;
    if (!elections || elections.length === 0) return;
    if (viewMode === 'LIVE') {
      if (selectedElectionId !== elections[0].electionId) {
        setSelectedElectionId(elections[0].electionId);
      }
    } else if (!selectedElectionId) {
      setSelectedElectionId(elections[0].electionId);
    }
  }, [elections, viewMode]); // intentionally omit selectedElectionId to avoid loop

  // Clear race + map selection on election change
  useEffect(() => {
    setSelectedRaceId(null);
    setSelectedWard(null);
    setFocusedCandidate(null);
  }, [selectedElectionId]);

  // Clear focused candidate on race change
  useEffect(() => {
    setFocusedCandidate(null);
  }, [selectedRaceId]);

  const { races } = useRaces(viewMode !== 'SIMULATE' ? selectedElectionId : null);

  // Auto-select highest-priority race
  const RACE_PRIORITY: Record<string, number> = {
    Presidential: 0, Governor: 1, Senate: 2, Congress: 3,
    Mayor: 4, StateSenate: 5, Assembly: 6, Referendum: 7, Other: 8,
  };
  useEffect(() => {
    if (viewMode === 'SIMULATE') return;
    if (races && races.length > 0 && !selectedRaceId) {
      const sorted = [...races].sort(
        (a, b) => (RACE_PRIORITY[a.type] ?? 99) - (RACE_PRIORITY[b.type] ?? 99)
      );
      setSelectedRaceId(sorted[0].id);
    }
  }, [races, selectedRaceId, viewMode]);

  const { results: raceResult, isLoading: isLoadingRace, isError: raceError } = useRaceResults(
    viewMode !== 'SIMULATE' ? selectedElectionId : null,
    viewMode !== 'SIMULATE' ? selectedRaceId : null
  );
  const { precinctResults, isLoading: isLoadingPrecincts, isError: precinctError } = usePrecinctResults(
    viewMode !== 'SIMULATE' ? selectedElectionId : null,
    viewMode !== 'SIMULATE' ? selectedRaceId : null
  );
  const { lastPublished } = useLastPublished(viewMode !== 'SIMULATE' ? selectedElectionId : null);

  const currentTotalVotes = raceResult?.totalVotes ?? 0;
  const { turnoutData } = useHistoricalTurnout(
    viewMode !== 'SIMULATE' ? selectedRaceId : null,
    currentTotalVotes,
    raceResult?.raceName
  );

  const isLoading = isLoadingRace || isLoadingPrecincts;
  const hasError = viewMode !== 'SIMULATE' && (!!electionsError || !!raceError || !!precinctError);

  // ── Effective map precincts (What If mode overrides normal results) ───────
  const effectivePrecincts: PrecinctResult[] =
    viewMode === 'SIMULATE' && simUpdate.whatIfPrecinctResults
      ? simUpdate.whatIfPrecinctResults
      : (precinctResults || []);

  return (
    <Layout
      sidebar={
        viewMode === 'SIMULATE' ? (
          <SimulationsPanel
            whatIfClickedWard={simClickedWard}
            onClearWhatIfClickedWard={() => setSimClickedWard(null)}
            onProjectionUpdate={setSimUpdate}
          />
        ) : (
          <Sidebar
            raceResult={raceResult}
            turnoutData={turnoutData}
            precinctResults={precinctResults}
            isLoading={isLoading}
            onSelectWard={setSelectedWard}
            isArchive={viewMode === 'ARCHIVE'}
            focusedCandidate={focusedCandidate}
            onFocusCandidate={setFocusedCandidate}
          />
        )
      }
      lastUpdated={lastPublished?.lastPublished}
      elections={elections}
      selectedElectionId={selectedElectionId}
      onSelectElection={setSelectedElectionId}
      viewMode={viewMode}
      onToggleViewMode={setViewMode}
      hasError={hasError}
    >
      <div className="relative w-full h-full">
        {viewMode !== 'SIMULATE' && (
          <RaceSelector
            races={races}
            selectedRaceId={selectedRaceId}
            onSelectRace={setSelectedRaceId}
          />
        )}
        <MapWrapper
          precinctResults={effectivePrecincts}
          isLoading={viewMode !== 'SIMULATE' ? isLoading : false}
          selectedWard={viewMode !== 'SIMULATE' ? selectedWard : null}
          raceResult={viewMode !== 'SIMULATE' ? raceResult : undefined}
          onReset={() => setSelectedWard(null)}
          focusedCandidate={viewMode !== 'SIMULATE' ? focusedCandidate : null}
          onCandidateReset={() => setFocusedCandidate(null)}
          simulateMode={viewMode === 'SIMULATE'}
          projectionData={viewMode === 'SIMULATE' ? simUpdate.projectionData : undefined}
          onWardClick={viewMode === 'SIMULATE' ? setSimClickedWard : undefined}
        />
      </div>
    </Layout>
  );
}
