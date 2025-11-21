import { Race, RaceType } from './api';
import wardDistricts from './ward-districts.json';

// Mock data for development
export const mockElections = [
    {
        electionId: "2024-11-05",
        electionName: "November 2024 General Election",
        electionDate: "2024-11-05"
    },
    {
        electionId: "2023-04-04",
        electionName: "Spring 2023 General Election",
        electionDate: "2023-04-04"
    },
    {
        electionId: "2022-11-08",
        electionName: "November 2022 General Election",
        electionDate: "2022-11-08"
    },
    {
        electionId: "2020-11-03",
        electionName: "November 2020 General Election",
        electionDate: "2020-11-03"
    },
    {
        electionId: "2019-04-02",
        electionName: "Spring 2019 General Election",
        electionDate: "2019-04-02"
    },
    {
        electionId: "2018-11-06",
        electionName: "November 2018 General Election",
        electionDate: "2018-11-06"
    },
    {
        electionId: "2016-11-08",
        electionName: "November 2016 General Election",
        electionDate: "2016-11-08"
    }
];

export const mockLastPublished = {
    lastPublished: new Date().toISOString()
};

// Comprehensive 2024 Race Definitions
export const mockRaces: Race[] = [
    // ... (Keep existing 2024 races) ...
    // Federal
    {
        id: "1",
        electionId: "2024-11-05",
        name: "President / Vice President",
        type: 'Presidential',
        totalPrecincts: 260,
        precinctsReporting: 260,
        candidates: [],
        lastUpdated: new Date().toISOString()
    },
    {
        id: "2",
        electionId: "2024-11-05",
        name: "United States Senator",
        type: 'Senate',
        totalPrecincts: 260,
        precinctsReporting: 260,
        candidates: [],
        lastUpdated: new Date().toISOString()
    },
    {
        id: "3",
        electionId: "2024-11-05",
        name: "Representative in Congress District 2",
        type: 'Congress',
        districtId: "2",
        totalPrecincts: 260,
        precinctsReporting: 260,
        candidates: [],
        lastUpdated: new Date().toISOString()
    },

    // State Senate (Districts appearing in Dane County)
    { id: "4", electionId: "2024-11-05", name: "State Senator District 16", type: 'StateSenate', districtId: "16", totalPrecincts: 50, precinctsReporting: 50, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "5", electionId: "2024-11-05", name: "State Senator District 26", type: 'StateSenate', districtId: "26", totalPrecincts: 50, precinctsReporting: 50, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "6", electionId: "2024-11-05", name: "State Senator District 27", type: 'StateSenate', districtId: "27", totalPrecincts: 50, precinctsReporting: 50, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "7", electionId: "2024-11-05", name: "State Senator District 14", type: 'StateSenate', districtId: "14", totalPrecincts: 50, precinctsReporting: 50, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "8", electionId: "2024-11-05", name: "State Senator District 13", type: 'StateSenate', districtId: "13", totalPrecincts: 50, precinctsReporting: 50, candidates: [], lastUpdated: new Date().toISOString() },

    // State Assembly (Districts appearing in Dane County)
    { id: "9", electionId: "2024-11-05", name: "Representative to the Assembly District 76", type: 'Assembly', districtId: "76", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "10", electionId: "2024-11-05", name: "Representative to the Assembly District 77", type: 'Assembly', districtId: "77", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "11", electionId: "2024-11-05", name: "Representative to the Assembly District 78", type: 'Assembly', districtId: "78", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "12", electionId: "2024-11-05", name: "Representative to the Assembly District 79", type: 'Assembly', districtId: "79", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "13", electionId: "2024-11-05", name: "Representative to the Assembly District 80", type: 'Assembly', districtId: "80", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "14", electionId: "2024-11-05", name: "Representative to the Assembly District 46", type: 'Assembly', districtId: "46", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "15", electionId: "2024-11-05", name: "Representative to the Assembly District 47", type: 'Assembly', districtId: "47", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "16", electionId: "2024-11-05", name: "Representative to the Assembly District 48", type: 'Assembly', districtId: "48", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "17", electionId: "2024-11-05", name: "Representative to the Assembly District 42", type: 'Assembly', districtId: "42", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },

    // Referendum
    { id: "18", electionId: "2024-11-05", name: "State Referendum (Eligibility to vote)", type: 'Referendum', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },

    // Spring 2023 - Madison Mayor
    {
        id: "race-2024-ref",
        electionId: "2024-11-05",
        name: "City of Madison Referendum",
        type: "Referendum",
        totalPrecincts: 100,
        precinctsReporting: 100,
        candidates: [],
        lastUpdated: new Date().toISOString()
    },
    {
        id: "mayor-2023",
        electionId: "2023-04-04",
        name: "Mayor of Madison",
        type: 'Mayor',
        totalPrecincts: 100, // Approx Madison wards
        precinctsReporting: 100,
        candidates: [],
        lastUpdated: new Date().toISOString()
    },

    // 2022 General
    { id: "gov-2022", electionId: "2022-11-08", name: "Governor / Lieutenant Governor", type: 'Governor', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "sen-2022", electionId: "2022-11-08", name: "United States Senator", type: 'Senate', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "asm-76-2022", electionId: "2022-11-08", name: "Representative to the Assembly District 76", type: 'Assembly', districtId: "76", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },

    // 2020 General
    { id: "pres-2020", electionId: "2020-11-03", name: "President / Vice President", type: 'Presidential', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "asm-76-2020", electionId: "2020-11-03", name: "Representative to the Assembly District 76", type: 'Assembly', districtId: "76", totalPrecincts: 20, precinctsReporting: 20, candidates: [], lastUpdated: new Date().toISOString() },

    // Spring 2019 - Madison Mayor
    {
        id: "mayor-2019",
        electionId: "2019-04-02",
        name: "Mayor of Madison",
        type: 'Mayor',
        totalPrecincts: 100,
        precinctsReporting: 100,
        candidates: [],
        lastUpdated: new Date().toISOString()
    },

    // 2018 General
    { id: "gov-2018", electionId: "2018-11-06", name: "Governor / Lieutenant Governor", type: 'Governor', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "sen-2018", electionId: "2018-11-06", name: "United States Senator", type: 'Senate', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },

    // 2016 General
    { id: "pres-2016", electionId: "2016-11-08", name: "President / Vice President", type: 'Presidential', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() },
    { id: "sen-2016", electionId: "2016-11-08", name: "United States Senator", type: 'Senate', totalPrecincts: 260, precinctsReporting: 260, candidates: [], lastUpdated: new Date().toISOString() }
];

// Helper to get candidates for a race
const getCandidatesForRace = (race: Race) => {
    // 2024
    if (race.electionId === "2024-11-05") {
        if (race.type === 'Presidential') {
            return [
                { candidateName: "Kamala D. Harris / Tim Walz", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Donald J. Trump / JD Vance", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Tammy Baldwin", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Eric Hovde", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Congress') {
            return [
                { candidateName: "Mark Pocan", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Peter Theron", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'StateSenate') {
            return [
                { candidateName: "Democratic Candidate", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Republican Candidate", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Assembly') {
            return [
                { candidateName: "Democratic Candidate", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Republican Candidate", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Referendum') {
            // City of Madison Referendum (57% Yes)
            if (race.id === 'race-2024-ref') {
                return [
                    { candidateName: "Yes", votes: 0, percentage: 57.0, party: "Non-Partisan" },
                    { candidateName: "No", votes: 0, percentage: 43.0, party: "Non-Partisan" }
                ];
            }
            // Generic referendum
            return [
                { candidateName: "Yes", votes: 0, percentage: 0 },
                { candidateName: "No", votes: 0, percentage: 0 }
            ];
        }
    }

    // 2023
    if (race.id === 'mayor-2023') {
        return [
            { candidateName: "Satya Rhodes-Conway", votes: 0, percentage: 55.2, party: "Non-Partisan" },
            { candidateName: "Gloria Reyes", votes: 0, percentage: 44.1, party: "Non-Partisan" }
        ];
    }

    // 2022
    if (race.electionId === "2022-11-08") {
        if (race.type === 'Governor') {
            return [
                { candidateName: "Tony Evers", votes: 236577, percentage: 78.6, party: "Democratic" },
                { candidateName: "Tim Michels", votes: 62300, percentage: 20.7, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Mandela Barnes", votes: 0, percentage: 77.0, party: "Democratic" }, // Est based on Evers
                { candidateName: "Ron Johnson", votes: 0, percentage: 22.0, party: "Republican" }
            ];
        }
        if (race.type === 'Assembly') {
            return [
                { candidateName: "Democratic Candidate", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Republican Candidate", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
    }

    // 2020
    if (race.electionId === "2020-11-03") {
        if (race.type === 'Presidential') {
            return [
                { candidateName: "Joseph R. Biden / Kamala Harris", votes: 260121, percentage: 75.5, party: "Democratic" },
                { candidateName: "Donald J. Trump / Mike Pence", votes: 78789, percentage: 22.9, party: "Republican" }
            ];
        }
        if (race.type === 'Assembly') {
            return [
                { candidateName: "Democratic Candidate", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Republican Candidate", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
    }

    // 2019 Spring
    if (race.electionId === "2019-04-02") {
        if (race.type === 'Mayor') {
            return [
                { candidateName: "Satya Rhodes-Conway", votes: 47915, percentage: 61.9, party: "Non-Partisan" },
                { candidateName: "Paul Soglin", votes: 29150, percentage: 37.5, party: "Non-Partisan" }
            ];
        }
    }

    // 2018
    if (race.electionId === "2018-11-06") {
        if (race.type === 'Governor') {
            return [
                { candidateName: "Tony Evers", votes: 220052, percentage: 74.7, party: "Democratic" },
                { candidateName: "Scott Walker", votes: 69206, percentage: 23.5, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Tammy Baldwin", votes: 228050, percentage: 77.6, party: "Democratic" },
                { candidateName: "Leah Vukmir", votes: 65515, percentage: 22.3, party: "Republican" }
            ];
        }
    }

    // 2016
    if (race.electionId === "2016-11-08") {
        if (race.type === 'Presidential') {
            return [
                { candidateName: "Hillary Clinton / Tim Kaine", votes: 217697, percentage: 70.4, party: "Democratic" },
                { candidateName: "Donald J. Trump / Mike Pence", votes: 71275, percentage: 23.0, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Russ Feingold", votes: 0, percentage: 72.0, party: "Democratic" },
                { candidateName: "Ron Johnson", votes: 0, percentage: 25.0, party: "Republican" }
            ];
        }
    }

    return [];
};

// Populate candidates in mockRaces
mockRaces.forEach(race => {
    race.candidates = getCandidatesForRace(race);
});

export const mockRaceResults = mockRaces.reduce((acc, race) => {
    acc[race.id] = {
        id: race.id,
        raceName: race.name,
        candidates: race.candidates,
        totalVotes: 0,
        precinctsReporting: race.precinctsReporting,
        totalPrecincts: race.totalPrecincts
    };
    return acc;
}, {} as any);


// Generate mock precinct results using Ward Districts Mapping
import mayor2023Data from './real-data/mayor-2023.json';

export const generateMockPrecinctResults = (raceId: string) => {
    const results: any[] = [];
    const race = mockRaces.find(r => r.id === raceId);

    if (!race) return [];

    // ... (existing imports)

    // ... (inside generateMockPrecinctResults)

    // SPECIAL OVERRIDE: Use Real Data for 2023 Mayor
    if (race.id === 'mayor-2023') {
        const realResults: any[] = [];

        // Helper to parse "C Madison Wd 1" -> "1"
        const getWardNum = (str: string) => {
            const match = str.match(/Wd\s+(\d+)/);
            return match ? match[1] : null;
        };

        mayor2023Data.forEach((row: any) => {
            const wardNum = getWardNum(row.ward);
            if (wardNum) {
                const satyaVotes = parseInt(row.satya) || 0;
                const gloriaVotes = parseInt(row.gloria) || 0;
                const total = satyaVotes + gloriaVotes;

                // Satya
                realResults.push({
                    precinctName: "City of Madison",
                    wardNumber: wardNum,
                    candidateName: "Satya Rhodes-Conway",
                    votes: satyaVotes,
                    registeredVoters: Math.floor(total * 1.4), // Estimate
                    ballotscast: total,
                    isDem: true
                });

                // Gloria
                realResults.push({
                    precinctName: "City of Madison",
                    wardNumber: wardNum,
                    candidateName: "Gloria Reyes",
                    votes: gloriaVotes,
                    registeredVoters: Math.floor(total * 1.4), // Estimate
                    ballotscast: total,
                    isDem: false
                });
            }
        });

        return realResults;
    }

    const candidates = mockRaceResults[raceId]?.candidates || [];

    // First pass: Generate raw votes based on bias
    let generatedResults: any[] = [];
    let totalDemVotes = 0;
    let totalRepVotes = 0;
    let totalBallots = 0;

    // Iterate through all municipalities in the mapping
    Object.entries(wardDistricts).forEach(([muniName, wards]) => {
        // Determine bias based on municipality name (simple heuristic)
        let demBias = 0.55; // Default slight lean

        // Use actual election percentages if available
        if (candidates.length >= 2 && candidates[0].percentage > 0) {
            const actualPercentage = candidates[0].percentage / 100;

            // If it's a Mayor race, use Aldermanic District logic for Madison
            if (race.type === 'Mayor' && muniName.includes('Madison')) {
                demBias = actualPercentage;
            }
            // For county-wide races (Gov, Sen, Pres), adjust based on Muni
            else {
                // Assuming the actualPercentage is the County Average
                // Madison is usually +10-15% points higher than county average
                // Rural is usually -10-20% points lower
                if (muniName.includes('Madison')) demBias = Math.min(actualPercentage + 0.10, 0.90);
                else if (muniName.includes('Fitchburg') || muniName.includes('Middleton')) demBias = actualPercentage;
                else demBias = Math.max(actualPercentage - 0.15, 0.30);
            }
        } else {
            // Fallback if no percentage data
            if (muniName.includes('Madison')) demBias = 0.75;
            else if (muniName.includes('Fitchburg') || muniName.includes('Middleton') || muniName.includes('Sun Prairie')) demBias = 0.65;
            else if (muniName.includes('Verona') || muniName.includes('Oregon')) demBias = 0.60;
            else demBias = 0.45; // Rural areas lean Rep
        }

        (wards as any[]).forEach(wardInfo => {
            // Check if this ward belongs to the race's district
            let includeWard = false;

            if (race.type === 'Presidential' || race.type === 'Senate') {
                includeWard = true; // All wards
            } else if (race.type === 'Referendum') {
                // City of Madison Referendum only includes Madison wards
                if (race.id === 'race-2024-ref') {
                    includeWard = muniName.includes('Madison');
                } else {
                    includeWard = true; // Other referendums county-wide
                }
            } else if (race.type === 'Congress') {
                includeWard = wardInfo.cong === race.districtId;
            } else if (race.type === 'StateSenate') {
                includeWard = wardInfo.sen === race.districtId;
            } else if (race.type === 'Assembly') {
                includeWard = wardInfo.asm === race.districtId;
            } else if (race.type === 'Mayor') {
                includeWard = muniName.includes('Madison');
            } else if (race.type === 'Governor') {
                includeWard = true;
            }

            if (includeWard) {
                const registeredVoters = Math.floor(Math.random() * 800) + 200;
                const turnout = 0.7 + Math.random() * 0.2;
                const ballotscast = Math.floor(registeredVoters * turnout);

                // Calculate votes with slight variation around the bias
                let localBias = demBias;

                // SPECIAL LOGIC FOR 2023 MAYOR RACE (Satya vs Reyes)
                // Satya (demBias) won 55.2% overall, but lost outer wards.
                // We use Aldermanic Districts to simulate this.
                if (race.id === 'mayor-2023' && muniName.includes('Madison')) {
                    const ald = parseInt(wardInfo.ald);

                    // Satya Strongholds (Central/Near East/West): Districts 2, 4, 6, 8, 13, 15
                    if ([2, 4, 6, 8, 13, 15].includes(ald)) {
                        localBias = 0.70; // Satya wins big
                    }
                    // Reyes Strongholds/Competitive (Far West/Southwest/North): Districts 1, 9, 14, 16, 17, 18, 19, 20
                    else if ([1, 9, 14, 16, 17, 18, 19, 20].includes(ald)) {
                        localBias = 0.42; // Reyes wins (Satya gets 42%)
                    }
                    // Swing/Mixed: 3, 5, 7, 10, 11, 12
                    else {
                        localBias = 0.52; // Satya barely wins or tossup
                    }
                }

                const variation = Math.random() * 0.08 - 0.04; // +/- 4% variation
                const demPercentage = Math.min(Math.max(localBias + variation, 0.1), 0.9);
                const demVotes = Math.floor(ballotscast * demPercentage);
                const repVotes = ballotscast - demVotes;

                generatedResults.push({
                    precinctName: muniName,
                    wardNumber: wardInfo.ward,
                    candidateName: candidates[0].candidateName, // Dem/Satya
                    votes: demVotes,
                    registeredVoters,
                    ballotscast,
                    isDem: true
                });

                generatedResults.push({
                    precinctName: muniName,
                    wardNumber: wardInfo.ward,
                    candidateName: candidates[1].candidateName, // Rep/Reyes
                    votes: repVotes,
                    registeredVoters,
                    ballotscast,
                    isDem: false
                });

                totalDemVotes += demVotes;
                totalRepVotes += repVotes;
                totalBallots += ballotscast;
            }
        });
    });

    // Normalization Step for 2023 Mayor
    // Ensure totals match official results exactly: Satya 63,078, Reyes 50,405
    if (race.id === 'mayor-2023' && candidates[0].votes > 0 && candidates[1].votes > 0) {
        const targetDem = candidates[0].votes; // 63078
        const targetRep = candidates[1].votes; // 50405

        const demFactor = targetDem / totalDemVotes;
        const repFactor = targetRep / totalRepVotes;

        generatedResults.forEach(r => {
            if (r.isDem) {
                r.votes = Math.round(r.votes * demFactor);
            } else {
                r.votes = Math.round(r.votes * repFactor);
            }
        });
    }

    return generatedResults;
};
