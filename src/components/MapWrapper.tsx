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
    // TRENDS mode: force the SHIFT overlay (gained/lost ground)
    trendsMode?: boolean;
    shiftByWard?: Record<string, { from: number; to: number }>;
    shiftLabels?: { from: string; to: string } | null;
    // LIVE/ARCHIVE: benchmark overlay option (SHIFT layer selectable from the control)
    benchmarkLabel?: string | null;
    // COALITION mode: combined slate support (0-100) per ward
    coalitionMode?: boolean;
    coalitionByWard?: Record<string, number>;
    coalitionLabel?: string | null;
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset, focusedCandidate, onCandidateReset, simulateMode, projectionData, simulateHighlightedWards, onWardClick, simulateOverlayMode, turnoutByWard, comparisonTurnoutByWard, comparisonLabel, fitKey, trendsMode, shiftByWard, shiftLabels, benchmarkLabel, coalitionMode, coalitionByWard, coalitionLabel }: MapWrapperProps) {
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

    // If the benchmark is cleared while its layer is active, fall back
    useEffect(() => {
        if (!trendsMode && overlayMode === 'SHIFT' && !shiftByWard) setOverlayMode('NONE');
    }, [overlayMode, shiftByWard, trendsMode]);

    // SIMULATE forces its own overlay; TRENDS forces SHIFT; COALITION forces COALITION
    const effectiveOverlayMode: OverlayMode = simulateMode
        ? (simulateOverlayMode ?? 'PROJECTION')
        : trendsMode
            ? 'SHIFT'
            : coalitionMode
                ? 'COALITION'
                : overlayMode;

    return (
        <div className="relative w-full h-full">
            {coalitionMode && (
                <div className="absolute top-3 md:top-4 right-3 md:right-4 z-[1000] w-56 bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl rounded-xl p-3">
                    <div className="text-xs font-bold text-slate-300 mb-1 truncate">{coalitionLabel || 'Coalition'}</div>
                    {coalitionByWard && Object.keys(coalitionByWard).length > 0 ? (
                        <>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                <span>Weak</span><span>50%</span><span>Strong</span>
                            </div>
                            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-slate-200 to-green-500">
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 opacity-60" />
                            </div>
                            <div className="text-[9px] text-slate-500 mt-1.5">Combined slate vote share by ward</div>
                        </>
                    ) : (
                        <div className="text-[11px] text-slate-500">Add candidates in the panel to build a coalition.</div>
                    )}
                </div>
            )}
            {!simulateMode && !trendsMode && !coalitionMode && (
                <MapOverlayControl
                    currentMode={overlayMode}
                    onChange={handleOverlayChange}
                    comparisonLabel={comparisonLabel}
                    turnoutReady={!!turnoutByWard}
                    candidateLegend={candidateLegend}
                    benchmarkLabel={benchmarkLabel}
                    benchmarkReady={!!shiftByWard}
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
                shiftByWard={shiftByWard}
                shiftLabels={shiftLabels}
                coalitionByWard={coalitionMode ? coalitionByWard : undefined}
                coalitionLabel={coalitionMode ? coalitionLabel : undefined}
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
