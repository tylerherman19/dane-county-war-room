import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PrecinctResult, RaceResult } from '@/lib/api';
import { getWardAnalysis, WardAnalysis } from '@/lib/analysis-data';
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

interface HSL { h: number; s: number; l: number; }

// Helper to assign colors to candidates dynamically
function assignCandidateColors(candidates: { candidateName: string; party?: string }[]): Record<string, HSL> {
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

export default function Map({ precinctResults, isLoading, selectedWard, raceResult, onReset, overlayMode }: MapProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [candidateColors, setCandidateColors] = useState<Record<string, HSL>>({});
    const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

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
                const diff = currentMargin - analysis.presidentialMargin2020;

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
            // --- TURNOUT HEATMAP ---
            else if (overlayMode === 'TURNOUT') {
                const currentTurnout = total / relevantResults[0].registeredVoters;
                // Compare to average
                const ratio = currentTurnout / analysis.averageTurnout;

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

                // Simplified Heatmap:
                // 0% -> 100% turnout
                // 0 = Black, 50 = Grey, 80+ = Bright Green
                const t = Math.min(currentTurnout, 1.0);
                if (t < 0.5) {
                    h = 0; s = 0; l = t * 100; // Black to Grey
                } else {
                    h = 140; s = 100; l = 20 + ((t - 0.5) * 120); // Dark Green to Neon
                    if (l > 70) l = 70; // Cap lightness
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

                const diff = currentMargin - analysis.previousMargin;

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

        // OPTIMIZED LOOKUP
        const potentialMatches = resultsMap[wardNum] || [];
        const relevantResults = potentialMatches.filter((r: PrecinctResult) =>
            r.precinctName.toLowerCase().includes(municipality.toLowerCase()) ||
            municipality.toLowerCase().includes(r.precinctName.toLowerCase())
        );

        if (relevantResults.length > 0) {
            const total = relevantResults[0].ballotscast;
            const sorted = relevantResults.sort((a: PrecinctResult, b: PrecinctResult) => b.votes - a.votes);

            // Get Analysis Data
            const analysis = getWardAnalysis(wardNum, municipality);

            let popupContent = `<div class="p-2 font-sans text-sm">
                <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">${raceResult?.raceName || 'Election Results'}</div>
                <h3 class="font-bold border-b pb-1 mb-2">${municipality} Ward ${wardNum}</h3>`;

            // --- DYNAMIC CONTENT BASED ON OVERLAY ---
            if (overlayMode === 'PRESIDENTIAL') {
                const winner = sorted[0];
                // Calculate current margin (simplified for demo)
                const runnerUp = sorted[1];
                const winnerColor = candidateColors[winner.candidateName.trim()];
                const isBlue = winnerColor && (winnerColor.h > 180 && winnerColor.h < 260);

                let currentMargin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                if (!isBlue) currentMargin = -currentMargin; // Convert to Dem margin perspective

                const diff = currentMargin - analysis.presidentialMargin2020;
                const diffPct = (diff * 100).toFixed(1);
                const sign = diff > 0 ? '+' : '';
                const colorClass = diff > 0 ? 'text-blue-400' : 'text-red-400';

                popupContent += `
                    <div class="mb-2">
                        <div class="text-xs text-slate-400">Vs. Biden 2020</div>
                        <div class="text-lg font-bold ${colorClass}">${sign}${diffPct}%</div>
                        <div class="text-xs text-slate-500 mt-1">
                            Current Margin: ${(currentMargin * 100).toFixed(1)}%<br>
                            2020 Margin: ${(analysis.presidentialMargin2020 * 100).toFixed(1)}%
                        </div>
                    </div>
                `;
            }
            else if (overlayMode === 'TURNOUT') {
                const currentTurnout = total / relevantResults[0].registeredVoters;
                const avgTurnout = analysis.averageTurnout;
                const diff = currentTurnout - avgTurnout;
                const sign = diff > 0 ? '+' : '';
                const colorClass = diff > 0 ? 'text-green-400' : 'text-slate-400';

                popupContent += `
                    <div class="mb-2">
                        <div class="text-xs text-slate-400">Turnout</div>
                        <div class="text-lg font-bold text-white">${(currentTurnout * 100).toFixed(1)}%</div>
                        <div class="text-sm font-medium ${colorClass} mt-1">
                            ${sign}${(diff * 100).toFixed(1)}% vs Avg
                        </div>
                        <div class="text-xs text-slate-500 mt-1">
                            Avg Turnout: ${(avgTurnout * 100).toFixed(1)}%
                        </div>
                    </div>
                `;
            }
            else if (overlayMode === 'SWING') {
                const winner = sorted[0];
                const runnerUp = sorted[1];
                const winnerColor = candidateColors[winner.candidateName.trim()];
                const isBlue = winnerColor && (winnerColor.h > 180 && winnerColor.h < 260);

                let currentMargin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                if (!isBlue) currentMargin = -currentMargin;

                const swing = currentMargin - analysis.previousMargin;
                const swingPct = (swing * 100).toFixed(1);
                const direction = swing > 0 ? 'Dem' : 'Rep';
                const colorClass = swing > 0 ? 'text-blue-400' : 'text-red-400';

                popupContent += `
                    <div class="mb-2">
                        <div class="text-xs text-slate-400">Swing vs Previous</div>
                        <div class="text-lg font-bold ${colorClass}">${direction} +${Math.abs(parseFloat(swingPct))}%</div>
                        <div class="text-xs text-slate-500 mt-1">
                            Current Margin: ${(currentMargin * 100).toFixed(1)}%<br>
                            Prev Margin: ${(analysis.previousMargin * 100).toFixed(1)}%
                        </div>
                    </div>
                `;
            }
            else {
                // --- STANDARD VIEW (Existing Logic) ---
                popupContent += `<div class="space-y-1">`;
                sorted.forEach((r: PrecinctResult) => {
                    const pct = ((r.votes / total) * 100).toFixed(1);
                    popupContent += `<div class="flex justify-between gap-4">
                        <span>${r.candidateName}</span>
                        <span class="font-mono">${r.votes} (${pct}%)</span>
                    </div>`;
                });
                popupContent += `<div class="mt-2 pt-1 border-t text-xs text-slate-500">
                    Turnout: ${total} / ${relevantResults[0].registeredVoters}
                </div></div>`;
            }

            // Close main div if not standard view (standard view closes it inside the else block)
            if (overlayMode !== 'NONE') {
                popupContent += `</div>`;
            }

            layer.bindTooltip(popupContent, {
                className: 'dark-popup',
                sticky: true,
                direction: 'top'
            });

            // Add hover effects (always, not just when no ward selected)
            layer.on({
                mouseover: (e) => {
                    const layer = e.target;
                    layer.setStyle({
                        weight: 3,
                        color: '#60a5fa',
                        fillOpacity: 0.9
                    });
                    layer.bringToFront();
                },
                mouseout: (e) => {
                    const layer = e.target;
                    // Manually recalculate the original style with current selectedWard
                    const originalStyle = style(feature, selectedWard);
                    layer.setStyle(originalStyle);
                }
            });
        }
    }, [resultsMap, raceResult, selectedWard, style, overlayMode, candidateColors]); // Dependencies

    return (
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
                        key={`${selectedWard ? selectedWard.num : 'all'}-${raceResult?.id || 'default'}-${overlayMode}`}
                        data={geoJsonData}
                        style={(feature) => style(feature, selectedWard)}
                        onEachFeature={onEachFeature}
                        ref={geoJsonLayerRef}
                    />
                    <MapController geoJsonData={geoJsonData} selectedWard={selectedWard} onReset={onReset} />
                </>
            )}
        </MapContainer>
    );
}
