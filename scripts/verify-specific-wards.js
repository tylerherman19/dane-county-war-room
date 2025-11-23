const fs = require('fs');
const path = require('path');

// Load Data
const presPath = path.join(__dirname, '../src/lib/real-data/president-2020.json');
const president2020 = JSON.parse(fs.readFileSync(presPath, 'utf8'));

// Test specific wards that the user might check
const testWards = [
    { name: "MADISON CITY WARD 050", expectedMargin: 70.3 },
    { name: "MADISON CITY WARD 058", expectedMargin: 69.7 },
    { name: "MADISON CITY WARD 056", expectedMargin: null }, // Will calculate
    { name: "MADISON TOWN", expectedMargin: 75.0 }
];

console.log("Verifying Ward Data:\n");

testWards.forEach(test => {
    const entry = president2020.find(r => r.ward === test.name);
    if (entry) {
        const margin = ((entry.biden - entry.trump) / entry.total) * 100;
        const marginStr = margin.toFixed(1);
        const expected = test.expectedMargin || marginStr;
        const status = Math.abs(parseFloat(marginStr) - parseFloat(expected)) < 0.1 ? "✅" : "❌";
        console.log(`${status} ${test.name}`);
        console.log(`   Biden: ${entry.biden}, Trump: ${entry.trump}, Total: ${entry.total}`);
        console.log(`   Margin: ${marginStr}% (Expected: ${expected}%)\n`);
    } else {
        console.log(`❌ ${test.name} - NOT FOUND\n`);
    }
});
