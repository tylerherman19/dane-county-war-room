/**
 * Build-time script: fetches historical election data from the Dane County API
 * and writes it to public/historical-ward-data.json.
 *
 * Runs automatically via the "prebuild" npm script before `npm run build`.
 * Can also be run manually: node scripts/build-historical-data.mjs
 *
 * All data is sourced directly from https://api.danecounty.gov — zero hardcoded values.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';

const BASE = 'https://api.danecounty.gov/api/v1/elections';
const RELEVANT_TYPES = new Set(['Presidential', 'Mayor', 'Governor', 'Senate', 'Congress', 'Alder', 'Assembly', 'StateSenate']);

// ── Helpers (mirrors logic in src/lib/) ──────────────────────────────────────

/**
 * Convert an API precinct name (e.g. "C Madison Wd 001") to a clean municipality
 * name in the same format that the GeoJSON uses ("City of Madison"), so that
 * normalizeWardName() produces keys that match what analysis-data.ts generates.
 */
function expandPrecinctName(precinctName) {
    // Strip trailing ward designation: "Wd 001", "Wds 1-5", etc.
    let name = precinctName.replace(/\s+Wds?\s+[\d\s,\-]+$/i, '').trim();
    // Expand single-letter municipality type prefix used by the Dane County API
    if (/^C\s+/i.test(name)) name = name.replace(/^C\s+/i, 'City of ');
    else if (/^T\s+/i.test(name)) name = name.replace(/^T\s+/i, 'Town of ');
    else if (/^V\s+/i.test(name)) name = name.replace(/^V\s+/i, 'Village of ');
    return name;
}

function normalizeWardName(precinctName, wardNumber) {
    // Convert API precinct name to GeoJSON-style municipality name first
    let s = expandPrecinctName(precinctName).toLowerCase();
    let type = '';
    if (s.includes('town')) type = 'town';
    else if (s.includes('village')) type = 'village';
    else if (s.includes('city')) type = 'city';
    s = s
        .replace(/^(city|village|town) of\s+/, '')
        .replace(/\s+(city|village|town)\b/g, '')
        .trim()
        .replace(/\s+/g, '-');
    let key = s;
    if (type) key += `-${type}`;
    if (wardNumber && wardNumber !== '0') key += `-${wardNumber}`;
    return key;
}

function detectRaceType(raceName) {
    const n = raceName.toLowerCase();
    // Local "president"/chair offices must not match the Presidential check below
    if (/(village|school board|county board)\s+president/.test(n) || n.includes('chairperson') || n.includes('town chair')) return 'Other';
    if (n.includes('president')) return 'Presidential';
    if (n.includes('u.s. senator') || n.includes('us senator') || n.includes('united states senator')) return 'Senate';
    if (n.includes('state senator') || n.includes('state senate')) return 'StateSenate';
    if (n.includes('senator') || n.includes('senate')) return 'Senate';
    if (n.includes('congress') || n.includes('u.s. representative') || n.includes('representative in congress')) return 'Congress';
    if (n.includes('assembly')) return 'Assembly';
    if (n.includes('referendum') || n.includes('question') || n.includes('advisory')) return 'Referendum';
    if (n.includes('mayor')) return 'Mayor';
    if (n.includes('governor')) return 'Governor';
    if (n.includes('alder') || n.includes('alderperson') || n.includes('alderman')) return 'Alder';
    return 'Other';
}

/** Expand grouped ward ranges like "Wds 1-5, 11, 18-19" → [1,2,3,4,5,11,18,19] */
function expandWardRanges(precinctName) {
    const wards = [];
    const wdsMatch = precinctName.match(/Wds\s+([\d\s,\-]+)/i);
    if (wdsMatch) {
        const parts = wdsMatch[1].trim().split(',').map(p => p.trim());
        for (const part of parts) {
            const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                for (let i = start; i <= end; i++) wards.push(i);
            } else {
                const num = parseInt(part);
                if (!isNaN(num)) wards.push(num);
            }
        }
    } else {
        const single = precinctName.match(/Wd\s+0*(\d+)/i);
        if (single) wards.push(parseInt(single[1]));
    }
    return wards;
}

// Use curl instead of Node's built-in fetch so that the https_proxy / HTTPS_PROXY
// environment variable is honoured automatically in sandboxed build environments.
// In CI (GitHub Actions) the proxy variable is unset and curl reaches the API directly.
function fetchJSON(url) {
    try {
        const out = execSync(`curl -sf --max-time 60 "${url}"`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        return JSON.parse(out);
    } catch (err) {
        throw new Error(`curl failed for ${url}: ${err.message}`);
    }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {

console.log('[build-historical-data] Starting...');

const allElections = fetchJSON(`${BASE}/list`);
const cutoff = new Date();
cutoff.setFullYear(cutoff.getFullYear() - 10);
const recent = allElections.filter(e => new Date(e.ElectionDate) >= cutoff);
console.log(`[build-historical-data] ${recent.length} elections in the last 10 years`);

const output = { generatedAt: new Date().toISOString(), data: {} };
let totalRaces = 0;
let totalWards = 0;

for (const election of recent) {
    let races;
    try {
        races = fetchJSON(`${BASE}/races/${election.ElectionId}`);
    } catch (err) {
        console.warn(`  ⚠ Skipping election ${election.ElectionId} (${election.ElectionName}): ${err.message}`);
        continue;
    }

    const relevant = races.filter(r => RELEVANT_TYPES.has(detectRaceType(r.RaceName)));
    if (relevant.length === 0) continue;

    console.log(`  ${election.ElectionName} — ${relevant.length} relevant race(s)`);

    for (const race of relevant) {
        const raceType = detectRaceType(race.RaceName);

        // Alder and Mayor projections are Madison-specific — the war room covers
        // the City of Madison, so drop other municipalities' aldermanic and
        // mayoral races (otherwise "Mayor of Madison" blends in Fitchburg,
        // Middleton, Sun Prairie, etc. and understates Madison turnout).
        if ((raceType === 'Alder' || raceType === 'Mayor') && !race.RaceName.toLowerCase().includes('madison')) continue;

        // Fetch party info from race-level results so we can sign the historical margin
        // (positive = Dem lead, negative = GOP lead) to match Map.tsx overlay logic.
        let partyMap = {}; // candidateName → party string
        try {
            const raceResults = fetchJSON(`${BASE}/electionresults/${election.ElectionId}/${race.RaceNumber}`);
            if (raceResults?.Candidates) {
                raceResults.Candidates.forEach(c => { partyMap[c.CandidateName] = c.PartyName || c.Party || ''; });
            }
        } catch { /* ignore — margin will default to unsigned if party info unavailable */ }

        let precincts;
        try {
            const precinctData = fetchJSON(`${BASE}/precinctresults/${election.ElectionId}/${race.RaceNumber}`);
            // API returns { ElectionRace, PrecinctVotes, Election } — iterate the votes array.
            precincts = precinctData.PrecinctVotes ?? precinctData;
        } catch (err) {
            console.warn(`    ⚠ Skipping race ${race.RaceNumber} (${race.RaceName}): ${err.message}`);
            continue;
        }

        if (!Array.isArray(precincts) || precincts.length === 0) {
            console.warn(`    ⚠ No precinct data for race ${race.RaceNumber} (${race.RaceName})`);
            continue;
        }

        // Group votes by normalised ward key
        const wardCandidates = new Map();

        for (const pv of precincts) {
            const wards = expandWardRanges(pv.PrecinctName);
            const count = wards.length || 1;
            const votesPerWard = Math.round(pv.TotalVotes / count);
            const ballotsPerWard = Math.round((pv.BallotsCount ?? pv.TotalVotes) / count);

            const wardNums = count > 0 ? wards : [0];
            for (const wardNum of wardNums) {
                const key = normalizeWardName(pv.PrecinctName, String(wardNum));
                if (!wardCandidates.has(key)) wardCandidates.set(key, { candidates: new Map(), ballots: 0 });
                const entry = wardCandidates.get(key);
                const prev = entry.candidates.get(pv.CandidateName) ?? 0;
                entry.candidates.set(pv.CandidateName, prev + votesPerWard);
                entry.ballots = Math.max(entry.ballots, ballotsPerWard);
            }
        }

        // Compute margin per ward and build wardResults plain object.
        // Margin is SIGNED: positive = Dem lead, negative = GOP/other lead.
        // This matches how Map.tsx PRESIDENTIAL overlay interprets historical margins.
        const wardResults = {};
        for (const [wardKey, { candidates, ballots }] of wardCandidates) {
            const sorted = Array.from(candidates.entries())
                .map(([name, votes]) => ({ name, votes }))
                .sort((a, b) => b.votes - a.votes);
            const totalVotes = sorted.reduce((s, c) => s + c.votes, 0);
            if (totalVotes === 0) continue;
            const topName = sorted[0]?.name ?? '';
            const topParty = (partyMap[topName] || '').toLowerCase();
            const isDem = topParty.includes('democrat');
            let absMargin = 0;
            if (sorted.length >= 2) {
                absMargin = (sorted[0].votes - sorted[1].votes) / totalVotes;
            } else if (sorted.length === 1) {
                absMargin = 1.0;
            }
            // Sign: positive if Dem won, negative if GOP/other won
            const margin = isDem ? absMargin : -absMargin;
            wardResults[wardKey] = {
                candidates: sorted,
                totalVotes,
                topCandidate: topName,
                margin,
            };
        }

        // For district-based races, extract district number from race name
        let districtNum = null;
        if (raceType === 'Alder' || raceType === 'Assembly' || raceType === 'StateSenate') {
            const m = race.RaceName.match(/district\s+(\d+)/i);
            districtNum = m ? parseInt(m[1]) : null;
        }

        if (!output.data[raceType]) output.data[raceType] = [];
        output.data[raceType].push({
            electionId: String(election.ElectionId),
            electionName: election.ElectionName,
            electionDate: election.ElectionDate,
            raceId: String(race.RaceNumber),
            raceName: race.RaceName,
            raceType,
            districtNum,
            wardResults,
        });

        totalRaces++;
        totalWards += Object.keys(wardResults).length;
        console.log(`    ✓ ${raceType}: "${race.RaceName}" — ${Object.keys(wardResults).length} wards`);
    }
}

// Sort each type by date desc (most recent first)
for (const arr of Object.values(output.data)) {
    arr.sort((a, b) => new Date(b.electionDate) - new Date(a.electionDate));
}

mkdirSync('public', { recursive: true });
const json = JSON.stringify(output);
writeFileSync('public/historical-ward-data.json', json);

console.log(`\n[build-historical-data] Done.`);
console.log(`  Races: ${totalRaces}  |  Ward entries: ${totalWards}  |  File: ${(json.length / 1024).toFixed(0)} KB`);

} // end main()

main().catch(err => {
    // Network failure or API unavailability — write an empty stub so the build still succeeds.
    // The app will fall back to the static turnout estimate until the JSON is populated.
    console.warn(`\n[build-historical-data] WARNING: Could not fetch historical data: ${err.message}`);
    console.warn('[build-historical-data] Writing empty stub — run `npm run build:historical` with network access.');
    mkdirSync('public', { recursive: true });
    const stub = JSON.stringify({ generatedAt: new Date().toISOString(), data: {} });
    writeFileSync('public/historical-ward-data.json', stub);
    process.exit(0); // Don't fail the build
});
