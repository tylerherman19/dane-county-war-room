'use client';
import dynamic from 'next/dynamic';
import type { PrecinctResult, RaceResult } from '@/lib/api';
const Map = dynamic(() => import('./Map'), {ssr:false,loading:()=><div className="panel-message">Loading map…</div>});
export interface ResultsMapProps {
    electionDate?:string; comparisonDate?:string; comparisonRows?:PrecinctResult[];
    precinctResults: PrecinctResult[]; isLoading: boolean; selectedWard:{name:string;num:string}|null;
    raceResult?:RaceResult; focusedCandidate:string|null; onCandidateReset:()=>void;
    fitKey:string; onSelectWard:(ward:{name:string;num:string}|null)=>void; trendsMode?:boolean;
    shiftByWard?:Record<string,{from:number;to:number}>; shiftLabel?:string;
}
export default function MapWrapper(props:ResultsMapProps) { return <Map {...props} />; }
