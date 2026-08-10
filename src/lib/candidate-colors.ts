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

// Fallback palette for non-partisan or multiple candidates of the same party.
// 8 CVD-checked hues (fixed order — see the dataviz skill's palette.md) so a
// wide-open primary (AD76 2026 is 5-way; 2020's was 7-way) doesn't cycle back
// to a color already in use.
const FALLBACK_PALETTE: HSL[] = [
    { h: 211, s: 62, l: 51 }, // blue    #2a78d6
    { h: 17,  s: 78, l: 55 }, // orange  #eb6834
    { h: 160, s: 74, l: 40 }, // aqua    #1baf7a
    { h: 42,  s: 100, l: 46 }, // yellow  #eda100
    { h: 340, s: 68, l: 74 }, // magenta #e87ba4
    { h: 120, s: 100, l: 26 }, // green   #008300
    { h: 251, s: 47, l: 44 }, // violet  #4a3aa7
    { h: 1,   s: 74, l: 57 }, // red     #e34948
];

const WRITE_IN_COLOR: HSL = { h: 0, s: 0, l: 62 }; // neutral gray — never a real contender

function isWriteIn(name: string): boolean {
    return /^write[\s-]?in/i.test(name.trim());
}

/**
 * Assign HSL colors to a list of candidates based on party affiliation.
 * Returns a Record keyed by trimmed candidate name.
 *
 * Flat party color only makes sense one-candidate-per-party (a general
 * election). In a primary, several candidates share a party — coloring
 * them all the same blue/red would make the map/legend unreadable, so any
 * party with 2+ candidates falls back to distinct palette colors instead.
 */
export function assignCandidateColors(
    candidates: { candidateName: string; party?: string }[]
): Record<string, HSL> {
    const colors: Record<string, HSL> = {};
    let paletteIndex = 0;

    const partyCounts: Record<string, number> = {};
    candidates.forEach(c => {
        if (c.party && !isWriteIn(c.candidateName)) partyCounts[c.party] = (partyCounts[c.party] ?? 0) + 1;
    });

    candidates.forEach(c => {
        const name = c.candidateName.trim();
        if (isWriteIn(name)) {
            colors[name] = WRITE_IN_COLOR;
            return;
        }
        // Hardcoded overrides for prominent figures whose party may not be in the feed
        if (name.includes('Biden') || name.includes('Harris') || name.includes('Evers')) {
            colors[name] = PARTY_COLORS['Democratic'];
        } else if (name.includes('Trump') || name.includes('Michels')) {
            colors[name] = PARTY_COLORS['Republican'];
        } else if (c.party && PARTY_COLORS[c.party] && (partyCounts[c.party] ?? 0) <= 1) {
            colors[name] = PARTY_COLORS[c.party];
        } else {
            colors[name] = FALLBACK_PALETTE[paletteIndex % FALLBACK_PALETTE.length];
            paletteIndex++;
        }
    });

    return colors;
}
