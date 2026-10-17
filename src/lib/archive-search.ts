import { Election, Race, detectRaceType, isAdminRace } from './api';
import { fetchBulkResults } from './candidate-history';
export interface ArchiveRace extends Race { electionId:string; electionName:string; electionDate:string; }
export async function getArchiveBallot(election:Election):Promise<ArchiveRace[]|null> {
    const bulk=await fetchBulkResults(election.electionId,election.lastPublished);
    if(!bulk?.Races)return null;
    return bulk.Races.filter(r=>!isAdminRace(r.RaceName)).map(r=>({
        id:r.RaceNumber,electionId:election.electionId,electionName:election.electionName,electionDate:election.electionDate,
        name:r.RaceName.replace(/\s*-\s*Official Canvass\s*$/i,'').trim(),type:detectRaceType(r.RaceName),
        totalPrecincts:r.TotalPrecincts,precinctsReporting:r.PrecinctsReported,lastUpdated:election.lastPublished,
        candidates:r.Candidates.map(c=>({candidateName:c.Name.trim(),votes:c.Votes,percentage:c.Percentage,party:c.PartyName?.trim()}))
    }));
}
export function normalizeSearch(text:string) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
export function matchesArchiveRace(race:Race,query:string,electionName='') {
    const text=normalizeSearch(`${race.name} ${electionName} ${race.candidates.map(c=>c.candidateName).join(' ')}`);
    return normalizeSearch(query).split(/\s+/).every(word=>text.includes(word));
}
export function candidateMatches(race:Race,query:string) {
    const names=race.candidates.map(c=>({name:c.candidateName,normalized:normalizeSearch(c.candidateName)}));
    // Ignore office/year terms, but require all candidate-related terms in one name.
    const words=normalizeSearch(query).split(/\s+/).filter(w=>w.length>1 && !/^\d+$/.test(w) && names.some(c=>c.normalized.includes(w)));
    return words.length ? names.filter(c=>words.every(w=>c.normalized.includes(w))).map(c=>c.name) : [];
}
export function candidateScore(name:string,query:string) {
    const n=normalizeSearch(name),q=normalizeSearch(query).split(' ').filter(w=>!/^\d+$/.test(w)).join(' ');
    if(n===q)return 0;
    if(n.split(' ').includes(q))return 1;
    if(n.startsWith(q))return 2;
    return 3;
}
export function groupCandidateRaces(rows:ArchiveRace[],query:string) {
    const groups=new Map<string,{name:string;races:ArchiveRace[]}>();
    for(const race of rows)for(const name of candidateMatches(race,query)){
        const key=normalizeSearch(name),group=groups.get(key)??{name,races:[]};
        group.races.push(race);groups.set(key,group);
    }
    return [...groups.values()].map(g=>({...g,races:g.races.sort((a,b)=>b.electionDate.localeCompare(a.electionDate)||a.name.localeCompare(b.name))}))
        .sort((a,b)=>candidateScore(a.name,query)-candidateScore(b.name,query)||a.name.localeCompare(b.name));
}
interface ArchiveIndex {version:number;entries:{id:string;published:string;races:{id:string;name:string;candidates:string[]}[]}[];}
let indexRequest:Promise<ArchiveIndex|null>|undefined;
async function loadIndex() {
    if(!indexRequest) indexRequest=fetch(`${process.env.NEXT_PUBLIC_BASE_PATH||''}/data/archive-index.json`,{signal:AbortSignal.timeout(15000)})
        .then(async r=>{if(!r.ok)throw new Error('Index unavailable');const d=await r.json();if(d.version!==1||!Array.isArray(d.entries))throw new Error('Invalid index');return d as ArchiveIndex;})
        .catch(()=>{indexRequest=undefined;return null;});
    return indexRequest;
}
function indexedBallot(index:ArchiveIndex|null,e:Election):ArchiveRace[]|undefined {
    const entry=index?.entries.find(x=>x.id===e.electionId && x.published===e.lastPublished);
    return entry?.races.map(r=>({id:r.id,name:r.name,electionId:e.electionId,electionName:e.electionName,electionDate:e.electionDate,type:detectRaceType(r.name),totalPrecincts:0,precinctsReporting:0,lastUpdated:e.lastPublished,candidates:r.candidates.map(candidateName=>({candidateName,votes:0,percentage:0}))}));
}
export async function searchArchiveRaces(elections:Election[],query:string,options:{candidateOnly?:boolean;signal?:AbortSignal;onProgress?:(races:ArchiveRace[],done:number,failed:number)=>void}={}) {
    options.signal?.throwIfAborted();
    const index=await loadIndex();
    options.signal?.throwIfAborted();
    const matches:ArchiveRace[]=[];
    let done=0,failed=0;
    const collect=(races:ArchiveRace[]|null)=>{done++;if(!races){failed++;return;}matches.push(...races.filter(r=>matchesArchiveRace(r,query,`${r.electionName} ${r.electionDate}`)&&(!options.candidateOnly||candidateMatches(r,query).length>0)));};
    const remaining:Election[]=[];
    for(const election of elections){const ballot=indexedBallot(index,election);if(ballot)collect(ballot);else remaining.push(election);}
    const report=()=>options.onProgress?.([...matches].sort((a,b)=>{
        const score=(r:ArchiveRace)=>Math.min(4,...candidateMatches(r,query).map(n=>candidateScore(n,query)));
        return score(a)-score(b)||b.electionDate.localeCompare(a.electionDate);
    }),done,failed);
    report();
    // Only missing or changed elections need county requests. Failures remain retryable.
    for(let i=0;i<remaining.length;i+=4) {
        options.signal?.throwIfAborted();
        const batch=await Promise.all(remaining.slice(i,i+4).map(getArchiveBallot));
        options.signal?.throwIfAborted();
        batch.forEach(collect);report();
    }
    return matches;
}
