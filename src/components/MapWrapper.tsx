'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PrecinctResult, RaceResult } from '@/lib/api';
import MapOverlayControl, { OverlayMode } from './MapOverlayControl';
import { HoveredWard } from './Map';
import { isHistoricalDataLoaded, getHistoricalRaceInfo, loadHistoricalRaceById, normalizeWardName } from '@/lib/analysis-data';
import { getAvailableRacesWithOverlap, HistoricalRaceSummary } from '@/lib/historical-api-data';
import { assignCandidateColors } from '@/lib/candidate-colors';

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
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset, focusedCandidate, onCandidateReset }: MapWrapperProps) {
    const [overlayMode, setOverlayMode] = useState<OverlayMode>('NONE');
    const [debugOpen, setDebugOpen] = useState(false);
    const [debugWardData, setDebugWardData] = useState<HoveredWard | null>(null);
    const [historicalLabel, setHistoricalLabel] = useState<string | null>(null);
    const [availableRaces, setAvailableRaces] = useState<HistoricalRaceSummary[]>([]);
    const [selectedComparisonKey, setSelectedComparisonKey] = useState<string | null>(null);
    const [isLoadingComparison, setIsLoadingComparison] = useState(false);

    // Reset overlay + label on race change, then poll until historical data loads.
    // Combined into one effect so reset always happens before polling begins.
    useEffect(() => {
        setOverlayMode('NONE');
        setHistoricalLabel(null);
        setAvailableRaces([]);
        setSelectedComparisonKey(null);
        const id = setInterval(() => {
            if (isHistoricalDataLoaded()) {
                const info = getHistoricalRaceInfo();
                if (info) setHistoricalLabel(`${info.year} ${info.name}`);
                clearInterval(id);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [raceResult?.id]);

    // Candidate color legend — derived from raceResult, used by MapOverlayControl
    // to render per-candidate swatches in the NONE and SWING mode legends.
    const candidateLegend = useMemo(() => {
        if (!raceResult?.candidates?.length) return [];
        const colors = assignCandidateColors(raceResult.candidates);
        return raceResult.candidates.map(c => {
            const name = c.candidateName.trim();
            const hsl = colors[name] ?? { h: 215, s: 80, l: 55 };
            return { name, h: hsl.h, s: hsl.s, l: hsl.l };
        });
    }, [raceResult]);

    // Deduplicated normalized ward keys for the current live race.
    // Used to filter the comparison picker to geographically relevant races only.
    const currentWardKeys = useMemo(() => {
        const seen = new Set<string>();
        const keys: string[] = [];
        precinctResults.forEach(r => {
            const k = normalizeWardName(r.precinctName, r.wardNumber);
            if (!seen.has(k)) { seen.add(k); keys.push(k); }
        });
        return keys;
    }, [precinctResults]);

    // Once historical data loads, fetch the comparison race list filtered to
    // races that share ward keys with the current race (same geography).
    useEffect(() => {
        if (!historicalLabel) return;
        getAvailableRacesWithOverlap(currentWardKeys).then(setAvailableRaces).catch(() => {});
    }, [historicalLabel, currentWardKeys]);

    const handleOverlayChange = useCallback((mode: OverlayMode) => {
        setOverlayMode(mode);
        onCandidateReset(); // switching overlays clears the candidate focus view
    }, [onCandidateReset]);

    const handleComparisonChange = useCallback(async (key: string) => {
        if (!key) {
            // Reset to default — re-trigger the auto-load via polling
            setSelectedComparisonKey(null);
            return;
        }
        const [electionId, raceId] = key.split('|');
        setSelectedComparisonKey(key);
        setIsLoadingComparison(true);
        await loadHistoricalRaceById(electionId, raceId);
        const info = getHistoricalRaceInfo();
        if (info) setHistoricalLabel(`${info.year} ${info.name}`);
        setIsLoadingComparison(false);
    }, []);

    return (
        <div className="relative w-full h-full">
            <MapOverlayControl
                currentMode={overlayMode}
                onChange={handleOverlayChange}
                historicalLabel={historicalLabel}
                availableRaces={availableRaces}
                selectedComparisonKey={selectedComparisonKey}
                onComparisonChange={handleComparisonChange}
                isLoadingComparison={isLoadingComparison}
                candidateLegend={candidateLegend}
            />
            <Map
                precinctResults={precinctResults}
                isLoading={isLoading}
                selectedWard={selectedWard}
                raceResult={raceResult}
                onReset={onReset}
                overlayMode={overlayMode}
                onWardHover={setDebugWardData}
                historicalLabel={historicalLabel}
                focusedCandidate={focusedCandidate}
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
