'use client';
import { ReactNode, useState } from 'react';
import type { Election } from '@/lib/api';
import ElectionSelector from './ElectionSelector';
export type ViewMode = 'LIVE' | 'BOARD' | 'ARCHIVE' | 'TRENDS';
export default function Layout({children, sidebar, elections, selectedElectionId, onSelectElection, viewMode, onToggleViewMode, hasError, onRetry, lastUpdated}: {
    children: ReactNode; sidebar: ReactNode; elections?: Election[]; selectedElectionId: string | null;
    onSelectElection: (id: string) => void; viewMode: ViewMode; onToggleViewMode: (mode: ViewMode) => void;
    hasError?: boolean; onRetry: () => void; lastUpdated?: string;
}) {
    const [mobilePanel, setMobilePanel] = useState(false);
    const selected = elections?.find(e => e.electionId === selectedElectionId);
    const stamp = lastUpdated && !Number.isNaN(Date.parse(lastUpdated))
        ? new Date(lastUpdated).toLocaleString('en-US', {timeZone:'America/Chicago', month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}) : null;
    return <div className="app-shell">
        <header className="app-header">
            <h1>Dane County <span>Elections</span></h1>
            <nav aria-label="Main navigation">{([['LIVE','Results'],['BOARD','Board'],['ARCHIVE','Archive'],['TRENDS','Trends']] as const).map(([id,label]) =>
                <button key={id} aria-current={viewMode === id ? 'page' : undefined} onClick={() => {setMobilePanel(false);onToggleViewMode(id);}}>{label}</button>)}</nav>
            <a href="https://elections.danecounty.gov/Election-Result" target="_blank" rel="noreferrer">County source ↗</a>
        </header>
        {viewMode === 'ARCHIVE' && <ElectionSelector elections={elections} selectedElectionId={selectedElectionId} onSelectElection={onSelectElection} />}
        {viewMode !== 'TRENDS' && <div className="election-context"><strong>{selected?.electionName ?? 'Loading elections…'}</strong><span>{stamp ? `County published ${stamp}` : 'Dane County election results'}{viewMode === 'LIVE' || viewMode === 'BOARD' ? ' · Checks every 30 seconds' : ''}</span></div>}
        {hasError && <div className="data-error" role="alert">Could not load the county data. Any displayed results may be out of date. <button onClick={onRetry}>Retry</button></div>}
        <div className="workspace">
            {sidebar && <aside className={`results-panel ${mobilePanel ? 'panel-open' : ''}`} aria-label="Results and search">
                <button className="close-panel" onClick={() => setMobilePanel(false)}>Back to map</button>{sidebar}
            </aside>}
            <main className="map-area">{children}</main>
        </div>
        {sidebar && <button className="mobile-results" onClick={() => setMobilePanel(v => !v)}>{mobilePanel ? 'Show map' : viewMode === 'TRENDS' ? 'Search candidates' : 'Races & results'}</button>}
    </div>;
}
