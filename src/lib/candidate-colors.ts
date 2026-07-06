// Shared candidate color utility — used by both Map.tsx (rendering) and
// MapWrapper.tsx (legend computation). Extracted here to avoid SSR issues
// that would arise from importing browser-only Map.tsx in server components.

export interface HSL { h: number; s: number; l: number; }

// Party colors (HSL) — classic FiveThirtyEight data palette
const PARTY_COLORS: Record<string, HSL> = {
    'Democratic':  { h: 200, s: 100, l: 42 }, // #008fd5 blue
    'Republican':  { h: 9,   s: 97,  l: 59 }, // #fc4f30 red
    'Green':       { h: 92,  s: 29,  l: 44 }, // #6d904f green
    'Libertarian': { h: 41,  s: 77,  l: 56 }, // #e5ae38 gold
    'Independent': { h: 90,  s: 44,  l: 47 }, // #77ab43 green
    'Nonpartisan': { h: 0,   s: 0,   l: 55 }, // #8b8b8b gray
};

// Fallback palette for non-partisan or multiple candidates of the same party
const FALLBACK_PALETTE: HSL[] = [
    { h: 200, s: 100, l: 42 }, // blue
    { h: 9,   s: 97,  l: 59 }, // red
    { h: 41,  s: 77,  l: 56 }, // gold
    { h: 92,  s: 29,  l: 44 }, // green
    { h: 0,   s: 0,   l: 55 }, // gray
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
            colors[name] = PARTY_COLORS['Democratic'];
        } else if (name.includes('Trump') || name.includes('Michels')) {
            colors[name] = PARTY_COLORS['Republican'];
        } else if (c.party && PARTY_COLORS[c.party]) {
            colors[name] = PARTY_COLORS[c.party];
        } else {
            colors[name] = FALLBACK_PALETTE[paletteIndex % FALLBACK_PALETTE.length];
            paletteIndex++;
        }
    });

    return colors;
}
