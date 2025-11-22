// Historical turnout data for Dane County
// Based on recent election cycles (approximate averages)

export const HISTORICAL_TURNOUT = {
    'Presidential': 300000, // High turnout (General)
    'Senate': 280000,       // High turnout (General)
    'Governor': 260000,     // Midterm General
    'Congress': 260000,     // Midterm General
    'Supreme Court': 180000, // Spring Election (High interest)
    'Mayor': 100000,        // Spring Election (Local)
    'Alder': 80000,         // Spring Election (Local)
    'Referendum': 150000,   // Varies widely, using a mid-range
    'Assembly': 250000,     // General
    'Default': 150000       // Fallback
};

export function getExpectedTurnout(raceType: string): number {
    // Normalize race type key
    if (!raceType) return HISTORICAL_TURNOUT['Default'];

    const key = Object.keys(HISTORICAL_TURNOUT).find(k =>
        raceType.toLowerCase().includes(k.toLowerCase())
    );

    return HISTORICAL_TURNOUT[key as keyof typeof HISTORICAL_TURNOUT] || HISTORICAL_TURNOUT['Default'];
}
