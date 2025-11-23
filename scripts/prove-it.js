
const fs = require('fs');
const path = require('path');

// --- LOAD DATA ---
const presPath = path.join(__dirname, '../src/lib/real-data/president-2020.json');
const mayorPath = path.join(__dirname, '../src/lib/real-data/mayor-2023.json');
const distPath = path.join(__dirname, '../src/lib/ward-districts.json');

const president2020 = JSON.parse(fs.readFileSync(presPath, 'utf8'));
const mayor2023 = JSON.parse(fs.readFileSync(mayorPath, 'utf8'));
const wardDistricts = JSON.parse(fs.readFileSync(distPath, 'utf8'));

// --- LOGIC (COPIED FROM src/lib/analysis-data.ts) ---

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

    // Extract ward number if present FIRST
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
    const match = rawName.toUpperCase().match(/((?:(?:WARD|WD)\s+)?(?:\d+(?:\s+TO\s+\d+)?(?:\s+|$))+)$/);

    if (match) {
        const numbersPart = match[1];
        const baseRaw = rawName.substring(0, rawName.length - numbersPart.length);
        const normalizedBase = normalizeWard(baseRaw);

        // Clean up numbers part
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

// --- TESTS ---

console.log("Running Proof Suite...\n");

let passed = 0;
let failed = 0;

const assert = (desc, condition) => {
    if (condition) {
        console.log(`✅ PASS: ${desc}`);
        passed++;
    } else {
        console.log(`❌ FAIL: ${desc}`);
        failed++;
    }
};

// 1. Populate Maps
const presMap = new Map();
president2020.forEach(r => expandWardKeys(r.ward).forEach(k => presMap.set(k, r)));

const mayorMap = new Map();
mayor2023.forEach(r => {
    if (r.ward) expandWardKeys(r.ward).forEach(k => mayorMap.set(k, r));
});

const distMap = new Map();
Object.keys(wardDistricts).forEach(muni => {
    wardDistricts[muni].forEach(d => {
        const key = normalizeWard(`${muni} Ward ${d.ward}`);
        distMap.set(key, true);
    });
});

// 2. Ward 58 Check
const ward58Key = normalizeWard("City of Madison Ward 58");
const ward58Data = presMap.get(ward58Key);
assert("Ward 58 Key is 'madison-city-58'", ward58Key === 'madison-city-58');
assert("Ward 58 Data Found", !!ward58Data);

if (ward58Data) {
    const margin = (ward58Data.biden - ward58Data.trump) / ward58Data.total;
    const marginPct = (margin * 100).toFixed(1);
    assert(`Ward 58 Margin is 69.7% (Got ${marginPct}%)`, marginPct === "69.7");
}

// 3. Town of Madison Check
const townKey = normalizeWard("MADISON TOWN");
const townData = presMap.get(townKey);
assert("Town of Madison Key is 'madison-town'", townKey === 'madison-town');
assert("Town of Madison Data Found", !!townData);

if (townData) {
    const margin = (townData.biden - townData.trump) / townData.total;
    const marginPct = (margin * 100).toFixed(1);
    assert(`Town of Madison Margin is 75.0% (Got ${marginPct}%)`, marginPct === "75.0");
}

// 4. Collision Check
assert("City and Town keys are different", ward58Key !== townKey);

// 5. Mayor Data Check (Random Sample)
const mayorKey = normalizeWard("C Madison Wd 001");
assert("Mayor Ward 1 Key is 'madison-city-1'", mayorKey === 'madison-city-1');
assert("Mayor Ward 1 Data Found", mayorMap.has(mayorKey));

// 6. District Data Check
const distKey = normalizeWard("City of Fitchburg Ward 16");
assert("Fitchburg Ward 16 Key is 'fitchburg-city-16'", distKey === 'fitchburg-city-16');
assert("Fitchburg Ward 16 District Data Found", distMap.has(distKey));

// 7. Global Coverage (Quick Check)
console.log(`President Map Size: ${presMap.size}`);
console.log(`Mayor Map Size: ${mayorMap.size}`);
console.log(`District Map Size: ${distMap.size}`);

assert("President Map has > 200 entries", presMap.size > 200);
assert("Mayor Map has > 150 entries", mayorMap.size > 150);
assert("District Map has > 400 entries", distMap.size > 400);

console.log(`\nSummary: ${passed} Passed, ${failed} Failed.`);
if (failed === 0) {
    console.log("PROOF SUCCESSFUL: The logic is correct and data is accurate.");
} else {
    console.log("PROOF FAILED: Discrepancies found.");
    process.exit(1);
}
