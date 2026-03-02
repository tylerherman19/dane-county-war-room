// Shared candidate color utility — used by both Map.tsx (rendering) and
// MapWrapper.tsx (legend computation). Extracted here to avoid SSR issues
// that would arise from importing browser-only Map.tsx in server components.

export interface HSL { h: number; s: number; l: number; }

// Standard party colors (HSL)
const PARTY_COLORS: Record<string, HSL> = {
    'Democratic':  { h: 215, s: 90, l: 50 }, // Blue
    'Republican':  { h: 0,   s: 90, l: 50 }, // Red
    'Green':       { h: 140, s: 70, l: 45 }, // Green
    'Libertarian': { h: 45,  s: 90, l: 50 }, // Gold
    'Independent': { h: 280, s: 60, l: 60 }, // Purple
    'Nonpartisan': { h: 200, s: 10, l: 50 }, // Grey
};

// Fallback palette for non-partisan or multiple candidates of the same party
const FALLBACK_PALETTE: HSL[] = [
    { h: 215, s: 80, l: 55 }, // Blue
    { h: 160, s: 70, l: 45 }, // Teal
    { h: 280, s: 60, l: 60 }, // Purple
    { h: 30,  s: 90, l: 55 }, // Orange
    { h: 330, s: 70, l: 55 }, // Pink
];

/**
 * Assign HSL colors to a list of candidates based on party affiliation.
 * Returns a Record keyed by trimmed candidate name.
 */
export function assignCandidateColors(
    candidates: { candidateName: string; party?: string }[]
): Record<string, HSL> {
    const colors: Record<string, HSL> = {};
    let paletteIndex = 0;

    candidates.forEach(c => {
        const name = c.candidateName.trim();
        // Hardcoded overrides for prominent figures whose party may not be in the feed
        if (name.includes('Biden') || name.includes('Harris') || name.includes('Evers')) {
            colors[name] = { h: 215, s: 90, l: 50 };
        } else if (name.includes('Trump') || name.includes('Michels')) {
            colors[name] = { h: 0, s: 90, l: 50 };
        } else if (c.party && PARTY_COLORS[c.party]) {
            colors[name] = PARTY_COLORS[c.party];
        } else {
            colors[name] = FALLBACK_PALETTE[paletteIndex % FALLBACK_PALETTE.length];
            paletteIndex++;
        }
    });

    return colors;
}
