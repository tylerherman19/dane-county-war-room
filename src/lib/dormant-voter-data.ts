// Computes dormant voter pool and primary vs. general dropoff per ward,
// derived from the pre-built historical-ward-data.json.
//
// "Dormant voter pool" for a ward = avg(Spring Election turnout) - avg(Spring Primary turnout).
// These are voters who show up in April finals but skip February primaries —
// the canvassing universe for a primary campaign.

import { fetchHistoricalData } from './historical-api-data';
import { wardKeyToPrecinctInfo } from './projections-data';

export interface DropoffInfo {
    general: number;     // most recent Spring Election (general) turnout
    primary: number;     // most recent Spring Primary turnout
    dropoff: number;     // general - primary (dormant voters this cycle)
    dropoffPct: number;  // dropoff / general * 100
}

export interface CanvassWard {
    wardKey: string;
    displayName: string;   // e.g. "City of Madison Ward 45"
    wardNumber: string;
    dormantPool: number;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

// Module-level caches (reused across calls within the same browser session)
let dormantPoolCache: Record<string, number> | null = null;
let dropoffCache: Record<string, DropoffInfo> | null = null;

function isPrimaryElection(electionName: string): boolean {
    return electionName.toLowerCase().includes('spring primary');
}

function isGeneralElection(electionName: string): boolean {
    const name = electionName.toLowerCase();
    return name.includes('spring election') || name.includes('general election');
}

/**
 * Compute per-ward dormant voter pool:
 *   dormantPool[wardKey] = avg(Spring Election votes) - avg(Spring Primary votes)
 *
 * Uses all available Mayor races in the historical data, averaged across cycles.
 * Returns {} if no Mayor data is found.
 */
export async function getDormantPoolByWard(): Promise<Record<string, number>> {
    if (dormantPoolCache) return dormantPoolCache;

    const data = await fetchHistoricalData();
    const mayorRaces = data.get('Mayor') ?? [];

    const primaryRaces = mayorRaces.filter(r => isPrimaryElection(r.electionName));
    const generalRaces = mayorRaces.filter(r => isGeneralElection(r.electionName));

    if (primaryRaces.length === 0 || generalRaces.length === 0) {
        dormantPoolCache = {};
        return {};
    }

    // Collect all ward keys across both election types
    const allWardKeys = new Set<string>();
    [...primaryRaces, ...generalRaces].forEach(r =>
        r.wardResults.forEach((_, k) => allWardKeys.add(k))
    );

    const result: Record<string, number> = {};
    for (const wardKey of allWardKeys) {
        const primaryCounts = primaryRaces
            .filter(r => r.wardResults.has(wardKey))
            .map(r => r.wardResults.get(wardKey)!.totalVotes);
        const avgPrimary = primaryCounts.length > 0
            ? primaryCounts.reduce((a, b) => a + b, 0) / primaryCounts.length
            : 0;

        const generalCounts = generalRaces
            .filter(r => r.wardResults.has(wardKey))
            .map(r => r.wardResults.get(wardKey)!.totalVotes);
        const avgGeneral = generalCounts.length > 0
            ? generalCounts.reduce((a, b) => a + b, 0) / generalCounts.length
            : 0;

        result[wardKey] = Math.max(0, Math.round(avgGeneral - avgPrimary));
    }

    dormantPoolCache = result;
    return result;
}

/**
 * Compute per-ward dropoff using the MOST RECENT Spring Election vs. most recent Spring Primary.
 * Returns { general, primary, dropoff, dropoffPct } per ward.
 */
export async function getDropoffByWard(): Promise<Record<string, DropoffInfo>> {
    if (dropoffCache) return dropoffCache;

    const data = await fetchHistoricalData();
    const mayorRaces = data.get('Mayor') ?? [];

    // Races are stored newest-first in the JSON
    const mostRecentPrimary = mayorRaces.find(r => isPrimaryElection(r.electionName));
    const mostRecentGeneral = mayorRaces.find(r => isGeneralElection(r.electionName));

    if (!mostRecentPrimary || !mostRecentGeneral) {
        dropoffCache = {};
        return {};
    }

    const allWardKeys = new Set<string>();
    mostRecentPrimary.wardResults.forEach((_, k) => allWardKeys.add(k));
    mostRecentGeneral.wardResults.forEach((_, k) => allWardKeys.add(k));

    const result: Record<string, DropoffInfo> = {};
    for (const wardKey of allWardKeys) {
        const primary = mostRecentPrimary.wardResults.get(wardKey)?.totalVotes ?? 0;
        const general = mostRecentGeneral.wardResults.get(wardKey)?.totalVotes ?? 0;
        const dropoff = Math.max(0, general - primary);
        const dropoffPct = general > 0 ? (dropoff / general) * 100 : 0;
        result[wardKey] = { general, primary, dropoff, dropoffPct };
    }

    dropoffCache = result;
    return result;
}

export interface DropoffWard {
    wardKey: string;
    displayName: string;
    wardNumber: string;
    dropoff: number;
    dropoffPct: number;
    general: number;
    primary: number;
}

/**
 * Return the top N wards sorted by primary dropoff size.
 */
export function rankDropoffWards(
    dropoffData: Record<string, DropoffInfo>,
    topN = 15,
): DropoffWard[] {
    return Object.entries(dropoffData)
        .filter(([, d]) => d.dropoff > 0)
        .sort(([, a], [, b]) => b.dropoff - a.dropoff)
        .slice(0, topN)
        .map(([wardKey, d]) => {
            const { precinctName, wardNumber } = wardKeyToPrecinctInfo(wardKey);
            return {
                wardKey,
                displayName: `${precinctName} Ward ${wardNumber}`,
                wardNumber,
                dropoff: d.dropoff,
                dropoffPct: d.dropoffPct,
                general: d.general,
                primary: d.primary,
            };
        });
}

/**
 * Return the top N wards sorted by dormant pool size, with priority badges.
 * HIGH = top 5, MEDIUM = 6–10, LOW = 11–15.
 */
export function rankCanvassWards(
    dormantPool: Record<string, number>,
    topN = 15,
): CanvassWard[] {
    return Object.entries(dormantPool)
        .sort(([, a], [, b]) => b - a)
        .slice(0, topN)
        .map(([wardKey, pool], i) => {
            const { precinctName, wardNumber } = wardKeyToPrecinctInfo(wardKey);
            const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
                i < 5 ? 'HIGH' : i < 10 ? 'MEDIUM' : 'LOW';
            return {
                wardKey,
                displayName: `${precinctName} Ward ${wardNumber}`,
                wardNumber,
                dormantPool: pool,
                priority,
            };
        });
}
