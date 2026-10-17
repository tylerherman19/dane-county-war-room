'use client';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import type { Election, Race } from '@/lib/api';
import { officeCategory, raceParty } from '@/lib/archive-filters';
import { ArchiveRace, candidateMatches, getArchiveBallot, matchesArchiveRace, searchArchiveRaces } from '@/lib/archive-search';
import SelectorDialog from './SelectorDialog';
import CandidateRaceMatches from './CandidateRaceMatches';
interface SearchState {query:string;rows:ArchiveRace[];done:number;failed:number;loading:boolean;}
export default function RaceSelector({races,selectedRaceId,onSelectRace,elections=[],election,onSelectArchiveRace,archive=false}:{
    races?:Race[];selectedRaceId:string|null;onSelectRace:(id:string)=>void;elections?:Election[];election?:Election;onSelectArchiveRace:(e:string,r:string)=>void;archive?:boolean;
}) {
    const [open,setOpen]=useState(false);
    const [query,setQuery]=useState('');
    const [party,setParty]=useState('');
    const [scope,setScope]=useState<'current'|'archive'>('archive');
    const [search,setSearch]=useState<SearchState>({query:'',rows:[],done:0,failed:0,loading:false});
    const {data:ballot,isLoading:ballotLoading,error:ballotError,mutate}=useSWR(open && election ? ['archiveBallot',election.electionId] : null,()=>getArchiveBallot(election!),{revalidateOnFocus:false});
    const selected=races?.find(r=>r.id===selectedRaceId);
    const activeIndex=races?.findIndex(r=>r.id===selectedRaceId) ?? -1;
    const currentRaces=ballot ?? races ?? [];
    const parties=[...new Set(currentRaces.map(raceParty))];
    const globalSearch=archive && scope==='archive' && query.trim().length>=2;
    const electionIds=elections.map(e=>`${e.electionId}:${e.lastPublished}`).join('|');
    useEffect(()=>{
        if(!open || !globalSearch)return;
        const controller=new AbortController();
        const timer=setTimeout(()=>{
            setSearch({query,rows:[],done:0,failed:0,loading:true});
            // Search the selected election first, then continue newest to oldest.
            const ordered=[...elections].sort((a,b)=>Number(b.electionId===election?.electionId)-Number(a.electionId===election?.electionId));
            void searchArchiveRaces(ordered,query,{signal:controller.signal,onProgress:(rows,done,failed)=>setSearch({query,rows,done,failed,loading:done<ordered.length})})
                .catch(()=>{if(!controller.signal.aborted)setSearch(s=>({...s,loading:false,failed:s.failed+1}));});
        },300);
        return ()=>{clearTimeout(timer);controller.abort();};
        // Election objects refresh every 30 seconds; restart only when IDs or publication revisions change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    },[open,globalSearch,query,electionIds,election?.electionId]);
    const localMatches=currentRaces.filter(r=>(!party||raceParty(r)===party)&&matchesArchiveRace(r,query));
    const found=globalSearch && search.query===query ? search.rows.filter(r=>!party||raceParty(r)===party) : localMatches;
    const groups=useMemo(()=>{
        const map=new Map<string,Race[]>();
        for(const race of found){const key=globalSearch?'electionName' in race?String(race.electionName):election?.electionName??'This election':officeCategory(race);const group=map.get(key)??[];group.push(race);map.set(key,group);}
        return [...map];
    },[found,globalSearch,election?.electionName]);
    function choose(r:Race){if('electionId' in r && r.electionId && r.electionId!==election?.electionId)onSelectArchiveRace(r.electionId,r.id);else onSelectRace(r.id);setOpen(false);setQuery('');}
    const candidateRows=globalSearch ? (found as ArchiveRace[]).filter(r=>candidateMatches(r,query).length>0) : [];
    const candidateKeys=new Set(candidateRows.map(r=>`${r.electionId}|${r.id}`));
    const busy=globalSearch && (search.query!==query || search.loading);
    return <div className="race-picker">
        <button className="selection-chip race-chip" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><span>{selected?.name ?? 'Choose a race or candidate'}</span><span aria-hidden="true">⌄</span></button>
        <div className="race-stepper"><button aria-label="Previous race" disabled={activeIndex<=0} onClick={()=>onSelectRace(races![activeIndex-1].id)}>‹</button><button aria-label="Next race" disabled={activeIndex<0||activeIndex>=(races?.length??0)-1} onClick={()=>onSelectRace(races![activeIndex+1].id)}>›</button></div>
        <SelectorDialog open={open} onClose={()=>setOpen(false)} title="Find a race or candidate" wide>
            <div className="picker-search"><label className="sr-only" htmlFor="race-search">Find a race or candidate</label><input id="race-search" type="search" placeholder="Candidate, office, district, or place…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
            <div className="picker-tabs race-tabs">
                {archive && query.trim().length>=2 ? <><button aria-pressed={scope==='archive'} onClick={()=>setScope('archive')}>All elections</button><button aria-pressed={scope==='current'} onClick={()=>setScope('current')}>This election</button></> : <span>{election?.electionName} · {currentRaces.length} races</span>}
                {parties.length>1 && <details className="picker-more"><summary>{party ? `${party} ballot`:'Party ballot'}</summary><div className="party-options"><button aria-pressed={!party} onClick={()=>setParty('')}>All parties</button>{parties.map(p=><button key={p} aria-pressed={party===p} onClick={()=>setParty(p)}>{p}</button>)}</div></details>}
            </div>
            {(ballotError||ballot===null) && !globalSearch && <p className="picker-empty">Candidate names could not load. Office search still works. <button onClick={()=>void mutate()}>Retry</button></p>}
            {globalSearch && <p className="search-progress" role="status">{busy?`Searching elections… ${search.query===query?search.done:0} of ${elections.length}`:`${found.length} matching races`}{search.query===query && search.failed>0?` · ${search.failed} elections unavailable; reopen search to retry`:''}</p>}
            <div className={`race-menu-list ${globalSearch?'search-results-list':''}`}>{globalSearch && <CandidateRaceMatches rows={candidateRows} query={query} onSelect={(e,r)=>{onSelectArchiveRace(e,r);setOpen(false);setQuery('');}}/>}{groups.filter(([,items])=>items.some(r=>!candidateKeys.has(`${r.electionId}|${r.id}`))).map(([group,items])=><section className="race-menu-group" key={group}><h3>{group}</h3>{items.filter(r=>!candidateKeys.has(`${r.electionId}|${r.id}`)).map(r=>{
                const names=query ? candidateMatches(r,query) : [];
                return <button key={`${r.electionId??election?.electionId}|${r.id}`} className="race-option" aria-current={r.id===selectedRaceId && (!r.electionId || r.electionId===election?.electionId)?'true':undefined} onClick={()=>choose(r)}><span className="race-option-title">{r.id===selectedRaceId && (!r.electionId||r.electionId===election?.electionId)?'✓ ':''}{r.name}</span>{names.length>0 && <span className="race-option-candidates">{names.join(' · ')}</span>}</button>;
            })}</section>)}</div>
            {!found.length && <p className="picker-empty">{busy?'Looking for matching races…':ballotLoading?'Loading candidate names…':'No matching races. Try a surname, an office, or a district.'}</p>}
            <footer className="picker-footer"><span>{query ? 'Select a race to open its map and results.' : 'Races follow the county’s ballot order.'}</span>{query||party?<button onClick={()=>{setQuery('');setParty('');}}>Clear search</button>:null}</footer>
        </SelectorDialog>
    </div>;
}
