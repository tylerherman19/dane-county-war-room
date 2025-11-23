
const fs = require('fs');
const path = require('path');
const president2020 = require('../src/lib/real-data/president-2020.json');

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

const presidentMap = new Map();
president2020.forEach(r => {
    presidentMap.set(normalizeWard(r.ward), r);
});

const testWards = [
    "City of Madison Ward 56",
    "Madison Ward 56",
    "MADISON CITY WARD 056",
    "City of Madison Ward 28" // From user's other screenshot
];

console.log("--- Debugging Ward Normalization ---");

testWards.forEach(name => {
    const normalized = normalizeWard(name);
    const result = presidentMap.get(normalized);
    console.log(`\nInput: "${name}"`);
    console.log(`Normalized: "${normalized}"`);
    console.log(`Found: ${!!result}`);
    if (result) {
        console.log(`Data:`, result);
        const margin = (result.biden - result.trump) / result.total;
        console.log(`Calculated Margin: ${(margin * 100).toFixed(1)}%`);
    } else {
        // Try fallback
        const fallback = normalized.replace(/-\d+$/, '');
        const fbResult = presidentMap.get(fallback);
        console.log(`Fallback: "${fallback}"`);
        console.log(`Found Fallback: ${!!fbResult}`);
        if (fbResult) {
            console.log(`Fallback Data:`, fbResult);
            const margin = (fbResult.biden - fbResult.trump) / fbResult.total;
            console.log(`Calculated Margin (Fallback): ${(margin * 100).toFixed(1)}%`);
        }
    }
});
