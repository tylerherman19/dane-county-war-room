'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, X, FlaskConical, Layers, Users, TrendingDown, BarChart3, Download } from 'lucide-react';
import {
    DistrictProjection,
    SimProjectionUpdate,
    computeWinNumber,
    applyMultipliers,
    computeProjectionData,
    computeWhatIfProjectionData,
    toPrecinctResults,
    loadDistrictProjections,
} from '@/lib/projections-data';
import { HistoricalRaceData } from '@/lib/historical-api-data';
import { OverlayMode } from './MapOverlayControl';
import { getDormantPoolByWard, rankCanvassWards, CanvassWard, getDropoffByWard, rankDropoffWards, DropoffWard, DropoffInfo } from '@/lib/dormant-voter-data';
import { toCsv, downloadCsv, fileSlug } from '@/lib/csv';

interface SimulationsPanelProps {
    whatIfClickedWard: { name: string; num: string } | null;
    onClearWhatIfClickedWard: () => void;
    onProjectionUpdate: (update: SimProjectionUpdate) => void;
    simulateOverlayMode: OverlayMode;
    onSimulateOverlayModeChange: (mode: OverlayMode) => void;
}

export default function SimulationsPanel({
    whatIfClickedWard,
    onClearWhatIfClickedWard,
    onProjectionUpdate,
    simulateOverlayMode,
    onSimulateOverlayModeChange,
}: SimulationsPanelProps) {
    // ── District data ──────────────────────────────────────────────────────
    const [mayorProjection, setMayorProjection] = useState<DistrictProjection | null>(null);
    const [alderDistricts, setAlderDistricts] = useState<DistrictProjection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ── Dormant pool data (for Canvass Priority) ───────────────────────────
    const [dormantPoolData, setDormantPoolData] = useState<Record<string, number> | null>(null);

    // ── Dropoff data (for Primary Dropoff) ────────────────────────────────
    const [dropoffData, setDropoffData] = useState<Record<string, DropoffInfo> | null>(null);

    // ── Core simulation inputs ─────────────────────────────────────────────
    const [turnoutPct, setTurnoutPct] = useState(100);
    const [numCandidates, setNumCandidates] = useState(2);
    const [regDelta, setRegDelta] = useState(0);
    const [selectedKey, setSelectedKey] = useState<string>('Mayor');

    // ── Collapsible section states ─────────────────────────────────────────
    const [racePickerOpen, setRacePickerOpen] = useState(true);
    const [topCanvassWardsOpen, setTopCanvassWardsOpen] = useState(false);
    const [topDropoffWardsOpen, setTopDropoffWardsOpen] = useState(false);
    const [turnoutOpen, setTurnoutOpen] = useState(true);
    const [regChangeOpen, setRegChangeOpen] = useState(true);
    const [raceSettingsOpen, setRaceSettingsOpen] = useState(true);
    const [mapLegendOpen, setMapLegendOpen] = useState(false);

    // ── What If state ──────────────────────────────────────────────────────
    const [whatIfOpen, setWhatIfOpen] = useState(true);
    const [whatIfRaceKey, setWhatIfRaceKey] = useState<string>('');
    const [globalWhatIfMult, setGlobalWhatIfMult] = useState(100);
    const [wardList, setWardList] = useState<Array<{ wardKey: string; label: string; multiplier: number }>>([]);

    // ── Feature 3: Candidate selection for margin impact ───────────────────
    const [yourCandidate, setYourCandidate] = useState<string>('');

    // Load data on mount
    useEffect(() => {
        loadDistrictProjections().then(({ mayor, alderDistricts }) => {
            setMayorProjection(mayor);
            setAlderDistricts(alderDistricts);
            setIsLoading(false);
        });
        getDormantPoolByWard().then(setDormantPoolData).catch(() => {});
        getDropoffByWard().then(setDropoffData).catch(() => {});
    }, []);

    // ── Resolve selected district ──────────────────────────────────────────
    const selectedDistrict: DistrictProjection | null =
        selectedKey === 'Mayor'
            ? mayorProjection
            : alderDistricts.find((d: DistrictProjection) => `Alder-${d.districtNum}` === selectedKey) ?? null;

    // ── Resolve What If race ───────────────────────────────────────────────
    const allElections: (HistoricalRaceData & { districtNum?: number })[] = selectedDistrict?.elections ?? [];
    const whatIfRace = allElections.find(
        e => `${e.electionId}|${e.raceId}` === whatIfRaceKey
    ) ?? null;

    // ── Handle map ward clicks ─────────────────────────────────────────────
    useEffect(() => {
        if (!whatIfClickedWard || !whatIfOpen || !whatIfRace) return;
        onClearWhatIfClickedWard();

        const clickedLabel = `${whatIfClickedWard.name} Ward ${whatIfClickedWard.num}`;
        const wardKey = findWardKeyForClicked(whatIfRace.wardResults, whatIfClickedWard);
        if (!wardKey) return;

        type WardEntry = { wardKey: string; label: string; multiplier: number };
        setWardList((prev: WardEntry[]) => {
            if (prev.some((w: WardEntry) => w.wardKey === wardKey)) return prev;
            return [...prev, { wardKey, label: clickedLabel, multiplier: globalWhatIfMult }];
        });
    }, [whatIfClickedWard]);

    // ── Auto-select most recent race when elections become available ───────
    useEffect(() => {
        if (allElections.length > 0 && !whatIfRaceKey) {
            setWhatIfRaceKey(`${allElections[0].electionId}|${allElections[0].raceId}`);
        }
    }, [allElections.length]);

    // ── Derived values ─────────────────────────────────────────────────────
    const hasPrimaryData = (selectedDistrict?.primaryHistoricalAvg ?? 0) > 0;
    const baseline = hasPrimaryData
        ? selectedDistrict!.primaryHistoricalAvg
        : (selectedDistrict?.historicalAvg ?? 0);
    const expectedTotal = applyMultipliers(baseline, turnoutPct, regDelta);
    const winResult = computeWinNumber(expectedTotal, numCandidates);

    // ── What If candidate totals ───────────────────────────────────────────
    const whatIfCandidateTotals: { name: string; original: number; adjusted: number }[] = useMemo(() => {
        if (!whatIfOpen || !whatIfRace) return [];
        const perWardOverrides: Record<string, number> = {};
        wardList.forEach(w => { perWardOverrides[w.wardKey] = w.multiplier; });

        const candidateTotals: Record<string, { original: number; adjusted: number }> = {};
        for (const [wardKey, wr] of whatIfRace.wardResults.entries()) {
            const m = (perWardOverrides[wardKey] ?? globalWhatIfMult) / 100;
            for (const c of wr.candidates) {
                if (!candidateTotals[c.name]) candidateTotals[c.name] = { original: 0, adjusted: 0 };
                candidateTotals[c.name].original += c.votes;
                candidateTotals[c.name].adjusted += Math.round(c.votes * m);
            }
        }
        return Object.entries(candidateTotals)
            .map(([name, totals]) => ({ name, ...totals }))
            .sort((a, b) => b.adjusted - a.adjusted);
    }, [whatIfOpen, whatIfRace, wardList, globalWhatIfMult]);

    // ── Projected total (for Win Number header) ────────────────────────────
    // In What If mode: sum of all adjusted ward totals from the selected race.
    // Otherwise: expectedTotal (global sim sliders).
    const projectedTotal = useMemo(() => {
        if (whatIfOpen && whatIfRace) {
            const perWardOverrides: Record<string, number> = {};
            wardList.forEach(w => { perWardOverrides[w.wardKey] = w.multiplier; });
            let total = 0;
            for (const [wardKey, wr] of whatIfRace.wardResults.entries()) {
                const m = (perWardOverrides[wardKey] ?? globalWhatIfMult) / 100;
                total += Math.round(wr.totalVotes * m);
            }
            return total;
        }
        return expectedTotal;
    }, [whatIfOpen, whatIfRace, wardList, globalWhatIfMult, expectedTotal]);

    // ── Your share: candidate total to compare against win number ─────────
    const yourShareTotal = useMemo(() => {
        if (whatIfOpen && whatIfRace && whatIfCandidateTotals.length > 0) {
            if (yourCandidate) {
                const cand = whatIfCandidateTotals.find(c => c.name.trim() === yourCandidate);
                return cand?.adjusted ?? 0;
            }
            return whatIfCandidateTotals[0]?.adjusted ?? 0;
        }
        // Base sim: assume even split
        return numCandidates > 0 ? Math.round(expectedTotal / numCandidates) : expectedTotal;
    }, [whatIfOpen, whatIfRace, whatIfCandidateTotals, yourCandidate, expectedTotal, numCandidates]);

    const gap = yourShareTotal - winResult.winNumber;

    // ── Candidate names for "Your Candidate" picker ────────────────────────
    const whatIfCandidateNames = useMemo(() => {
        if (!whatIfRace) return [];
        const names = new Set<string>();
        for (const wr of whatIfRace.wardResults.values()) {
            for (const c of wr.candidates) {
                const n = c.name.trim();
                if (n && !n.toLowerCase().includes('write')) names.add(n);
            }
        }
        return Array.from(names);
    }, [whatIfRace]);

    // ── Top 15 canvass wards (filtered to selected district) ──────────────
    const topCanvassWards = useMemo((): CanvassWard[] => {
        if (!dormantPoolData) return [];
        const districtWards = selectedDistrict?.wardKeys;
        const filtered = districtWards
            ? Object.fromEntries(Object.entries(dormantPoolData).filter(([k]) => districtWards.includes(k)))
            : dormantPoolData;
        return rankCanvassWards(filtered, 15);
    }, [dormantPoolData, selectedDistrict]);

    // ── Top 15 dropoff wards (filtered to selected district) ──────────────
    const topDropoffWards = useMemo((): DropoffWard[] => {
        if (!dropoffData) return [];
        const districtWards = selectedDistrict?.wardKeys;
        const filtered = districtWards
            ? Object.fromEntries(Object.entries(dropoffData).filter(([k]) => districtWards.includes(k)))
            : dropoffData;
        return rankDropoffWards(filtered, 15);
    }, [dropoffData, selectedDistrict]);

    // ── CSV export of the full (not just top-15) district-scoped lists ─────
    const scopeName = selectedDistrict?.label ?? 'district';
    const stamp = () => new Date().toISOString().slice(0, 10);

    function exportCanvass() {
        if (!dormantPoolData) return;
        const districtWards = selectedDistrict?.wardKeys;
        const filtered = districtWards
            ? Object.fromEntries(Object.entries(dormantPoolData).filter(([k]) => districtWards.includes(k)))
            : dormantPoolData;
        const all = rankCanvassWards(filtered, Number.MAX_SAFE_INTEGER);
        if (all.length === 0) return;
        const csv = toCsv(
            ['Rank', 'Ward', 'Ward #', 'Dormant voters', 'Priority'],
            all.map((w, i) => [i + 1, w.displayName, w.wardNumber, w.dormantPool, w.priority]),
        );
        downloadCsv(`canvass-priority-${fileSlug(scopeName)}-${stamp()}`, csv);
    }

    function exportDropoff() {
        if (!dropoffData) return;
        const districtWards = selectedDistrict?.wardKeys;
        const filtered = districtWards
            ? Object.fromEntries(Object.entries(dropoffData).filter(([k]) => districtWards.includes(k)))
            : dropoffData;
        const all = rankDropoffWards(filtered, Number.MAX_SAFE_INTEGER);
        if (all.length === 0) return;
        const csv = toCsv(
            ['Rank', 'Ward', 'Ward #', 'General turnout', 'Primary turnout', 'Dropoff', 'Dropoff %'],
            all.map((w, i) => [i + 1, w.displayName, w.wardNumber, w.general, w.primary, w.dropoff, w.dropoffPct.toFixed(1)]),
        );
        downloadCsv(`primary-dropoff-${fileSlug(scopeName)}-${stamp()}`, csv);
    }

    // ── Map projection update ──────────────────────────────────────────────
    const buildUpdate = useCallback((): SimProjectionUpdate => {
        if (!selectedDistrict) {
            return { projectionData: {}, highlightedWardKeys: new Set(), whatIfPrecinctResults: null, whatIfMode: false };
        }

        const highlightedWardKeys = new Set(selectedDistrict.wardKeys);

        if (whatIfOpen && whatIfRace) {
            const perWardOverrides: Record<string, number> = {};
            wardList.forEach((w) => { perWardOverrides[w.wardKey] = w.multiplier; });

            const projectionData = computeWhatIfProjectionData(whatIfRace.wardResults, globalWhatIfMult, perWardOverrides);
            const whatIfPrecinctResults = toPrecinctResults(whatIfRace.wardResults, globalWhatIfMult, perWardOverrides);
            return { projectionData, highlightedWardKeys, whatIfPrecinctResults, whatIfMode: true };
        }

        const projectionData = computeProjectionData(selectedDistrict);
        return { projectionData, highlightedWardKeys, whatIfPrecinctResults: null, whatIfMode: false };
    }, [selectedDistrict, whatIfOpen, whatIfRace, globalWhatIfMult, wardList]);

    useEffect(() => {
        onProjectionUpdate(buildUpdate());
    }, [buildUpdate]);

    // Reset What If when the race changes, and point it at the newly selected
    // district's most recent race. The projection overlay renders through
    // whatIfPrecinctResults, so clearing the key to '' (and relying on the
    // length-keyed auto-select effect) blanks the map whenever two districts
    // have the same election count — e.g. switching between alder districts.
    useEffect(() => {
        setWardList([]);
        setGlobalWhatIfMult(100);
        setYourCandidate('');
        setWhatIfRaceKey(
            allElections.length > 0 ? `${allElections[0].electionId}|${allElections[0].raceId}` : ''
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKey]);

    // ── Full simulation reset ──────────────────────────────────────────────
    const handleReset = useCallback(() => {
        setTurnoutPct(100);
        setRegDelta(0);
        setNumCandidates(2);
        setWhatIfOpen(false);
        setWardList([]);
        setGlobalWhatIfMult(100);
        setYourCandidate('');
        onSimulateOverlayModeChange('PROJECTION');
    }, [onSimulateOverlayModeChange]);

    if (isLoading) {
        return (
            <div className="h-full bg-white p-5 space-y-4 animate-pulse">
                <div className="h-8 bg-[#f0f0f0]" />
                <div className="h-32 bg-[#f0f0f0]" />
                <div className="h-24 bg-[#f0f0f0]" />
                <div className="h-24 bg-[#f0f0f0]" />
            </div>
        );
    }

    const hasMayorData = !!mayorProjection;
    const hasAlderData = alderDistricts.length > 0;

    return (
        <div className="h-full bg-white flex flex-col overflow-hidden">

            {/* ── WIN NUMBER STICKY HEADER ── */}
            {selectedDistrict && (
                <div className="flex-shrink-0 border-b-2 border-[#222] bg-white px-4 pt-3 pb-3">
                    <div className="grid grid-cols-3 gap-2 mb-2">
                        {/* Win Number */}
                        <div className="text-center">
                            <div className="text-[9px] text-[#999] font-bold uppercase tracking-[0.08em] mb-0.5">Win Number</div>
                            <div className="text-xl font-bold num text-[#008fd5]">
                                {winResult.winNumber.toLocaleString()}
                            </div>
                        </div>
                        {/* Your Share / Projected */}
                        <div className="text-center">
                            <div className="text-[9px] text-[#999] font-bold uppercase tracking-[0.08em] mb-0.5">
                                {whatIfOpen && whatIfRace ? 'Your Share' : 'Projected Total'}
                            </div>
                            <div className="text-xl font-bold num text-[#222]">
                                {yourShareTotal.toLocaleString()}
                            </div>
                        </div>
                        {/* Gap */}
                        <div className="text-center">
                            <div className="text-[9px] text-[#999] font-bold uppercase tracking-[0.08em] mb-0.5">Gap</div>
                            <div className={`text-xl font-bold num ${gap >= 0 ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                {gap >= 0 ? '+' : ''}{gap.toLocaleString()}
                            </div>
                        </div>
                    </div>
                    {/* Progress bar: your share toward win number */}
                    <div className="h-1.5 bg-[#e8e8e8] overflow-hidden mb-2">
                        <div
                            className="h-full transition-all duration-300"
                            style={{
                                width: `${winResult.winNumber > 0 ? Math.min((yourShareTotal / winResult.winNumber) * 100, 100) : 0}%`,
                                background: gap >= 0 ? '#6d904f' : '#fc4f30',
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[#666] num">
                            {gap >= 0 ? '▲ On track to win' : `▼ Need ${Math.abs(gap).toLocaleString()} more votes`}
                        </span>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-1 text-[10px] text-[#666] hover:text-[#222] transition-colors"
                            title="Reset all simulation inputs"
                        >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Reset
                        </button>
                    </div>
                </div>
            )}

            {/* ── SCROLLABLE BODY ── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── Header ── */}
                <div className="flex items-center gap-2 mb-1">
                    <FlaskConical className="w-4 h-4 text-[#008fd5]" />
                    <h2 className="text-sm font-bold text-[#222]">Pre-Election Simulation</h2>
                </div>
                <p className="text-xs text-[#999] -mt-2">
                    Game-plan turnout and field strategy. No live results, pure projection.
                </p>

                {/* ── Race Selector ── */}
                <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                    <button
                        onClick={() => setRacePickerOpen(o => !o)}
                        className="w-full p-3 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                    >
                        <div className="kicker">Race</div>
                        {racePickerOpen ? <ChevronUp className="w-4 h-4 text-[#999]" /> : <ChevronDown className="w-4 h-4 text-[#999]" />}
                    </button>
                    {racePickerOpen && (
                        <div className="px-3 pb-3 border-t border-[#e0e0e0] pt-2 space-y-2">
                            <div className="flex flex-wrap gap-1">
                                {hasMayorData && (
                                    <button
                                        onClick={() => setSelectedKey('Mayor')}
                                        className={`px-2.5 py-1 rounded-[3px] text-xs font-bold transition-colors ${selectedKey === 'Mayor' ? 'bg-[#222] text-white border border-[#222]' : 'bg-white text-[#666] border border-[#cccccc] hover:text-[#222] hover:border-[#999]'}`}
                                    >
                                        Mayor
                                    </button>
                                )}
                                {hasAlderData && alderDistricts.map(d => (
                                    <button
                                        key={d.districtNum}
                                        onClick={() => setSelectedKey(`Alder-${d.districtNum}`)}
                                        className={`px-2 py-1 rounded-[3px] text-xs font-bold transition-colors ${selectedKey === `Alder-${d.districtNum}` ? 'bg-[#222] text-white border border-[#222]' : 'bg-white text-[#666] border border-[#cccccc] hover:text-[#222] hover:border-[#999]'}`}
                                    >
                                        D{d.districtNum}
                                    </button>
                                ))}
                                {!hasMayorData && !hasAlderData && (
                                    <div className="text-xs text-[#a16207] py-1">
                                        No historical data. Run <code className="font-mono bg-[#f0f0f0] px-1 rounded-[2px]">npm run build:historical</code>.
                                    </div>
                                )}
                            </div>
                            {selectedDistrict && (
                                <div className="text-xs text-[#999] num">
                                    {selectedDistrict.label} ·{' '}
                                    {hasPrimaryData
                                        ? <>primary avg <span className="text-[#666]">{selectedDistrict.primaryHistoricalAvg.toLocaleString()}</span> votes ({selectedDistrict.primaryElectionsCount} primary{selectedDistrict.primaryElectionsCount !== 1 ? 's' : ''})</>
                                        : <>avg <span className="text-[#666]">{selectedDistrict.historicalAvg.toLocaleString()}</span> votes ({selectedDistrict.electionsCount} election{selectedDistrict.electionsCount !== 1 ? 's' : ''} averaged)</>
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {selectedDistrict && (
                    <>
                        {/* ── Map Layer Selector ── */}
                        <div className="border border-[#e0e0e0] rounded-[3px] p-3 bg-white">
                            <div className="kicker mb-2 flex items-center gap-1.5">
                                <Layers className="w-3 h-3" />
                                Map Layer
                            </div>
                            <div className="space-y-1">
                                {[
                                    {
                                        id: 'PROJECTION' as OverlayMode,
                                        label: 'Turnout Projection',
                                        desc: 'Historical ward turnout heat map',
                                        icon: BarChart3,
                                    },
                                    {
                                        id: 'CANVASS_PRIORITY' as OverlayMode,
                                        label: 'Canvass Priority',
                                        desc: 'Dormant voter pool by ward',
                                        icon: Users,
                                    },
                                    {
                                        id: 'PRIMARY_DROPOFF' as OverlayMode,
                                        label: 'Primary Dropoff',
                                        desc: 'General to primary turnout gap',
                                        icon: TrendingDown,
                                    },
                                ].map(opt => {
                                    const isActive = simulateOverlayMode === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => onSimulateOverlayModeChange(opt.id)}
                                            className={`w-full text-left px-2.5 py-2 transition-colors flex items-center gap-2.5 border-l-2 ${
                                                isActive
                                                    ? 'border-[#008fd5] bg-[#f2f9fd]'
                                                    : 'border-transparent hover:bg-[#f7f7f7]'
                                            }`}
                                        >
                                            <opt.icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#008fd5]' : 'text-[#999]'}`} />
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-[#222]">
                                                    {opt.label}
                                                </div>
                                                <div className="text-[10px] text-[#999] truncate">{opt.desc}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Canvass Priority Sidebar List ── */}
                        {simulateOverlayMode === 'CANVASS_PRIORITY' && (
                            <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                                <button
                                    onClick={() => setTopCanvassWardsOpen(o => !o)}
                                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <Users className="w-3 h-3 text-[#008fd5]" />
                                        <span className="kicker text-[10px]">Top Canvass Wards</span>
                                    </div>
                                    {topCanvassWardsOpen ? <ChevronUp className="w-4 h-4 text-[#999]" /> : <ChevronDown className="w-4 h-4 text-[#999]" />}
                                </button>
                                {topCanvassWardsOpen && (
                                    <div className="border-t border-[#e0e0e0]">
                                        {topCanvassWards.length > 0 && (
                                            <div className="px-3 py-2.5 border-b border-[#e0e0e0] flex items-center">
                                                <button
                                                    onClick={exportCanvass}
                                                    className="ml-auto flex items-center gap-1 text-[10px] text-[#666] hover:text-[#222] transition-colors"
                                                    title="Download the full ranked list as CSV"
                                                >
                                                    <Download className="w-3 h-3" /> CSV
                                                </button>
                                            </div>
                                        )}
                                        {topCanvassWards.length === 0 ? (
                                            <div className="p-3 text-xs text-[#999] text-center">Loading dormant voter data</div>
                                        ) : (
                                            <div className="divide-y divide-[#eeeeee]">
                                                {topCanvassWards.map((ward, i) => (
                                                    <div key={ward.wardKey} className="px-3 py-2 flex items-center gap-2">
                                                        <span className="text-[10px] text-[#999] num w-4 text-right flex-shrink-0">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs text-[#222] truncate">{ward.displayName}</div>
                                                            <div className="text-[10px] text-[#999] num">
                                                                ~{ward.dormantPool.toLocaleString()} dormant voters
                                                            </div>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-[2px] border flex-shrink-0 ${
                                                            ward.priority === 'HIGH'
                                                                ? 'border-[#fc4f30] text-[#c73a1d]'
                                                                : ward.priority === 'MEDIUM'
                                                                ? 'border-[#e5ae38] text-[#a16207]'
                                                                : 'border-[#cccccc] text-[#666]'
                                                        }`}>
                                                            {ward.priority}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Primary Dropoff Ranked List ── */}
                        {simulateOverlayMode === 'PRIMARY_DROPOFF' && (
                            <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                                <button
                                    onClick={() => setTopDropoffWardsOpen(o => !o)}
                                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                                >
                                    <div className="flex items-center gap-1.5">
                                        <TrendingDown className="w-3 h-3 text-[#a16207]" />
                                        <span className="kicker text-[10px]">Top Dropoff Wards</span>
                                    </div>
                                    {topDropoffWardsOpen ? <ChevronUp className="w-4 h-4 text-[#999]" /> : <ChevronDown className="w-4 h-4 text-[#999]" />}
                                </button>
                                {topDropoffWardsOpen && (
                                    <div className="border-t border-[#e0e0e0]">
                                        {topDropoffWards.length > 0 && (
                                            <div className="px-3 py-2.5 border-b border-[#e0e0e0] flex items-center">
                                                <button
                                                    onClick={exportDropoff}
                                                    className="ml-auto flex items-center gap-1 text-[10px] text-[#666] hover:text-[#222] transition-colors"
                                                    title="Download the full ranked list as CSV"
                                                >
                                                    <Download className="w-3 h-3" /> CSV
                                                </button>
                                            </div>
                                        )}
                                        <div className="px-3 py-2 border-b border-[#eeeeee] flex items-center gap-2 text-[10px] text-[#999]">
                                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'hsl(28, 15%, 90%)' }} />
                                            Low
                                            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, hsl(28,15%,90%), hsl(28,95%,38%))' }} />
                                            High
                                            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'hsl(28, 95%, 38%)' }} />
                                        </div>
                                        {topDropoffWards.length === 0 ? (
                                            <div className="p-3 text-xs text-[#999] text-center">Loading dropoff data</div>
                                        ) : (
                                            <div className="divide-y divide-[#eeeeee]">
                                                {topDropoffWards.map((ward, i) => (
                                                    <div key={ward.wardKey} className="px-3 py-2 flex items-center gap-2">
                                                        <span className="text-[10px] text-[#999] num w-4 text-right flex-shrink-0">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs text-[#222] truncate">{ward.displayName}</div>
                                                            <div className="text-[10px] text-[#999] num">
                                                                {ward.general.toLocaleString()} gen · {ward.primary.toLocaleString()} pri
                                                            </div>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <div className="text-xs font-bold num text-[#a16207]">−{ward.dropoff.toLocaleString()}</div>
                                                            <div className="text-[10px] text-[#999] num">{ward.dropoffPct.toFixed(0)}% drop</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Turnout Slider ── */}
                        <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                            <button
                                onClick={() => setTurnoutOpen(o => !o)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="kicker">Turnout</span>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[#222] font-bold text-sm num">{turnoutPct}%</span>
                                    </div>
                                </div>
                                {turnoutOpen ? <ChevronUp className="w-4 h-4 text-[#999] ml-2" /> : <ChevronDown className="w-4 h-4 text-[#999] ml-2" />}
                            </button>
                            {turnoutOpen && (
                                <div className="px-4 pb-4 pt-3 border-t border-[#e0e0e0] space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div />
                                        <div className="flex items-center gap-1">
                                            {turnoutPct !== 100 && (
                                                <button onClick={() => setTurnoutPct(100)} className="text-[#999] hover:text-[#222] transition-colors ml-1" title="Reset to historical avg">
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        type="range" min={50} max={200} step={5}
                                        value={turnoutPct}
                                        onChange={e => setTurnoutPct(Number(e.target.value))}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#e8e8e8]"
                                        style={{ accentColor: '#008fd5' }}
                                    />
                                    <div className="flex justify-between text-[10px] text-[#999] num">
                                        <span>50% (low)</span>
                                        <span>100% (avg)</span>
                                        <span>200% (high)</span>
                                    </div>
                                    <div className="text-xs text-[#666] num">
                                        Expected: <span className="text-[#222] font-bold">{expectedTotal.toLocaleString()} votes</span>
                                        {turnoutPct !== 100 && (
                                            <span className={`ml-2 font-bold ${turnoutPct > 100 ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                                {turnoutPct > 100 ? '↑' : '↓'} {Math.abs(turnoutPct - 100)}% vs avg
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Registration Change ── */}
                        <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                            <button
                                onClick={() => setRegChangeOpen(o => !o)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className="kicker">Registration Change</span>
                                    <div className="flex items-center gap-1">
                                        <span className={`font-bold text-sm num ${regDelta > 0 ? 'text-[#567a3a]' : regDelta < 0 ? 'text-[#c73a1d]' : 'text-[#222]'}`}>
                                            {regDelta > 0 ? '+' : ''}{regDelta}%
                                        </span>
                                    </div>
                                </div>
                                {regChangeOpen ? <ChevronUp className="w-4 h-4 text-[#999] ml-2" /> : <ChevronDown className="w-4 h-4 text-[#999] ml-2" />}
                            </button>
                            {regChangeOpen && (
                                <div className="px-4 pb-4 pt-3 border-t border-[#e0e0e0] space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div />
                                        <div className="flex items-center gap-1">
                                            {regDelta !== 0 && (
                                                <button onClick={() => setRegDelta(0)} className="text-[#999] hover:text-[#222] transition-colors ml-1" title="Reset">
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <input
                                        type="range" min={-20} max={50} step={1}
                                        value={regDelta}
                                        onChange={e => setRegDelta(Number(e.target.value))}
                                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#e8e8e8]"
                                        style={{ accentColor: regDelta >= 0 ? '#6d904f' : '#fc4f30' }}
                                    />
                                    <div className="flex justify-between text-[10px] text-[#999] num">
                                        <span>−20%</span>
                                        <span>0%</span>
                                        <span>+50%</span>
                                    </div>
                                    <div className="text-xs text-[#999]">
                                        Models voter registration growth/decline since last comparable election.
                                        {regDelta !== 0 && (
                                            <span className="block mt-0.5 text-[#666] num">
                                                Adds <span className="text-[#222] font-bold">{(applyMultipliers(baseline, turnoutPct, regDelta) - applyMultipliers(baseline, turnoutPct, 0) > 0 ? '+' : '')}{(applyMultipliers(baseline, turnoutPct, regDelta) - applyMultipliers(baseline, turnoutPct, 0)).toLocaleString()}</span> votes vs turnout-only estimate.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Race Settings ── */}
                        <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                            <button
                                onClick={() => setRaceSettingsOpen(o => !o)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                            >
                                <span className="kicker">Race Settings</span>
                                {raceSettingsOpen ? <ChevronUp className="w-4 h-4 text-[#999]" /> : <ChevronDown className="w-4 h-4 text-[#999]" />}
                            </button>
                            {raceSettingsOpen && (
                                <div className="px-4 pb-4 pt-3 border-t border-[#e0e0e0] space-y-3">
                                    <div>
                                        <div className="text-[10px] text-[#999] font-bold uppercase tracking-[0.06em] mb-1.5">Candidates in Race</div>
                                        <div className="flex gap-1">
                                            {[2, 3].map(n => (
                                                <button
                                                    key={n}
                                                    onClick={() => setNumCandidates(n)}
                                                    className={`px-3 py-1.5 rounded-[3px] text-xs font-bold transition-colors ${
                                                        numCandidates === n
                                                            ? 'bg-[#222] text-white border border-[#222]'
                                                            : 'bg-white text-[#666] border border-[#cccccc] hover:text-[#222] hover:border-[#999]'
                                                    }`}
                                                >
                                                    {n === 2 ? '2-way' : '3-way'}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-1.5 text-[10px] text-[#999]">
                                            {numCandidates === 2 ? 'Head-to-head: exact majority required' : '3-way plurality: win threshold is an estimate'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Win Number Card ── */}
                        <div className="border border-[#e0e0e0] border-t-2 border-t-[#222] rounded-[3px] p-4 bg-white">
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="kicker">
                                    Win Number{winResult.isEstimate ? ' (est.)' : ''}
                                </span>
                            </div>
                            <div className="text-4xl font-bold num text-[#222] mb-2">
                                {winResult.winNumber.toLocaleString()}
                            </div>
                            <div className="text-xs text-[#666] leading-relaxed font-mono bg-[#f7f7f7] rounded-[3px] px-3 py-2">
                                {winResult.explanation}
                            </div>
                            {winResult.isEstimate && (
                                <div className="mt-2 text-[10px] text-[#999] leading-relaxed">
                                    In a {numCandidates}-way plurality race, actual win threshold varies.
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-[#e0e0e0] flex justify-between text-xs text-[#999] num">
                                <span>Expected total: {expectedTotal.toLocaleString()}</span>
                                <span>{((winResult.winNumber / expectedTotal) * 100).toFixed(1)}% of expected</span>
                            </div>
                        </div>

                        {/* ── Map Legend (for PROJECTION mode) ── */}
                        {simulateOverlayMode === 'PROJECTION' && (
                            <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                                <button
                                    onClick={() => setMapLegendOpen(o => !o)}
                                    className="w-full p-3 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                                >
                                    <div className="kicker">Map Legend</div>
                                    {mapLegendOpen ? <ChevronUp className="w-4 h-4 text-[#999]" /> : <ChevronDown className="w-4 h-4 text-[#999]" />}
                                </button>
                                {mapLegendOpen && (
                                    <div className="px-3 pb-3 border-t border-[#e0e0e0] pt-2 space-y-2">
                                        <div className="space-y-1.5 text-xs text-[#666]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 flex-shrink-0 bg-[#6d904f]" />
                                                High-turnout wards (historically)
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 flex-shrink-0 bg-[#fc4f30]" />
                                                Low-turnout wards (historically)
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 flex-shrink-0 bg-[#ececec] border border-[#cccccc]" />
                                                Outside selected district
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-[#999]">
                                            Relative turnout within the district across {selectedDistrict.electionsCount} past election{selectedDistrict.electionsCount !== 1 ? 's' : ''}.
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── What If Scenario ── */}
                        <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                            <button
                                onClick={() => setWhatIfOpen(o => !o)}
                                className="w-full p-4 flex items-center justify-between hover:bg-[#f7f7f7] transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FlaskConical className="w-3.5 h-3.5 text-[#a16207]" />
                                    <span className="text-sm font-bold text-[#222]">What If Scenario</span>
                                    {whatIfOpen && whatIfRace && (
                                        <span className="text-[10px] font-bold text-[#a16207] border border-[#e5ae38] px-1.5 py-0.5 rounded-[2px]">ACTIVE</span>
                                    )}
                                </div>
                                {whatIfOpen ? <ChevronUp className="w-4 h-4 text-[#999]" /> : <ChevronDown className="w-4 h-4 text-[#999]" />}
                            </button>

                            {whatIfOpen && (
                                <div className="px-4 pb-4 space-y-4 border-t border-[#e0e0e0] pt-3">
                                    <p className="text-xs text-[#999]">
                                        Adjust ward-level turnout to see margin impact in real time. Click any ward on the map to add a per-ward slider.
                                    </p>

                                    {/* Past race selector */}
                                    <div>
                                        <div className="text-xs text-[#666] font-bold mb-1">Past race</div>
                                        <select
                                            className="w-full bg-white text-[#222] text-xs rounded-[3px] px-2 py-2 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                                            value={whatIfRaceKey}
                                            onChange={e => { setWhatIfRaceKey(e.target.value); setWardList([]); setYourCandidate(''); }}
                                        >
                                            <option value="">Select an election</option>
                                            {allElections.map(e => {
                                                const key = `${e.electionId}|${e.raceId}`;
                                                const year = e.electionDate.slice(0, 4);
                                                const totalVotes = Array.from(e.wardResults.values()).reduce((s, w) => s + w.totalVotes, 0);
                                                return (
                                                    <option key={key} value={key}>
                                                        {year} — {e.raceName} ({totalVotes.toLocaleString()} votes)
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    {whatIfRace && (
                                        <>
                                            {/* ── Feature 3: Your Candidate picker ── */}
                                            <div>
                                                <div className="text-xs text-[#666] font-bold mb-1">Your candidate</div>
                                                <select
                                                    className="w-full bg-white text-[#222] text-xs rounded-[3px] px-2 py-2 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                                                    value={yourCandidate}
                                                    onChange={e => setYourCandidate(e.target.value)}
                                                >
                                                    <option value="">Auto — top candidate (by vote share)</option>
                                                    {whatIfCandidateNames.map(name => (
                                                        <option key={name} value={name}>{name}</option>
                                                    ))}
                                                </select>
                                                <div className="text-[10px] text-[#999] mt-1">
                                                    Used for margin impact labels on ward sliders below.
                                                </div>
                                            </div>

                                            {/* Global multiplier */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-[#666] font-bold">Global turnout adjustment</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[#222] font-bold text-sm num">{globalWhatIfMult}%</span>
                                                        {globalWhatIfMult !== 100 && (
                                                            <button onClick={() => setGlobalWhatIfMult(100)} className="text-[#999] hover:text-[#222] ml-1" title="Reset">
                                                                <RotateCcw className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <input
                                                    type="range" min={50} max={200} step={5}
                                                    value={globalWhatIfMult}
                                                    onChange={e => setGlobalWhatIfMult(Number(e.target.value))}
                                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#e8e8e8]"
                                                    style={{ accentColor: '#e5ae38' }}
                                                />
                                                <div className="text-[10px] text-[#999] num flex justify-between">
                                                    <span>50%</span><span>100%</span><span>200%</span>
                                                </div>
                                            </div>

                                            {/* Per-ward overrides */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-[#666] font-bold">Ward overrides</span>
                                                    {wardList.length > 0 && (
                                                        <button
                                                            onClick={() => setWardList([])}
                                                            className="text-[10px] text-[#999] hover:text-[#c73a1d] transition-colors"
                                                        >
                                                            Clear all
                                                        </button>
                                                    )}
                                                </div>

                                                {wardList.length === 0 ? (
                                                    <div className="text-xs text-[#999] text-center py-3 border border-dashed border-[#cccccc] rounded-[3px]">
                                                        Click any ward on the map to add it here
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {wardList.map((ward, i) => {
                                                            // ── Feature 3: Margin impact label ──
                                                            const wardResult = whatIfRace.wardResults.get(ward.wardKey);
                                                            let marginLabel: { votes: number; pts: number } | null = null;
                                                            if (wardResult && ward.multiplier !== 100 && projectedTotal > 0 && wardResult.totalVotes > 0) {
                                                                const deltaVotes = Math.round(wardResult.totalVotes * (ward.multiplier - 100) / 100);
                                                                const sorted = [...wardResult.candidates].sort((a, b) => b.votes - a.votes);
                                                                let marginFactor = 0;
                                                                if (yourCandidate) {
                                                                    const yourResult = wardResult.candidates.find(c => c.name.trim() === yourCandidate);
                                                                    const topOpponent = wardResult.candidates
                                                                        .filter(c => c.name.trim() !== yourCandidate)
                                                                        .sort((a, b) => b.votes - a.votes)[0];
                                                                    const yourShare = yourResult ? yourResult.votes / wardResult.totalVotes : 0;
                                                                    const oppShare = topOpponent ? topOpponent.votes / wardResult.totalVotes : 0;
                                                                    marginFactor = yourShare - oppShare;
                                                                } else if (sorted.length >= 2) {
                                                                    marginFactor = (sorted[0].votes - sorted[1].votes) / wardResult.totalVotes;
                                                                }
                                                                const marginVoteDelta = Math.round(deltaVotes * marginFactor);
                                                                const marginPts = marginVoteDelta / projectedTotal * 100;
                                                                marginLabel = { votes: deltaVotes, pts: marginPts };
                                                            }

                                                            return (
                                                                <div key={ward.wardKey} className="bg-[#f7f7f7] border border-[#e0e0e0] rounded-[3px] p-2.5">
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <span className="text-xs text-[#222] truncate flex-1">{ward.label}</span>
                                                                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                                                            <span className="text-xs font-bold num text-[#a16207]">{ward.multiplier}%</span>
                                                                            <button
                                                                                onClick={() => setWardList(prev => prev.filter((_, idx) => idx !== i))}
                                                                                className="text-[#999] hover:text-[#c73a1d] transition-colors"
                                                                            >
                                                                                <X className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <input
                                                                        type="range" min={0} max={200} step={5}
                                                                        value={ward.multiplier}
                                                                        onChange={e => setWardList(prev => prev.map((w, idx) =>
                                                                            idx === i ? { ...w, multiplier: Number(e.target.value) } : w
                                                                        ))}
                                                                        className="w-full h-1 rounded-full appearance-none cursor-pointer bg-[#e8e8e8]"
                                                                        style={{ accentColor: '#e5ae38' }}
                                                                    />
                                                                    {/* ── Feature 3: Margin impact display ── */}
                                                                    {marginLabel !== null && (
                                                                        <div className={`mt-1.5 text-[10px] font-mono px-1.5 py-1 rounded-[2px] ${
                                                                            marginLabel.votes >= 0 ? 'bg-[#eef4e8] text-[#567a3a]' : 'bg-[#fdeae5] text-[#c73a1d]'
                                                                        }`}>
                                                                            {marginLabel.votes >= 0 ? '+' : ''}{marginLabel.votes.toLocaleString()} votes
                                                                            {' · '}margin {marginLabel.pts >= 0 ? '+' : ''}{marginLabel.pts.toFixed(1)} pts
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Adjusted results summary */}
                                            {whatIfCandidateTotals.length > 0 && (
                                                <div className="bg-[#f7f7f7] border border-[#e0e0e0] rounded-[3px] p-3 space-y-2">
                                                    <div className="text-xs text-[#666] font-bold mb-2">Adjusted Result</div>
                                                    {whatIfCandidateTotals.map((c, i) => {
                                                        const diff = c.adjusted - c.original;
                                                        const isWinner = i === 0;
                                                        const isYours = yourCandidate && c.name.trim() === yourCandidate;
                                                        return (
                                                            <div key={c.name} className={`${isWinner ? 'text-[#222]' : 'text-[#666]'}`}>
                                                                <div className="flex justify-between items-baseline text-xs mb-1">
                                                                    <span className="font-medium truncate flex-1">
                                                                        {isWinner ? '▲ ' : '\u00a0\u00a0'}
                                                                        {c.name}
                                                                        {isYours && <span className="ml-1 text-[9px] font-bold text-[#00729c] border border-[#008fd5] px-1 py-0.5 rounded-[2px]">YOU</span>}
                                                                    </span>
                                                                    <div className="ml-2 shrink-0 flex items-baseline gap-1.5">
                                                                        <span className="font-bold num">{c.adjusted.toLocaleString()}</span>
                                                                        <span className={`text-[10px] num ${diff > 0 ? 'text-[#567a3a]' : diff < 0 ? 'text-[#c73a1d]' : 'text-[#999]'}`}>
                                                                            {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-1 bg-[#e8e8e8] overflow-hidden">
                                                                    <div
                                                                        className="h-full transition-all duration-300"
                                                                        style={{
                                                                            width: `${whatIfCandidateTotals[0].adjusted > 0 ? (c.adjusted / whatIfCandidateTotals[0].adjusted) * 100 : 0}%`,
                                                                            background: isYours ? '#008fd5' : isWinner ? '#6d904f' : '#8b8b8b',
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {whatIfCandidateTotals.length >= 2 && (
                                                        <div className="pt-2 border-t border-[#e0e0e0] text-xs text-[#999] flex justify-between">
                                                            <span>Margin (1st vs 2nd)</span>
                                                            <span className={`font-bold num ${whatIfCandidateTotals[0].adjusted > whatIfCandidateTotals[1].adjusted ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                                                                {(whatIfCandidateTotals[0].adjusted - whatIfCandidateTotals[1].adjusted) > 0 ? '+' : ''}
                                                                {(whatIfCandidateTotals[0].adjusted - whatIfCandidateTotals[1].adjusted).toLocaleString()} votes
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function findWardKeyForClicked(
    wardResults: Map<string, { candidates: { name: string; votes: number }[]; totalVotes: number; topCandidate: string; margin: number }>,
    clicked: { name: string; num: string },
): string | null {
    const num = parseInt(clicked.num).toString();
    const nameLower = clicked.name.toLowerCase();

    for (const key of wardResults.keys()) {
        if (!key.endsWith(`-${num}`)) continue;
        const keyCore = key.replace(/-\d+$/, '').replace(/-city|-town|-village/, '').replace(/-/g, ' ');
        if (nameLower.includes(keyCore) || keyCore.split(' ').some(w => nameLower.includes(w))) {
            return key;
        }
    }
    return null;
}
