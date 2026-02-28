'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import MapWrapper from '@/components/MapWrapper';
import Sidebar from '@/components/Sidebar';
import RaceSelector from '@/components/RaceSelector';
import {
  useElections,
  useRaces,
  useRaceResults,
  usePrecinctResults,
  useHistoricalTurnout,
  useLastPublished
} from '@/hooks/useElectionData';

export default function Home() {
  // State
  const [viewMode, setViewMode] = useState<'LIVE' | 'ARCHIVE'>('LIVE');
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedWard, setSelectedWard] = useState<{ name: string; num: string } | null>(null);

  // Data Hooks
  const { elections, isError: electionsError } = useElections();

  // Auto-select the most recent election.
  // In LIVE mode, always lock to the latest election.
  useEffect(() => {
    if (!elections || elections.length === 0) return;

    if (viewMode === 'LIVE') {
      if (selectedElectionId !== elections[0].electionId) {
        setSelectedElectionId(elections[0].electionId);
      }
    } else if (!selectedElectionId) {
      setSelectedElectionId(elections[0].electionId);
    }
  }, [elections, viewMode]); // intentionally omit selectedElectionId to avoid loop

  // Clear race selection whenever the election changes so we always
  // auto-select the correct first race for the new election.
  useEffect(() => {
    setSelectedRaceId(null);
    setSelectedWard(null);
  }, [selectedElectionId]);

  const { races } = useRaces(selectedElectionId);

  // Auto-select first race of the current election.
  useEffect(() => {
    if (races && races.length > 0 && !selectedRaceId) {
      setSelectedRaceId(races[0].id);
    }
  }, [races, selectedRaceId]);

  const { results: raceResult, isLoading: isLoadingRace, isError: raceError } = useRaceResults(selectedElectionId, selectedRaceId);
  const { precinctResults, isLoading: isLoadingPrecincts, isError: precinctError } = usePrecinctResults(selectedElectionId, selectedRaceId);
  const { lastPublished } = useLastPublished(selectedElectionId);

  // Calculate current total votes for turnout estimation
  const currentTotalVotes = raceResult?.totalVotes ?? 0;
  const { turnoutData } = useHistoricalTurnout(selectedRaceId, currentTotalVotes, raceResult?.raceName);

  const isLoading = isLoadingRace || isLoadingPrecincts;
  const hasError = !!electionsError || !!raceError || !!precinctError;

  return (
    <Layout
      sidebar={
        <Sidebar
          raceResult={raceResult}
          turnoutData={turnoutData}
          precinctResults={precinctResults}
          isLoading={isLoading}
          onSelectWard={setSelectedWard}
        />
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
        <RaceSelector
          races={races}
          selectedRaceId={selectedRaceId}
          onSelectRace={setSelectedRaceId}
        />
        <MapWrapper
          precinctResults={precinctResults || []}
          isLoading={isLoading}
          selectedWard={selectedWard}
          raceResult={raceResult}
          onReset={() => setSelectedWard(null)}
        />
      </div>
    </Layout>
  );
}
