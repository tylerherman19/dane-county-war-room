import type { Election } from './api';
export type ElectionPhase = 'NOVEMBER' | 'PRIMARY';
export function currentFallCycleYear(calendarYear:number) { return calendarYear-calendarYear%2; }
export function getCycleElections(elections:Election[],year:number):Record<ElectionPhase,Election|undefined> {
    const cycle=elections.filter(e=>Number(e.electionDate.slice(0,4))===year && !/special|recall/i.test(e.electionName));
    const newest=[...cycle].sort((a,b)=>b.electionDate.localeCompare(a.electionDate));
    return {
        NOVEMBER:newest.find(e=>e.electionDate.slice(5,7)==='11' && /general/i.test(e.electionName) && !/primary/i.test(e.electionName)),
        PRIMARY:newest.find(e=>/partisan primary/i.test(e.electionName) || (e.electionDate.slice(5,7)==='08' && /primary/i.test(e.electionName)))
    };
}
