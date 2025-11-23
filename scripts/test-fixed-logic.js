const fs = require('fs');
const path = require('path');

// Load Data
const mayorPath = path.join(__dirname, '../src/lib/real-data/mayor-2023.json');
const mayor2023 = JSON.parse(fs.readFileSync(mayorPath, 'utf8'));

// Simulate the FIXED logic
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

const mayorMap = new Map();
mayor2023.forEach(r => {
    if (r.ward) {
        mayorMap.set(normalizeWard(r.ward), r);
    }
});

// Test Ward 50
const key = normalizeWard("City of Madison Ward 50");
console.log(`Looking up key: "${key}"`);

const result = mayorMap.get(key);
if (result) {
    console.log("Found:", JSON.stringify(result, null, 2));

    const satya = Number(result.satya || 0);
    const gloria = Number(result.gloria || 0);
    const total = Number(result.total || 0);

    console.log(`\nUsing ACTUAL total from data: ${total}`);
    const margin = (satya - gloria) / total;
    console.log(`Margin: (${satya} - ${gloria}) / ${total} = ${(margin * 100).toFixed(1)}%`);
} else {
    console.log("NOT FOUND");
}
