// Quick test to check what race data looks like
const fetch = require('node-fetch');

async function test() {
    try {
        // Get elections
        const electionsRes = await fetch('https://api.danecounty.gov/api/v1/elections/list');
        const elections = await electionsRes.json();

        // Find 2024 General
        const election2024 = elections.find(e => e.ElectionName.includes('2024') && e.ElectionName.includes('General'));
        console.log('2024 Election:', election2024);

        if (!election2024) {
            console.log('No 2024 election found');
            return;
        }

        // Get races
        const racesRes = await fetch(`https://api.danecounty.gov/api/v1/elections/races/${election2024.ElectionId}`);
        const races = await racesRes.json();

        console.log('\nRaces:');
        races.forEach(r => {
            console.log(`  - ${r.RaceName} (${r.RaceNumber})`);
            const lower = r.RaceName.toLowerCase();
            console.log(`    Lowercase: "${lower}"`);
            console.log(`    Contains 'president': ${lower.includes('president')}`);
        });

        // Get President race results
        const presRace = races.find(r => r.RaceName.toLowerCase().includes('president'));
        if (presRace) {
            console.log('\n\nFetching President race results...');
            const resultsRes = await fetch(`https://api.danecounty.gov/api/v1/elections/electionresults/${election2024.ElectionId}/${presRace.RaceNumber}`);
            const results = await resultsRes.json();
            console.log('Race Name from results:', results.RaceName);
            console.log('Lowercase:', results.RaceName.toLowerCase());
            console.log('Includes president:', results.RaceName.toLowerCase().includes('president'));
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

test();
