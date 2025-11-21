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

                                        // After 5s: Remove Pulse/Highlight
                                        setTimeout(() => {
                                            el.classList.remove('ward-pulse');
                                        }, 5000);
                                    }
                                }
                            }
                        }
                    }
                });
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

            // Determine Color based on Party
            let color = '#64748b'; // Default slate

            // Try to find party from raceResult candidates
            // Use trim() and case-insensitive match for robustness
            const candidateInfo = raceResult?.candidates.find((c: any) =>
                c.candidateName.trim().toLowerCase() === winner.candidateName.trim().toLowerCase()
            );
            const party = candidateInfo?.party?.toLowerCase() || '';

            if (party.includes('democrat') || party.includes('liber') || party.includes('green')) {
                color = '#3b82f6'; // Blue
            } else if (party.includes('republican')) {
                color = '#ef4444'; // Red
            } else if (winner.candidateName.includes('Satya')) {
                color = '#3b82f6'; // Satya -> Blue (Progressive)
            } else if (winner.candidateName.includes('Gloria') || winner.candidateName.includes('Soglin')) {
                color = '#ef4444'; // Challengers -> Red (for contrast)
            } else if (winner.candidateName.toLowerCase().includes('yes')) {
                color = '#3b82f6'; // Yes = Blue
            } else if (winner.candidateName.toLowerCase().includes('no')) {
                color = '#ef4444'; // No = Red
            } else if (['Evers', 'Baldwin', 'Biden', 'Clinton', 'Harris', 'Obama', 'Feingold', 'Pocan'].some(n => winner.candidateName.includes(n))) {
                color = '#3b82f6'; // Known Dems
            } else if (['Walker', 'Johnson', 'Trump', 'Michels', 'Vukmir', 'Pence', 'Vance', 'Theron'].some(n => winner.candidateName.includes(n))) {
                color = '#ef4444'; // Known GOP
            }

            // Calculate Opacity based on Margin (Gradient)
            const opacity = 0.4 + (Math.min(margin, 0.5) * 1.0);

            baseStyle = {
                fillColor: color,
                weight: 1,
                opacity: 1,
                color: '#334155',
                fillOpacity: opacity
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

            // Only add hover effects if NO ward is selected (to avoid fighting with spotlight)
            if (!selectedWard) {
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
                            fillOpacity: 0.6 // Approximation
                        });
                    }
                });
            }
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
