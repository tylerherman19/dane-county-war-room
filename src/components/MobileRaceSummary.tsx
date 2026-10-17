import type { PrecinctResult, RaceResult } from '@/lib/api';
import { buildWardData,wardKey } from '@/lib/map-data';
export default function MobileRaceSummary({result,rows=[],ward}:{result?:RaceResult;rows?:PrecinctResult[];ward:{name:string;num:string}|null}) {
    if(!result)return null;
    const selected=ward?buildWardData(rows).get(wardKey(ward.name,ward.num)):undefined;
    const candidates=selected?.candidates??result.candidates.map(c=>({name:c.candidateName,votes:c.votes})).sort((a,b)=>b.votes-a.votes);
    const total=selected?.total??result.totalVotes;
    return <div className="mobile-race-summary">
        <strong>{selected?selected.grouped?selected.source:`${selected.name} · Ward ${selected.num}`:result.raceName.replace(/\s*-\s*Official Canvass\s*$/i,'')}</strong>
        <div>{candidates.slice(0,2).map(c=><span key={c.name}>{c.name} <b>{total?(100*c.votes/total).toFixed(1):'0.0'}%</b></span>)}</div>
        <small>{selected?.grouped?'Combined precinct totals':`${total.toLocaleString()} votes`}{!selected?` · ${result.precinctsReporting}/${result.totalPrecincts} precincts`:''}</small>
    </div>;
}
