'use client';

import dynamic from 'next/dynamic';
import { PrecinctResult } from '@/lib/api';

const Map = dynamic(() => import('./Map'), {
    ssr: false,
    loading: () => <div className="w-full h-full bg-slate-950 flex items-center justify-center text-slate-500">Loading Map...</div>
});

interface MapWrapperProps {
    precinctResults: PrecinctResult[] | undefined;
    isLoading: boolean;
}

export default function MapWrapper(props: MapWrapperProps) {
    return <Map {...props} />;
}
