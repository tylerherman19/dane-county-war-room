import { Election, Race, detectRaceType, isAdminRace } from './api';
import { fetchBulkResults } from './candidate-history';
export interface ArchiveRace extends Race { electionId:string; electionName:string; electionDate:string; }
export async function getArchiveBallot(election:Election):Promise<ArchiveRace[]|null> {
    const bulk=await fetchBulkResults(election.electionId);
    if(!bulk?.Races)return null;
    return bulk.Races.filter(r=>!isAdminRace(r.RaceName)).map(r=>({
        id:r.RaceNumber,electionId:election.electionId,electionName:election.electionName,electionDate:election.electionDate,
        name:r.RaceName.replace(/\s*-\s*Official Canvass\s*$/i,'').trim(),type:detectRaceType(r.RaceName),
        totalPrecincts:r.TotalPrecincts,precinctsReporting:r.PrecinctsReported,lastUpdated:election.lastPublished,
        candidates:r.Candidates.map(c=>({candidateName:c.Name.trim(),votes:c.Votes,percentage:c.Percentage,party:c.PartyName?.trim()}))
    }));
}
export function matchesArchiveRace(race:Race,query:string,electionName='') {
    const text=`${race.name} ${electionName} ${race.candidates.map(c=>c.candidateName).join(' ')}`.toLowerCase();
    return query.trim().toLowerCase().split(/\s+/).every(word=>text.includes(word));
}
export function candidateMatches(race:Race,query:string) {
    const words=query.toLowerCase().trim().split(/\s+/).filter(w=>w.length>1 && !/^\d+$/.test(w));
    return race.candidates.filter(c=>words.some(w=>c.candidateName.toLowerCase().includes(w))).map(c=>c.candidateName);
}
export async function searchArchiveRaces(elections:Election[],query:string,options:{signal?:AbortSignal;onProgress?:(races:ArchiveRace[],done:number,failed:number)=>void}={}) {
    const matches:ArchiveRace[]=[];
    let done=0,failed=0;
    for(let i=0;i<elections.length;i+=4) {
        options.signal?.throwIfAborted();
        const batch=await Promise.all(elections.slice(i,i+4).map(getArchiveBallot));
        options.signal?.throwIfAborted();
        for(const races of batch){done++;if(!races){failed++;continue;}matches.push(...races.filter(r=>matchesArchiveRace(r,query,`${r.electionName} ${r.electionDate}`)));}
        options.onProgress?.([...matches],done,failed);
    }
    return matches;
}
