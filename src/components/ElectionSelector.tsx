'use client';
import { useState } from 'react';
import type { Election } from '@/lib/api';
import { electionYear, electionStage, electionCycle, filterElections } from '@/lib/archive-filters';
import SelectorDialog from './SelectorDialog';
import { candidateMatches } from '@/lib/archive-search';
import { useArchiveRaceSearch } from '@/hooks/useArchiveRaceSearch';
export default function ElectionSelector({elections=[],selectedElectionId,onSelectElection,onSelectArchiveRace}:{elections?:Election[];selectedElectionId:string|null;onSelectElection:(id:string)=>void;onSelectArchiveRace:(e:string,r:string)=>void}) {
    const [open,setOpen]=useState(false);
    const [filters,setFilters]=useState({year:'',stage:'',cycle:'',query:''});
    const selected=elections.find(e=>e.electionId===selectedElectionId);
    const matches=filterElections(elections,filters);
    const searchElections=filterElections(elections,{...filters,query:''});
    const searchCandidates=open && filters.query.trim().length>=2 && /[a-z]/i.test(filters.query);
    const candidates=useArchiveRaceSearch(searchElections,filters.query,searchCandidates);
    const years=[...new Set(elections.map(electionYear))].sort().reverse();
    const groups=[...new Set(matches.map(electionYear))];
    return <div className="election-picker">
        <button className="selection-chip" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><span>{selected?.electionName ?? 'Choose election'}</span><span aria-hidden="true">⌄</span></button>
        <SelectorDialog open={open} onClose={()=>setOpen(false)} title="Find an election or candidate">
            <div className="picker-search"><label className="sr-only" htmlFor="election-search">Search candidates or elections</label><input id="election-search" type="search" placeholder="Candidate name, year, or election…" value={filters.query} onChange={e=>setFilters(f=>({...f,query:e.target.value}))}/></div>
            <div className="picker-tabs" aria-label="Election type">{[['','All elections'],['Primary','Primary'],['General','General / spring']].map(([value,label])=><button key={value} aria-pressed={filters.stage===value} onClick={()=>setFilters(f=>({...f,stage:value}))}>{label}</button>)}
                <details className="picker-more"><summary>Year & cycle</summary><div><label>Year<select value={filters.year} onChange={e=>setFilters(f=>({...f,year:e.target.value}))}><option value="">All years</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><label>Cycle<select value={filters.cycle} onChange={e=>setFilters(f=>({...f,cycle:e.target.value}))}><option value="">All cycles</option>{['Spring','Fall','Special','Recall','Other'].map(c=><option key={c}>{c}</option>)}</select></label></div></details>
            </div>
            <div className="election-list">
                {searchCandidates && <section className="candidate-race-results" aria-label="Candidate race matches">
                    <div className="candidate-search-status" role="status">{candidates.loading?`Finding candidate races… ${candidates.done} of ${searchElections.length} elections`:`${candidates.rows.length} races matching “${filters.query}”`}</div>
                    {candidates.rows.map(r=><button className="candidate-race-option" key={`${r.electionId}|${r.id}`} onClick={()=>{onSelectArchiveRace(r.electionId,r.id);setOpen(false);}}>
                        <strong>{candidateMatches(r,filters.query).join(' · ')}</strong>
                        <span>{r.name}</span>
                        <span className="candidate-race-election">{r.electionName} · {r.electionDate.slice(0,10)}</span>
                    </button>)}
                    {candidates.failed>0 && <p className="data-note">{candidates.failed} elections could not be loaded. Reopen the search to retry.</p>}
                </section>}
                {searchCandidates && matches.length>0 && <h3 className="election-search-label">Matching elections</h3>}
                {groups.map(year=><section key={year} className="election-year"><h3>{year}</h3><div>{matches.filter(e=>electionYear(e)===year).map(e=><button key={e.electionId} className="election-option" aria-current={e.electionId===selectedElectionId?'true':undefined} onClick={()=>{onSelectElection(e.electionId);setOpen(false);}}>
                <span className="election-name">{e.electionId===selectedElectionId?'✓ ':''}{e.electionName.replace(new RegExp(`^${year}\\s*`),'')}</span><span className={`election-tag tag-${electionStage(e).toLowerCase()}`}>{electionCycle(e)==='Special'||electionCycle(e)==='Recall'?electionCycle(e):electionStage(e)==='Primary'?'Primary':electionCycle(e)==='Spring'?'Spring':'General'}</span><time>{new Date(`${e.electionDate.slice(0,10)}T12:00:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</time>
            </button>)}</div></section>)}</div>
            {!matches.length && !searchCandidates && <p className="picker-empty">No elections match. <button onClick={()=>setFilters({year:'',stage:'',cycle:'',query:''})}>Clear search</button></p>}
            {searchCandidates && !candidates.loading && !candidates.rows.length && !matches.length && <p className="picker-empty">No candidate races or elections match. Try a surname or a different year.</p>}
            <footer className="picker-footer"><span>{searchCandidates ? 'Select a race to open its map and results.' : `${matches.length} elections · County archive`}</span>{(filters.year||filters.stage||filters.cycle||filters.query) && <button onClick={()=>setFilters({year:'',stage:'',cycle:'',query:''})}>Show all elections</button>}</footer>
        </SelectorDialog>
    </div>;
}
