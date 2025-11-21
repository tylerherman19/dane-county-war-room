'use client';

import dynamic from 'next/dynamic';
import { PrecinctResult } from '@/lib/api';

const DynamicMap = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-900 animate-pulse flex items-center justify-center text-slate-500">Loading Map...</div>
}) as any;

interface MapWrapperProps {
    precinctResults: any[];
    isLoading: boolean;
    selectedWard?: { name: string; num: string } | null;
    raceResult?: any;
    onReset?: () => void;
}

export default function MapWrapper({ precinctResults, isLoading, selectedWard, raceResult, onReset }: MapWrapperProps) {
    return <DynamicMap precinctResults={precinctResults} isLoading={isLoading} selectedWard={selectedWard} raceResult={raceResult} onReset={onReset} />;
}
