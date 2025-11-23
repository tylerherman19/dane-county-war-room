
const fs = require('fs');
const path = require('path');
const president2020 = require('../src/lib/real-data/president-2020.json');
const mayor2023 = require('../src/lib/real-data/mayor-2023.json');

// Copy of the normalizeWard function from analysis-data.ts
const normalizeWard = (name) => {
    let s = name.toLowerCase();
    const wardMatch = s.match(/ward\s+(\d+)/);
    const wardNum = wardMatch ? parseInt(wardMatch[1], 10).toString() : '';
    s = s.replace(/ward\s+\d+/, '');
    s = s.replace(/^(city|village|town) of\s+/, '');
    s = s.replace(/\s+(city|village|town|vlg)/g, '');
    s = s.trim().replace(/\s+/g, '-');
    if (wardNum) return `${s}-${wardNum}`;
    return s;
};

// Load GeoJSON
const geoJsonPath = path.join(process.cwd(), 'public', 'dane_wards.geojson');
const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf8'));

const geoJsonWards = new Set();
geoJsonData.features.forEach(f => {
    const name = f.properties.NAME;
    const wardNum = parseInt(f.properties.WardNumber).toString();
    const key = normalizeWard(`${name} Ward ${wardNum}`);
    geoJsonWards.add(key);
});

// Helper to expand grouped ward strings into individual keys
const expandWardKeys = (rawName) => {
    const keys = [];
    const upper = rawName.toUpperCase();

    // 1. Check for "X TO Y" pattern
    const rangeMatch = upper.match(/(\d+)\s+TO\s+(\d+)/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[1]);
        const end = parseInt(rangeMatch[2]);

        const baseRaw = rawName.replace(/\s+\d+\s+TO\s+\d+.*/i, '');
        const normalizedBase = normalizeWard(baseRaw);

        for (let i = start; i <= end; i++) {
            keys.push(`${normalizedBase}-${i}`);
        }
        return keys;
    }

    // 2. Check for space-separated numbers at the end
    const numberListMatch = rawName.match(/(\s+\d+)+$/);
    if (numberListMatch) {
        const nums = numberListMatch[0].trim().split(/\s+/);
        if (nums.length > 1) {
            const baseRaw = rawName.replace(/(\s+\d+)+$/, '');
            const normalizedBase = normalizeWard(baseRaw);

            nums.forEach(n => {
                keys.push(`${normalizedBase}-${parseInt(n)}`);
            });
            return keys;
        }
    }

    keys.push(normalizeWard(rawName));
    return keys;
};

const presidentMap = new Set();
president2020.forEach(r => {
    const keys = expandWardKeys(r.ward);
    keys.forEach(k => presidentMap.add(k));
});

const mayorMap = new Set();
mayor2023.forEach(r => {
    if (r.ward) mayorMap.add(normalizeWard(r.ward));
});

console.log(`GeoJSON Wards: ${geoJsonWards.size}`);
console.log(`President 2020 Wards: ${presidentMap.size}`);
console.log(`Mayor 2023 Wards: ${mayorMap.size}`);

let unmatchedPres = 0;
let unmatchedMayor = 0;

console.log('\n--- Unmatched GeoJSON Wards (President 2020) ---');
geoJsonWards.forEach(key => {
    // Check exact match or fallback match
    const fallbackKey = key.replace(/-\d+$/, '');
    if (!presidentMap.has(key) && !presidentMap.has(fallbackKey)) {
        console.log(`Missing in Pres 2020: ${key}`);
        unmatchedPres++;
    }
});

console.log('\n--- Unmatched GeoJSON Wards (Mayor 2023) ---');
geoJsonWards.forEach(key => {
    const fallbackKey = key.replace(/-\d+$/, '');
    if (!mayorMap.has(key) && !mayorMap.has(fallbackKey)) {
        // console.log(`Missing in Mayor 2023: ${key}`); // Likely many outside Madison
        unmatchedMayor++;
    }
});

console.log(`\nTotal Unmatched Pres: ${unmatchedPres}`);
console.log(`Total Unmatched Mayor: ${unmatchedMayor}`);
