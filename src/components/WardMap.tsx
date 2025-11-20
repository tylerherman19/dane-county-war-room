'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface WardResult {
    wardNumber: string;
    winner: string;
    margin: number;
}

interface WardMapProps {
    wardResults: WardResult[];
}

export function WardMap({ wardResults }: WardMapProps) {
    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainerRef.current) return;

        // Initialize map
        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, {
                center: [43.0731, -89.4012],
                zoom: 11,
                zoomControl: true,
            });

            // Add dark tile layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap © CARTO',
                maxZoom: 19,
            }).addTo(mapRef.current);
        }

        // Load and display ward boundaries
        fetch('/dane_wards.geojson')
            .then(response => response.json())
            .then(data => {
                if (!mapRef.current) return;

                L.geoJSON(data, {
                    style: (feature) => {
                        const wardNum = feature?.properties?.WARD || '';
                        const result = wardResults.find(r => r.wardNumber === wardNum);

                        let fillColor = '#64748b'; // Default gray
                        if (result) {
                            if (result.winner.includes('Harris')) {
                                fillColor = result.margin > 30 ? '#1e40af' : result.margin > 15 ? '#3b82f6' : '#60a5fa';
                            } else {
                                fillColor = result.margin > 30 ? '#991b1b' : result.margin > 15 ? '#dc2626' : '#f87171';
                            }
                        }

                        return {
                            fillColor,
                            weight: 1,
                            opacity: 0.8,
                            color: '#1e293b',
                            fillOpacity: 0.7,
                        };
                    },
                    onEachFeature: (feature, layer) => {
                        const wardNum = feature.properties?.WARD || 'Unknown';
                        const result = wardResults.find(r => r.wardNumber === wardNum);

                        if (result) {
                            layer.bindPopup(`
                <div class="text-sm">
                  <strong>Ward ${wardNum}</strong><br/>
                  Winner: ${result.winner}<br/>
                  Margin: ${result.margin.toFixed(1)}%
                </div>
              `);
                        }
                    },
                }).addTo(mapRef.current);
            });

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [wardResults]);

    return (
        <div className="relative w-full h-full">
            {/* Legend */}
            <div className="absolute top-4 left-4 z-[1000] bg-slate-800/90 backdrop-blur-sm border border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Madison Ward Map</h3>
                <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#1e40af' }}></div>
                        <span className="text-slate-300">Dem Strong (&gt; 70%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#3b82f6' }}></div>
                        <span className="text-slate-300">Dem Lean (&gt; 55%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f87171' }}></div>
                        <span className="text-slate-300">Rep Lean (&gt; 55%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }}></div>
                        <span className="text-slate-300">Rep Strong (&gt; 70%)</span>
                    </div>
                </div>
            </div>

            <div ref={mapContainerRef} className="w-full h-full rounded-lg" />
        </div>
    );
}
