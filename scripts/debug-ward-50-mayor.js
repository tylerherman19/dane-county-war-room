const fs = require('fs');
const path = require('path');

// Load Data
const mayorPath = path.join(__dirname, '../src/lib/real-data/mayor-2023.json');
const mayor2023 = JSON.parse(fs.readFileSync(mayorPath, 'utf8'));

// Find Ward 50
const ward50 = mayor2023.find(r => r.ward && r.ward.includes('050'));

if (ward50) {
    console.log("Ward 50 Mayor 2023 Data:");
    console.log(JSON.stringify(ward50, null, 2));

    const satya = Number(ward50.satya || 0);
    const gloria = Number(ward50.gloria || 0);
    const total = ward50.total || (satya + gloria);

    console.log("\nCalculations:");
    console.log(`Satya: ${satya}`);
    console.log(`Gloria: ${gloria}`);
    console.log(`Total (from data): ${ward50.total}`);
    console.log(`Total (calculated): ${satya + gloria}`);

    const margin = (satya - gloria) / total;
    console.log(`\nMargin: (${satya} - ${gloria}) / ${total} = ${margin}`);
    console.log(`Margin %: ${(margin * 100).toFixed(1)}%`);
} else {
    console.log("Ward 50 not found in Mayor 2023 data");
}
