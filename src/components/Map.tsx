import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PrecinctResult, RaceResult } from '@/lib/api';
import { getWardAnalysis, WardAnalysis, startLoadingHistoricalData, getCachedAvgVotes } from '@/lib/analysis-data';
import { OverlayMode } from './MapOverlayControl';
import { HSL, assignCandidateColors } from '@/lib/candidate-colors';

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
    precinctResults: PrecinctResult[] | undefined;
    isLoading: boolean;
    selectedWard: { name: string; num: string } | null;
    raceResult: RaceResult | undefined;
    onReset: () => void;
    overlayMode: OverlayMode;
    onWardHover?: (ward: HoveredWard | null) => void;
    historicalLabel?: string | null;
    focusedCandidate?: string | null;
    // SIMULATE mode
    projectionData?: Record<string, number>; // wardKey → ratio vs district mean (1.0 = avg)
    onWardClick?: (ward: { name: string; num: string }) => void;
}

export interface HoveredWard {
    municipality: string;
    wardNum: string;
    results: Array<{ candidateName: string; votes: number; pct: number }>;
    total: number;
    x: number;
    y: number;
    analysis: WardAnalysis | null;
    fillColor: string;
}

function MapController({ geoJsonData, selectedWard, onReset }: { geoJsonData: any; selectedWard?: { name: string; num: string } | null; onReset?: () => void }) {
    const map = useMap();

    useEffect(() => {
        if (geoJsonData) {
            const layer = L.geoJSON(geoJsonData);
            map.fitBounds(layer.getBounds());
        }
    }, [geoJsonData, map]);

    useEffect(() => {
        if (selectedWard && geoJsonData) {
            const layer = L.geoJSON(geoJsonData, {
                filter: (feature) => {
                    const wardNum = parseInt(feature.properties.WardNumber);
                    const targetNum = parseInt(selectedWard.num);
                    const muniName = feature.properties.NAME;

                    if (wardNum !== targetNum) return false;
                    return selectedWard.name.toLowerCase().includes(muniName.toLowerCase()) ||
                        muniName.toLowerCase().includes(selectedWard.name.toLowerCase());
                }
            });

            if (layer.getLayers().length > 0) {
                // Initial Zoom
                map.fitBounds(layer.getBounds(), { maxZoom: 14, animate: true });

                // Sequence:
                // 0s: Zoomed in, Pulse starts
                // 2s: Pulse ends, Zoom resets to county view
                // 2s-5s: Ward stays highlighted (pulsing or static high vis)
                // 5s: Highlight removed

                // Apply Pulse
                map.eachLayer((l: any) => {
                    if (l.feature && l.feature.properties) {
                        const wardNum = parseInt(l.feature.properties.WardNumber);
                        const targetNum = parseInt(selectedWard.num);
                        const muniName = l.feature.properties.NAME;

                        if (wardNum === targetNum) {
                            if (selectedWard.name.toLowerCase().includes(muniName.toLowerCase()) ||
                                muniName.toLowerCase().includes(selectedWard.name.toLowerCase())) {

                                if (l.getElement) {
                                    const el = l.getElement();
                                    if (el) {
                                        // Start Pulse
                                        el.classList.add('ward-pulse');

                                        // After 2s: Reset Zoom but keep highlight
                                        setTimeout(() => {
                                            map.flyTo([43.0731, -89.4012], 10, { duration: 1.5 });
                                        }, 2000);

                                        // After 5s: Remove Pulse/Highlight AND Reset Selection
                                        setTimeout(() => {
                                            el.classList.remove('ward-pulse');
                                            if (onReset) onReset();
                                        }, 5000);
                                    }
                                }
                            }
                        }
                    }
                });
            }
        }
    }, [selectedWard, geoJsonData, map, onReset]);

    return null;
}

// Re-export so existing downstream imports from './Map' keep working
export { assignCandidateColors };
export type { HSL };

/**
 * Convert GeoJSON feature properties (municipality name + ward number) into a
 * normalized ward key that matches the format stored in projectionData.
 * Format: "madison-city-1", "sun-prairie-city-3", "westport-town-1", etc.
 */
function buildProjectionKey(municipality: string, wardNum: string): string {
    let s = municipality.toLowerCase();
    let type = '';
    if (s.includes('town')) type = 'town';
    else if (s.includes('village')) type = 'village';
    else if (s.includes('city')) type = 'city';
    s = s
        .replace(/^(city|village|town) of\s+/, '')
        .replace(/\s+(city|village|town)\b/g, '')
        .trim()
        .replace(/\s+/g, '-');
    let key = s;
    if (type) key += `-${type}`;
    if (wardNum && wardNum !== '0') key += `-${wardNum}`;
    return key;
}

export default function Map({ precinctResults, isLoading, selectedWard, raceResult, onReset, overlayMode, onWardHover, historicalLabel, focusedCandidate, projectionData, onWardClick }: MapProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [candidateColors, setCandidateColors] = useState<Record<string, HSL>>({});
    const [hoveredWard, setHoveredWard] = useState<HoveredWard | null>(null);
    const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

    // Start loading historical data when the race changes (keyed on id, not type,
    // so 30-second vote updates don't trigger a redundant reload).
    useEffect(() => {
        if (raceResult?.id && raceResult?.type) {
            startLoadingHistoricalData(raceResult.type);
        }
    }, [raceResult?.id]);

    // OPTIMIZATION: Create a fast lookup dictionary for results
    // Key: "Municipality Name-WardNumber" (normalized)
    // Value: PrecinctResult[] (usually just one, but keeping array structure for compatibility)
    const resultsMap = useMemo(() => {
        const map: Record<string, PrecinctResult[]> = {};
        if (precinctResults) {
            precinctResults.forEach(r => {
                const wardNum = parseInt(r.wardNumber).toString(); // Normalize to string "1", "2"
                if (!map[wardNum]) map[wardNum] = [];
                map[wardNum].push(r);
            });
        }
        return map;
    }, [precinctResults]);

    useEffect(() => {
        if (raceResult?.candidates) {
            setCandidateColors(assignCandidateColors(raceResult.candidates));
        }
    }, [raceResult]);

    useEffect(() => {
        fetch('dane_wards.geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Error loading GeoJSON:', err));
    }, []);

    // Memoize style function to prevent recreation on every render
    const style = useCallback((feature: any, currentSelectedWard: { name: string; num: string } | null = null) => {
        const municipality = feature.properties.NAME;
        const wardNum = parseInt(feature.properties.WardNumber).toString(); // Normalize

        // OPTIMIZED LOOKUP: Get candidates by ward number first
        const potentialMatches = resultsMap[wardNum] || [];

        // Then do the string matching on this small subset
        const relevantResults = potentialMatches.filter((r: PrecinctResult) =>
            r.precinctName.toLowerCase().includes(municipality.toLowerCase()) ||
            municipality.toLowerCase().includes(r.precinctName.toLowerCase())
        );

        // Base style for empty/irrelevant wards
        let baseStyle = {
            fillColor: '#0f172a',
            weight: 1,
            opacity: 0.5,
            color: '#1e293b',
            fillOpacity: 0.3
        };

        if (relevantResults.length > 0) {
            const total = relevantResults[0].ballotscast;
            const sorted = relevantResults.sort((a: PrecinctResult, b: PrecinctResult) => b.votes - a.votes);
            const winner = sorted[0];
            const runnerUp = sorted[1];

            // Get Analysis Data
            const analysis = getWardAnalysis(wardNum, municipality);

            // --- CANDIDATE FOCUS VIEW ---
            // When a candidate is selected in the sidebar, show their vote share per ward
            // as a gradient: pale = few votes, saturated = dominant share.
            // Wards where the focused candidate WON get a glowing hue-colored border.
            if (focusedCandidate) {
                const candidateResult = relevantResults.find(
                    r => r.candidateName.trim() === focusedCandidate.trim()
                );
                if (candidateResult && total > 0) {
                    const baseColor = candidateColors[focusedCandidate.trim()] || { h: 215, s: 80, l: 50 };
                    const votePct = candidateResult.votes / total; // 0–1
                    const t = Math.min(votePct / 0.7, 1.0); // normalize: 70%+ → full saturation
                    const lightness = Math.round(88 - t * 52); // 88% (0 votes) → 36% (dominant)
                    const saturation = Math.round(20 + t * Math.max(0, baseColor.s - 20));
                    const isWinner = winner.candidateName.trim() === focusedCandidate.trim();
                    baseStyle = {
                        fillColor: `hsl(${baseColor.h}, ${saturation}%, ${lightness}%)`,
                        weight: isWinner ? 2 : 1,
                        opacity: isWinner ? 0.9 : 1,
                        color: isWinner ? `hsl(${baseColor.h}, 80%, 70%)` : '#334155',
                        fillOpacity: 0.85,
                    };
                } else {
                    // Candidate has no votes here — very faint
                    baseStyle = { fillColor: '#1e293b', weight: 1, opacity: 0.3, color: '#1e293b', fillOpacity: 0.15 };
                }
            }
            // --- STANDARD VIEW ---
            else if (overlayMode === 'NONE') {
                const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                const baseColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 75, l: 50 };

                // Gradient: normalize margin 0–45% → t 0–1.
                // Lightness: 82% (pale toss-up) → 42% (deep landslide) — 40pt range.
                // Saturation: ramps from 25% up to the candidate's full saturation.
                // This gives crisp color for safe seats and near-white for toss-ups.
                const t = Math.min(margin / 0.45, 1.0);
                const lightness = Math.round(82 - t * 40);
                const saturation = Math.round(25 + t * Math.max(0, baseColor.s - 25));

                baseStyle = {
                    fillColor: `hsl(${baseColor.h}, ${saturation}%, ${lightness}%)`,
                    weight: 1,
                    opacity: 1,
                    color: '#334155',
                    fillOpacity: 0.75
                };
            }
            // --- TURNOUT HEATMAP (VOTE VOLUME) ---
            // Compares each ward's current ballots cast to its own historical baseline.
            // Per-ward comparison is preferred (accurate); falls back to the pre-computed
            // county-wide average when the ward key doesn't match historical data.
            // Both paths use O(1) lookups — no per-render iteration of the full cache.
            // Red = below baseline, Green = above baseline.
            else if (overlayMode === 'TURNOUT') {
                const wardAnalysis = getWardAnalysis(wardNum, municipality);
                // Prefer the ward's own historical vote count; fall back to county avg.
                const historicalRef = wardAnalysis.historicalVotes > 0
                    ? wardAnalysis.historicalVotes
                    : (getCachedAvgVotes() ?? 0);

                if (historicalRef === 0 || total === 0) {
                    // Historical data not yet loaded — neutral grey
                    baseStyle = { fillColor: '#1e293b', weight: 1, opacity: 0.4, color: '#334155', fillOpacity: 0.5 };
                } else {
                    const ratio = total / historicalRef;

                    let h: number, s: number, l: number;
                    if (ratio < 1.0) {
                        // Below historical baseline — red gradient
                        h = 0;
                        const intensity = Math.min((1.0 - ratio) / 0.5, 1);
                        l = 90 - (intensity * 40);
                        s = intensity * 80;
                    } else {
                        // Above historical baseline — green gradient
                        // Starts near-white at baseline (matching red branch) and ramps to deep green.
                        h = 140;
                        const intensity = Math.min((ratio - 1.0) / 0.5, 1);
                        l = 90 - (intensity * 50);
                        s = intensity * 100;
                    }

                    baseStyle = {
                        fillColor: `hsl(${h}, ${s}%, ${l}%)`,
                        weight: 1,
                        opacity: 1,
                        color: '#334155',
                        fillOpacity: 0.75
                    };
                }
            }
            // --- PROJECTION HEATMAP (SIMULATE mode) ---
            // Shows relative historical turnout within the selected district.
            // Green = above-average turnout ward (protect/grow), Red = below-average (opportunity).
            // projectionData values are ratios: 1.0 = district mean, >1 = green, <1 = red.
            else if (overlayMode === 'PROJECTION') {
                // Not in the selected district — show dimmed
                if (!projectionData) {
                    baseStyle = { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.1 };
                } else {
                    // Build normalized ward key to look up projection ratio
                    const normalizedKey = buildProjectionKey(municipality, wardNum);
                    const ratio = projectionData[normalizedKey] ?? -1;

                    if (ratio < 0) {
                        // Ward not in selected district → dim
                        baseStyle = { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.08 };
                    } else {
                        let h: number, s: number, l: number;
                        if (ratio < 1.0) {
                            h = 0; // red — below district average
                            const intensity = Math.min((1.0 - ratio) / 0.6, 1);
                            l = 90 - intensity * 45;
                            s = intensity * 85;
                        } else {
                            h = 140; // green — above district average
                            const intensity = Math.min((ratio - 1.0) / 0.6, 1);
                            l = 90 - intensity * 52;
                            s = intensity * 100;
                        }
                        baseStyle = {
                            fillColor: `hsl(${h}, ${s}%, ${l}%)`,
                            weight: 1,
                            opacity: 1,
                            color: '#334155',
                            fillOpacity: 0.8,
                        };
                    }
                }
            }
            // --- MARGIN INTENSITY ---
            // Shows how competitive each ward is right now: pale = toss-up, saturated = landslide.
            // Useful for GOTV targeting. No historical data needed — works immediately.
            else if (overlayMode === 'SWING') {
                const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                const winnerColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 80, l: 50 };
                // 0% margin → pale/white; 40%+ margin → fully saturated winner color
                const intensity = Math.min(margin / 0.4, 1);
                baseStyle = {
                    fillColor: `hsl(${winnerColor.h}, ${Math.round(intensity * 85)}%, ${Math.round(90 - intensity * 40)}%)`,
                    weight: 1,
                    opacity: 1,
                    color: '#334155',
                    fillOpacity: 0.8
                };
            }
        }

        // SPOTLIGHT EFFECT: If a ward is selected, dim everyone else
        if (currentSelectedWard) {
            const isSelected = parseInt(wardNum) === parseInt(currentSelectedWard.num) &&
                (currentSelectedWard.name.toLowerCase().includes(municipality.toLowerCase()) ||
                    municipality.toLowerCase().includes(currentSelectedWard.name.toLowerCase()));

            if (!isSelected) {
                baseStyle.fillOpacity = baseStyle.fillOpacity * 0.1; // Dim significantly
                baseStyle.opacity = 0.1; // Fade borders
                baseStyle.color = '#1e293b';
            } else {
                baseStyle.weight = 3; // Thicker border for selected
                baseStyle.color = '#ffffff'; // White border for selected
                baseStyle.opacity = 1;
                baseStyle.fillOpacity = 0.9; // High visibility
            }
        }

        return baseStyle;
    }, [resultsMap, candidateColors, overlayMode, focusedCandidate]);

    const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
        const municipality = feature.properties.NAME;
        const wardNum = parseInt(feature.properties.WardNumber).toString();

        const potentialMatches = resultsMap[wardNum] || [];
        const relevantResults = potentialMatches.filter((r: PrecinctResult) =>
            r.precinctName.toLowerCase().includes(municipality.toLowerCase()) ||
            municipality.toLowerCase().includes(r.precinctName.toLowerCase())
        );

        const hasData = relevantResults.length > 0;
        const defaultBorderColor = hasData ? '#334155' : '#1e293b';
        const defaultBorderOpacity = hasData ? 1 : 0.5;

        // In PROJECTION mode with onWardClick, ward click adds ward to What If list
        const isProjectionClickable = overlayMode === 'PROJECTION' && !!onWardClick;

        layer.on({
            mouseover: (e: any) => {
                e.target.setStyle({ weight: 2, color: '#ffffff', opacity: 1 });
                e.target.bringToFront();

                if (hasData) {
                    const total = relevantResults[0].ballotscast;
                    const sorted = [...relevantResults].sort((a: PrecinctResult, b: PrecinctResult) => b.votes - a.votes);
                    const analysis = getWardAnalysis(wardNum, municipality);

                    // Compute fill color for debug (mirrors style() logic)
                    const winner = sorted[0];
                    const baseColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 16, l: 47 };
                    const runnerUp = sorted[1];
                    const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                    const lightness = 65 - (Math.min(margin, 0.5) * 30);
                    const fillColor = `hsl(${baseColor.h}, ${baseColor.s}%, ${lightness}%)`;

                    const ward: HoveredWard = {
                        municipality,
                        wardNum,
                        results: sorted.map((r: PrecinctResult) => ({
                            candidateName: r.candidateName,
                            votes: r.votes,
                            pct: total > 0 ? (r.votes / total) * 100 : 0,
                        })),
                        total,
                        x: e.originalEvent.clientX,
                        y: e.originalEvent.clientY,
                        analysis,
                        fillColor,
                    };
                    setHoveredWard(ward);
                    onWardHover?.(ward);
                }
            },
            mousemove: (e: any) => {
                if (hasData) {
                    setHoveredWard(prev => prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null);
                }
            },
            mouseout: (e: any) => {
                e.target.setStyle({ weight: 1, color: defaultBorderColor, opacity: defaultBorderOpacity });
                setHoveredWard(null);
                onWardHover?.(null);
            },
            click: () => {
                if (isProjectionClickable) {
                    onWardClick!({ name: municipality, num: wardNum });
                }
            },
        });

        // Show pointer cursor on clickable wards in PROJECTION mode
        if (isProjectionClickable) {
            (layer as any).options = { ...((layer as any).options || {}), className: 'cursor-pointer' };
        }
    }, [resultsMap, candidateColors, onWardHover, overlayMode, onWardClick]);

    return (
        <>
            <MapContainer
                center={[43.0731, -89.4012]}
                zoom={10}
                className="w-full h-full bg-slate-950"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {geoJsonData && (
                    <>
                        <GeoJSON
                            key={`${selectedWard ? selectedWard.num : 'all'}-${raceResult?.id || 'default'}-${overlayMode}-${Object.keys(candidateColors).length}-${historicalLabel || 'loading'}-${focusedCandidate || 'none'}-${projectionData ? Object.keys(projectionData).length : 0}`}
                            data={geoJsonData}
                            style={(feature) => style(feature, selectedWard)}
                            onEachFeature={onEachFeature}
                            ref={geoJsonLayerRef}
                        />
                        <MapController geoJsonData={geoJsonData} selectedWard={selectedWard} onReset={onReset} />
                    </>
                )}
            </MapContainer>

            {hoveredWard && (
                <div style={{
                    position: 'fixed',
                    left: hoveredWard.x + 16,
                    top: hoveredWard.y - 8,
                    transform: 'translateY(-100%)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    minWidth: '230px',
                    maxWidth: '290px',
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.65)',
                        color: 'white',
                        fontSize: '13px',
                        fontFamily: 'system-ui, sans-serif',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1e293b' }}>
                            <div
                                title={raceResult?.raceName || 'Election Results'}
                                style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                                {raceResult?.raceName || 'Election Results'}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>
                                {hoveredWard.municipality} · Wd.&nbsp;{hoveredWard.wardNum}
                            </div>
                        </div>

                        {/* Candidate rows */}
                        <div style={{ padding: '10px 14px' }}>
                            {(() => {
                                // For Presidential races, only show D and R candidates in the tooltip.
                                const isPresidential = raceResult?.type === 'Presidential';
                                const partyMap: Record<string, string | undefined> = Object.fromEntries(
                                    (raceResult?.candidates ?? []).map(c => [c.candidateName.trim(), c.party])
                                );
                                const visibleResults = isPresidential
                                    ? hoveredWard.results.filter(r => {
                                        const party = partyMap[r.candidateName.trim()];
                                        const name = r.candidateName;
                                        return party === 'Democratic' || party === 'Republican'
                                            || name.includes('Biden') || name.includes('Harris')
                                            || name.includes('Trump');
                                    })
                                    : hoveredWard.results;
                                return visibleResults.map((r, i) => {
                                    const hsl = candidateColors[r.candidateName.trim()];
                                    const barColor = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '#64748b';
                                    const isWinner = i === 0;
                                    return (
                                        <div key={i} style={{ marginBottom: i < visibleResults.length - 1 ? '10px' : 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                                <span title={r.candidateName} style={{ color: isWinner ? '#f1f5f9' : '#94a3b8', fontWeight: isWinner ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                                                    {isWinner ? '▲ ' : '\u00a0\u00a0 '}{r.candidateName}
                                                </span>
                                                <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: isWinner ? 700 : 400, color: isWinner ? '#f1f5f9' : '#64748b', marginLeft: '12px' }}>
                                                    {r.pct.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div style={{ height: '5px', background: '#1e293b', borderRadius: '3px', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${r.pct}%`, background: barColor, borderRadius: '3px' }} />
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                                                {r.votes.toLocaleString()} votes
                                            </div>
                                        </div>
                                    );
                                });
                            })()}
                        </div>

                        {/* Margin comparison row — shown in NONE/SWING when real historical margin exists */}
                        {overlayMode !== 'TURNOUT' && hoveredWard.analysis?.historicalRaceName && hoveredWard.analysis.historicalMargin !== 0 && (() => {
                            const histMarginPct = hoveredWard.analysis!.historicalMargin * 100;
                            const currentMarginPct = hoveredWard.results.length >= 2
                                ? hoveredWard.results[0].pct - hoveredWard.results[1].pct
                                : 100;
                            const diff = currentMarginPct - Math.abs(histMarginPct);
                            const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' pts';
                            const diffColor = diff >= 0 ? '#4ade80' : '#f87171';
                            const year = hoveredWard.analysis!.historicalDate
                                ? new Date(hoveredWard.analysis!.historicalDate).getFullYear()
                                : '?';
                            return (
                                <div style={{ padding: '5px 14px 6px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>
                                        vs {year} {hoveredWard.analysis!.historicalRaceName.split(' ').slice(0, 2).join(' ')}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: diffColor }}>{diffStr}</span>
                                </div>
                            );
                        })()}

                        {/* Turnout delta row — shown only in TURNOUT overlay mode */}
                        {overlayMode === 'TURNOUT' && hoveredWard.analysis && hoveredWard.analysis.historicalVotes > 0 && (() => {
                            const ratio = hoveredWard.total / hoveredWard.analysis!.historicalVotes;
                            const deltaPct = (ratio - 1) * 100;
                            const isAbove = deltaPct >= 0;
                            const arrow = isAbove ? '↑' : '↓';
                            const deltaColor = isAbove ? '#4ade80' : '#f87171';
                            const year = hoveredWard.analysis!.historicalDate
                                ? new Date(hoveredWard.analysis!.historicalDate).getFullYear()
                                : '?';
                            const prevVotes = hoveredWard.analysis!.historicalVotes.toLocaleString();
                            const ballotDiff = hoveredWard.total - hoveredWard.analysis!.historicalVotes;
                            const diffStr = (isAbove ? '+' : '') + ballotDiff.toLocaleString();
                            return (
                                <div style={{ padding: '5px 14px 6px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>vs {year} baseline · {prevVotes} ballots</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: deltaColor }}>
                                        {arrow} {Math.abs(deltaPct).toFixed(0)}% &middot; {diffStr} ballots
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Footer — only shown for contested races (2+ candidates) */}
                        {hoveredWard.results.length >= 2 && (
                            <div style={{ padding: '7px 14px 10px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#475569' }}>
                                    {hoveredWard.total.toLocaleString()} ballots cast
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    +{Math.abs(hoveredWard.results[0].pct - hoveredWard.results[1].pct).toFixed(1)}% margin
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
