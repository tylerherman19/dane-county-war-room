'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PrecinctResult } from '@/lib/api';

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
    selectedWard?: { name: string; num: string } | null;
    raceResult?: any;
    onReset?: () => void;
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

// Color Palettes (HSL)
// Blue: 217, 91%, 60%
// Red: 0, 84%, 60%
// Yellow: 48, 96%, 47%
// Green: 142, 71%, 45%
// Purple: 271, 91%, 65%
// Orange: 24, 95%, 53%
// Cyan: 189, 94%, 43%

interface HSL { h: number; s: number; l: number; }

const PALETTE_2: HSL[] = [{ h: 217, s: 91, l: 60 }, { h: 0, s: 84, l: 60 }];
const PALETTE_4: HSL[] = [...PALETTE_2, { h: 48, s: 96, l: 47 }, { h: 142, s: 71, l: 45 }];
const PALETTE_MANY: HSL[] = [...PALETTE_4, { h: 271, s: 91, l: 65 }, { h: 24, s: 95, l: 53 }, { h: 189, s: 94, l: 43 }];

function assignCandidateColors(candidates: any[]): Record<string, HSL> {
    if (!candidates || candidates.length === 0) return {};

    const assignments: Record<string, HSL> = {};
    const count = candidates.length;

    // Determine Palette
    let palette = PALETTE_MANY;
    if (count <= 2) palette = PALETTE_2;
    else if (count <= 4) palette = PALETTE_4;

    // Create a pool of available colors
    let availableColors = [...palette];
    const unassignedCandidates: any[] = [];

    // 1. Assign Fixed Parties (Dem/Rep)
    candidates.forEach(c => {
        const name = c.candidateName.trim();
        const party = (c.party || '').toLowerCase();
        const nameLower = name.toLowerCase();

        // Blue (Dem) is index 0 in all palettes
        // Red (Rep) is index 1 in all palettes

        if (party.includes('democrat') || nameLower.includes('satya') || nameLower.includes('biden') || nameLower.includes('evers')) {
            const blue = palette[0];
            if (availableColors.includes(blue)) {
                assignments[name] = blue;
                availableColors = availableColors.filter(col => col !== blue);
            } else {
                unassignedCandidates.push(c);
            }
        } else if (party.includes('republican') || nameLower.includes('trump') || nameLower.includes('johnson')) {
            const red = palette[1];
            if (availableColors.includes(red)) {
                assignments[name] = red;
                availableColors = availableColors.filter(col => col !== red);
            } else {
                unassignedCandidates.push(c);
            }
        } else {
            unassignedCandidates.push(c);
        }
    });

    // 2. Assign Remaining Candidates to Remaining Colors
    unassignedCandidates.forEach(c => {
        const name = c.candidateName.trim();
        if (availableColors.length > 0) {
            assignments[name] = availableColors.shift()!;
        } else {
            // Fallback: Slate-ish
            assignments[name] = { h: 215, s: 16, l: 47 };
        }
    });

    return assignments;
}

export default function Map({ precinctResults, isLoading, selectedWard, raceResult, onReset }: MapProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [candidateColors, setCandidateColors] = useState<Record<string, HSL>>({});

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

    const style = (feature: any) => {
        const municipality = feature.properties.NAME;
        const wardNum = feature.properties.WardNumber;

        // Filter results for this ward
        const relevantResults = precinctResults?.filter(r =>
            parseInt(r.wardNumber) === parseInt(wardNum) &&
            (r.precinctName.toLowerCase().includes(municipality.toLowerCase()) || municipality.toLowerCase().includes(r.precinctName.toLowerCase()))
        ) || [];

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
            const sorted = relevantResults.sort((a, b) => b.votes - a.votes);
            const winner = sorted[0];
            const runnerUp = sorted[1];

            // Determine Margin
            const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;

            // Determine Color
            const baseColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 16, l: 47 };

            // Calculate Lightness based on Margin
            // Margin 0 (Tie) -> Lightness 80% (Pale)
            // Margin 0.5+ (Landslide) -> Lightness 40% (Dark/Standard)
            // Formula: L = 80 - (Math.min(margin, 0.5) * 2 * 40)
            // Simplified: L = 80 - (Math.min(margin, 0.5) * 80)
            const lightness = 80 - (Math.min(margin, 0.5) * 80);

            // Ensure we don't go too dark or too light if needed, but 40-80 is a good range.
            // Actually, let's clamp the lower bound to the base color's lightness if it's higher than 40?
            // Or just stick to the formula for consistency.

            const colorString = `hsl(${baseColor.h}, ${baseColor.s}%, ${lightness}%)`;

            baseStyle = {
                fillColor: colorString,
                weight: 1,
                opacity: 1,
                color: '#334155',
                fillOpacity: 0.9 // High opacity because we use lightness for the gradient now
            };
        }

        // SPOTLIGHT EFFECT: If a ward is selected, dim everyone else
        if (selectedWard) {
            const isSelected = parseInt(wardNum) === parseInt(selectedWard.num) &&
                (selectedWard.name.toLowerCase().includes(municipality.toLowerCase()) ||
                    municipality.toLowerCase().includes(selectedWard.name.toLowerCase()));

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
    };

    const onEachFeature = (feature: any, layer: L.Layer) => {
        const municipality = feature.properties.NAME;
        const wardNum = feature.properties.WardNumber;

        const relevantResults = precinctResults?.filter(r =>
            parseInt(r.wardNumber) === parseInt(wardNum) &&
            (r.precinctName.toLowerCase().includes(municipality.toLowerCase()) || municipality.toLowerCase().includes(r.precinctName.toLowerCase()))
        ) || [];

        if (relevantResults.length > 0) {
            const total = relevantResults[0].ballotscast;
            const sorted = relevantResults.sort((a, b) => b.votes - a.votes);

            let popupContent = `<div class="p-2 font-sans text-sm">
                <div class="text-xs text-slate-400 mb-1 uppercase tracking-wider">${raceResult?.raceName || 'Election Results'}</div>
                <h3 class="font-bold border-b pb-1 mb-2">${municipality} Ward ${wardNum}</h3>
                <div class="space-y-1">`;

            sorted.forEach(r => {
                const pct = ((r.votes / total) * 100).toFixed(1);
                popupContent += `<div class="flex justify-between gap-4">
                    <span>${r.candidateName}</span>
                    <span class="font-mono">${r.votes} (${pct}%)</span>
                </div>`;
            });

            popupContent += `<div class="mt-2 pt-1 border-t text-xs text-slate-500">
                Turnout: ${total} / ${relevantResults[0].registeredVoters}
            </div></div>`;

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
                    // Re-apply base style logic roughly or just reset
                    // Ideally we trigger a re-render but that's expensive. 
                    // We'll just reset to a "safe" default for hover exit.
                    layer.setStyle({
                        weight: 1,
                        color: '#334155',
                        fillOpacity: 0.9
                    });
                }
            });
        }
    };

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
                        key={`${selectedWard ? selectedWard.num : 'all'}-${raceResult?.id || 'default'}`}
                        data={geoJsonData}
                        style={style}
                        onEachFeature={onEachFeature}
                    />
                    <MapController geoJsonData={geoJsonData} selectedWard={selectedWard} />
                </>
            )}
        </MapContainer>
    );
}
