const fs = require('fs');
const path = require('path');

// Load all data
const presPath = path.join(__dirname, '../src/lib/real-data/president-2020.json');
const mayorPath = path.join(__dirname, '../src/lib/real-data/mayor-2023.json');
const president2020 = JSON.parse(fs.readFileSync(presPath, 'utf8'));
const mayor2023 = JSON.parse(fs.readFileSync(mayorPath, 'utf8'));

// Normalization logic (from analysis-data.ts)
const normalizeWard = (name) => {
    let s = name.toLowerCase();
    let type = '';
    if (s.includes('town') || s.match(/\bt\b/)) type = 'town';
    else if (s.includes('village') || s.includes('vlg') || s.match(/\bv\b/)) type = 'village';
    else if (s.includes('city') || s.match(/\bc\b/)) type = 'city';
    s = s.replace(/^(city|village|town) of\s+/, '');
    s = s.replace(/\s+(city|village|town|vlg)\b/g, '');
    s = s.replace(/\b(c|v|t)\s+/g, '');
    s = s.replace(/\bwd\b/g, 'ward');
    const wardMatch = s.match(/ward\s+(\d+)/);
    const wardNum = wardMatch ? parseInt(wardMatch[1], 10).toString() : '';
    s = s.replace(/ward\s+\d+/, '');
    s = s.replace(/\bward\b/g, '');
    s = s.trim().replace(/\s+/g, '-');
    let key = s;
    if (type) key += `-${type}`;
    if (wardNum) key += `-${wardNum}`;
    return key;
};

// Build maps
const presMap = new Map();
president2020.forEach(r => presMap.set(normalizeWard(r.ward), r));

const mayorMap = new Map();
mayor2023.forEach(r => {
    if (r.ward) mayorMap.set(normalizeWard(r.ward), r);
});

console.log("=== COMPREHENSIVE WARD VERIFICATION ===\n");

// Test Ward 50
console.log("WARD 50 (City of Madison):");
const ward50Key = normalizeWard("City of Madison Ward 50");
const pres50 = presMap.get(ward50Key);
const mayor50 = mayorMap.get(ward50Key);

if (pres50) {
    const margin2020 = ((pres50.biden - pres50.trump) / pres50.total * 100).toFixed(1);
    console.log(`  ✅ 2020 Margin: ${margin2020}% (Biden ${pres50.biden}, Trump ${pres50.trump}, Total ${pres50.total})`);
} else {
    console.log(`  ❌ 2020 Data: NOT FOUND`);
}

if (mayor50) {
    const marginMayor = ((mayor50.satya - mayor50.gloria) / mayor50.total * 100).toFixed(1);
    console.log(`  ✅ Current Margin (Mayor 2023): ${marginMayor}% (Satya ${mayor50.satya}, Gloria ${mayor50.gloria}, Total ${mayor50.total})`);
} else {
    console.log(`  ❌ Mayor Data: NOT FOUND`);
}

// Test Ward 58
console.log("\nWARD 58 (City of Madison):");
const ward58Key = normalizeWard("City of Madison Ward 58");
const pres58 = presMap.get(ward58Key);
const mayor58 = mayorMap.get(ward58Key);

if (pres58) {
    const margin2020 = ((pres58.biden - pres58.trump) / pres58.total * 100).toFixed(1);
    console.log(`  ✅ 2020 Margin: ${margin2020}% (Biden ${pres58.biden}, Trump ${pres58.trump}, Total ${pres58.total})`);
} else {
    console.log(`  ❌ 2020 Data: NOT FOUND`);
}

if (mayor58) {
    const marginMayor = ((mayor58.satya - mayor58.gloria) / mayor58.total * 100).toFixed(1);
    console.log(`  ✅ Current Margin (Mayor 2023): ${marginMayor}% (Satya ${mayor58.satya}, Gloria ${mayor58.gloria}, Total ${mayor58.total})`);
} else {
    console.log(`  ❌ Mayor Data: NOT FOUND`);
}

// Test Town of Madison
console.log("\nTOWN OF MADISON:");
const townKey = normalizeWard("MADISON TOWN");
const presTown = presMap.get(townKey);
if (presTown) {
    const margin2020 = ((presTown.biden - presTown.trump) / presTown.total * 100).toFixed(1);
    console.log(`  ✅ 2020 Margin: ${margin2020}% (Biden ${presTown.biden}, Trump ${presTown.trump}, Total ${presTown.total})`);
    console.log(`  Note: This is a dissolved municipality, should NOT be used for City wards`);
} else {
    console.log(`  ❌ 2020 Data: NOT FOUND`);
}

console.log("\n=== VERIFICATION COMPLETE ===");
