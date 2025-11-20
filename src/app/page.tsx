'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardHeader } from '@/components/DashboardHeader';
import { RaceCard } from '@/components/RaceCard';
import { MadisonTable } from '@/components/MadisonTable';
import { ReportingUnits } from '@/components/ReportingUnits';
import { WardMap } from '@/components/WardMap';
import { mockElections, mockLastPublished, mockRaces, mockRaceResults, generateMockPrecinctResults } from '@/lib/mock-data';

const REFRESH_INTERVAL = 30000; // 30 seconds
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

// Key races we care about (matching race numbers to friendly names)
const KEY_RACES = [1, 2, 3, 4, 5, 6]; // Presidential, Senate, Supreme Court, County Exec, Mayor, Referendum

export default function Dashboard() {
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString());
  const [electionData, setElectionData] = useState({
    electionName: mockElections[0].electionName,
    electionDate: mockElections[0].electionDate,
    electionId: mockElections[0].electionId,
  });

  // Calculate overall reporting percentage
  const totalPrecincts = 277;
  const reportedPrecincts = mockRaceResults[1]?.precinctsReporting || 245;
  const reportingPercentage = (reportedPrecincts / totalPrecincts) * 100;

  // Process Madison ward data for table
  const madisonWardData = (() => {
    const precinctResults = generateMockPrecinctResults(1);
    const wardMap = new Map();

    precinctResults.forEach(result => {
      if (!wardMap.has(result.wardNumber)) {
        wardMap.set(result.wardNumber, {
          wardNumber: result.wardNumber,
          demCandidate: '',
          demVotes: 0,
          demPercentage: 0,
          totalVotes: 0,
          turnoutPercentage: 0,
          winner: '',
          registeredVoters: result.registeredVoters,
          ballotscast: result.ballotscast,
        });
      }

      const ward = wardMap.get(result.wardNumber);
      ward.totalVotes += result.votes;

      if (result.candidateName.includes('Harris')) {
        ward.demCandidate = result.candidateName;
        ward.demVotes = result.votes;
      }
    });

    return Array.from(wardMap.values()).map(ward => ({
      ...ward,
      demPercentage: (ward.demVotes / ward.totalVotes) * 100,
      turnoutPercentage: (ward.ballotscast / ward.registeredVoters) * 100,
      winner: ward.demVotes > (ward.totalVotes - ward.demVotes) ? ward.demCandidate : 'Trump / Vance',
    }));
  })();

  // Process ward results for map
  const wardMapResults = madisonWardData.map(ward => ({
    wardNumber: ward.wardNumber,
    winner: ward.winner,
    margin: Math.abs(ward.demPercentage - (100 - ward.demPercentage)),
  }));

  // Generate outstanding units data
  const outstandingUnits = Array.from({ length: 277 }, (_, i) => ({
    name: `Ward ${(i + 1).toString().padStart(3, '0')}`,
    registeredVoters: Math.floor(Math.random() * 1000) + 500,
    hasReported: i < reportedPrecincts,
  }));

  // Auto-refresh logic
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date().toISOString());
      // In production, this would check for new data and refresh
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950">
      <DashboardHeader
        electionName={electionData.electionName}
        electionDate={electionData.electionDate}
        lastUpdated={lastUpdated}
        reportingPercentage={reportingPercentage}
      />

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Key County-Wide Races */}
        <section>
          <h2 className="text-4xl font-bold text-white mb-6">Key Races</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {KEY_RACES.map(raceNum => {
              const race = mockRaceResults[raceNum as keyof typeof mockRaceResults];
              if (!race) return null;

              return (
                <RaceCard
                  key={raceNum}
                  raceName={race.raceName}
                  candidates={race.candidates}
                  totalVotes={race.totalVotes}
                  precinctsReporting={race.precinctsReporting}
                  totalPrecincts={race.totalPrecincts}
                />
              );
            })}
          </div>
        </section>

        {/* City of Madison Deep-Dive */}
        <section>
          <h2 className="text-4xl font-bold text-white mb-6">City of Madison</h2>
          <div className="space-y-6">
            <WardMap wardResults={wardMapResults} />
            <MadisonTable wardData={madisonWardData} />
          </div>
        </section>

        {/* Reporting Units Watch */}
        <section>
          <ReportingUnits
            totalUnits={totalPrecincts}
            reportedUnits={reportedPrecincts}
            outstandingUnits={outstandingUnits}
          />
        </section>
      </main>
    </div>
  );
}
