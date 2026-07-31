// Ward → legislative/county/city district assignments for seat-scoped targeting.
// ward-districts.json: { "City of Madison": [{ward, asm, sen, cong, sup, ald}, ...], ... }
import wardDistricts from './ward-districts.json';

export type DistrictKind = 'asm' | 'sen' | 'sup' | 'ald';

export interface DistrictFilter {
    kind: DistrictKind;
    num: string;
}

export const DISTRICT_KIND_LABELS: Record<DistrictKind, string> = {
    asm: 'Assembly',
    sen: 'State Senate',
    sup: 'County Supervisor',
    ald: 'Madison Alder',
};

interface WardDistrictRow {
    ward: string;
    asm: string;
    sen: string;
    cong: string;
    sup: string;
    ald: string | null;
}

const data = wardDistricts as Record<string, WardDistrictRow[]>;

function wardKey(muni: string, ward: string): string {
    const n = parseInt(ward);
    return `${muni}|${isNaN(n) ? ward : n}`;
}

/** Label like "Assembly District 76" */
export function districtLabel(filter: DistrictFilter): string {
    return `${DISTRICT_KIND_LABELS[filter.kind]} District ${filter.num}`;
}

/**
 * KNOWN DATA LIMITATION: 5 wards outside AD76 (Town of Sun Prairie Wds 2 & 3,
 * Town of Rutland Wd 2, Town of Burke Wds 2 & 7) have two rows in
 * ward-districts.json with different `asm` values for the same ward — these
 * are almost certainly genuine post-redistricting split wards (part of the
 * ward in one Assembly district, part in another), not data entry errors.
 * There's no split-percentage source to divide them, so both rows are kept
 * and a filter on EITHER district includes the ward — meaning a district
 * total that includes one of these wards may be very slightly inflated
 * (double-counted) if you filter to one of the two districts it straddles.
 * AD76 itself has no such conflicts. Do not "fix" this by arbitrarily
 * dropping one row — that would silently exclude real voters from whichever
 * district loses the coin flip.
 */

/** All ward keys ("City of Madison|46") belonging to a district. */
export function getWardsInDistrict(filter: DistrictFilter): Set<string> {
    const keys = new Set<string>();
    for (const [muni, rows] of Object.entries(data)) {
        // Alder districts are city-specific; only Madison's are meaningful here
        if (filter.kind === 'ald' && muni !== 'City of Madison') continue;
        for (const row of rows) {
            if (row[filter.kind] != null && row[filter.kind] === filter.num) keys.add(wardKey(muni, row.ward));
        }
    }
    return keys;
}

/** Options for the district picker, grouped by kind, sorted numerically. */
export function getDistrictOptions(): { kind: DistrictKind; label: string; districts: string[] }[] {
    const byKind: Record<DistrictKind, Set<string>> = { asm: new Set(), sen: new Set(), sup: new Set(), ald: new Set() };
    for (const [muni, rows] of Object.entries(data)) {
        for (const row of rows) {
            byKind.asm.add(row.asm);
            byKind.sen.add(row.sen);
            byKind.sup.add(row.sup);
            if (muni === 'City of Madison' && row.ald != null) byKind.ald.add(row.ald);
        }
    }
    return (Object.keys(DISTRICT_KIND_LABELS) as DistrictKind[]).map(kind => ({
        kind,
        label: DISTRICT_KIND_LABELS[kind],
        districts: [...byKind[kind]].sort((a, b) => parseInt(a) - parseInt(b)),
    }));
}
