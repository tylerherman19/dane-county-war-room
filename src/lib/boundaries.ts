export interface BoundarySnapshot {id:string;date:string;label:string;file:string;source:string;}
// Only compare the exact same geometry when calculating a ward-level shift.
export function selectBoundary(snapshots:BoundarySnapshot[],electionDate?:string) {
    const date=electionDate?.slice(0,10);
    const sorted=[...snapshots].sort((a,b)=>b.date.localeCompare(a.date));
    if(!date)return sorted[0];
    return sorted.find(s=>s.date<=date);
}
export function boundaryIsReference(snapshot:BoundarySnapshot,electionDate?:string) {
    return !!electionDate && snapshot.date.slice(0,4)!==electionDate.slice(0,4);
}
export function sameBoundary(a:{type:string;coordinates?:unknown},b:{type:string;coordinates?:unknown}) {
    return a.coordinates!==undefined && b.coordinates!==undefined && a.type===b.type && JSON.stringify(a.coordinates)===JSON.stringify(b.coordinates);
}
