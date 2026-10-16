'use client';
import { useState } from 'react';
import type { Race } from '@/lib/api';
import { officeCategory, raceParty } from '@/lib/archive-filters';

export default function RaceSelector({races, selectedRaceId, onSelectRace}: {
    races?: Race[]; selectedRaceId: string | null; onSelectRace: (id: string) => void;
}) {
    const [query, setQuery] = useState('');
    const [office, setOffice] = useState('');
    const [party, setParty] = useState('');
    const offices = [...new Set((races ?? []).map(officeCategory))].sort();
    const parties = [...new Set((races ?? []).map(raceParty))].sort();
    const matches = (races ?? []).filter(r => (!office || officeCategory(r) === office) && (!party || raceParty(r) === party)
        && query.toLowerCase().trim().split(/\s+/).every(w => r.name.toLowerCase().includes(w)));
    const selected = races?.find(r => r.id === selectedRaceId);
    const visible = matches.some(r => r.id === selectedRaceId);
    return <section className="race-browser" aria-label="Find a race">
        <div className="race-filter-grid">
            <label>Find a race<input type="search" placeholder="Office, district, municipality…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <label>Office<select value={office} onChange={e => setOffice(e.target.value)}><option value="">All offices</option>{offices.map(o => <option key={o}>{o}</option>)}</select></label>
            {parties.length > 1 && <label>Party<select value={party} onChange={e => setParty(e.target.value)}><option value="">All parties</option>{parties.map(p => <option key={p}>{p}</option>)}</select></label>}
        </div>
        <label className="race-selection">Race <select value={visible ? selectedRaceId ?? '' : ''} onChange={e => e.target.value && onSelectRace(e.target.value)} disabled={!matches.length}>
            <option value="" disabled>{!races ? 'Loading races…' : matches.length ? 'Choose a race' : 'No matching races'}</option>
            {matches.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select></label>
        <div className="filter-summary"><span role="status">{matches.length} races{!visible && selected ? ` · Viewing ${selected.name}` : ''}</span>
            {(query || office || party) && <button onClick={() => {setQuery('');setOffice('');setParty('');}}>Clear race filters</button>}
        </div>
    </section>;
}
