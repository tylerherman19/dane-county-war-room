
const fs = require('fs');
const path = require('path');

const geoJsonPath = path.join(__dirname, '../public/dane_wards.geojson');
const outputPath = path.join(__dirname, '../src/lib/ward-districts.json');

try {
    const rawData = fs.readFileSync(geoJsonPath);
    const geoJson = JSON.parse(rawData);

    const mapping = {};

    geoJson.features.forEach(feature => {
        const props = feature.properties;
        const muni = props.NAME;
        const ward = props.WardNumber;

        if (!mapping[muni]) {
            mapping[muni] = [];
        }

        mapping[muni].push({
            ward: ward,
            asm: props.AsmDistrict,
            sen: props.SenDistrict,
            cong: props.HoRDistrict,
            sup: props.SupDistrict,
            ald: props.AldDistrict
        });
    });

    fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
    console.log(`Successfully wrote ward mapping to ${outputPath}`);
    console.log(`Found ${Object.keys(mapping).length} municipalities.`);

} catch (error) {
    console.error('Error processing GeoJSON:', error);
}
