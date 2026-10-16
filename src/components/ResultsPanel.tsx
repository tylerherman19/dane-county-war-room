'use client';
import { useMemo, useState } from 'react';
import type { PrecinctResult, RaceResult } from '@/lib/api';
import { buildWardData, wardKey } from '@/lib/map-data';
import { assignCandidateColors } from '@/lib/candidate-colors';

export default function ResultsPanel({result, rows = [], loading, selectedWard, onSelectWard, focusedCandidate, onFocusCandidate}: {
    result?: RaceResult; rows?: PrecinctResult[]; loading:boolean; selectedWard:{name:string;num:string}|null;
    onSelectWard:(ward:{name:string;num:string}|null)=>void; focusedCandidate:string|null; onFocusCandidate:(name:string|null)=>void;
}) {
    const [query,setQuery] = useState('');
    const wards = useMemo(() => buildWardData(rows),[rows]);
    const current = selectedWard ? wards.get(wardKey(selectedWard.name,selectedWard.num)) : undefined;
    if (loading) return <div className="panel-message" role="status">Loading county results…</div>;
    if (!result) return <div className="panel-message">Choose an election and race to see results.</div>;
    const colors = assignCandidateColors(result.candidates);
    const candidates = current ? current.candidates : result.candidates.map(c => ({name:c.candidateName,votes:c.votes})).sort((a,b) => b.votes-a.votes);
    const total = current?.total ?? result.totalVotes;
    const unique = [...new Map([...wards.values()].map(w => [w.source,w])).values()];
    const matches = unique.filter(w => `${w.name} ${w.num} ${w.source}`.toLowerCase().includes(query.toLowerCase()));
    return <section className="result-detail">
        <h2>{result.raceName}</h2>
        <p className="result-subtitle">{current ? current.grouped ? current.source : `${current.name} · Ward ${current.num}` : 'Dane County results'}</p>
        {selectedWard && <button className="text-button" onClick={() => onSelectWard(null)}>Show whole race</button>}
        <div className="result-metrics"><strong>{total.toLocaleString()} <span>votes</span></strong><span>{current ? current.reported ? 'Reported' : 'Not reported' : `${result.precinctsReporting} / ${result.totalPrecincts} precincts reporting`}</span></div>
        {current?.grouped && <p className="data-note">Combined precinct: these totals cover all listed wards. Individual ward counts are not published.</p>}
        <div className="candidate-list">{candidates.map(c => {
            const color=colors[c.name]; const fill=color ? `hsl(${color.h},${color.s}%,${color.l}%)` : '#738294';
            const pct=total ? 100*c.votes/total : 0;
            return <button key={c.name} className="candidate-row" aria-pressed={focusedCandidate === c.name} onClick={() => onFocusCandidate(focusedCandidate === c.name ? null : c.name)}>
                <span className="candidate-line"><span><i style={{background:fill}} />{c.name}</span><strong>{pct.toFixed(1)}%</strong></span>
                <span className="candidate-track"><span style={{width:`${pct}%`,background:fill}} /></span>
                <span className="candidate-votes">{c.votes.toLocaleString()} votes</span>
            </button>;
        })}</div>
        {focusedCandidate && <button className="text-button" onClick={() => onFocusCandidate(null)}>Clear candidate highlight</button>}
        <p className="data-note">Select a candidate to highlight their support on the map.</p>
        <div className="precinct-browser"><label>Find a precinct<input type="search" placeholder="Municipality or ward…" value={query} onChange={e => setQuery(e.target.value)} /></label>
            <p className="data-note">{matches.length} precincts. Select one to zoom to it.</p>
            {matches.map(w => <button className="precinct-row" key={w.source} onClick={() => onSelectWard({name:w.name,num:w.num})}><span>{w.grouped ? w.source : `${w.name} · Ward ${w.num}`}</span><strong>{w.reported ? w.total.toLocaleString() : 'Pending'}</strong></button>)}
            {!matches.length && <p className="data-note">No precincts match this search.</p>}
        </div>
    </section>;
}
