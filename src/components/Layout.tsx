'use client';
import { ReactNode, useEffect, useState } from 'react';
import type { ResultStatus } from '@/lib/result-status';
import type { Election } from '@/lib/api';
export type ViewMode = 'LIVE' | 'BOARD' | 'ARCHIVE' | 'TRENDS';
export default function Layout({children, sidebar, elections, selectedElectionId, viewMode, onToggleViewMode, hasError, onRetry, lastUpdated, selectors, electionLabel, mobileSummary, status, checkedAt}: {
    children: ReactNode; sidebar: ReactNode; elections?: Election[]; selectedElectionId: string | null;
    onSelectElection: (id: string) => void; viewMode: ViewMode; onToggleViewMode: (mode: ViewMode) => void;
    selectors?: ReactNode; electionLabel?:string; mobileSummary?:ReactNode;
    status?:{kind:ResultStatus;label:string}; checkedAt?:string;
    hasError?: boolean; onRetry: () => void; lastUpdated?: string;
}) {
    const [mobilePanel, setMobilePanel] = useState(false);
    useEffect(()=>{if(!mobilePanel)return;const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setMobilePanel(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[mobilePanel]);
    const checked=checkedAt?new Date(checkedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}):null;
    const selected = elections?.find(e => e.electionId === selectedElectionId);
    const stamp = lastUpdated && !Number.isNaN(Date.parse(lastUpdated))
        ? `${new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(lastUpdated)?lastUpdated:`${lastUpdated}Z`).toLocaleString('en-US', {timeZone:/[zZ]$|[+-]\d{2}:?\d{2}$/.test(lastUpdated)?'America/Chicago':'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} CT` : null;
    return <div className="app-shell">
        <header className="app-header">
            <h1>Dane County <span>Elections</span></h1>
            <nav aria-label="Main navigation">{([['LIVE','Results'],['BOARD','Board'],['ARCHIVE','Archive'],['TRENDS','Trends']] as const).map(([id,label]) =>
                <button key={id} aria-current={viewMode === id ? 'page' : undefined} onClick={() => {setMobilePanel(false);onToggleViewMode(id);}}>{label}</button>)}</nav>
            <a href="https://elections.danecounty.gov/Election-Result" target="_blank" rel="noreferrer">County source ↗</a>
        </header>
        {selectors && <div className="selection-bar">{selectors}</div>}
        {viewMode !== 'TRENDS' && <div className="election-context"><div><strong>{selected?.electionName ?? electionLabel ?? 'Loading elections…'}</strong><span>{stamp ? `County published ${stamp}` : 'Dane County election results'}</span></div><div className="connection-status"><strong data-status={status?.kind} role="status">{status?.label}</strong><span>{checked ? `Last successful check ${checked}` : 'Waiting for a successful check'}{viewMode==='LIVE'||viewMode==='BOARD'?' · Every 30 sec':''}</span></div></div>}
        {mobileSummary && <div className="mobile-summary-area">{mobileSummary}</div>}
        {hasError && <div className="data-error" role="alert">Could not load the county data. Any displayed results may be out of date. <button onClick={onRetry}>Retry</button></div>}
        <div className="workspace">
            {sidebar && <aside className={`results-panel ${mobilePanel ? 'panel-open' : ''}`} id="results-sheet" aria-label="Results and search">
                <button className="close-panel" onClick={() => setMobilePanel(false)}>⌄ Collapse results</button>{sidebar}
            </aside>}
            <main className="map-area">{children}</main>
        </div>
        {sidebar && <button className="mobile-results" aria-expanded={mobilePanel} aria-controls="results-sheet" onClick={() => setMobilePanel(v => !v)}>{mobilePanel ? 'Collapse results ⌄' : viewMode === 'TRENDS' ? 'Search candidates' : 'Expand results ⌃'}</button>}
    </div>;
}
