import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PrecinctResult, RaceResult } from '@/lib/api';
import { getWardAnalysis, WardAnalysis, startLoadingHistoricalData } from '@/lib/analysis-data';
import { OverlayMode } from './MapOverlayControl';

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

// Color Palettes (HSL) - Traditional Election Map Style
// Using deeper, more saturated colors for better visibility
// Blue: 217, 91%, 50% (Deep Democratic Blue)
// Red: 0, 85%, 50% (Deep Republican Red)
// Gold: 45, 100%, 50% (Deep Gold instead of pale yellow)
// Green: 120, 60%, 35% (Deep Forest Green)
// Purple: 271, 80%, 55% (Deep Purple)
// Orange: 20, 90%, 50% (Deep Orange)
// Teal: 180, 70%, 40% (Deep Teal)

export interface HSL { h: number; s: number; l: number; }

// Helper to assign colors to candidates dynamically
export function assignCandidateColors(candidates: { candidateName: string; party?: string }[]): Record<string, HSL> {
    const colors: Record<string, HSL> = {};

    // Standard party colors
    const partyColors: Record<string, HSL> = {
        'Democratic': { h: 215, s: 90, l: 50 }, // Blue
        'Republican': { h: 0, s: 90, l: 50 },   // Red
        'Green': { h: 140, s: 70, l: 45 },      // Green
        'Libertarian': { h: 45, s: 90, l: 50 }, // Gold
        'Independent': { h: 280, s: 60, l: 60 }, // Purple
        'Nonpartisan': { h: 200, s: 10, l: 50 }  // Grey
    };

    // Fallback palette for non-partisan or multiple candidates of same party
    const palette: HSL[] = [
        { h: 215, s: 80, l: 55 }, // Blue
        { h: 160, s: 70, l: 45 }, // Teal
        { h: 280, s: 60, l: 60 }, // Purple
        { h: 30, s: 90, l: 55 },  // Orange
        { h: 330, s: 70, l: 55 }, // Pink
    ];

    let paletteIndex = 0;

    candidates.forEach(c => {
        const name = c.candidateName.trim();
        // Check for specific known candidates (optional hardcoding for key figures)
        if (name.includes('Biden') || name.includes('Harris') || name.includes('Evers')) {
            colors[name] = { h: 215, s: 90, l: 50 };
        } else if (name.includes('Trump') || name.includes('Michels')) {
            colors[name] = { h: 0, s: 90, l: 50 };
        } else if (c.party && partyColors[c.party]) {
            colors[name] = partyColors[c.party];
        } else {
            colors[name] = palette[paletteIndex % palette.length];
            paletteIndex++;
        }
    });

    return colors;
}

export default function Map({ precinctResults, isLoading, selectedWard, raceResult, onReset, overlayMode, onWardHover }: MapProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [candidateColors, setCandidateColors] = useState<Record<string, HSL>>({});
    const [hoveredWard, setHoveredWard] = useState<HoveredWard | null>(null);
    const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

    // Start loading historical data when race changes
    useEffect(() => {
        if (raceResult?.type) {
            startLoadingHistoricalData(raceResult.type);
        }
    }, [raceResult?.type]);

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

            // --- STANDARD VIEW ---
            if (overlayMode === 'NONE') {
                // Determine Margin
                const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;

                // Determine Color
                const baseColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 16, l: 47 };

                // Calculate Lightness based on Margin - Traditional Election Map Style
                const lightness = 65 - (Math.min(margin, 0.5) * 30);

                const colorString = `hsl(${baseColor.h}, ${baseColor.s}%, ${lightness}%)`;

                baseStyle = {
                    fillColor: colorString,
                    weight: 1,
                    opacity: 1,
                    color: '#334155',
                    fillOpacity: 0.65
                };
            }
            // --- PRESIDENTIAL BENCHMARK ---
            else if (overlayMode === 'PRESIDENTIAL') {
                // Calculate current Dem margin (assuming winner is Dem for simplicity, or finding Dem candidate)
                // For robustness, let's find the "Democratic" or "Liberal" candidate or just the winner if they are blue.
                // Simplified: Use winner's margin if they are Blue, else negative.
                const winnerColor = candidateColors[winner.candidateName.trim()];
                const isBlue = winnerColor && (winnerColor.h > 180 && winnerColor.h < 260); // Roughly blue hue

                let currentMargin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                if (!isBlue) currentMargin = -currentMargin; // If winner is Red, margin is negative (from Dem perspective)

                // Compare to Biden 2020
                const diff = currentMargin - analysis.historicalMargin;

                // Color Scale: Red (Underperform) -> Grey -> Blue (Overperform)
                // Range: -0.2 to +0.2
                let h = 215; // Blue
                let s = 80;
                let l = 50;

                if (diff < 0) {
                    h = 0; // Red
                    l = 90 - (Math.min(Math.abs(diff) * 3, 0.5) * 80); // Darker red as underperformance grows
                    // Actually, let's do:
                    // 0 -> Grey/White
                    // -0.2 -> Dark Red
                    const intensity = Math.min(Math.abs(diff) / 0.2, 1);
                    l = 90 - (intensity * 40); // 90 -> 50
                    s = intensity * 80;
                } else {
                    h = 215; // Blue
                    const intensity = Math.min(diff / 0.2, 1);
                    l = 90 - (intensity * 40); // 90 -> 50
                    s = intensity * 80;
                }

                if (Math.abs(diff) < 0.01) {
                    h = 0; s = 0; l = 80; // Neutral grey
                }

                baseStyle = {
                    fillColor: `hsl(${h}, ${s}%, ${l}%)`,
                    weight: 1,
                    opacity: 1,
                    color: '#334155',
                    fillOpacity: 0.75
                };
            }
            // --- TURNOUT HEATMAP (VOTE VOLUME) ---
            else if (overlayMode === 'TURNOUT') {
                // We don't have registered voters for historical data, so we compare RAW VOTE VOLUME
                const currentVotes = total;
                const avgVotes = analysis.historicalVotes || 0; // Historical vote volume

                // Avoid division by zero
                const ratio = avgVotes > 0 ? currentVotes / avgVotes : 0;

                // Scale: 0.5 (Low) -> 1.0 (Avg) -> 1.5 (High)
                // Red -> Grey -> Green

                let h = 120; // Green
                let s = 80;
                let l = 50;

                if (ratio < 1.0) {
                    h = 0; s = 0; l = 30 + (ratio * 40); // Dark grey to light grey
                } else {
                    h = 140; // Green
                    const intensity = Math.min((ratio - 1.0) / 0.5, 1);
                    l = 50 - (intensity * 10); // Slightly darker green for intensity
                    s = 50 + (intensity * 50); // More saturated
                }

                baseStyle = {
                    fillColor: `hsl(${h}, ${s}%, ${l}%)`,
                    weight: 1,
                    opacity: 1,
                    color: '#334155',
                    fillOpacity: 0.75
                };
            }
            // --- SWING ANALYSIS ---
            else if (overlayMode === 'SWING') {
                // Similar to Presidential but vs Previous Margin
                const winnerColor = candidateColors[winner.candidateName.trim()];
                const isBlue = winnerColor && (winnerColor.h > 180 && winnerColor.h < 260);

                let currentMargin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                if (!isBlue) currentMargin = -currentMargin;

                const diff = currentMargin - analysis.historicalMargin;

                // Red Shift vs Blue Shift
                let h = 215;
                let s = 80;
                let l = 50;

                if (diff < 0) {
                    h = 0; // Red Shift
                    const intensity = Math.min(Math.abs(diff) / 0.15, 1);
                    l = 90 - (intensity * 40);
                    s = intensity * 80;
                } else {
                    h = 215; // Blue Shift
                    const intensity = Math.min(diff / 0.15, 1);
                    l = 90 - (intensity * 40);
                    s = intensity * 80;
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
    }, [resultsMap, candidateColors, overlayMode]); // Re-create if overlay mode changes

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
        });
    }, [resultsMap, candidateColors, onWardHover]);

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
                            key={`${selectedWard ? selectedWard.num : 'all'}-${raceResult?.id || 'default'}-${overlayMode}-${Object.keys(candidateColors).length}`}
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
                            <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>
                                {raceResult?.raceName || 'Election Results'}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>
                                {hoveredWard.municipality} · Wd.&nbsp;{hoveredWard.wardNum}
                            </div>
                        </div>

                        {/* Candidate rows */}
                        <div style={{ padding: '10px 14px' }}>
                            {hoveredWard.results.map((r, i) => {
                                const hsl = candidateColors[r.candidateName.trim()];
                                const barColor = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '#64748b';
                                const isWinner = i === 0;
                                return (
                                    <div key={i} style={{ marginBottom: i < hoveredWard.results.length - 1 ? '10px' : 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                            <span style={{ color: isWinner ? '#f1f5f9' : '#94a3b8', fontWeight: isWinner ? 600 : 400 }}>
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
                            })}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '7px 14px 10px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#475569' }}>
                                {hoveredWard.total.toLocaleString()} ballots cast
                            </span>
                            {hoveredWard.results.length >= 2 && (
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    +{Math.abs(hoveredWard.results[0].pct - hoveredWard.results[1].pct).toFixed(1)}% margin
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
