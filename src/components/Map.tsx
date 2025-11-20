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
}

function MapController({ geoJsonData, selectedWard }: { geoJsonData: any; selectedWard?: { name: string; num: string } | null }) {
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
                    return feature.properties.WardNumber.toString() === selectedWard.num &&
                        feature.properties.NAME.includes('Madison'); // Simplified for mock
                }
            });
            if (layer.getLayers().length > 0) {
                map.fitBounds(layer.getBounds(), { maxZoom: 14, animate: true });
            }
        }
    }, [selectedWard, geoJsonData, map]);

    return null;
}

export default function Map({ precinctResults, isLoading, selectedWard, raceResult }: MapProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);

    useEffect(() => {
        fetch('dane_wards.geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Error loading GeoJSON:', err));
    }, []);

    const getColor = (wardId: string, municipality: string) => {
        if (!precinctResults) return '#1e293b'; // Default slate-800
        return '#3b82f6'; // Placeholder
    };

    // Pre-process results into a map for faster lookup and coloring
    const wardDataMap = new globalThis.Map<string, { winner: string, margin: number, total: number, demPct: number }>();

    if (precinctResults) {
        // Group by ward
        const wards: Record<string, PrecinctResult[]> = {};
        precinctResults.forEach(r => {
            const key = `${r.precinctName}-${r.wardNumber}`; // Unique key
            if (!wards[key]) wards[key] = [];
            wards[key].push(r);
        });

        Object.entries(wards).forEach(([key, results]) => {
            const total = results[0].ballotscast;
            const sorted = [...results].sort((a, b) => b.votes - a.votes);
            const winner = sorted[0];
            const runnerUp = sorted[1];
            const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;

            wardDataMap.set(key, {
                winner: winner.candidateName,
                margin,
                total,
                demPct: 0
            });
        });
    }

    const style = (feature: any) => {
        const municipality = feature.properties.NAME;
        const wardNum = feature.properties.WardNumber;

        // Filter results for this ward
        // Note: Mock data now uses "City of Madison" as precinctName, so we match on that or partial
        const relevantResults = precinctResults?.filter(r =>
            parseInt(r.wardNumber) === parseInt(wardNum) &&
            (r.precinctName.toLowerCase().includes(municipality.toLowerCase()) || municipality.toLowerCase().includes(r.precinctName.toLowerCase()))
        ) || [];

        if (relevantResults.length === 0) {
            return {
                fillColor: '#1e293b',
                weight: 1,
                opacity: 1,
                color: '#334155',
                fillOpacity: 0.7
            };
        }

        const total = relevantResults[0].ballotscast;
        const sorted = relevantResults.sort((a, b) => b.votes - a.votes);
        const winner = sorted[0];
        const runnerUp = sorted[1];

        // Determine Margin
        // If only one candidate, margin is 100% (1.0)
        // Otherwise (Winner - RunnerUp) / Total
        const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;

        // Determine Color based on Party
        let color = '#64748b'; // Default slate

        // Try to find party from raceResult candidates
        const candidateInfo = raceResult?.candidates.find((c: any) => c.candidateName === winner.candidateName);
        const party = candidateInfo?.party?.toLowerCase() || '';

        if (party.includes('democrat') || party.includes('liber') || party.includes('green')) { // Grouping left-leaning for now or just Dem
            color = '#3b82f6'; // Blue
        } else if (party.includes('republican')) {
            color = '#ef4444'; // Red
        } else if (winner.candidateName.toLowerCase().includes('yes')) {
            color = '#3b82f6'; // Yes = Blue
        } else if (winner.candidateName.toLowerCase().includes('no')) {
            color = '#ef4444'; // No = Red
        }

        // Calculate Opacity based on Margin (Gradient)
        // Min opacity 0.4 (close race), Max 0.9 (landslide)
        // Margin 0.0 -> 0.4
        // Margin 0.5+ -> 0.9
        const opacity = 0.4 + (Math.min(margin, 0.5) * 1.0);

        return {
            fillColor: color,
            weight: 1,
            opacity: 1,
            color: '#334155',
            fillOpacity: opacity
        };
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

            // Handle Pulse Effect
            if (selectedWard && selectedWard.num === wardNum.toString() && municipality.includes('Madison')) { // Simplified check
                const path = layer as L.Path;
                // Add class via DOM element if possible, or manual style animation
                // Leaflet doesn't easily support adding classes to paths via API for SVG, but we can access the element
                if (path.getElement()) {
                    path.getElement()?.classList.add('ward-pulse');
                    setTimeout(() => {
                        path.getElement()?.classList.remove('ward-pulse');
                    }, 5000);
                }
            }

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
                    // Reset style (simplified, ideally should revert to original style function)
                    // Check if we are pulsing, if so don't fully reset? 
                    // Actually CSS animation overrides inline styles usually, so it might be fine.
                    layer.setStyle({
                        weight: 1,
                        color: '#334155',
                        fillOpacity: 0.7
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
