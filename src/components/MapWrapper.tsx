'use client';

import Map from './Map';
import { PrecinctResult, RaceResult } from '@/lib/api';
import MapOverlayControl, { OverlayMode } from './MapOverlayControl';
import { useState } from 'react';

interface MapWrapperProps {
    precinctResults: PrecinctResult[];
    isLoading: boolean;
    selectedWard: { name: string; num: string } | null;
    raceResult: RaceResult | undefined;
    onReset: () => void;
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset }: MapWrapperProps) {
    const [overlayMode, setOverlayMode] = useState<OverlayMode>('NONE');

    return (
        <div className="relative w-full h-full">
            <MapOverlayControl currentMode={overlayMode} onChange={setOverlayMode} />
            <Map
                precinctResults={precinctResults}
                isLoading={isLoading}
                selectedWard={selectedWard}
                raceResult={raceResult}
                onReset={onReset}
                overlayMode={overlayMode}
            />
        </div>
    );
}
