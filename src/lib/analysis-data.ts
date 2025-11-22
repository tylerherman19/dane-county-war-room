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
    total: number;
}

export interface WardAnalysis {
    presidentialMargin2020: number; // e.g., 0.45 (Biden +45)
    averageTurnout: number;         // e.g., 0.65 (65%)
    previousMargin: number;         // e.g., 0.40 (Last similar election)
    trend: number[];                // Last available margins
}

// Helper to normalize ward names for matching
// "City of Madison Ward 56" -> "madison-56"
// "MADISON CITY WARD 002" -> "madison-2"
// "MAPLE BLUFF VLG" -> "maple-bluff"
const normalizeWard = (name: string): string => {
    let s = name.toLowerCase();

    // Remove common prefixes
    s = s.replace(/^(city|village|town) of\s+/, '');

    // Remove common suffixes (often found in the data files)
    s = s.replace(/\s+(city|vlg|town|village)$/, '');

    // Extract ward number if present
    const wardMatch = s.match(/ward\s+(\d+)/);
    const wardNum = wardMatch ? parseInt(wardMatch[1], 10).toString() : '';

    // Remove "ward X" from the name part to get the base municipality name
    s = s.replace(/ward\s+\d+/, '').trim();

    // Replace spaces with dashes
    s = s.replace(/\s+/g, '-');

    // Special case for "madison" if it still has "city" or similar attached in a weird way, 
    // but the above regexes should handle "madison city" -> "madison"

    if (wardNum) return `${s}-${wardNum}`;
    return s;
};

// Create lookup maps for O(1) access
const presidentMap = new Map<string, PresidentialResult>();
(president2020 as PresidentialResult[]).forEach(r => {
    presidentMap.set(normalizeWard(r.ward), r);
});

const mayorMap = new Map<string, MayorResult>();
(mayor2023 as any[]).forEach((r: any) => {
    if (r.ward) mayorMap.set(normalizeWard(r.ward), r);
});

export function getWardAnalysis(wardId: string, municipality: string): WardAnalysis {
    const normalizedKey = normalizeWard(`${municipality} Ward ${wardId}`);
    // Fallback key without ward number (for places like Maple Bluff that might be reported as a whole)
    const baseKey = normalizedKey.split('-').slice(0, -1).join('-');
    // Actually, normalizeWard("Maple Bluff") returns "maple-bluff". 
    // normalizeWard("Maple Bluff Ward 1") returns "maple-bluff-1".
    // So if we don't find "maple-bluff-1", we should try "maple-bluff".
    const fallbackKey = normalizedKey.replace(/-\d+$/, '');

    // 1. Presidential Benchmark (2020)
    let presResult = presidentMap.get(normalizedKey);
    if (!presResult) presResult = presidentMap.get(fallbackKey);

    let presidentialMargin2020 = 0;
    let turnout2020 = 0;

    if (presResult && presResult.total > 0) {
        // Margin = (Biden - Trump) / Total
        presidentialMargin2020 = (presResult.biden - presResult.trump) / presResult.total;
        // We don't have registered voters in this simple file, so we can't calc exact turnout %
        // But we can use raw votes as a proxy or default to a high baseline
        turnout2020 = 0.85; // Assumed high turnout for 2020
    } else {
        // NO PLACEHOLDERS: Return 0 if no data
        presidentialMargin2020 = 0;
    }

    // 2. Previous Margin (Mayor 2023 as proxy for "Previous")
    // Satya (Left) vs Gloria (Center/Right)
    let mayorResult = mayorMap.get(normalizedKey);
    if (!mayorResult) mayorResult = mayorMap.get(fallbackKey);

    let previousMargin = 0;
    let turnout2023 = 0;

    if (mayorResult) {
        const satya = Number(mayorResult.satya || 0);
        const gloria = Number(mayorResult.gloria || 0);
        const total = satya + gloria; // Use calculated total from candidates to be safe
        if (total > 0) {
            previousMargin = (satya - gloria) / total;
            turnout2023 = 0.55; // Lower turnout for Spring
        }
    } else {
        // NO PLACEHOLDERS: Return 0 if no data
        previousMargin = 0;
    }

    // 3. Average Turnout
    // Simple average of available data points
    let averageTurnout = 0;
    if (turnout2020 > 0 && turnout2023 > 0) {
        averageTurnout = (turnout2020 + turnout2023) / 2;
    } else if (turnout2020 > 0) {
        averageTurnout = turnout2020;
    } else if (turnout2023 > 0) {
        averageTurnout = turnout2023;
    }

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
