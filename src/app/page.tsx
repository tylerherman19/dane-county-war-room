'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '@/components/Layout';
import MapWrapper from '@/components/MapWrapper';
import Sidebar from '@/components/Sidebar';
import SimulationsPanel from '@/components/SimulationsPanel';
import RaceSelector from '@/components/RaceSelector';
import RaceGroupSidebar from '@/components/RaceGroupSidebar';
import Watchboard from '@/components/Watchboard';
import CoalitionPanel, { CoalitionUpdate } from '@/components/CoalitionPanel';
import TargetPanel, { TargetUpdate } from '@/components/TargetPanel';
import {
  useElections,
  useRaces,
  useRaceResults,
  usePrecinctResults,
  useElectionTurnout,
  useLastPublished,
  useElectionBoard
} from '@/hooks/useElectionData';
import { SimProjectionUpdate } from '@/lib/projections-data';
import { Election, PrecinctResult, Race, getRaceGroupKey } from '@/lib/api';
import { OverlayMode } from '@/components/MapOverlayControl';
import DistrictFilterControl from '@/components/DistrictFilterControl';
import { DistrictFilter, districtLabel, getWardsInDistrict } from '@/lib/districts';
import TrendsPanel, { ShiftPair } from '@/components/TrendsPanel';
import { BenchmarkSelection } from '@/components/BenchmarkCard';
import PrimaryFocusPanel, { PrimaryTab, PlanningState } from '@/components/PrimaryFocusPanel';
import { ScenarioId } from '@/components/PlanningPanel';
import { PlanningWardDatum } from '@/components/Map';
import { fetchPlanningData, computeWardPower, buildScenarios } from '@/lib/planning-data';
import useSWR from 'swr';
import { ElectionTurnout, extractDistrictNumber } from '@/lib/api';

function buildWardMap(turnout: ElectionTurnout | undefined): Record<string, number> | undefined {
  if (!turnout) return undefined;
  const m: Record<string, number> = {};
  turnout.byWard.forEach(w => {
    const k = `${w.precinctName}|${w.wardNumber}`;
    m[k] = (m[k] ?? 0) + w.ballotsCast;
  });
  return m;
}

/** Per-ward share (%) of one candidate within a race's precinct rows. */
function sharesByWard(rows: PrecinctResult[], candidateName: string): Record<string, number> {
  const totals: Record<string, number> = {};
  const cand: Record<string, number> = {};
  const target = candidateName.trim();
  rows.forEach(r => {
    const k = `${r.precinctName}|${parseInt(r.wardNumber) || 0}`;
    totals[k] = (totals[k] ?? 0) + r.votes;
    if (r.candidateName.trim() === target) cand[k] = (cand[k] ?? 0) + r.votes;
  });
  const out: Record<string, number> = {};
  Object.keys(totals).forEach(k => {
    if (totals[k] > 0) out[k] = ((cand[k] ?? 0) / totals[k]) * 100;
  });
  return out;
}

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
  const [viewMode, setViewMode] = useState<'LIVE' | 'BOARD' | 'ARCHIVE' | 'TRENDS' | 'COALITION' | 'TARGET' | 'SIMULATE' | 'PRIMARY'>('LIVE');
  const isResultsMode = viewMode === 'LIVE' || viewMode === 'ARCHIVE' || viewMode === 'PRIMARY';
  // BOARD pins the newest election like LIVE and needs an election selected.
  const needsElection = isResultsMode || viewMode === 'BOARD';
  const boardPinsLatest = viewMode === 'BOARD';

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
    if (!needsElection) return;
    if (!elections || elections.length === 0) return;

    // Apply shared-link state (?e=&r=) once, before the LIVE pin below
    if (isResultsMode && !urlStateApplied.current) {
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

    if (viewMode === 'LIVE' || boardPinsLatest) {
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

  const { races } = useRaces(isResultsMode ? selectedElectionId : null);

  // Races belonging to the currently selected group
  const groupRaces: Race[] = selectedGroupKey
    ? (races?.filter((r: Race) => getRaceGroupKey(r) === selectedGroupKey) ?? [])
    : [];

  useEffect(() => {
    if (!isResultsMode) return;
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

  // ── PRIMARY mode: lock onto an Assembly District's state house race ──────
  // Defaults to AD76; the district filter (shared with LIVE/ARCHIVE) can be
  // changed to any other Assembly district from the map's filter control.
  useEffect(() => {
    if (viewMode !== 'PRIMARY') return;
    if (!districtFilter || districtFilter.kind !== 'asm') {
      setDistrictFilter({ kind: 'asm', num: '76' });
    }
  }, [viewMode, districtFilter]);

  const primaryMatchingRaces: Race[] = useMemo(() => {
    if (!races || !districtFilter || districtFilter.kind !== 'asm') return [];
    const num = parseInt(districtFilter.num);
    return races.filter(r => r.type === 'Assembly' && extractDistrictNumber(r.name) === num);
  }, [races, districtFilter]);

  useEffect(() => {
    if (viewMode !== 'PRIMARY' || primaryMatchingRaces.length === 0) return;
    if (!selectedRaceId || !primaryMatchingRaces.some(r => r.id === selectedRaceId)) {
      setSelectedRaceId(primaryMatchingRaces[0].id);
      setSelectedGroupKey(null);
    }
  }, [viewMode, primaryMatchingRaces, selectedRaceId]);

  const { results: raceResult, isLoading: isLoadingRace, isError: raceError } = useRaceResults(
    isResultsMode ? selectedElectionId : null,
    isResultsMode ? selectedRaceId : null
  );
  const { precinctResults, isLoading: isLoadingPrecincts, isError: precinctError } = usePrecinctResults(
    isResultsMode ? selectedElectionId : null,
    isResultsMode ? selectedRaceId : null
  );
  const { lastPublished } = useLastPublished(needsElection ? selectedElectionId : null);

  // ── BOARD mode: every race at once ───────────────────────────────────────
  const { board, isLoading: boardLoading } = useElectionBoard(
    viewMode === 'BOARD' ? selectedElectionId : null,
    viewMode === 'BOARD'
  );
  const selectedElectionName = elections?.find(e => e.electionId === selectedElectionId)?.electionName;

  function handleSelectBoardRace(raceId: string) {
    const isLatest = !!elections && selectedElectionId === elections[0]?.electionId;
    setViewMode(isLatest ? 'LIVE' : 'ARCHIVE');
    setSelectedRaceId(raceId);
    setSelectedGroupKey(null);
    setSelectedWard(null);
    setFocusedCandidate(null);
  }

  // ── COALITION mode: combined slate support by ward ───────────────────────
  const [coalition, setCoalition] = useState<CoalitionUpdate>({ coalitionByWard: null, label: null });
  useEffect(() => {
    if (viewMode !== 'COALITION') setCoalition({ coalitionByWard: null, label: null });
  }, [viewMode]);

  // ── TARGET mode: ward turnout-consistency overlay ────────────────────────
  const [targetUpdate, setTargetUpdate] = useState<TargetUpdate>({ scoreByWard: null, label: null });
  useEffect(() => {
    if (viewMode !== 'TARGET') setTargetUpdate({ scoreByWard: null, label: null });
  }, [viewMode]);

  // ── Real turnout: selected election + comparison baseline ────────────────
  const comparisonElectionId = useMemo(
    () => comparisonOverride ?? defaultComparisonElection(elections ?? [], selectedElectionId),
    [comparisonOverride, elections, selectedElectionId]
  );
  const { turnout: electionTurnout } = useElectionTurnout(
    isResultsMode ? selectedElectionId : null,
    viewMode === 'LIVE' || viewMode === 'PRIMARY'
  );
  const { turnout: comparisonTurnout } = useElectionTurnout(
    isResultsMode ? comparisonElectionId : null
  );
  const comparisonElection = elections?.find(e => e.electionId === comparisonElectionId);

  // Ward-keyed maps for the map overlay: "City of Madison|46" -> ballots cast
  const turnoutByWard = useMemo(() => buildWardMap(electionTurnout), [electionTurnout]);
  const comparisonTurnoutByWard = useMemo(() => buildWardMap(comparisonTurnout), [comparisonTurnout]);

  // ── TRENDS mode: candidate gained/lost ground between two races ──────────
  const [shiftPair, setShiftPair] = useState<ShiftPair | null>(null);
  useEffect(() => {
    if (viewMode !== 'TRENDS') setShiftPair(null);
  }, [viewMode]);

  const { precinctResults: shiftFromPrecincts } = usePrecinctResults(
    viewMode === 'TRENDS' && shiftPair ? shiftPair.from.electionId : null,
    viewMode === 'TRENDS' && shiftPair ? shiftPair.from.raceId : null
  );
  const { precinctResults: shiftToPrecincts } = usePrecinctResults(
    viewMode === 'TRENDS' && shiftPair ? shiftPair.to.electionId : null,
    viewMode === 'TRENDS' && shiftPair ? shiftPair.to.raceId : null
  );
  const { turnout: shiftToTurnout } = useElectionTurnout(
    viewMode === 'TRENDS' && shiftPair ? shiftPair.to.electionId : null
  );
  const { turnout: shiftFromTurnout } = useElectionTurnout(
    viewMode === 'TRENDS' && shiftPair ? shiftPair.from.electionId : null
  );
  const shiftToTurnoutMap = useMemo(() => buildWardMap(shiftToTurnout), [shiftToTurnout]);
  const shiftFromTurnoutMap = useMemo(() => buildWardMap(shiftFromTurnout), [shiftFromTurnout]);

  const shiftByWard = useMemo(() => {
    if (!shiftPair || !shiftFromPrecincts || !shiftToPrecincts) return undefined;
    const fromShare = sharesByWard(shiftFromPrecincts, shiftPair.candidateName);
    const toShare = sharesByWard(shiftToPrecincts, shiftPair.candidateName);
    const out: Record<string, { from: number; to: number }> = {};
    Object.keys(toShare).forEach(k => {
      if (fromShare[k] !== undefined) out[k] = { from: fromShare[k], to: toShare[k] };
    });
    return Object.keys(out).length > 0 ? out : undefined;
  }, [shiftPair, shiftFromPrecincts, shiftToPrecincts]);

  const shiftLabels = shiftPair
    ? {
        from: `${shiftPair.from.electionDate.slice(0, 4)} ${shiftPair.from.raceName}`,
        to: `${shiftPair.to.electionDate.slice(0, 4)} ${shiftPair.to.raceName}`,
      }
    : null;

  // ── Election-night benchmark: current race vs a candidate's past race ────
  const [benchmark, setBenchmark] = useState<BenchmarkSelection | null>(null);
  useEffect(() => { setBenchmark(null); }, [selectedRaceId, selectedElectionId]);

  const { precinctResults: benchPrecincts } = usePrecinctResults(
    isResultsMode && benchmark ? benchmark.record.electionId : null,
    isResultsMode && benchmark ? benchmark.record.raceId : null
  );

  const benchmarkData = useMemo(() => {
    if (!benchmark || !precinctResults?.length || !benchPrecincts?.length) return null;
    const agg = (rows: PrecinctResult[], name: string) => {
      const t: Record<string, number> = {};
      const c: Record<string, number> = {};
      const target = name.trim();
      rows.forEach(r => {
        const k = `${r.precinctName}|${parseInt(r.wardNumber) || 0}`;
        t[k] = (t[k] ?? 0) + r.votes;
        if (r.candidateName.trim() === target) c[k] = (c[k] ?? 0) + r.votes;
      });
      return { t, c };
    };
    const live = agg(precinctResults, benchmark.currentCandidate);
    const past = agg(benchPrecincts, benchmark.record.candidateName);
    const shift: Record<string, { from: number; to: number }> = {};
    let lc = 0, lt = 0, pc = 0, pt = 0, n = 0;
    // Apples-to-apples: only wards with votes counted now AND present in the
    // benchmark race — on election night that means reported overlap wards.
    Object.keys(live.t).forEach(k => {
      if (live.t[k] > 0 && (past.t[k] ?? 0) > 0) {
        shift[k] = { from: ((past.c[k] ?? 0) / past.t[k]) * 100, to: ((live.c[k] ?? 0) / live.t[k]) * 100 };
        lc += live.c[k] ?? 0; lt += live.t[k];
        pc += past.c[k] ?? 0; pt += past.t[k];
        n++;
      }
    });
    if (n === 0) return null;
    return {
      shift,
      stats: { sharedWards: n, liveShare: (lc / lt) * 100, benchShare: (pc / pt) * 100 },
    };
  }, [benchmark, precinctResults, benchPrecincts]);

  const benchmarkLabels = benchmark
    ? {
        from: `${benchmark.record.electionDate.slice(0, 4)} ${benchmark.record.raceName}`,
        to: 'This race',
      }
    : null;

  const isLoading = isLoadingRace || isLoadingPrecincts;
  const hasError = isResultsMode && (!!electionsError || !!raceError || !!precinctError);

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

  // ── PRIMARY mode: pre-election planning (baked AD76 primary history) ─────
  const [primaryTabOverride, setPrimaryTabOverride] = useState<PrimaryTab | null>(null);
  const [planningScenarioId, setPlanningScenarioId] = useState<ScenarioId>('MID');
  const [planningNumCandidates, setPlanningNumCandidates] = useState(4);
  useEffect(() => {
    if (viewMode !== 'PRIMARY') setPrimaryTabOverride(null);
  }, [viewMode]);

  const { data: planningData, error: planningError, isLoading: planningLoading } = useSWR(
    viewMode === 'PRIMARY' ? 'ad76-planning' : null,
    fetchPlanningData
  );
  const planningPower = useMemo(
    () => (planningData && districtWardKeys ? computeWardPower(planningData, districtWardKeys) : null),
    [planningData, districtWardKeys]
  );
  const planningScenarios = useMemo(
    () => (planningData ? buildScenarios(planningData) : []),
    [planningData]
  );
  const planningScenario = planningScenarios.find(s => s.id === planningScenarioId) ?? planningScenarios[0];

  // Default to Planning until the district race exists and has votes counted;
  // the user's explicit tab choice always wins.
  const primaryHasReturns = primaryMatchingRaces.length > 0 && (raceResult?.totalVotes ?? 0) > 0;
  const primaryTab: PrimaryTab = primaryTabOverride ?? (primaryHasReturns ? 'NIGHT' : 'PLANNING');

  const planningState: PlanningState = {
    data: planningData ?? null,
    isLoading: planningLoading,
    isError: !!planningError,
    power: planningPower,
    scenarios: planningScenarios,
    scenarioId: planningScenario?.id ?? 'MID',
    onScenarioChange: setPlanningScenarioId,
    numCandidates: planningNumCandidates,
    onNumCandidatesChange: setPlanningNumCandidates,
  };

  // Map overlay data: expected vote per ward at the selected scenario
  const planningByWard = useMemo(() => {
    if (viewMode !== 'PRIMARY' || primaryTab !== 'PLANNING' || !planningPower || !planningScenario) return undefined;
    const out: Record<string, PlanningWardDatum> = {};
    planningPower.rows.forEach(r => {
      out[r.wardKey] = {
        share: r.share,
        expected: Math.round(r.share * planningScenario.totalVotes),
        rank: r.rank,
        totalWards: planningPower.rows.length,
        baselineYear: planningPower.baselineYear,
      };
    });
    return out;
  }, [viewMode, primaryTab, planningPower, planningScenario]);

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

  const showGroupSidebar = isResultsMode && !!selectedGroupKey && groupRaces.length > 0 && !!selectedElectionId;

  return (
    <Layout
      sidebar={
        viewMode === 'BOARD' ? null :
        viewMode === 'COALITION' ? (
          <CoalitionPanel elections={elections} onCoalitionUpdate={setCoalition} />
        ) : viewMode === 'TARGET' ? (
          <TargetPanel
            elections={elections}
            districtFilter={districtFilter}
            onDistrictChange={setDistrictFilter}
            onTargetUpdate={setTargetUpdate}
          />
        ) : viewMode === 'SIMULATE' ? (
          <SimulationsPanel
            whatIfClickedWard={simClickedWard}
            onClearWhatIfClickedWard={() => setSimClickedWard(null)}
            onProjectionUpdate={setSimUpdate}
            simulateOverlayMode={simulateOverlayMode}
            onSimulateOverlayModeChange={setSimulateOverlayMode}
          />
        ) : viewMode === 'TRENDS' ? (
          <TrendsPanel elections={elections} onShiftPair={setShiftPair} />
        ) : viewMode === 'PRIMARY' ? (
          <PrimaryFocusPanel
            primaryTab={primaryTab}
            onPrimaryTabChange={setPrimaryTabOverride}
            planning={planningState}
            districtFilter={districtFilter}
            onQuickSelectDistrict={num => setDistrictFilter({ kind: 'asm', num })}
            matchingRaces={primaryMatchingRaces}
            selectedRaceId={selectedRaceId}
            onSelectRace={handleSelectRace}
            raceResult={raceResult}
            precinctResults={scopedPrecincts}
            isLoading={isLoading}
            districtWardKeys={districtWardKeys}
            turnoutByWard={turnoutByWard}
            comparisonTurnoutByWard={comparisonTurnoutByWard}
            comparisonElection={comparisonElection}
            elections={elections}
            selectedElectionId={selectedElectionId}
            onSelectComparison={setComparisonOverride}
            isLive={true}
            benchmark={benchmark}
            onBenchmarkChange={setBenchmark}
            benchmarkStats={benchmarkData?.stats ?? null}
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
            isLive={viewMode === 'LIVE'}
            benchmark={benchmark}
            onBenchmarkChange={setBenchmark}
            benchmarkStats={benchmarkData?.stats ?? null}
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
        {viewMode === 'BOARD' ? (
          <Watchboard
            board={board}
            isLoading={boardLoading}
            isLive={!!elections && selectedElectionId === elections[0]?.electionId}
            electionName={selectedElectionName}
            onSelectRace={handleSelectBoardRace}
          />
        ) : (
        <>
        {isResultsMode && (
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
          isLoading={isResultsMode ? isLoading : false}
          selectedWard={isResultsMode ? selectedWard : null}
          raceResult={isResultsMode ? raceResult : undefined}
          turnoutByWard={viewMode === 'TRENDS' ? shiftToTurnoutMap : isResultsMode ? turnoutByWard : undefined}
          comparisonTurnoutByWard={viewMode === 'TRENDS' ? shiftFromTurnoutMap : isResultsMode ? comparisonTurnoutByWard : undefined}
          comparisonLabel={
            viewMode === 'TRENDS'
              ? (shiftPair?.from.electionName ?? null)
              : isResultsMode ? (comparisonElection?.electionName ?? null) : null
          }
          trendsMode={viewMode === 'TRENDS'}
          shiftByWard={viewMode === 'TRENDS' ? shiftByWard : benchmarkData?.shift}
          shiftLabels={viewMode === 'TRENDS' ? shiftLabels : benchmarkLabels}
          benchmarkLabel={
            isResultsMode && benchmark
              ? `${benchmark.currentCandidate.split(' ').slice(-1)[0]} vs ${benchmark.record.electionDate.slice(0, 4)} ${benchmark.record.raceName}`
              : null
          }
          fitKey={
            viewMode === 'TRENDS'
              ? `shift|${shiftPair ? shiftPair.from.electionId + shiftPair.from.raceId + shiftPair.to.electionId + shiftPair.to.raceId : 'none'}`
              : viewMode === 'COALITION'
                ? `coalition|${coalition.coalitionByWard ? Object.keys(coalition.coalitionByWard).length : 0}`
                : viewMode === 'TARGET'
                ? `target|${districtFilter ? districtFilter.kind + districtFilter.num : 'all'}|${targetUpdate.scoreByWard ? Object.keys(targetUpdate.scoreByWard).length : 0}`
                : viewMode === 'SIMULATE'
                  ? `sim|${simUpdate.highlightedWardKeys.size}|${[...simUpdate.highlightedWardKeys].sort()[0] ?? 'none'}`
                  : `${selectedRaceId ?? 'none'}|${districtFilter ? districtFilter.kind + districtFilter.num : 'all'}${viewMode === 'PRIMARY' ? `|${primaryTab}` : ''}`
          }
          planningByWard={planningByWard}
          coalitionMode={viewMode === 'COALITION' || viewMode === 'TARGET'}
          coalitionByWard={
            viewMode === 'COALITION'
              ? (coalition.coalitionByWard ?? undefined)
              : viewMode === 'TARGET'
                ? (targetUpdate.scoreByWard ?? undefined)
                : undefined
          }
          coalitionLabel={
            viewMode === 'COALITION'
              ? coalition.label
              : viewMode === 'TARGET'
                ? targetUpdate.label
                : undefined
          }
          coalitionSubtext={viewMode === 'TARGET' ? 'Green votes consistently · red is presidential-only' : undefined}
          onReset={() => setSelectedWard(null)}
          focusedCandidate={isResultsMode ? focusedCandidate : null}
          onCandidateReset={() => setFocusedCandidate(null)}
          simulateMode={viewMode === 'SIMULATE'}
          projectionData={viewMode === 'SIMULATE' ? simUpdate.projectionData : undefined}
          simulateHighlightedWards={viewMode === 'SIMULATE' ? simUpdate.highlightedWardKeys : null}
          onWardClick={viewMode === 'SIMULATE' ? setSimClickedWard : undefined}
          simulateOverlayMode={viewMode === 'SIMULATE' ? simulateOverlayMode : undefined}
        />
        </>
        )}
      </div>
    </Layout>
  );
}
