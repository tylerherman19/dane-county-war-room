/**
 * Build-time script: fetches ward-level history for the AD76 Democratic
 * partisan primary (August) from the Dane County API and writes it to
 * public/ad76-planning.json.
 *
 * This powers the pre-election "Planning" view: ward power ranking,
 * turnout scenarios / win-number math, and election-night benchmarks.
 *
 * Runs via "prebuild" before `npm run build`.
 * Can also be run manually: node scripts/build-ad76-planning-data.mjs
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const OUTPUT_PATH = 'public/ad76-planning.json';

/** True if OUTPUT_PATH already holds real (non-stub) planning data from a prior successful run. */
function hasExistingGoodData() {
    if (!existsSync(OUTPUT_PATH)) return false;
    try {
        const prev = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'));
        return Array.isArray(prev.years) && prev.years.length > 0;
    } catch {
        return false;
    }
}

const BASE = 'https://api.danecounty.gov/api/v1/elections';
const DISTRICT = 76;

// Use curl instead of Node's built-in fetch so that the https_proxy / HTTPS_PROXY
// environment variable is honoured automatically in sandboxed build environments.
function fetchJSON(url) {
    try {
        const out = execSync(`curl -sf --max-time 60 "${url}"`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        return JSON.parse(out);
    } catch (err) {
        throw new Error(`curl failed for ${url}: ${err.message}`);
    }
}

/** "C Madison Wd 046" → "City of Madison" (matches the GeoJSON NAME field). */
function expandPrecinctName(precinctName) {
    let name = precinctName.replace(/\s+Wds?\s+[\d\s,\-]+$/i, '').trim();
    if (/^C\s+/i.test(name)) name = name.replace(/^C\s+/i, 'City of ');
    else if (/^T\s+/i.test(name)) name = name.replace(/^T\s+/i, 'Town of ');
    else if (/^V\s+/i.test(name)) name = name.replace(/^V\s+/i, 'Village of ');
    return name;
}

/** Expand grouped ward ranges like "Wds 1-5, 11" → [1,2,3,4,5,11]. */
function expandWardRanges(precinctName) {
    const wards = [];
    const wdsMatch = precinctName.match(/Wds\s+([\d\s,\-]+)/i);
    if (wdsMatch) {
        for (const part of wdsMatch[1].trim().split(',').map(p => p.trim())) {
            const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
            if (range) {
                for (let i = parseInt(range[1]); i <= parseInt(range[2]); i++) wards.push(i);
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

function isWriteIn(name) {
    return /^write[\s-]?in/i.test(name.trim());
}

async function main() {
    console.log('[build-ad76-planning] Starting...');

    const elections = fetchJSON(`${BASE}/list`);
    const partisanPrimaries = elections
        .filter(e => /partisan primary/i.test(e.ElectionName))
        .sort((a, b) => new Date(b.ElectionDate) - new Date(a.ElectionDate));

    const years = [];
    for (const election of partisanPrimaries) {
        const year = new Date(election.ElectionDate).getFullYear();
        if (year < 2018) break; // older cycles predate useful ward boundaries

        let races;
        try {
            races = fetchJSON(`${BASE}/races/${election.ElectionId}`);
        } catch (err) {
            console.warn(`  ⚠ Skipping ${election.ElectionName}: ${err.message}`);
            continue;
        }

        const race = races.find(r => {
            const n = r.RaceName;
            return /assembly/i.test(n)
                && new RegExp(`district\\s+${DISTRICT}\\b`, 'i').test(n)
                && (/^DEM\s/i.test(n) || /democratic/i.test(n));
        });
        if (!race) {
            console.warn(`  ⚠ No DEM AD${DISTRICT} race in ${election.ElectionName}`);
            continue;
        }

        let results, precinctData;
        try {
            results = fetchJSON(`${BASE}/electionresults/${election.ElectionId}/${race.RaceNumber}`);
            precinctData = fetchJSON(`${BASE}/precinctresults/${election.ElectionId}/${race.RaceNumber}`);
        } catch (err) {
            console.warn(`  ⚠ Skipping ${election.ElectionName} race ${race.RaceNumber}: ${err.message}`);
            continue;
        }

        const candidates = (results.Candidates ?? [])
            .filter(c => !isWriteIn(c.Name))
            .map(c => ({ name: c.Name, votes: c.Votes, pct: c.Percentage }))
            .sort((a, b) => b.votes - a.votes);
        const totalVotes = (results.Candidates ?? []).reduce((s, c) => s + c.Votes, 0);

        // Per-ward race votes, keyed "City of Madison|46" (the app's ward-key format).
        // Grouped precincts ("Wds 1-2") are split evenly across their wards.
        const wardVotes = {};
        const rows = precinctData.PrecinctVotes ?? precinctData;
        for (const pv of Array.isArray(rows) ? rows : []) {
            const muni = expandPrecinctName(pv.PrecinctName);
            const wards = expandWardRanges(pv.PrecinctName);
            const wardNums = wards.length > 0 ? wards : [0];
            const votesPerWard = (pv.TotalVotes ?? 0) / wardNums.length;
            for (const w of wardNums) {
                const key = `${muni}|${w}`;
                wardVotes[key] = (wardVotes[key] ?? 0) + votesPerWard;
            }
        }
        for (const k of Object.keys(wardVotes)) wardVotes[k] = Math.round(wardVotes[k]);

        years.push({
            year,
            electionId: String(election.ElectionId),
            raceId: String(race.RaceNumber),
            electionName: election.ElectionName,
            electionDate: election.ElectionDate,
            raceName: race.RaceName.replace(/\s*-\s*Official Canvass\s*$/i, ''),
            totalVotes,
            contested: candidates.filter(c => c.votes > 0).length > 1,
            candidates,
            wardVotes,
        });
        console.log(`  ✓ ${year}: "${race.RaceName}" — ${totalVotes.toLocaleString()} votes, ${Object.keys(wardVotes).length} wards, contested=${candidates.length > 1}`);
    }

    const output = {
        generatedAt: new Date().toISOString(),
        district: DISTRICT,
        party: 'DEM',
        years,
    };

    if (years.length === 0 && hasExistingGoodData()) {
        // Nothing usable came back this run, but a prior successful run left good
        // data in place — keep it rather than deploying an empty Planning view.
        console.warn('\n[build-ad76-planning] WARNING: no years fetched this run — keeping existing public/ad76-planning.json.');
        return;
    }

    mkdirSync('public', { recursive: true });
    const json = JSON.stringify(output);
    writeFileSync(OUTPUT_PATH, json);
    console.log(`\n[build-ad76-planning] Done. ${years.length} cycles | ${(json.length / 1024).toFixed(0)} KB`);
}

main().catch(err => {
    console.warn(`\n[build-ad76-planning] WARNING: ${err.message}`);
    if (hasExistingGoodData()) {
        // Network failure with prior good data on disk — leave it alone instead of
        // clobbering it with an empty stub. A stale Planning view beats a blank one.
        console.warn('[build-ad76-planning] Keeping existing public/ad76-planning.json from a prior successful run.');
        process.exit(0);
    }
    console.warn('[build-ad76-planning] No prior data on disk — writing empty stub. Run `npm run build:planning` with network access before deploying.');
    mkdirSync('public', { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), district: DISTRICT, party: 'DEM', years: [] }));
    process.exit(0);
});
