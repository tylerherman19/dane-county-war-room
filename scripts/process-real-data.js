const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const { pipeline } = require('stream');
const { promisify } = require('util');

const streamPipeline = promisify(pipeline);

const PRESIDENT_2020_URL = 'https://int.nyt.com/newsgraphics/elections/map-data/2020/national/precincts-with-results.geojson.gz';
const TEMP_GZ_PATH = path.join(__dirname, 'temp-2020.geojson.gz');
const TEMP_JSON_PATH = path.join(__dirname, 'temp-2020.geojson');
const OUTPUT_PRES_PATH = path.join(__dirname, '../src/lib/real-data/president-2020.json');
const OUTPUT_MAYOR_PATH = path.join(__dirname, '../src/lib/real-data/mayor-2023.json');
const PRECINCT_TEST_PATH = path.join(__dirname, '../precinct_test.json');

// Dane County FIPS: 55025
const DANE_COUNTY_PREFIX = '55025';

async function downloadFile(url, outputPath) {
    console.log(`Downloading ${url}...`);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('Download complete.');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => { });
            reject(err);
        });
    });
}

async function decompressFile(inputPath, outputPath) {
    console.log(`Decompressing ${inputPath}...`);
    const gunzip = zlib.createGunzip();
    const source = fs.createReadStream(inputPath);
    const destination = fs.createWriteStream(outputPath);
    await streamPipeline(source, gunzip, destination);
    console.log('Decompression complete.');
}

function normalizeWard(name) {
    const lower = name.toLowerCase();
    const wardMatch = lower.match(/ward\s+(\d+)/);
    const wardNum = wardMatch ? wardMatch[1] : '';

    if (lower.includes('madison')) return `madison-${wardNum}`;
    if (lower.includes('fitchburg')) return `fitchburg-${wardNum}`;
    if (lower.includes('sun prairie')) return `sun-prairie-${wardNum}`;
    if (lower.includes('middleton')) return `middleton-${wardNum}`;
    if (lower.includes('verona')) return `verona-${wardNum}`;
    if (lower.includes('monona')) return `monona-${wardNum}`;
    if (lower.includes('stoughton')) return `stoughton-${wardNum}`;

    // Towns/Villages often just have the name
    // "Town of Albion" -> "albion"
    // "Village of Dane" -> "dane"
    let cleanName = lower
        .replace(/^town of\s+/, '')
        .replace(/^village of\s+/, '')
        .replace(/^city of\s+/, '')
        .replace(/\s+/g, '-');

    if (wardNum) {
        return `${cleanName}-${wardNum}`;
    }
    return cleanName;
}

async function processPresident2020() {
    console.log('Processing 2020 Presidential Data...');

    // 1. Download
    await downloadFile(PRESIDENT_2020_URL, TEMP_GZ_PATH);

    // 2. Decompress
    await decompressFile(TEMP_GZ_PATH, TEMP_JSON_PATH);

    // 3. Parse and Filter using jq
    console.log('Filtering with jq...');
    const { execSync } = require('child_process');
    const jqCommand = `jq -c '.features[] | select(.properties.GEOID | startswith("${DANE_COUNTY_PREFIX}")) | {ward: .properties.GEOID, biden: .properties.votes_dem, trump: .properties.votes_rep, total: .properties.votes_total}' "${TEMP_JSON_PATH}"`;

    const rawDaneData = execSync(jqCommand, { maxBuffer: 1024 * 1024 * 50 }).toString();

    // jq outputs one JSON object per line
    const lines = rawDaneData.trim().split('\n');
    console.log(`Found ${lines.length} Dane County precincts.`);

    const results = lines.map(line => {
        const p = JSON.parse(line);
        // GEOID format: 55025-PRECINCT_NAME
        const namePart = p.ward.replace(`${DANE_COUNTY_PREFIX}-`, '');

        return {
            ward: namePart,
            biden: p.biden,
            trump: p.trump,
            total: p.total
        };
    });

    fs.writeFileSync(OUTPUT_PRES_PATH, JSON.stringify(results, null, 2));
    console.log(`Saved 2020 data to ${OUTPUT_PRES_PATH}`);

    // Cleanup
    fs.unlinkSync(TEMP_GZ_PATH);
    fs.unlinkSync(TEMP_JSON_PATH);
}

async function processMayor2023() {
    console.log('Processing 2023 Mayor Data...');

    if (!fs.existsSync(PRECINCT_TEST_PATH)) {
        console.error('precinct_test.json not found!');
        return;
    }

    const rawData = fs.readFileSync(PRECINCT_TEST_PATH, 'utf8');
    const data = JSON.parse(rawData);

    // Filter for Mayor race (RaceNumber 0015 based on file inspection)
    // Or just look for "Mayor" in RaceName
    const mayorVotes = data.PrecinctVotes.filter(pv => pv.RaceName.includes('Mayor'));

    // Group by precinct
    const precinctMap = {};

    mayorVotes.forEach(pv => {
        const pName = pv.PrecinctName.trim();
        if (!precinctMap[pName]) {
            precinctMap[pName] = { ward: pName, satya: 0, gloria: 0, total: 0 };
        }

        const candidate = pv.CandidateName.trim();
        if (candidate.includes('Satya')) {
            precinctMap[pName].satya += pv.TotalVotes;
        } else if (candidate.includes('Gloria')) {
            precinctMap[pName].gloria += pv.TotalVotes;
        }
        precinctMap[pName].total += pv.TotalVotes;
    });

    const results = Object.values(precinctMap);
    console.log(`Found ${results.length} precincts for 2023 Mayor.`);

    fs.writeFileSync(OUTPUT_MAYOR_PATH, JSON.stringify(results, null, 2));
    console.log(`Saved 2023 data to ${OUTPUT_MAYOR_PATH}`);
}

async function main() {
    try {
        await processPresident2020();
        await processMayor2023();
        console.log('All data processed successfully.');
    } catch (err) {
        console.error('Error processing data:', err);
        process.exit(1);
    }
}

main();
