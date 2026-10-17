import type { PrecinctResult } from './api';
export function wardKey(name: string, num: string | number) {
    return `${name.trim().toLowerCase().replace(/\s+/g,' ')}|${String(num).trim().toLowerCase().replace(/^0+(?=\d)/,'')}`;
}
export interface WardData {
    name: string; num: string; source: string; grouped: boolean; reported: boolean;
    candidates: {name:string;votes:number}[]; total: number;
}
export function buildWardData(rows: PrecinctResult[]) {
    const wards = new Map<string, WardData>();
    for (const row of rows) {
        const key = wardKey(row.precinctName,row.wardNumber);
        const ward = wards.get(key) ?? {name:row.precinctName,num:row.wardNumber,source:row.sourcePrecinct ?? `${row.precinctName} Ward ${row.wardNumber}`,grouped:!!row.groupedWards,reported:false,candidates:[],total:0};
        const votes = row.sourceVotes ?? row.votes;
        const candidate = ward.candidates.find(c => c.name === row.candidateName);
        if (candidate) candidate.votes += votes;
        else ward.candidates.push({name:row.candidateName,votes});
        ward.total += votes;
        ward.reported ||= row.reported;
        wards.set(key,ward);
    }
    for (const ward of wards.values()) ward.candidates.sort((a,b) => b.votes-a.votes);
    return wards;
}
