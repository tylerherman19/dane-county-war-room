// Mock data for development
export const mockElections = [
    {
        electionId: "2026-11-03",
        electionName: "November 2026 General Election",
        electionDate: "2026-11-03"
    }
];

export const mockLastPublished = {
    lastPublished: new Date().toISOString()
};

export const mockRaces = [
    { raceNumber: 1, raceName: "President and Vice President", raceType: "Federal" },
    { raceNumber: 2, raceName: "U.S. Senator", raceType: "Federal" },
    { raceNumber: 3, raceName: "Wisconsin Supreme Court Justice", raceType: "State" },
    { raceNumber: 4, raceName: "Dane County Executive", raceType: "County" },
    { raceNumber: 5, raceName: "Mayor - City of Madison", raceType: "Municipal" },
    { raceNumber: 6, raceName: "Referendum Question 1", raceType: "Referendum" }
];

export const mockRaceResults = {
    1: {
        raceNumber: 1,
        raceName: "President and Vice President",
        candidates: [
            { candidateName: "Kamala Harris / Tim Walz", votes: 185420, percentage: 72.3, party: "Democratic" },
            { candidateName: "Donald Trump / JD Vance", votes: 65890, percentage: 25.7, party: "Republican" },
            { candidateName: "Other", votes: 5130, percentage: 2.0, party: "Other" }
        ],
        totalVotes: 256440,
        precinctsReporting: 245,
        totalPrecincts: 277
    },
    2: {
        raceNumber: 2,
        raceName: "U.S. Senator",
        candidates: [
            { candidateName: "Tammy Baldwin", votes: 178920, percentage: 70.1, party: "Democratic" },
            { candidateName: "Eric Hovde", votes: 76320, percentage: 29.9, party: "Republican" }
        ],
        totalVotes: 255240,
        precinctsReporting: 245,
        totalPrecincts: 277
    },
    3: {
        raceNumber: 3,
        raceName: "Wisconsin Supreme Court Justice",
        candidates: [
            { candidateName: "Janet Protasiewicz", votes: 182340, percentage: 71.5, party: "Nonpartisan" },
            { candidateName: "Dan Kelly", votes: 72680, percentage: 28.5, party: "Nonpartisan" }
        ],
        totalVotes: 255020,
        precinctsReporting: 245,
        totalPrecincts: 277
    },
    4: {
        raceNumber: 4,
        raceName: "Dane County Executive",
        candidates: [
            { candidateName: "Melissa Agard", votes: 165420, percentage: 65.2, party: "Democratic" },
            { candidateName: "John Doe", votes: 88320, percentage: 34.8, party: "Republican" }
        ],
        totalVotes: 253740,
        precinctsReporting: 245,
        totalPrecincts: 277
    },
    5: {
        raceNumber: 5,
        raceName: "Mayor - City of Madison",
        candidates: [
            { candidateName: "Satya Rhodes-Conway", votes: 52340, percentage: 68.5, party: "Nonpartisan" },
            { candidateName: "Challenger", votes: 24080, percentage: 31.5, party: "Nonpartisan" }
        ],
        totalVotes: 76420,
        precinctsReporting: 98,
        totalPrecincts: 102
    },
    6: {
        raceNumber: 6,
        raceName: "Referendum Question 1",
        candidates: [
            { candidateName: "Yes", votes: 145680, percentage: 57.3 },
            { candidateName: "No", votes: 108560, percentage: 42.7 }
        ],
        totalVotes: 254240,
        precinctsReporting: 245,
        totalPrecincts: 277
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
                precinctName: `Ward ${wardNum}`,
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
