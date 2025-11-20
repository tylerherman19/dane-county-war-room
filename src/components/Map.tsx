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

export default function Map({ precinctResults, isLoading, selectedWard }: MapProps) {
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

        const relevantResults = precinctResults?.filter(r =>
            parseInt(r.wardNumber) === parseInt(wardNum) &&
            r.precinctName.toLowerCase().includes(municipality.toLowerCase())
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

        const name = winner.candidateName.toLowerCase();
        let color = '#64748b'; // Default slate

        if (name.includes('harris') || name.includes('baldwin') || name.includes('pocan') || name.includes('hong') || name.includes('agard') || name.includes('yes')) {
            const pct = winner.votes / total;
            if (pct > 0.8) color = '#1d4ed8';
            else if (pct > 0.6) color = '#3b82f6';
            else color = '#60a5fa';
        } else if (name.includes('trump') || name.includes('hovde') || name.includes('theron') || name.includes('no')) {
            const pct = winner.votes / total;
            if (pct > 0.8) color = '#b91c1c';
            else if (pct > 0.6) color = '#ef4444';
            else color = '#f87171';
        }

        return {
            fillColor: color,
            weight: 1,
            opacity: 1,
            color: '#334155',
            fillOpacity: 0.7
        };
    };

    const onEachFeature = (feature: any, layer: L.Layer) => {
        const municipality = feature.properties.NAME;
        const wardNum = feature.properties.WardNumber;

        const relevantResults = precinctResults?.filter(r =>
            parseInt(r.wardNumber) === parseInt(wardNum) &&
            r.precinctName.toLowerCase().includes(municipality.toLowerCase())
        ) || [];

        if (relevantResults.length > 0) {
            const total = relevantResults[0].ballotscast;
            const sorted = relevantResults.sort((a, b) => b.votes - a.votes);

            let popupContent = `<div class="p-2 font-sans text-sm">
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
