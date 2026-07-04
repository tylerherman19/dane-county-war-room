'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '@/components/Layout';
import MapWrapper from '@/components/MapWrapper';
import Sidebar from '@/components/Sidebar';
import SimulationsPanel from '@/components/SimulationsPanel';
import RaceSelector from '@/components/RaceSelector';
import RaceGroupSidebar from '@/components/RaceGroupSidebar';
import {
  useElections,
  useRaces,
  useRaceResults,
  usePrecinctResults,
  useElectionTurnout,
  useLastPublished
} from '@/hooks/useElectionData';
import { SimProjectionUpdate } from '@/lib/projections-data';
import { Election, PrecinctResult, Race, getRaceGroupKey } from '@/lib/api';
import { OverlayMode } from '@/components/MapOverlayControl';
import DistrictFilterControl from '@/components/DistrictFilterControl';
import { DistrictFilter, districtLabel, getWardsInDistrict } from '@/lib/districts';

/**
 * Picks the default comparison election: the most recent election strictly
 * older than the selected one of the same season type (general vs general,
 * spring vs spring...), falling back to the next older election of any kind.
 */
function defaultComparisonElection(elections: Election[], selectedId: string | null): string | null {
  if (!selectedId) return null;
  const idx = elections.findIndex(e => e.electionId === selectedId);
  if (idx < 0) return null;
  const older = elections.slice(idx + 1); // list is sorted newest-first
  if (older.length === 0) return null;
  const SEASONS = ['General Election', 'Partisan Primary', 'Spring Election', 'Spring Primary'];
  const season = SEASONS.find(s => elections[idx].electionName.includes(s));
  if (season) {
    const match = older.find(e => e.electionName.includes(season));
    if (match) return match.electionId;
  }
  return older[0].electionId;
}

export default function Home() {
  // ── Top-level mode ───────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'LIVE' | 'ARCHIVE' | 'SIMULATE'>('LIVE');

  // ── LIVE / ARCHIVE state ─────────────────────────────────────────────────
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(null);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedWard, setSelectedWard] = useState<{ name: string; num: string } | null>(null);
  const [focusedCandidate, setFocusedCandidate] = useState<string | null>(null);

  // ── Comparison election (turnout baseline) ──────────────────────────────
  // null = auto (previous comparable election); user can override in the sidebar.
  const [comparisonOverride, setComparisonOverride] = useState<string | null>(null);

  // ── Seat scope: restrict the dashboard to one district's wards ───────────
  const [districtFilter, setDistrictFilter] = useState<DistrictFilter | null>(null);

  // ── Shareable URL state (?e=&r=) ─────────────────────────────────────────
  const pendingUrlState = useRef<{ e: string | null; r: string | null } | null>(null);
  const urlStateApplied = useRef(false);

  // ── SIMULATE state ───────────────────────────────────────────────────────
  const [simUpdate, setSimUpdate] = useState<SimProjectionUpdate>({
    projectionData: {},
    highlightedWardKeys: new Set(),
    whatIfPrecinctResults: null,
    whatIfMode: false,
  });
  const [simClickedWard, setSimClickedWard] = useState<{ name: string; num: string } | null>(null);
  // Which overlay layer is active in SIMULATE mode (controlled from SimulationsPanel)
  const [simulateOverlayMode, setSimulateOverlayMode] = useState<OverlayMode>('PROJECTION');

  // Reset simulateOverlayMode when leaving SIMULATE mode
  useEffect(() => {
    if (viewMode !== 'SIMULATE') setSimulateOverlayMode('PROJECTION');
  }, [viewMode]);

  // ── Data Hooks (disabled in SIMULATE mode) ───────────────────────────────
  const { elections, isError: electionsError } = useElections();

  useEffect(() => {
    if (viewMode === 'SIMULATE') return;
    if (!elections || elections.length === 0) return;

    // Apply shared-link state (?e=&r=) once, before the LIVE pin below
    if (!urlStateApplied.current) {
      urlStateApplied.current = true;
      const params = new URLSearchParams(window.location.search);
      const e = params.get('e');
      const r = params.get('r');
      pendingUrlState.current = { e, r };
      if (e && elections.some(el => el.electionId === e)) {
        if (e !== elections[0].electionId) setViewMode('ARCHIVE');
        setSelectedElectionId(e);
        return;
      }
    }

    if (viewMode === 'LIVE') {
      if (selectedElectionId !== elections[0].electionId) {
        setSelectedElectionId(elections[0].electionId);
      }
    } else if (!selectedElectionId) {
      setSelectedElectionId(elections[0].electionId);
    }
  }, [elections, viewMode]); // intentionally omit selectedElectionId to avoid loop

  useEffect(() => {
    setSelectedRaceId(null);
    setSelectedGroupKey(null);
    setSelectedWard(null);
    setFocusedCandidate(null);
    setComparisonOverride(null);
  }, [selectedElectionId]);

  // Keep the URL shareable: reflect current selection in ?e=&r=
  useEffect(() => {
    if (!urlStateApplied.current || !selectedElectionId) return;
    const params = new URLSearchParams();
    params.set('e', selectedElectionId);
    if (selectedRaceId) params.set('r', selectedRaceId);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [selectedElectionId, selectedRaceId]);

  useEffect(() => {
    setFocusedCandidate(null);
  }, [selectedRaceId]);

  const { races } = useRaces(viewMode !== 'SIMULATE' ? selectedElectionId : null);

  // Races belonging to the currently selected group
  const groupRaces: Race[] = selectedGroupKey
    ? (races?.filter((r: Race) => getRaceGroupKey(r) === selectedGroupKey) ?? [])
    : [];

  useEffect(() => {
    if (viewMode === 'SIMULATE') return;
    if (races && races.length > 0 && !selectedRaceId && !selectedGroupKey) {
      // Shared link may name a specific race
      const pendingRace = pendingUrlState.current?.r;
      if (pendingRace && races.some(x => x.id === pendingRace)) {
        pendingUrlState.current = null;
        setSelectedRaceId(pendingRace);
        return;
      }
      // The county lists races in ballot order, so the first race is the
      // top-of-ticket contest (President/VP in generals, Supreme Court in springs).
      setSelectedRaceId(races[0].id);
    }
  }, [races, selectedRaceId, selectedGroupKey, viewMode]);

  const { results: raceResult, isLoading: isLoadingRace, isError: raceError } = useRaceResults(
    viewMode !== 'SIMULATE' ? selectedElectionId : null,
    viewMode !== 'SIMULATE' ? selectedRaceId : null
  );
  const { precinctResults, isLoading: isLoadingPrecincts, isError: precinctError } = usePrecinctResults(
    viewMode !== 'SIMULATE' ? selectedElectionId : null,
    viewMode !== 'SIMULATE' ? selectedRaceId : null
  );
  const { lastPublished } = useLastPublished(viewMode !== 'SIMULATE' ? selectedElectionId : null);

  // ── Real turnout: selected election + comparison baseline ────────────────
  const comparisonElectionId = useMemo(
    () => comparisonOverride ?? defaultComparisonElection(elections ?? [], selectedElectionId),
    [comparisonOverride, elections, selectedElectionId]
  );
  const { turnout: electionTurnout } = useElectionTurnout(
    viewMode !== 'SIMULATE' ? selectedElectionId : null,
    viewMode === 'LIVE'
  );
  const { turnout: comparisonTurnout } = useElectionTurnout(
    viewMode !== 'SIMULATE' ? comparisonElectionId : null
  );
  const comparisonElection = elections?.find(e => e.electionId === comparisonElectionId);

  // Ward-keyed maps for the map overlay: "City of Madison|46" -> ballots cast
  const turnoutByWard = useMemo(() => {
    if (!electionTurnout) return undefined;
    const m: Record<string, number> = {};
    electionTurnout.byWard.forEach(w => {
      const k = `${w.precinctName}|${w.wardNumber}`;
      m[k] = (m[k] ?? 0) + w.ballotsCast;
    });
    return m;
  }, [electionTurnout]);
  const comparisonTurnoutByWard = useMemo(() => {
    if (!comparisonTurnout) return undefined;
    const m: Record<string, number> = {};
    comparisonTurnout.byWard.forEach(w => {
      const k = `${w.precinctName}|${w.wardNumber}`;
      m[k] = (m[k] ?? 0) + w.ballotsCast;
    });
    return m;
  }, [comparisonTurnout]);

  const isLoading = isLoadingRace || isLoadingPrecincts;
  const hasError = viewMode !== 'SIMULATE' && (!!electionsError || !!raceError || !!precinctError);

  // ── Effective map precincts (What If mode overrides normal results) ───────
  const effectivePrecincts: PrecinctResult[] = useMemo(
    () =>
      viewMode === 'SIMULATE' && simUpdate.whatIfPrecinctResults
        ? simUpdate.whatIfPrecinctResults
        : (precinctResults || []),
    [viewMode, simUpdate.whatIfPrecinctResults, precinctResults]
  );

  // Seat scope: keep only the selected district's wards
  const districtWardKeys = useMemo(
    () => (districtFilter ? getWardsInDistrict(districtFilter) : null),
    [districtFilter]
  );
  const scopedPrecincts: PrecinctResult[] = useMemo(() => {
    if (!districtWardKeys || viewMode === 'SIMULATE') return effectivePrecincts;
    return effectivePrecincts.filter(r =>
      districtWardKeys.has(`${r.precinctName}|${parseInt(r.wardNumber) || 0}`)
    );
  }, [effectivePrecincts, districtWardKeys, viewMode]);
  const scopeLabel = districtFilter && viewMode !== 'SIMULATE' ? districtLabel(districtFilter) : null;

  function handleSelectRace(raceId: string) {
    setSelectedRaceId(raceId);
    setSelectedGroupKey(null);
    setSelectedWard(null);
    setFocusedCandidate(null);
  }

  function handleSelectGroup(groupKey: string | null) {
    setSelectedGroupKey(groupKey);
    // Only clear the race when opening a group overview; clearing the group
    // (groupKey === null) must not wipe a race that was just selected.
    if (groupKey !== null) setSelectedRaceId(null);
    setSelectedWard(null);
    setFocusedCandidate(null);
  }

  const showGroupSidebar = viewMode !== 'SIMULATE' && !!selectedGroupKey && groupRaces.length > 0 && !!selectedElectionId;

  return (
    <Layout
      sidebar={
        viewMode === 'SIMULATE' ? (
          <SimulationsPanel
            whatIfClickedWard={simClickedWard}
            onClearWhatIfClickedWard={() => setSimClickedWard(null)}
            onProjectionUpdate={setSimUpdate}
            simulateOverlayMode={simulateOverlayMode}
            onSimulateOverlayModeChange={setSimulateOverlayMode}
          />
        ) : showGroupSidebar ? (
          <RaceGroupSidebar
            races={groupRaces}
            electionId={selectedElectionId!}
            groupLabel={selectedGroupKey!}
            onSelectRace={handleSelectRace}
            isArchive={viewMode === 'ARCHIVE'}
          />
        ) : (
          <Sidebar
            raceResult={raceResult}
            precinctResults={scopedPrecincts}
            isLoading={isLoading}
            onSelectWard={setSelectedWard}
            isArchive={viewMode === 'ARCHIVE'}
            focusedCandidate={focusedCandidate}
            onFocusCandidate={setFocusedCandidate}
            electionTurnout={electionTurnout}
            comparisonTurnout={comparisonTurnout}
            comparisonElection={comparisonElection}
            elections={elections}
            selectedElectionId={selectedElectionId}
            onSelectComparison={setComparisonOverride}
            scopeLabel={scopeLabel}
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
          <>
            <RaceSelector
              races={races}
              selectedRaceId={selectedRaceId}
              onSelectRace={handleSelectRace}
              selectedGroupKey={selectedGroupKey}
              onSelectGroup={handleSelectGroup}
            />
            <DistrictFilterControl filter={districtFilter} onChange={setDistrictFilter} />
          </>
        )}
        <MapWrapper
          precinctResults={scopedPrecincts}
          isLoading={viewMode !== 'SIMULATE' ? isLoading : false}
          selectedWard={viewMode !== 'SIMULATE' ? selectedWard : null}
          raceResult={viewMode !== 'SIMULATE' ? raceResult : undefined}
          turnoutByWard={viewMode !== 'SIMULATE' ? turnoutByWard : undefined}
          comparisonTurnoutByWard={viewMode !== 'SIMULATE' ? comparisonTurnoutByWard : undefined}
          comparisonLabel={viewMode !== 'SIMULATE' ? (comparisonElection?.electionName ?? null) : null}
          fitKey={`${selectedRaceId ?? 'none'}|${districtFilter ? districtFilter.kind + districtFilter.num : 'all'}`}
          onReset={() => setSelectedWard(null)}
          focusedCandidate={viewMode !== 'SIMULATE' ? focusedCandidate : null}
          onCandidateReset={() => setFocusedCandidate(null)}
          simulateMode={viewMode === 'SIMULATE'}
          projectionData={viewMode === 'SIMULATE' ? simUpdate.projectionData : undefined}
          simulateHighlightedWards={viewMode === 'SIMULATE' ? simUpdate.highlightedWardKeys : null}
          onWardClick={viewMode === 'SIMULATE' ? setSimClickedWard : undefined}
          simulateOverlayMode={viewMode === 'SIMULATE' ? simulateOverlayMode : undefined}
        />
      </div>
    </Layout>
  );
}
