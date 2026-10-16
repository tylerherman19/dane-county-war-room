'use client';
import { useState } from 'react';
import type { Election } from '@/lib/api';
import { electionYear, filterElections } from '@/lib/archive-filters';

export default function ElectionSelector({ elections = [], selectedElectionId, onSelectElection }: {
    elections?: Election[]; selectedElectionId: string | null; onSelectElection: (id: string) => void;
}) {
    const [filters, setFilters] = useState({year: '', stage: '', cycle: '', query: ''});
    const matches = filterElections(elections, filters);
    const years = [...new Set(elections.map(electionYear))].sort().reverse();
    const selected = elections.find(e => e.electionId === selectedElectionId);
    const selectedVisible = matches.some(e => e.electionId === selectedElectionId);
    const set = (key: keyof typeof filters, value: string) => setFilters(f => ({...f, [key]: value}));
    return <section className="archive-filters" aria-label="Election archive">
        <div className="archive-filter-grid">
            <label>Year<select value={filters.year} onChange={e => set('year', e.target.value)}><option value="">All years</option>{years.map(y => <option key={y}>{y}</option>)}</select></label>
            <label>Election type<select value={filters.stage} onChange={e => set('stage', e.target.value)}><option value="">All types</option>{['Primary', 'General', 'Spring election', 'Other'].map(s => <option key={s}>{s}</option>)}</select></label>
            <label>Cycle<select value={filters.cycle} onChange={e => set('cycle', e.target.value)}><option value="">All cycles</option>{['Spring', 'Fall', 'Special', 'Other'].map(s => <option key={s}>{s}</option>)}</select></label>
            <label className="archive-search">Search elections<input type="search" placeholder="Name or date…" value={filters.query} onChange={e => set('query', e.target.value)} /></label>
            <button className="quiet-button" onClick={() => setFilters({year:'',stage:'',cycle:'',query:''})}>Clear filters</button>
        </div>
        <div className="archive-selection">
            <label>Election <select value={selectedVisible ? selectedElectionId ?? '' : ''} onChange={e => e.target.value && onSelectElection(e.target.value)} disabled={!matches.length}>
                <option value="" disabled>{matches.length ? 'Choose an election' : 'No elections match these filters'}</option>
                {matches.map(e => <option key={e.electionId} value={e.electionId}>{e.electionDate.slice(0,10)} — {e.electionName}</option>)}
            </select></label>
            <span role="status">{matches.length} elections{!selectedVisible && selected ? ` · Viewing ${selected.electionName}` : ''}</span>
        </div>
    </section>;
}
