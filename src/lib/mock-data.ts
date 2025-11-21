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
            return [
                { candidateName: "Yes", votes: 0, percentage: 0 },
                { candidateName: "No", votes: 0, percentage: 0 }
            ];
        }
    }

    // 2023
    if (race.id === 'mayor-2023') {
        return [
            { candidateName: "Satya Rhodes-Conway", votes: 0, percentage: 0, party: "Non-Partisan" },
            { candidateName: "Gloria Reyes", votes: 0, percentage: 0, party: "Non-Partisan" }
        ];
    }

    // 2022
    if (race.electionId === "2022-11-08") {
        if (race.type === 'Governor') {
            return [
                { candidateName: "Tony Evers", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Tim Michels", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Mandela Barnes", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Ron Johnson", votes: 0, percentage: 0, party: "Republican" }
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
                { candidateName: "Joseph R. Biden / Kamala Harris", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Donald J. Trump / Mike Pence", votes: 0, percentage: 0, party: "Republican" }
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
    if (race.id === 'mayor-2019') {
        return [
            { candidateName: "Satya Rhodes-Conway", votes: 0, percentage: 0, party: "Non-Partisan" },
            { candidateName: "Paul Soglin", votes: 0, percentage: 0, party: "Non-Partisan" }
        ];
    }

    // 2018
    if (race.electionId === "2018-11-06") {
        if (race.type === 'Governor') {
            return [
                { candidateName: "Tony Evers", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Scott Walker", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Tammy Baldwin", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Leah Vukmir", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
    }

    // 2016
    if (race.electionId === "2016-11-08") {
        if (race.type === 'Presidential') {
            return [
                { candidateName: "Hillary Clinton / Tim Kaine", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Donald J. Trump / Mike Pence", votes: 0, percentage: 0, party: "Republican" }
            ];
        }
        if (race.type === 'Senate') {
            return [
                { candidateName: "Russ Feingold", votes: 0, percentage: 0, party: "Democratic" },
                { candidateName: "Ron Johnson", votes: 0, percentage: 0, party: "Republican" }
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
export const generateMockPrecinctResults = (raceId: string) => {
    const results: any[] = [];
    const race = mockRaces.find(r => r.id === raceId);

    if (!race) return [];

    const candidates = mockRaceResults[raceId]?.candidates || [];
    if (candidates.length < 2) return [];

    // Iterate through all municipalities in the mapping
    Object.entries(wardDistricts).forEach(([muniName, wards]) => {
        // Determine bias based on municipality name (simple heuristic)
        let demBias = 0.55; // Default slight lean
        if (muniName.includes('Madison')) demBias = 0.85;
        else if (muniName.includes('Fitchburg') || muniName.includes('Middleton') || muniName.includes('Sun Prairie')) demBias = 0.65;
        else if (muniName.includes('Verona') || muniName.includes('Oregon')) demBias = 0.60;
        else demBias = 0.45; // Rural areas lean Rep

        (wards as any[]).forEach(wardInfo => {
            // Check if this ward belongs to the race's district
            let includeWard = false;

            if (race.type === 'Presidential' || race.type === 'Senate' || race.type === 'Referendum') {
                includeWard = true; // All wards
            } else if (race.type === 'Congress') {
                includeWard = wardInfo.cong === race.districtId;
            } else if (race.type === 'StateSenate') {
                includeWard = wardInfo.sen === race.districtId;
            } else if (race.type === 'Assembly') {
                includeWard = wardInfo.asm === race.districtId;
            } else if (race.type === 'Mayor') {
                includeWard = muniName.includes('Madison');
            }

            if (includeWard) {
                const registeredVoters = Math.floor(Math.random() * 800) + 200;
                const turnout = 0.7 + Math.random() * 0.2;
                const ballotscast = Math.floor(registeredVoters * turnout);

                // Calculate votes
                const demPercentage = demBias + (Math.random() * 0.15 - 0.075);
                const demVotes = Math.floor(ballotscast * Math.min(Math.max(demPercentage, 0), 1));
                const repVotes = ballotscast - demVotes;

                results.push({
                    precinctName: muniName,
                    wardNumber: wardInfo.ward,
                    candidateName: candidates[0].candidateName,
                    votes: demVotes,
                    registeredVoters,
                    ballotscast
                });

                results.push({
                    precinctName: muniName,
                    wardNumber: wardInfo.ward,
                    candidateName: candidates[1].candidateName,
                    votes: repVotes,
                    registeredVoters,
                    ballotscast
                });
            }
        });
    });

    return results;
};
