'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PrecinctResult, RaceResult } from '@/lib/api';
import MapOverlayControl, { OverlayMode } from './MapOverlayControl';
import { HoveredWard } from './Map';
import { isHistoricalDataLoaded, getHistoricalRaceInfo, getExpectedTotalVotes, loadHistoricalRaceById, normalizeWardName } from '@/lib/analysis-data';
import { getAvailableRacesWithOverlap, HistoricalRaceSummary } from '@/lib/historical-api-data';
import { assignCandidateColors } from '@/lib/candidate-colors';
import { getDormantPoolByWard, getDropoffByWard, DropoffInfo } from '@/lib/dormant-voter-data';

const Map = dynamic(() => import('./Map'), { ssr: false });
const DebugPanel = dynamic(() => import('./DebugPanel'), { ssr: false });

interface MapWrapperProps {
    precinctResults: PrecinctResult[];
    isLoading: boolean;
    selectedWard: { name: string; num: string } | null;
    raceResult: RaceResult | undefined;
    onReset: () => void;
    focusedCandidate: string | null;
    onCandidateReset: () => void;
    // SIMULATE mode
    simulateMode?: boolean;
    projectionData?: Record<string, number>;
    onWardClick?: (ward: { name: string; num: string }) => void;
    simulateOverlayMode?: OverlayMode;
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset, focusedCandidate, onCandidateReset, simulateMode, projectionData, onWardClick, simulateOverlayMode }: MapWrapperProps) {
    const [overlayMode, setOverlayMode] = useState<OverlayMode>('NONE');
    const [debugOpen, setDebugOpen] = useState(false);
    const [debugWardData, setDebugWardData] = useState<HoveredWard | null>(null);
    const [historicalLabel, setHistoricalLabel] = useState<string | null>(null);
    const [availableRaces, setAvailableRaces] = useState<HistoricalRaceSummary[]>([]);
    const [selectedComparisonKey, setSelectedComparisonKey] = useState<string | null>(null);
    const [isLoadingComparison, setIsLoadingComparison] = useState(false);
    const [historicalTotalVotes, setHistoricalTotalVotes] = useState<number | null>(null);

    // SIMULATE overlay data (loaded once when simulateMode is first true)
    const [dormantPoolData, setDormantPoolData] = useState<Record<string, number> | undefined>(undefined);
    const [dropoffData, setDropoffData] = useState<Record<string, DropoffInfo> | undefined>(undefined);

    useEffect(() => {
        if (!simulateMode) return;
        getDormantPoolByWard().then(setDormantPoolData).catch(() => {});
        getDropoffByWard().then(setDropoffData).catch(() => {});
    }, [simulateMode]);

    // Reset overlay + label on race change, then poll until historical data loads.
    useEffect(() => {
        setOverlayMode('NONE');
        setHistoricalLabel(null);
        setHistoricalTotalVotes(null);
        setAvailableRaces([]);
        setSelectedComparisonKey(null);
        const id = setInterval(() => {
            if (isHistoricalDataLoaded()) {
                const info = getHistoricalRaceInfo();
                if (info) setHistoricalLabel(`${info.year} ${info.name}`);
                const total = getExpectedTotalVotes();
                setHistoricalTotalVotes(total > 0 ? total : null);
                clearInterval(id);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [raceResult?.id]);

    const candidateLegend = useMemo(() => {
        if (!raceResult?.candidates?.length) return [];
        const isPresidential = raceResult.type === 'Presidential';
        const colors = assignCandidateColors(raceResult.candidates);
        return raceResult.candidates
            .filter(c => {
                if (!isPresidential) return true;
                const name = c.candidateName.trim();
                return c.party === 'Democratic' || c.party === 'Republican'
                    || name.includes('Biden') || name.includes('Harris') || name.includes('Trump');
            })
            .map(c => {
                const name = c.candidateName.trim();
                const hsl = colors[name] ?? { h: 215, s: 80, l: 55 };
                return { name, h: hsl.h, s: hsl.s, l: hsl.l };
            });
    }, [raceResult]);

    const currentWardKeys = useMemo(() => {
        const seen = new Set<string>();
        const keys: string[] = [];
        precinctResults.forEach(r => {
            const k = normalizeWardName(r.precinctName, r.wardNumber);
            if (!seen.has(k)) { seen.add(k); keys.push(k); }
        });
        return keys;
    }, [precinctResults]);

    useEffect(() => {
        if (!historicalLabel) return;
        getAvailableRacesWithOverlap(currentWardKeys).then(setAvailableRaces).catch(() => {});
    }, [historicalLabel, currentWardKeys]);

    const handleOverlayChange = useCallback((mode: OverlayMode) => {
        setOverlayMode(mode);
        onCandidateReset();
    }, [onCandidateReset]);

    const handleComparisonChange = useCallback(async (key: string) => {
        if (!key) {
            setSelectedComparisonKey(null);
            return;
        }
        const [electionId, raceId] = key.split('|');
        setSelectedComparisonKey(key);
        setIsLoadingComparison(true);
        await loadHistoricalRaceById(electionId, raceId);
        const info = getHistoricalRaceInfo();
        if (info) setHistoricalLabel(`${info.year} ${info.name}`);
        const total = getExpectedTotalVotes();
        setHistoricalTotalVotes(total > 0 ? total : null);
        setIsLoadingComparison(false);
    }, []);

    // In SIMULATE mode use the simulateOverlayMode prop; otherwise use local overlayMode
    const effectiveOverlayMode: OverlayMode = simulateMode
        ? (simulateOverlayMode ?? 'PROJECTION')
        : overlayMode;

    return (
        <div className="relative w-full h-full">
            {!simulateMode && (
                <MapOverlayControl
                    currentMode={overlayMode}
                    onChange={handleOverlayChange}
                    historicalLabel={historicalLabel}
                    availableRaces={availableRaces}
                    selectedComparisonKey={selectedComparisonKey}
                    onComparisonChange={handleComparisonChange}
                    isLoadingComparison={isLoadingComparison}
                    historicalTotalVotes={historicalTotalVotes}
                    candidateLegend={candidateLegend}
                    currentRaceType={raceResult?.type}
                />
            )}
            <Map
                precinctResults={precinctResults}
                isLoading={isLoading}
                selectedWard={selectedWard}
                raceResult={raceResult}
                onReset={onReset}
                overlayMode={effectiveOverlayMode}
                onWardHover={setDebugWardData}
                historicalLabel={historicalLabel}
                focusedCandidate={focusedCandidate}
                projectionData={simulateMode ? projectionData : undefined}
                onWardClick={simulateMode ? onWardClick : undefined}
                dormantPoolData={simulateMode ? dormantPoolData : undefined}
                dropoffData={simulateMode ? dropoffData : undefined}
            />

            {/* Debug toggle button */}
            <button
                onClick={() => setDebugOpen(o => !o)}
                style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    zIndex: 9997,
                    background: debugOpen ? '#1e3a5f' : '#0f172a',
                    border: `1px solid ${debugOpen ? '#3b82f6' : '#334155'}`,
                    borderRadius: '6px',
                    padding: '5px 10px',
                    color: debugOpen ? '#60a5fa' : '#64748b',
                    fontSize: '11px',
                    fontFamily: 'system-ui, sans-serif',
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
            >
                <span style={{ fontSize: '12px' }}>⚙</span>
                DEBUG
            </button>

            {debugOpen && (
                <DebugPanel wardData={debugWardData} raceResult={raceResult} />
            )}
        </div>
    );
}
