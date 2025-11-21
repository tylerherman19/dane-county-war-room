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
  const { elections } = useElections();

  // Auto-select first election
  useEffect(() => {
    if (elections && elections.length > 0) {
      // If in LIVE mode, always force the most recent election
      if (viewMode === 'LIVE') {
        if (selectedElectionId !== elections[0].electionId) {
          setSelectedElectionId(elections[0].electionId);
        }
      }
      // If in ARCHIVE mode, only select if nothing is selected
      else if (!selectedElectionId) {
        setSelectedElectionId(elections[0].electionId);
      }
    }
  }, [elections, selectedElectionId, viewMode]);

  const { races } = useRaces(selectedElectionId);

  // Auto-select first race
  useEffect(() => {
    if (races && races.length > 0 && !selectedRaceId) {
      setSelectedRaceId(races[0].id);
    }
  }, [races, selectedRaceId]);

  const { results: raceResult, isLoading: isLoadingRace } = useRaceResults(selectedElectionId, selectedRaceId);
  const { precinctResults, isLoading: isLoadingPrecincts } = usePrecinctResults(selectedElectionId, selectedRaceId);
  const { lastPublished } = useLastPublished(selectedElectionId);

  // Calculate current total votes for turnout estimation
  const currentTotalVotes = raceResult?.totalVotes || 0;
  const { turnoutData } = useHistoricalTurnout(selectedRaceId, currentTotalVotes);

  const isLoading = isLoadingRace || isLoadingPrecincts;

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
