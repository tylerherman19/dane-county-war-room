import type { Election, Race } from './api';

export function electionYear(e: Election): string {
    return e.electionDate.match(/^(\d{4})/)?.[1] ?? e.electionName.match(/\b(19|20)\d{2}\b/)?.[0] ?? 'Unknown';
}
export function electionStage(e: Election): string {
    if (/primary/i.test(e.electionName)) return 'Primary';
    if (/general/i.test(e.electionName)) return 'General';
    if (/spring/i.test(e.electionName)) return 'Spring election';
    return 'Other';
}
export function electionCycle(e: Election): string {
    if (/special/i.test(e.electionName)) return 'Special';
    if (/spring/i.test(e.electionName)) return 'Spring';
    if (/partisan|general|fall/i.test(e.electionName)) return 'Fall';
    return 'Other';
}
export function filterElections(elections: Election[], filters: {year: string; stage: string; cycle: string; query: string}) {
    const words = filters.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return elections.filter(e => (!filters.year || electionYear(e) === filters.year)
        && (!filters.stage || electionStage(e) === filters.stage)
        && (!filters.cycle || electionCycle(e) === filters.cycle)
        && words.every(word => `${e.electionName} ${e.electionDate}`.toLowerCase().includes(word)));
}
export function officeCategory(r: Race): string {
    const n = r.name.toLowerCase();
    if (r.type === 'Referendum') return 'Referendums';
    if (/school|education/.test(n)) return 'School board & education';
    if (/justice|judge|court/.test(n)) return 'Courts';
    if (['Presidential', 'Senate', 'Congress'].includes(r.type)) return 'Federal';
    if (['Governor', 'Assembly', 'StateSenate'].includes(r.type) || /attorney general|secretary of state|state treasurer/.test(n)) return 'State';
    if (/county|sheriff|district attorney|register of deeds/.test(n)) return 'County';
    if (r.type === 'Mayor') return 'Mayor';
    if (r.type === 'Alder' || /council/.test(n)) return 'City council';
    if (/town|village/.test(n)) return 'Town & village';
    return 'Other local offices';
}
export function raceParty(r: Race): string {
    return r.name.match(/^(DEM|REP|LIB|GRN|CON|IND)\b/i)?.[1].toUpperCase() ?? 'Nonpartisan / other';
}
