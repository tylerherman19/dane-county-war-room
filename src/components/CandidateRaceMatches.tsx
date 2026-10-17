import { ArchiveRace, groupCandidateRaces } from '@/lib/archive-search';
export default function CandidateRaceMatches({rows,query,onSelect}:{rows:ArchiveRace[];query:string;onSelect:(e:string,r:string)=>void}) {
    return <div className="candidate-groups">{groupCandidateRaces(rows,query).map(group=><section className="candidate-group" key={group.name}>
        <h3>{group.name}<span>{group.races.length} {group.races.length===1?'race':'races'}</span></h3>
        {group.races.map(r=><button className="candidate-race-option" key={`${r.electionId}|${r.id}`} onClick={()=>onSelect(r.electionId,r.id)}>
            <strong>{r.name}</strong><span className="candidate-race-election">{r.electionName} · {r.electionDate.slice(0,10)}</span>
        </button>)}
    </section>)}</div>;
}
