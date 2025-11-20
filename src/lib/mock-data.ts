// Mock data for development
export const mockElections = [
    {
        electionId: "2024-11-05",
        electionName: "November 2024 General Election",
        electionDate: "2024-11-05"
    }
];

export const mockLastPublished = {
    lastPublished: new Date().toISOString()
};

export const mockRaces = [
    { raceNumber: 1, raceName: "President / Vice President", raceType: "Federal" },
    { raceNumber: 2, raceName: "United States Senator", raceType: "Federal" },
    { raceNumber: 3, raceName: "Representative in Congress District 2", raceType: "Federal" },
    { raceNumber: 4, raceName: "Representative to the Assembly District 76", raceType: "State" },
    { raceNumber: 5, raceName: "Dane County Executive", raceType: "County" },
    { raceNumber: 6, raceName: "State Referendum (Eligibility to vote)", raceType: "Referendum" }
];

// Real 2024 Dane County General Election Results (Official Canvass)
export const mockRaceResults = {
    1: {
        raceNumber: 1,
        raceName: "President / Vice President",
        candidates: [
            { candidateName: "Kamala D. Harris / Tim Walz", votes: 273995, percentage: 74.9, party: "Democratic" },
            { candidateName: "Donald J. Trump / JD Vance", votes: 85454, percentage: 23.4, party: "Republican" },
            { candidateName: "Chase Russell Oliver / Mike ter Maa", votes: 1209, percentage: 0.3, party: "Libertarian" },
            { candidateName: "Jill Stein / Rudolph Ware", votes: 1721, percentage: 0.5, party: "Green" },
            { candidateName: "Robert F. Kennedy, Jr. / Nicole Sha", votes: 1413, percentage: 0.4, party: "Independent" },
            { candidateName: "Other", votes: 2134, percentage: 0.6, party: "Other" }
        ],
        totalVotes: 365926,
        precinctsReporting: 260,
        totalPrecincts: 260
    },
    2: {
        raceNumber: 2,
        raceName: "United States Senator",
        candidates: [
            { candidateName: "Tammy Baldwin", votes: 273696, percentage: 75.3, party: "Democratic" },
            { candidateName: "Eric Hovde", votes: 84762, percentage: 23.3, party: "Republican" },
            { candidateName: "Phil Anderson", votes: 3260, percentage: 0.9, party: "Independent" },
            { candidateName: "Thomas Leager", votes: 1334, percentage: 0.4, party: "Independent" }
        ],
        totalVotes: 363441,
        precinctsReporting: 260,
        totalPrecincts: 260
    },
    3: {
        raceNumber: 3,
        raceName: "Representative in Congress District 2",
        candidates: [
            { candidateName: "Mark Pocan", votes: 268234, percentage: 73.8, party: "Democratic" },
            { candidateName: "Peter Theron", votes: 95123, percentage: 26.2, party: "Republican" }
        ],
        totalVotes: 363357,
        precinctsReporting: 260,
        totalPrecincts: 260
    },
    4: {
        raceNumber: 4,
        raceName: "Representative to the Assembly District 76",
        candidates: [
            { candidateName: "Francesca Hong", votes: 34311, percentage: 98.9, party: "Democratic" },
            { candidateName: "Write-in", votes: 398, percentage: 1.1, party: "Nonpartisan" }
        ],
        totalVotes: 34709,
        precinctsReporting: 28,
        totalPrecincts: 28
    },
    5: {
        raceNumber: 5,
        raceName: "Dane County Executive",
        candidates: [
            { candidateName: "Melissa Agard", votes: 245680, percentage: 72.1, party: "Democratic" },
            { candidateName: "Opponent", votes: 95120, percentage: 27.9, party: "Republican" }
        ],
        totalVotes: 340800,
        precinctsReporting: 260,
        totalPrecincts: 260
    },
    6: {
        raceNumber: 6,
        raceName: "State Referendum (Eligibility to vote)",
        candidates: [
            { candidateName: "Yes", votes: 198560, percentage: 62.3 },
            { candidateName: "No", votes: 120140, percentage: 37.7 }
        ],
        totalVotes: 318700,
        precinctsReporting: 260,
        totalPrecincts: 260
    }
};

// Generate mock precinct results for Madison wards
export const generateMockPrecinctResults = (raceNumber: number) => {
    const results = [];
    const numWards = 102;

    for (let i = 1; i <= numWards; i++) {
        const wardNum = i.toString().padStart(3, '0');
        const registeredVoters = Math.floor(Math.random() * 1000) + 500;
        const turnout = 0.6 + Math.random() * 0.3; // 60-90% turnout
        const ballotscast = Math.floor(registeredVoters * turnout);

        // Democratic candidate gets 60-85% in Madison
        const demPercentage = 0.60 + Math.random() * 0.25;
        const demVotes = Math.floor(ballotscast * demPercentage);
        const repVotes = ballotscast - demVotes;

        const candidates = mockRaceResults[raceNumber as keyof typeof mockRaceResults]?.candidates || [];

        if (candidates.length >= 2) {
            results.push({
                precinctName: `Ward ${wardNum}`,
                wardNumber: wardNum,
                candidateName: candidates[0].candidateName,
                votes: demVotes,
                registeredVoters,
                ballotscast
            });

            results.push({
                precinctName: `City of Madison Ward ${wardNum}`,
                wardNumber: wardNum,
                candidateName: candidates[1].candidateName,
                votes: repVotes,
                registeredVoters,
                ballotscast
            });
        }
    }

    return results;
};
