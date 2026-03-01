'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { PrecinctResult, RaceResult } from '@/lib/api';
import MapOverlayControl, { OverlayMode } from './MapOverlayControl';
import { HoveredWard } from './Map';
import { isHistoricalDataLoaded, getHistoricalRaceInfo } from '@/lib/analysis-data';

const Map = dynamic(() => import('./Map'), { ssr: false });
const DebugPanel = dynamic(() => import('./DebugPanel'), { ssr: false });

interface MapWrapperProps {
    precinctResults: PrecinctResult[];
    isLoading: boolean;
    selectedWard: { name: string; num: string } | null;
    raceResult: RaceResult | undefined;
    onReset: () => void;
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset }: MapWrapperProps) {
    const [overlayMode, setOverlayMode] = useState<OverlayMode>('NONE');
    const [debugOpen, setDebugOpen] = useState(false);
    const [debugWardData, setDebugWardData] = useState<HoveredWard | null>(null);
    const [historicalLabel, setHistoricalLabel] = useState<string | null>(null);

    // Reset overlay + label on race change, then poll until historical data loads.
    // Combined into one effect so reset always happens before polling begins.
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

    return (
        <div className="relative w-full h-full">
            <MapOverlayControl currentMode={overlayMode} onChange={setOverlayMode} historicalLabel={historicalLabel} />
            <Map
                precinctResults={precinctResults}
                isLoading={isLoading}
                selectedWard={selectedWard}
                raceResult={raceResult}
                onReset={onReset}
                overlayMode={overlayMode}
                onWardHover={setDebugWardData}
                historicalLabel={historicalLabel}
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
