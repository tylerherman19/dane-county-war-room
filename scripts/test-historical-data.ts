#!/usr/bin/env ts-node

// Comprehensive test of historical data loading system
// This will test the ENTIRE flow from API to cache to component

import { getElections, getRaces, getPrecinctResults } from '../src/lib/api';
import { fetchHistoricalData, getHistoricalComparison } from '../src/lib/historical-api-data';

async function main() {
    console.log('=== COMPREHENSIVE HISTORICAL DATA TEST ===\n');

    // Test 1: Verify API data exists
    console.log('TEST 1: Verifying API Data Exists');
    console.log('-----------------------------------');

    try {
        const elections = await getElections();
        const election2020 = elections.find(e => e.electionName.includes('2020') && e.electionName.includes('General'));
        const election2023Spring = elections.find(e => e.electionName.includes('2023') && e.electionName.includes('Spring Election'));
        const election2019Spring = elections.find(e => e.electionName.includes('2019') && e.electionName.includes('Spring Election'));

        console.log(`✓ Found 2020 General: ${election2020?.electionName} (ID: ${election2020?.electionId})`);
        console.log(`✓ Found 2023 Spring: ${election2023Spring?.electionName} (ID: ${election2023Spring?.electionId})`);
        console.log(`✓ Found 2019 Spring: ${election2019Spring?.electionName} (ID: ${election2019Spring?.electionId})`);

        if (election2020) {
            const races2020 = await getRaces(election2020.electionId);
            const presRace = races2020.find(r => r.type === 'Presidential');
            console.log(`✓ Found Presidential race in 2020: ${presRace?.name} (Type: ${presRace?.type})`);

            if (presRace) {
                const results = await getPrecinctResults(election2020.electionId, presRace.id);
                console.log(`✓ Got ${results.length} precinct results for 2020 Presidential`);
                console.log(`  Sample ward: ${results[0]?.precinctName} Ward ${results[0]?.wardNumber}`);
            }
        }

        if (election2023Spring) {
            const races2023 = await getRaces(election2023Spring.electionId);
            const mayorRace = races2023.find(r => r.type === 'Mayor');
            console.log(`✓ Found Mayor race in 2023: ${mayorRace?.name} (Type: ${mayorRace?.type})`);
        }

    } catch (error) {
        console.error('✗ API Test Failed:', error);
        return;
    }

    console.log('\n');

    // Test 2: Test fetchHistoricalData()
    console.log('TEST 2: Testing fetchHistoricalData()');
    console.log('--------------------------------------');

    try {
        const historicalData = await fetchHistoricalData();
        console.log(`✓ fetchHistoricalData() completed`);
        console.log(`  Race types found: ${Array.from(historicalData.keys()).join(', ')}`);

        const presidentialRaces = historicalData.get('Presidential');
        if (presidentialRaces) {
            console.log(`✓ Presidential races: ${presidentialRaces.length}`);
            presidentialRaces.forEach(r => {
                console.log(`  - ${r.raceName} (${r.electionName}) - ${r.wardResults.size} wards`);
            });
        } else {
            console.error('✗ No Presidential races found!');
        }

        const mayorRaces = historicalData.get('Mayor');
        if (mayorRaces) {
            console.log(`✓ Mayor races: ${mayorRaces.length}`);
            mayorRaces.forEach(r => {
                console.log(`  - ${r.raceName} (${r.electionName}) - ${r.wardResults.size} wards`);
            });
        } else {
            console.error('✗ No Mayor races found!');
        }

    } catch (error) {
        console.error('✗ fetchHistoricalData() Failed:', error);
        return;
    }

    console.log('\n');

    // Test 3: Test getHistoricalComparison()
    console.log('TEST 3: Testing getHistoricalComparison()');
    console.log('-----------------------------------------');

    try {
        // Test Madison Ward 50
        const ward50Comparison = await getHistoricalComparison('madison-city-50', 'Presidential');
        if (ward50Comparison && ward50Comparison.historical) {
            console.log(`✓ Found historical data for Madison Ward 50 (Presidential)`);
            console.log(`  Race: ${ward50Comparison.historicalRaceName}`);
            console.log(`  Date: ${ward50Comparison.historicalElectionDate}`);
            console.log(`  Margin: ${(ward50Comparison.historical.margin * 100).toFixed(1)}%`);
            console.log(`  Votes: ${ward50Comparison.historical.totalVotes}`);
        } else {
            console.error('✗ No historical data found for Madison Ward 50 (Presidential)');
        }

        // Test Mayor
        const ward50Mayor = await getHistoricalComparison('madison-city-50', 'Mayor');
        if (ward50Mayor && ward50Mayor.historical) {
            console.log(`✓ Found historical data for Madison Ward 50 (Mayor)`);
            console.log(`  Race: ${ward50Mayor.historicalRaceName}`);
            console.log(`  Date: ${ward50Mayor.historicalElectionDate}`);
            console.log(`  Margin: ${(ward50Mayor.historical.margin * 100).toFixed(1)}%`);
        } else {
            console.error('✗ No historical data found for Madison Ward 50 (Mayor)');
        }

    } catch (error) {
        console.error('✗ getHistoricalComparison() Failed:', error);
        return;
    }

    console.log('\n=== TEST COMPLETE ===');
}

main().catch(console.error);
