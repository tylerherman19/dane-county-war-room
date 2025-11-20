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
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [selectedWard, setSelectedWard] = useState<{ name: string; num: string } | null>(null);

  // Data Hooks
  const { elections } = useElections();

  // Auto-select first election
  useEffect(() => {
    if (elections && elections.length > 0 && !selectedElectionId) {
      setSelectedElectionId(elections[0].electionId);
    }
  }, [elections, selectedElectionId]);

  const { races } = useRaces(selectedElectionId);

  // Auto-select first race
  useEffect(() => {
    if (races && races.length > 0 && !selectedRaceId) {
      setSelectedRaceId(races[0].raceNumber);
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
        />
      </div>
    </Layout>
  );
}
