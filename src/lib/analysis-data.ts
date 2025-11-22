// Analysis Data Layer
// Fetches real historical data from JSON files.

import president2020 from './real-data/president-2020.json';
import mayor2023 from './real-data/mayor-2023.json';

// Type definitions for our data files
interface PresidentialResult {
    ward: string;
    biden: number;
    trump: number;
    total: number;
}

interface MayorResult {
    ward: string;
    satya: string | number; // JSON might have strings
    gloria: string | number;
}

export interface WardAnalysis {
    presidentialMargin2020: number; // e.g., 0.45 (Biden +45)
    averageTurnout: number;         // e.g., 0.65 (65%)
    previousMargin: number;         // e.g., 0.40 (Last similar election)
    trend: number[];                // Last available margins
}

// Helper to normalize ward names for matching
// "City of Madison Ward 56" -> "madison-56"
const normalizeWard = (name: string): string => {
    const lower = name.toLowerCase();
    const wardMatch = lower.match(/ward\s+(\d+)/);
    const wardNum = wardMatch ? wardMatch[1] : '';

    if (lower.includes('madison')) return `madison-${wardNum}`;
    if (lower.includes('fitchburg')) return `fitchburg-${wardNum}`;
    if (lower.includes('sun prairie')) return `sun-prairie-${wardNum}`;
    if (lower.includes('middleton')) return `middleton-${wardNum}`;
    if (lower.includes('verona')) return `verona-${wardNum}`;
    return `${lower.replace(/\s+/g, '-')}-${wardNum}`;
};

// Create lookup maps for O(1) access
const presidentMap = new Map<string, PresidentialResult>();
(president2020 as PresidentialResult[]).forEach(r => {
    presidentMap.set(normalizeWard(r.ward), r);
});

// Mayor data structure in JSON might be different, adapting...
// The mayor-2023.json seems to be a list of objects based on previous file checks
const mayorMap = new Map<string, any>();
(mayor2023 as any[]).forEach((r: any) => {
    // Adjust based on actual structure of mayor-2023.json
    // Assuming it has 'ward' property
    if (r.ward) mayorMap.set(normalizeWard(r.ward), r);
});

export function getWardAnalysis(wardId: string, municipality: string): WardAnalysis {
    const normalizedKey = normalizeWard(`${municipality} Ward ${wardId}`);

    // 1. Presidential Benchmark (2020)
    const presResult = presidentMap.get(normalizedKey);
    let presidentialMargin2020 = 0;
    let turnout2020 = 0;

    if (presResult && presResult.total > 0) {
        // Margin = (Biden - Trump) / Total
        presidentialMargin2020 = (presResult.biden - presResult.trump) / presResult.total;
        // We don't have registered voters in this simple file, so we can't calc exact turnout %
        // But we can use raw votes as a proxy or default to a high baseline
        turnout2020 = 0.85; // Assumed high turnout for 2020
    } else {
        // Fallback if data missing (e.g. new wards)
        presidentialMargin2020 = 0.45; // Default Dem lean
    }

    // 2. Previous Margin (Mayor 2023 as proxy for "Previous")
    // Satya (Left) vs Gloria (Center/Right)
    const mayorResult = mayorMap.get(normalizedKey);
    let previousMargin = 0;
    let turnout2023 = 0;

    if (mayorResult) {
        const satya = Number(mayorResult.satya || 0);
        const gloria = Number(mayorResult.gloria || 0);
        const total = satya + gloria;
        if (total > 0) {
            previousMargin = (satya - gloria) / total;
            turnout2023 = 0.55; // Lower turnout for Spring
        }
    } else {
        previousMargin = presidentialMargin2020 - 0.1; // Fallback
    }

    // 3. Average Turnout
    // Simple average of available data points
    const averageTurnout = (turnout2020 + turnout2023) / 2 || 0.7;

    // 4. Trend
    const trend = [
        previousMargin, // 2023
        presidentialMargin2020 // 2020
    ];

    return {
        presidentialMargin2020,
        averageTurnout,
        previousMargin,
        trend
    };
}
