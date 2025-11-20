'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface WardMapProps {
    wardResults: Array<{
        wardNumber: string;
        winner: string;
        margin: number;
    }>;
}

export function WardMap({ wardResults }: WardMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!isClient || !mapRef.current) return;

        // Initialize map only once
        if (!mapInstanceRef.current) {
            const map = L.map(mapRef.current).setView([43.0731, -89.4012], 11);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                maxZoom: 19
            }).addTo(map);

            mapInstanceRef.current = map;

            // Load GeoJSON
            fetch('/dane_wards.geojson')
                .then(res => res.json())
                .then(data => {
                    L.geoJSON(data, {
                        style: (feature) => {
                            const wardNum = feature?.properties?.WARD_NUM || feature?.properties?.ward || '';
                            const result = wardResults.find(r => r.wardNumber === wardNum.toString().padStart(3, '0'));

                            let fillColor = '#6b7280'; // default gray
                            if (result) {
                                if (result.winner.includes('Harris') || result.winner.includes('Baldwin') || result.winner.includes('Agard')) {
                                    fillColor = result.margin > 20 ? '#1e40af' : '#3b82f6';
                                } else {
                                    fillColor = result.margin > 20 ? '#991b1b' : '#ef4444';
                                }
                            }

                            return {
                                fillColor,
                                weight: 1,
                                opacity: 1,
                                color: '#27272a',
                                fillOpacity: 0.7
                            };
                        },
                        onEachFeature: (feature, layer) => {
                            const wardNum = feature?.properties?.WARD_NUM || feature?.properties?.ward || 'Unknown';
                            const result = wardResults.find(r => r.wardNumber === wardNum.toString().padStart(3, '0'));

                            if (result) {
                                layer.bindPopup(`
                  <div style="color: #000;">
                    <strong>Ward ${wardNum}</strong><br/>
                    Winner: ${result.winner}<br/>
                    Margin: ${result.margin.toFixed(1)}%
                  </div>
                `);
                            }
                        }
                    }).addTo(map);
                })
                .catch(err => console.error('Error loading GeoJSON:', err));
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [isClient, wardResults]);

    if (!isClient) {
        return (
            <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-3xl text-white">Madison Ward Map</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-96 bg-zinc-800 rounded-lg flex items-center justify-center">
                        <p className="text-zinc-400">Loading map...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-3xl text-white">Madison Ward Map</CardTitle>
                <div className="flex gap-4 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-600 rounded"></div>
                        <span className="text-sm text-zinc-400">Dem Strong</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-400 rounded"></div>
                        <span className="text-sm text-zinc-400">Dem Lean</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-400 rounded"></div>
                        <span className="text-sm text-zinc-400">Rep Lean</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-600 rounded"></div>
                        <span className="text-sm text-zinc-400">Rep Strong</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div ref={mapRef} className="h-96 rounded-lg z-0"></div>
            </CardContent>
        </Card>
    );
}
