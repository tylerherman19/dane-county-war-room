'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, X, FlaskConical, Target, TrendingDown, Layers } from 'lucide-react';
import {
    DistrictProjection,
    SimProjectionUpdate,
    SimulateLayerMode,
    DormantPoolEntry,
    DropoffEntry,
    computeWinNumber,
    applyMultipliers,
    computeProjectionData,
    computeWhatIfProjectionData,
    computeDormantPool,
    computePrimaryDropoff,
    toPrecinctResults,
    loadDistrictProjections,
} from '@/lib/projections-data';
import { HistoricalRaceData, fetchHistoricalData } from '@/lib/historical-api-data';

interface SimulationsPanelProps {
    // Ward clicked on map in What If mode (lifted from page.tsx)
    whatIfClickedWard: { name: string; num: string } | null;
    onClearWhatIfClickedWard: () => void;
    // Callback to push rendering data up to MapWrapper via page.tsx
    onProjectionUpdate: (update: SimProjectionUpdate) => void;
}

function getPartyColor(party: string | undefined): string {
    const p = (party || '').toLowerCase();
    if (p.includes('democrat')) return '#3b82f6';
    if (p.includes('republican')) return '#ef4444';
    if (p.includes('green')) return '#22c55e';
    if (p.includes('libertarian')) return '#eab308';
    return '#64748b';
}

// Priority badge thresholds for top 15 wards (rank 1-5 HIGH, 6-10 MED, 11-15 LOW)
function getPriorityBadge(rank: number): { label: string; bg: string; text: string } {
    if (rank <= 5) return { label: 'HIGH', bg: '#78350f', text: '#fbbf24' };
    if (rank <= 10) return { label: 'MED', bg: '#1e3a5f', text: '#60a5fa' };
    return { label: 'LOW', bg: '#1e293b', text: '#94a3b8' };
}

// Friendly display name from a ward key like "madison-city-45"
function wardKeyToDisplay(wardKey: string): string {
    const typePatterns = [
        { suffix: '-city-', label: 'City of' },
        { suffix: '-town-', label: 'Town of' },
        { suffix: '-village-', label: 'Village of' },
    ];
    for (const { suffix, label } of typePatterns) {
        const idx = wardKey.lastIndexOf(suffix);
        if (idx !== -1) {
            const name = wardKey.slice(0, idx).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const wardNum = wardKey.slice(idx + suffix.length);
            return `${label} ${name} Wd. ${wardNum}`;
        }
    }
    return wardKey;
}

export default function SimulationsPanel({ whatIfClickedWard, onClearWhatIfClickedWard, onProjectionUpdate }: SimulationsPanelProps) {
    // ── District data (loaded once from historical JSON) ──────────────────
    const [mayorProjection, setMayorProjection] = useState<DistrictProjection | null>(null);
    const [alderDistricts, setAlderDistricts] = useState<DistrictProjection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // ── Dormant pool & dropoff data ────────────────────────────────────────
    const [dormantPoolData, setDormantPoolData] = useState<Record<string, DormantPoolEntry>>({});
    const [dropoffData, setDropoffData] = useState<Record<string, DropoffEntry>>({});

    // ── Core simulation inputs ─────────────────────────────────────────────
    const [turnoutPct, setTurnoutPct] = useState(100);      // 50–200
    const [numCandidates, setNumCandidates] = useState(2);  // 2–5
    const [regDelta, setRegDelta] = useState(0);            // -20 to +50
    const [selectedKey, setSelectedKey] = useState<string>('Mayor'); // 'Mayor' | 'Alder-N'

    // ── Map layer mode ─────────────────────────────────────────────────────
    const [simulateLayerMode, setSimulateLayerMode] = useState<SimulateLayerMode>('PROJECTION');

    // ── Canvass priority panel ─────────────────────────────────────────────
    const [canvassPanelOpen, setCanvassPanelOpen] = useState(false);

    // ── What If state ──────────────────────────────────────────────────────
    const [whatIfOpen, setWhatIfOpen] = useState(false);
    const [whatIfRaceKey, setWhatIfRaceKey] = useState<string>('');
    const [globalWhatIfMult, setGlobalWhatIfMult] = useState(100); // %
    const [wardList, setWardList] = useState<Array<{ wardKey: string; label: string; multiplier: number }>>([]);

    // Load historical data on mount
    useEffect(() => {
        Promise.all([
            loadDistrictProjections(),
            fetchHistoricalData(),
        ]).then(([{ mayor, alderDistricts }, histData]) => {
            setMayorProjection(mayor);
            setAlderDistricts(alderDistricts);
            setDormantPoolData(computeDormantPool(histData as any));
            setDropoffData(computePrimaryDropoff(histData as any));
            setIsLoading(false);
        });
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

    // ── Handle map ward clicks (add to What If ward list) ─────────────────
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

    // ── Derived values ─────────────────────────────────────────────────────
    const baseline = selectedDistrict?.historicalAvg ?? 0;
    const expectedTotal = applyMultipliers(baseline, turnoutPct, regDelta);
    const winResult = computeWinNumber(expectedTotal, numCandidates);
    const gap = expectedTotal - winResult.winNumber;
    const isAnyNonDefault = turnoutPct !== 100 || regDelta !== 0 || numCandidates !== 2;

    // Reset all simulation inputs
    const handleResetAll = useCallback(() => {
        setTurnoutPct(100);
        setRegDelta(0);
        setNumCandidates(2);
        setWhatIfOpen(false);
        setWhatIfRaceKey('');
        setGlobalWhatIfMult(100);
        setWardList([]);
    }, []);

    // ── Compute top 15 wards by dormant pool size ──────────────────────────
    const top15Wards: Array<{ wardKey: string; entry: DormantPoolEntry; rank: number }> = Object.entries(dormantPoolData)
        .filter(([_, e]) => e.dormant > 0)
        .sort(([, a], [, b]) => b.dormant - a.dormant)
        .slice(0, 15)
        .map(([wardKey, entry], i) => ({ wardKey, entry, rank: i + 1 }));

    // Compute map projection update (emitted via callback)
    const buildUpdate = useCallback((): SimProjectionUpdate => {
        if (!selectedDistrict) {
            return {
                projectionData: {},
                highlightedWardKeys: new Set(),
                whatIfPrecinctResults: null,
                whatIfMode: false,
                simulateLayerMode,
                dormantPoolData,
                dropoffData,
            };
        }

        const highlightedWardKeys = new Set(selectedDistrict.wardKeys);

        if (whatIfOpen && whatIfRace) {
            const perWardOverrides: Record<string, number> = {};
            wardList.forEach((w: { wardKey: string; label: string; multiplier: number }) => { perWardOverrides[w.wardKey] = w.multiplier; });

            const projectionData = computeWhatIfProjectionData(whatIfRace.wardResults, globalWhatIfMult, perWardOverrides);
            const whatIfPrecinctResults = toPrecinctResults(whatIfRace.wardResults, globalWhatIfMult, perWardOverrides);
            return { projectionData, highlightedWardKeys, whatIfPrecinctResults, whatIfMode: true, simulateLayerMode, dormantPoolData, dropoffData };
        }

        const projectionData = computeProjectionData(selectedDistrict);
        return { projectionData, highlightedWardKeys, whatIfPrecinctResults: null, whatIfMode: false, simulateLayerMode, dormantPoolData, dropoffData };
    }, [selectedDistrict, whatIfOpen, whatIfRace, globalWhatIfMult, wardList, simulateLayerMode, dormantPoolData, dropoffData]);

    // Push update to parent whenever relevant state changes
    useEffect(() => {
        onProjectionUpdate(buildUpdate());
    }, [buildUpdate]);

    // Reset What If ward list when race changes
    useEffect(() => {
        setWardList([]);
        setWhatIfRaceKey('');
        setGlobalWhatIfMult(100);
    }, [selectedKey]);

    // ── What If adjusted results (for display) ────────────────────────────
    const whatIfCandidateTotals: { name: string; original: number; adjusted: number }[] = [];
    if (whatIfOpen && whatIfRace) {
        const perWardOverrides: Record<string, number> = {};
        wardList.forEach((w: { wardKey: string; label: string; multiplier: number }) => { perWardOverrides[w.wardKey] = w.multiplier; });

        const candidateTotals: Record<string, { original: number; adjusted: number }> = {};
        for (const [wardKey, wr] of whatIfRace.wardResults.entries()) {
            const m = (perWardOverrides[wardKey] ?? globalWhatIfMult) / 100;
            for (const c of wr.candidates) {
                if (!candidateTotals[c.name]) candidateTotals[c.name] = { original: 0, adjusted: 0 };
                candidateTotals[c.name].original += c.votes;
                candidateTotals[c.name].adjusted += Math.round(c.votes * m);
            }
        }
        for (const [name, totals] of Object.entries(candidateTotals)) {
            whatIfCandidateTotals.push({ name, ...totals });
        }
        whatIfCandidateTotals.sort((a, b) => b.adjusted - a.adjusted);
    }

    // Pre-compute What If total county votes (for margin impact calculation)
    const whatIfTotalCountyVotes = whatIfRace
        ? Array.from(whatIfRace.wardResults.values()).reduce((s, w) => s + w.totalVotes, 0)
        : 0;

    if (isLoading) {
        return (
            <div className="h-full bg-slate-900 border-l border-slate-800 p-5 space-y-4 animate-pulse">
                <div className="h-8 bg-slate-800 rounded-lg" />
                <div className="h-32 bg-slate-800 rounded-xl" />
                <div className="h-24 bg-slate-800 rounded-xl" />
                <div className="h-24 bg-slate-800 rounded-xl" />
            </div>
        );
    }

    const hasMayorData = !!mayorProjection;
    const hasAlderData = alderDistricts.length > 0;

    return (
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">

            {/* ── Sticky Win Number Header Bar ── */}
            {selectedDistrict && (
                <div className="shrink-0 px-4 pt-3 pb-3 border-b border-slate-700/50 bg-slate-900">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                                Win Number {winResult.isEstimate ? '(est.)' : ''}
                            </span>
                        </div>
                        {isAnyNonDefault && (
                            <button
                                onClick={handleResetAll}
                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                                title="Reset all simulation inputs"
                            >
                                <RotateCcw className="w-2.5 h-2.5" />
                                Reset
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-xl font-black text-white">{winResult.winNumber.toLocaleString()}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Win Target</div>
                        </div>
                        <div>
                            <div className="text-xl font-black text-slate-300">{expectedTotal.toLocaleString()}</div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Projected</div>
                        </div>
                        <div>
                            <div className={`text-xl font-black ${gap >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {gap >= 0 ? '+' : ''}{gap.toLocaleString()}
                            </div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wide">Gap</div>
                        </div>
                    </div>
                    {gap < 0 && (
                        <div className="mt-1.5 text-[9px] text-red-400/70 text-center">
                            Need {Math.abs(gap).toLocaleString()} more votes to win
                        </div>
                    )}
                    {gap >= 0 && (
                        <div className="mt-1.5 text-[9px] text-green-400/70 text-center">
                            {gap.toLocaleString()} votes ahead of win number
                        </div>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* ── Header ── */}
                <div className="flex items-center gap-2 mb-1">
                    <FlaskConical className="w-4 h-4 text-violet-400" />
                    <h2 className="text-sm font-bold text-white">Pre-Election Simulation</h2>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                    Game-plan turnout and field strategy. No live results — pure projection.
                </p>

                {/* ── Race Selector ── */}
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Race</div>
                    <div className="flex flex-wrap gap-1">
                        {hasMayorData && (
                            <button
                                onClick={() => setSelectedKey('Mayor')}
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${selectedKey === 'Mayor' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
                            >
                                Mayor
                            </button>
                        )}
                        {hasAlderData && alderDistricts.map(d => (
                            <button
                                key={d.districtNum}
                                onClick={() => setSelectedKey(`Alder-${d.districtNum}`)}
                                className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${selectedKey === `Alder-${d.districtNum}` ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
                            >
                                D{d.districtNum}
                            </button>
                        ))}
                        {!hasMayorData && !hasAlderData && (
                            <div className="text-xs text-amber-400 py-1">
                                No historical data found. Run <code className="font-mono bg-slate-800 px-1 rounded">npm run build:historical</code> to fetch data.
                            </div>
                        )}
                    </div>
                    {selectedDistrict && (
                        <div className="mt-2 text-xs text-slate-500">
                            {selectedDistrict.label} · avg {selectedDistrict.historicalAvg.toLocaleString()} votes ({selectedDistrict.electionsCount} election{selectedDistrict.electionsCount !== 1 ? 's' : ''} averaged)
                        </div>
                    )}
                </div>

                {/* ── Map Layer Selector ── */}
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
                    <div className="flex items-center gap-1.5 mb-2">
                        <Layers className="w-3 h-3 text-slate-400" />
                        <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Map Layer</div>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={() => setSimulateLayerMode('PROJECTION')}
                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all text-center ${simulateLayerMode === 'PROJECTION' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
                        >
                            Turnout
                        </button>
                        <button
                            onClick={() => { setSimulateLayerMode('CANVASS_PRIORITY'); setCanvassPanelOpen(true); }}
                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all text-center ${simulateLayerMode === 'CANVASS_PRIORITY' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
                            title="Avg general election turnout minus avg primary turnout per ward"
                        >
                            Canvass
                        </button>
                        <button
                            onClick={() => setSimulateLayerMode('PRIMARY_DROPOFF')}
                            className={`flex-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all text-center ${simulateLayerMode === 'PRIMARY_DROPOFF' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}
                            title="Most recent spring general minus most recent spring primary turnout"
                        >
                            Dropoff
                        </button>
                    </div>
                    <div className="mt-1.5 text-[9px] text-slate-600">
                        {simulateLayerMode === 'PROJECTION' && 'Historical turnout within selected district (green = high, red = low)'}
                        {simulateLayerMode === 'CANVASS_PRIORITY' && 'Avg spring general − avg spring primary. Darker purple = more dormant voters.'}
                        {simulateLayerMode === 'PRIMARY_DROPOFF' && 'Most recent spring general − spring primary. Darker blue = larger dropoff.'}
                    </div>
                </div>

                {/* ── Canvass Priority Panel ── */}
                {simulateLayerMode === 'CANVASS_PRIORITY' && top15Wards.length > 0 && (
                    <div className="bg-slate-800/40 rounded-xl border border-violet-800/30 overflow-hidden">
                        <button
                            onClick={() => setCanvassPanelOpen(o => !o)}
                            className="w-full p-3 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <TrendingDown className="w-3.5 h-3.5 text-violet-400" />
                                <span className="text-xs font-semibold text-white">Top Canvass Wards</span>
                                <span className="text-[9px] text-violet-400 bg-violet-400/10 px-1.5 py-0.5 rounded-full">TOP 15</span>
                            </div>
                            {canvassPanelOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </button>
                        {canvassPanelOpen && (
                            <div className="border-t border-slate-700/40">
                                <div className="px-3 pb-1 pt-2 text-[9px] text-slate-500">
                                    Ranked by dormant voter pool size (avg spring general − avg spring primary)
                                </div>
                                <div className="divide-y divide-slate-700/30 max-h-64 overflow-y-auto">
                                    {top15Wards.map(({ wardKey, entry, rank }) => {
                                        const badge = getPriorityBadge(rank);
                                        return (
                                            <div key={wardKey} className="px-3 py-2 flex items-center gap-2">
                                                <span className="text-[9px] text-slate-600 w-4 shrink-0">{rank}.</span>
                                                <span
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                                                    style={{ background: badge.bg, color: badge.text }}
                                                >
                                                    {badge.label}
                                                </span>
                                                <span className="text-[10px] text-slate-300 flex-1 truncate" title={wardKeyToDisplay(wardKey)}>
                                                    {wardKeyToDisplay(wardKey)}
                                                </span>
                                                <span className="text-[10px] font-semibold text-violet-400 shrink-0">
                                                    ~{entry.dormant.toLocaleString()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {selectedDistrict && (
                    <>
                        {/* ── Turnout Slider ── */}
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Turnout</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-white font-bold text-sm">{turnoutPct}%</span>
                                    {turnoutPct !== 100 && (
                                        <button onClick={() => setTurnoutPct(100)} className="text-slate-500 hover:text-slate-300 transition-colors ml-1" title="Reset to historical avg">
                                            <RotateCcw className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <input
                                type="range" min={50} max={200} step={5}
                                value={turnoutPct}
                                onChange={e => setTurnoutPct(Number(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: '#7c3aed' }}
                            />
                            <div className="flex justify-between text-[10px] text-slate-600">
                                <span>50% (low)</span>
                                <span>100% (avg)</span>
                                <span>200% (high)</span>
                            </div>
                            <div className="text-xs text-slate-400">
                                Expected: <span className="text-white font-semibold">{expectedTotal.toLocaleString()} votes</span>
                                {turnoutPct !== 100 && (
                                    <span className={`ml-2 font-medium ${turnoutPct > 100 ? 'text-green-400' : 'text-red-400'}`}>
                                        {turnoutPct > 100 ? '↑' : '↓'} {Math.abs(turnoutPct - 100)}% vs avg
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Registration Change ── */}
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Registration Change</span>
                                <div className="flex items-center gap-1">
                                    <span className={`font-bold text-sm ${regDelta > 0 ? 'text-green-400' : regDelta < 0 ? 'text-red-400' : 'text-white'}`}>
                                        {regDelta > 0 ? '+' : ''}{regDelta}%
                                    </span>
                                    {regDelta !== 0 && (
                                        <button onClick={() => setRegDelta(0)} className="text-slate-500 hover:text-slate-300 transition-colors ml-1" title="Reset">
                                            <RotateCcw className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <input
                                type="range" min={-20} max={50} step={1}
                                value={regDelta}
                                onChange={e => setRegDelta(Number(e.target.value))}
                                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: regDelta >= 0 ? '#22c55e' : '#ef4444' }}
                            />
                            <div className="flex justify-between text-[10px] text-slate-600">
                                <span>−20%</span>
                                <span>0%</span>
                                <span>+50%</span>
                            </div>
                            <div className="text-xs text-slate-500">
                                Models voter registration growth/decline since last comparable election.
                                {regDelta !== 0 && (
                                    <span className="block mt-0.5 text-slate-400">
                                        Adds <span className="text-white font-medium">{(applyMultipliers(baseline, turnoutPct, regDelta) - applyMultipliers(baseline, turnoutPct, 0) > 0 ? '+' : '')}{(applyMultipliers(baseline, turnoutPct, regDelta) - applyMultipliers(baseline, turnoutPct, 0)).toLocaleString()}</span> votes vs turnout-only estimate.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* ── Number of Candidates ── */}
                        <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/40 space-y-3">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider">Candidates in Race</div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setNumCandidates(n => Math.max(2, n - 1))}
                                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg flex items-center justify-center transition-colors"
                                    disabled={numCandidates <= 2}
                                >−</button>
                                <span className="text-2xl font-black text-white w-8 text-center">{numCandidates}</span>
                                <button
                                    onClick={() => setNumCandidates(n => Math.min(5, n + 1))}
                                    className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold text-lg flex items-center justify-center transition-colors"
                                    disabled={numCandidates >= 5}
                                >+</button>
                                <span className="text-xs text-slate-500 ml-1">
                                    {numCandidates === 2 ? 'head-to-head' : `${numCandidates}-way race`}
                                </span>
                            </div>
                        </div>

                        {/* ── Win Number Card (detailed) ── */}
                        <div
                            className="rounded-xl p-4 border"
                            style={{ background: 'linear-gradient(135deg, #4c1d9522 0%, #0f172a 100%)', borderColor: '#7c3aed44' }}
                        >
                            <div className="flex items-baseline justify-between mb-1">
                                <span className="text-xs font-bold uppercase tracking-widest text-violet-400">
                                    Win Number{winResult.isEstimate ? ' (est.)' : ''}
                                </span>
                            </div>
                            <div className="text-4xl font-black text-white mb-2">
                                {winResult.winNumber.toLocaleString()}
                            </div>
                            <div className="text-xs text-slate-400 leading-relaxed font-mono bg-slate-900/60 rounded-lg px-3 py-2">
                                {winResult.explanation}
                            </div>
                            {winResult.isEstimate && (
                                <div className="mt-2 text-[10px] text-slate-500 leading-relaxed">
                                    In a {numCandidates}-way plurality race, actual win threshold varies.
                                    Opponents could split unevenly — you may win with fewer, or need more.
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-slate-700/50 flex justify-between text-xs text-slate-500">
                                <span>Expected total: {expectedTotal.toLocaleString()}</span>
                                <span>{((winResult.winNumber / expectedTotal) * 100).toFixed(1)}% of expected</span>
                            </div>
                        </div>

                        {/* ── Map Legend ── */}
                        <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
                            <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Map Legend</div>
                            {simulateLayerMode === 'PROJECTION' && (
                                <div className="space-y-1.5 text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-green-500" />
                                        High-turnout wards (historically)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-red-500" />
                                        Low-turnout wards (historically)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-slate-800 border border-slate-700" />
                                        Outside selected district
                                    </div>
                                    <div className="mt-2 text-[10px] text-slate-600">
                                        Shows relative turnout within the district across {selectedDistrict.electionsCount} past election{selectedDistrict.electionsCount !== 1 ? 's' : ''}.
                                    </div>
                                </div>
                            )}
                            {simulateLayerMode === 'CANVASS_PRIORITY' && (
                                <div className="space-y-1.5 text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'hsl(270, 95%, 30%)' }} />
                                        Large dormant voter pool (high priority)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'hsl(270, 60%, 65%)' }} />
                                        Moderate dormant pool
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-slate-800 border border-slate-700" />
                                        Minimal or no dormant pool data
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-600">
                                        Darker = avg spring general turnout − avg spring primary turnout is larger
                                    </div>
                                </div>
                            )}
                            {simulateLayerMode === 'PRIMARY_DROPOFF' && (
                                <div className="space-y-1.5 text-xs text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'hsl(220, 100%, 38%)' }} />
                                        High primary dropoff (priority canvass)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: 'hsl(220, 60%, 72%)' }} />
                                        Moderate dropoff
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-slate-800 border border-slate-700" />
                                        No data / minimal dropoff
                                    </div>
                                    <div className="mt-1 text-[10px] text-slate-600">
                                        Most recent spring general − most recent spring primary
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── What If Scenario ── */}
                        <div className="bg-slate-800/40 rounded-xl border border-slate-700/40 overflow-hidden">
                            <button
                                onClick={() => setWhatIfOpen(o => !o)}
                                className="w-full p-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-sm font-semibold text-white">What If Scenario</span>
                                    {whatIfOpen && whatIfRace && (
                                        <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                                    )}
                                </div>
                                {whatIfOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                            </button>

                            {whatIfOpen && (
                                <div className="px-4 pb-4 space-y-4 border-t border-slate-700/40 pt-3">
                                    <p className="text-xs text-slate-500">
                                        Replay a past race with adjusted turnout. Click wards on the map to add per-ward overrides.
                                    </p>

                                    {/* Past race selector */}
                                    <div>
                                        <div className="text-xs text-slate-400 font-medium mb-1">Past race</div>
                                        <select
                                            className="w-full bg-slate-800 text-slate-300 text-xs rounded-md px-2 py-2 border border-slate-600 focus:outline-none focus:border-violet-500"
                                            value={whatIfRaceKey}
                                            onChange={e => { setWhatIfRaceKey(e.target.value); setWardList([]); }}
                                        >
                                            <option value="">Select an election…</option>
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
                                            {/* Global multiplier */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-slate-400 font-medium">Global turnout adjustment</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-white font-bold text-sm">{globalWhatIfMult}%</span>
                                                        {globalWhatIfMult !== 100 && (
                                                            <button onClick={() => setGlobalWhatIfMult(100)} className="text-slate-500 hover:text-slate-300 ml-1" title="Reset">
                                                                <RotateCcw className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <input
                                                    type="range" min={50} max={200} step={5}
                                                    value={globalWhatIfMult}
                                                    onChange={e => setGlobalWhatIfMult(Number(e.target.value))}
                                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                                    style={{ accentColor: '#f59e0b' }}
                                                />
                                                <div className="text-[10px] text-slate-600 flex justify-between">
                                                    <span>50%</span><span>100%</span><span>200%</span>
                                                </div>
                                            </div>

                                            {/* Per-ward list */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-slate-400 font-medium">Ward overrides</span>
                                                    {wardList.length > 0 && (
                                                        <button
                                                            onClick={() => setWardList([])}
                                                            className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                                                        >
                                                            Clear all
                                                        </button>
                                                    )}
                                                </div>

                                                {wardList.length === 0 ? (
                                                    <div className="text-xs text-slate-600 text-center py-3 border border-dashed border-slate-700 rounded-lg">
                                                        Click any ward on the map to add it here
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        {wardList.map((ward, i) => {
                                                            const origVotes = whatIfRace.wardResults.get(ward.wardKey)?.totalVotes ?? 0;
                                                            const delta = Math.round(origVotes * (ward.multiplier / 100 - 1));
                                                            const marginImpactPts = whatIfTotalCountyVotes > 0
                                                                ? ((Math.abs(delta) / whatIfTotalCountyVotes) * 100).toFixed(1)
                                                                : '0.0';
                                                            const showImpact = ward.multiplier !== 100 && origVotes > 0;
                                                            return (
                                                                <div key={ward.wardKey} className="bg-slate-900/60 rounded-lg p-2.5">
                                                                    <div className="flex items-center justify-between mb-1.5">
                                                                        <span className="text-xs text-slate-300 truncate flex-1">{ward.label}</span>
                                                                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                                                            <span className="text-xs font-bold text-amber-400">{ward.multiplier}%</span>
                                                                            <button
                                                                                onClick={() => setWardList(prev => prev.filter((_, idx) => idx !== i))}
                                                                                className="text-slate-600 hover:text-red-400 transition-colors"
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
                                                                        className="w-full h-1 rounded-full appearance-none cursor-pointer"
                                                                        style={{ accentColor: '#f59e0b' }}
                                                                    />
                                                                    {/* Turnout surge margin impact label */}
                                                                    {showImpact && (
                                                                        <div className={`mt-1.5 text-[10px] font-medium ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                            {delta > 0 ? '+' : ''}{delta.toLocaleString()} votes · {delta > 0 ? '+' : '−'}{marginImpactPts} pt margin impact
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Adjusted results */}
                                            {whatIfCandidateTotals.length > 0 && (
                                                <div className="bg-slate-900/60 rounded-lg p-3 space-y-2">
                                                    <div className="text-xs text-slate-400 font-medium mb-2">Adjusted Result</div>
                                                    {whatIfCandidateTotals.map((c, i) => {
                                                        const diff = c.adjusted - c.original;
                                                        const isWinner = i === 0;
                                                        return (
                                                            <div key={c.name} className={`${isWinner ? 'text-white' : 'text-slate-400'}`}>
                                                                <div className="flex justify-between items-baseline text-xs mb-1">
                                                                    <span className="font-medium truncate flex-1">{isWinner ? '▲ ' : '\u00a0\u00a0'}{c.name}</span>
                                                                    <div className="ml-2 shrink-0 flex items-baseline gap-1.5">
                                                                        <span className="font-bold">{c.adjusted.toLocaleString()}</span>
                                                                        <span className={`text-[10px] ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-slate-600'}`}>
                                                                            {diff >= 0 ? '+' : ''}{diff.toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full rounded-full transition-all duration-300"
                                                                        style={{
                                                                            width: `${whatIfCandidateTotals[0].adjusted > 0 ? (c.adjusted / whatIfCandidateTotals[0].adjusted) * 100 : 0}%`,
                                                                            background: isWinner ? '#7c3aed' : '#475569',
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {whatIfCandidateTotals.length >= 2 && (
                                                        <div className="pt-2 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
                                                            <span>Margin</span>
                                                            <span className={`font-semibold ${whatIfCandidateTotals[0].adjusted > whatIfCandidateTotals[1].adjusted ? 'text-green-400' : 'text-red-400'}`}>
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

/**
 * Try to find a matching ward key in the race's wardResults for a clicked ward.
 * The clicked ward comes from GeoJSON properties (municipality name + ward number),
 * while wardResults keys are normalized (e.g. "madison-city-45").
 */
function findWardKeyForClicked(
    wardResults: Map<string, { candidates: { name: string; votes: number }[]; totalVotes: number; topCandidate: string; margin: number }>,
    clicked: { name: string; num: string },
): string | null {
    const num = parseInt(clicked.num).toString();
    const nameLower = clicked.name.toLowerCase();

    for (const key of wardResults.keys()) {
        // Key ends with the ward number
        if (!key.endsWith(`-${num}`)) continue;
        // Key contains a fragment of the municipality name
        const keyCore = key.replace(/-\d+$/, '').replace(/-city|-town|-village/, '').replace(/-/g, ' ');
        if (nameLower.includes(keyCore) || keyCore.split(' ').some(w => nameLower.includes(w))) {
            return key;
        }
    }
    return null;
}
