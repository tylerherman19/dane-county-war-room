'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PrecinctResult, RaceResult } from '@/lib/api';
import MapOverlayControl, { OverlayMode } from './MapOverlayControl';
import { HoveredWard } from './Map';
import { isHistoricalDataLoaded, getHistoricalRaceInfo } from '@/lib/analysis-data';
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
    simulateHighlightedWards?: Set<string> | null;
    onWardClick?: (ward: { name: string; num: string }) => void;
    simulateOverlayMode?: OverlayMode;
    // Real turnout (ballots cast) keyed by "City of Madison|46"
    turnoutByWard?: Record<string, number>;
    comparisonTurnoutByWard?: Record<string, number>;
    comparisonLabel?: string | null;
    // Changes whenever the map should re-fit to the covered wards (race or seat filter)
    fitKey?: string;
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset, focusedCandidate, onCandidateReset, simulateMode, projectionData, simulateHighlightedWards, onWardClick, simulateOverlayMode, turnoutByWard, comparisonTurnoutByWard, comparisonLabel, fitKey }: MapWrapperProps) {
    const [overlayMode, setOverlayMode] = useState<OverlayMode>('NONE');
    const [debugOpen, setDebugOpen] = useState(false);
    const [debugWardData, setDebugWardData] = useState<HoveredWard | null>(null);
    const [historicalLabel, setHistoricalLabel] = useState<string | null>(null);

    // SIMULATE overlay data (loaded once when simulateMode is first true)
    const [dormantPoolData, setDormantPoolData] = useState<Record<string, number> | undefined>(undefined);
    const [dropoffData, setDropoffData] = useState<Record<string, DropoffInfo> | undefined>(undefined);

    useEffect(() => {
        if (!simulateMode) return;
        getDormantPoolByWard().then(setDormantPoolData).catch(() => {});
        getDropoffByWard().then(setDropoffData).catch(() => {});
    }, [simulateMode]);

    // Reset overlay + label on race change, then poll until historical data loads
    // (the label drives the "vs historical margin" tooltip row re-render).
    useEffect(() => {
        setOverlayMode('NONE');
        setHistoricalLabel(null);
        const id = setInterval(() => {
            if (isHistoricalDataLoaded()) {
                const info = getHistoricalRaceInfo();
                if (info) setHistoricalLabel(`${info.year} ${info.name}`);
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

    const handleOverlayChange = useCallback((mode: OverlayMode) => {
        setOverlayMode(mode);
        onCandidateReset();
    }, [onCandidateReset]);

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
                    comparisonLabel={comparisonLabel}
                    turnoutReady={!!turnoutByWard}
                    candidateLegend={candidateLegend}
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
                turnoutByWard={turnoutByWard}
                comparisonTurnoutByWard={comparisonTurnoutByWard}
                comparisonLabel={comparisonLabel}
                fitKey={fitKey}
                projectionData={simulateMode ? projectionData : undefined}
                simulateHighlightedWards={simulateMode ? simulateHighlightedWards : null}
                onWardClick={simulateMode ? onWardClick : undefined}
                dormantPoolData={simulateMode ? dormantPoolData : undefined}
                dropoffData={simulateMode ? dropoffData : undefined}
            />

            {/* Debug toggle — dev only */}
            {process.env.NODE_ENV === 'development' && (
                <>
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
                </>
            )}
        </div>
    );
}
