'use client';
import type { ElectionPhase } from '@/lib/election-cycle';
export default function ElectionPhaseToggle({phase,year,onChange}:{phase:ElectionPhase;year:number;onChange:(phase:ElectionPhase)=>void}) {
    return <div className="election-phase-toggle" role="group" aria-label="Election view">
        <button aria-pressed={phase==='NOVEMBER'} onClick={()=>onChange('NOVEMBER')}>November {year}</button>
        <button aria-pressed={phase==='PRIMARY'} onClick={()=>onChange('PRIMARY')}>Primary {year}</button>
    </div>;
}
