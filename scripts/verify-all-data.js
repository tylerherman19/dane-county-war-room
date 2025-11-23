
const fs = require('fs');
const path = require('path');
const president2020 = require('../src/lib/real-data/president-2020.json');
const mayor2023 = require('../src/lib/real-data/mayor-2023.json');

// --- LOGIC FROM src/lib/analysis-data.ts ---
// We must use the EXACT same logic to ensure verification is valid.

const normalizeWard = (name) => {
    let s = name.toLowerCase();
    let type = '';

    // Detect type
    if (s.includes('town') || s.match(/\bt\b/)) type = 'town';
    else if (s.includes('village') || s.includes('vlg') || s.match(/\bv\b/)) type = 'village';
    else if (s.includes('city') || s.match(/\bc\b/)) type = 'city';

    // Remove type keywords
    s = s.replace(/^(city|village|town) of\s+/, '');
    s = s.replace(/\s+(city|village|town|vlg)\b/g, '');
    s = s.replace(/\b(c|v|t)\s+/g, ''); // Remove single letter prefixes
    s = s.replace(/\bwd\b/g, 'ward');

    // Extract ward number
    const wardMatch = s.match(/ward\s+(\d+)/);
    const wardNum = wardMatch ? parseInt(wardMatch[1], 10).toString() : '';

    // Remove "ward X"
    s = s.replace(/ward\s+\d+/, '');

    // Remove standalone "ward" (e.g. if number was stripped)
    s = s.replace(/\bward\b/g, '');

    // Clean up
    s = s.trim().replace(/\s+/g, '-');

    // Construct key: name-type-ward
    // e.g. cottage-grove-town-1
    let key = s;
    if (type) key += `-${type}`;
    if (wardNum) key += `-${wardNum}`;

    return key;
};

const expandWardKeys = (rawName) => {
    const keys = [];

    // 1. Extract the "numbers part" (suffix)
    // "DEFOREST VLG 1 3 TO 6" -> "1 3 TO 6"
    // "VERONA CITY WARD 1 5" -> "1 5"
    // "MADISON CITY WARD 140" -> "140"

    // Strategy: Look for the last contiguous sequence of numbers, spaces, "TO", "WARD", "WD"
    const match = rawName.toUpperCase().match(/((?:(?:WARD|WD)\s+)?(?:\d+(?:\s+TO\s+\d+)?(?:\s+|$))+)$/);

    if (match) {
        const numbersPart = match[1];
        const baseRaw = rawName.substring(0, rawName.length - numbersPart.length);
        const normalizedBase = normalizeWard(baseRaw);

        // Clean up numbers part: "WARD 1 5" -> "1 5", "1 3 TO 6" -> "1 3-6"
        let cleanNumbers = numbersPart.replace(/(WARD|WD)/i, '').trim();
        cleanNumbers = cleanNumbers.replace(/\s+TO\s+/g, '-');

        const parts = cleanNumbers.split(/\s+/);

        parts.forEach(part => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(n => parseInt(n));
                for (let i = start; i <= end; i++) {
                    keys.push(`${normalizedBase}-${i}`);
                }
            } else {
                const n = parseInt(part);
                if (!isNaN(n)) {
                    keys.push(`${normalizedBase}-${n}`);
                }
            }
        });

        if (keys.length > 0) return keys;
    }

    // Fallback
    keys.push(normalizeWard(rawName));
    return keys;
};

// --- VERIFICATION LOGIC ---

// Load GeoJSON
const geoJsonPath = path.join(process.cwd(), 'public', 'dane_wards.geojson');
const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));

const wardDistricts = require('../src/lib/ward-districts.json');

console.log(`Total GeoJSON Wards: ${geoJsonData.features.length}`);
console.log(`Total Pres 2020 Entries: ${president2020.length}`);
console.log(`Total Mayor 2023 Entries: ${mayor2023.length}`);

// 1. Map Data Entries to Keys
const presDataMap = new Map(); // Key -> Data Entry Index
const mayorDataMap = new Map();
const districtDataMap = new Map();

president2020.forEach((r, index) => {
    if (r.ward) {
        const keys = expandWardKeys(r.ward);
        keys.forEach(k => {
            presDataMap.set(k, index);
        });
    }
});

mayor2023.forEach((r, index) => {
    if (r.ward) {
        const keys = expandWardKeys(r.ward);
        keys.forEach(k => {
            mayorDataMap.set(k, index);
        });
    }
});

// Map District Data
Object.keys(wardDistricts).forEach(muni => {
    wardDistricts[muni].forEach(d => {
        // wardDistricts uses "City of Fitchburg" and ward "16"
        // We construct a normalized key
        const key = normalizeWard(`${muni} Ward ${d.ward}`);
        districtDataMap.set(key, true);
    });
});

// 2. Check GeoJSON Coverage
const unmatchedPres = [];
const unmatchedMayorMadison = []; // Only track Madison for Mayor
const unmatchedDistricts = [];
const matchedPresIndices = new Set();
const matchedMayorIndices = new Set();

geoJsonData.features.forEach(f => {
    const name = f.properties.NAME;
    const wardNum = parseInt(f.properties.WardNumber).toString();
    const key = normalizeWard(`${name} Ward ${wardNum}`);

    // Check Pres 2020
    if (presDataMap.has(key)) {
        matchedPresIndices.add(presDataMap.get(key));
    } else {
        // Try fallback (remove ward number)
        // key is "name-type-ward", fallback is "name-type"
        const fallbackKey = key.replace(/-\d+$/, '');
        if (presDataMap.has(fallbackKey)) {
            matchedPresIndices.add(presDataMap.get(fallbackKey));
        } else {
            unmatchedPres.push({ name, wardNum, key, fallbackKey });
        }
    }

    // Check Mayor 2023 (Madison Only)
    if (name.toLowerCase().includes('madison')) {
        if (mayorDataMap.has(key)) {
            matchedMayorIndices.add(mayorDataMap.get(key));
        } else {
            const fallbackKey = key.replace(/-\d+$/, '');
            if (mayorDataMap.has(fallbackKey)) {
                matchedMayorIndices.add(mayorDataMap.get(fallbackKey));
            } else {
                unmatchedMayorMadison.push({ name, wardNum, key });
            }
        }
    }

    // Check Districts
    if (districtDataMap.has(key)) {
        // Matched
    } else {
        const fallbackKey = key.replace(/-\d+$/, '');
        if (districtDataMap.has(fallbackKey)) {
            // Matched via fallback
        } else {
            unmatchedDistricts.push({ name, wardNum, key });
        }
    }
});

// 3. Check Unused Data
const unusedPresEntries = [];
president2020.forEach((r, index) => {
    if (!matchedPresIndices.has(index)) {
        unusedPresEntries.push(r.ward);
    }
});

// --- REPORT ---

console.log('\n--- VERIFICATION REPORT ---');

console.log(`\n[President 2020]`);
console.log(`Matched Wards: ${geoJsonData.features.length - unmatchedPres.length}/${geoJsonData.features.length}`);
console.log(`Unmatched GeoJSON Wards: ${unmatchedPres.length}`);
if (unmatchedPres.length > 0) {
    console.log('Top 10 Unmatched:');
    unmatchedPres.slice(0, 10).forEach(u => console.log(`  - ${u.name} Ward ${u.wardNum} (Key: ${u.key})`));
}

console.log(`\nUnused Data Entries: ${unusedPresEntries.length}`);
if (unusedPresEntries.length > 0) {
    console.log('Top 10 Unused Data Entries (Potential Mismatches):');
    unusedPresEntries.slice(0, 10).forEach(u => console.log(`  - ${u}`));
}

console.log(`\n[Mayor 2023 (Madison Only)]`);
console.log(`Unmatched Madison Wards: ${unmatchedMayorMadison.length}`);
if (unmatchedMayorMadison.length > 0) {
    unmatchedMayorMadison.forEach(u => console.log(`  - ${u.name} Ward ${u.wardNum} (Key: ${u.key})`));
}

console.log(`\n[District Data]`);
console.log(`Matched Wards: ${geoJsonData.features.length - unmatchedDistricts.length}/${geoJsonData.features.length}`);
console.log(`Unmatched Wards: ${unmatchedDistricts.length}`);
if (unmatchedDistricts.length > 0) {
    unmatchedDistricts.slice(0, 10).forEach(u => console.log(`  - ${u.name} Ward ${u.wardNum} (Key: ${u.key})`));
}

// Conclusion
if (unusedPresEntries.length === 0 && unmatchedPres.length === 0) {
    console.log('\nSUCCESS: 100% Bi-directional Match for President 2020!');
} else {
    console.log('\nISSUES FOUND: See above.');
}
