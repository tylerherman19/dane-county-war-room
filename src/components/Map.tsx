import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PrecinctResult, RaceResult } from '@/lib/api';
import { getWardAnalysis, WardAnalysis, startLoadingHistoricalData, getCachedAvgVotes } from '@/lib/analysis-data';
import { OverlayMode } from './MapOverlayControl';
import { HSL, assignCandidateColors } from '@/lib/candidate-colors';
import { DropoffInfo } from '@/lib/dormant-voter-data';

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
    projectionData?: Record<string, number>;
    onWardClick?: (ward: { name: string; num: string }) => void;
    // SIMULATE overlay data
    dormantPoolData?: Record<string, number>;
    dropoffData?: Record<string, DropoffInfo>;
    simulateHighlightedWards?: Set<string> | null;
    // Real turnout (ballots cast) keyed by "City of Madison|46"
    turnoutByWard?: Record<string, number>;
    comparisonTurnoutByWard?: Record<string, number>;
    comparisonLabel?: string | null;
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
    dormantPool?: number;
    dropoffInfo?: DropoffInfo;
    turnoutBallots?: number;
    comparisonBallots?: number;
}

function MapController({ geoJsonData, selectedWard, onReset }: {
    geoJsonData: any;
    selectedWard?: { name: string; num: string } | null;
    onReset?: () => void;
}) {
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
                map.fitBounds(layer.getBounds(), { maxZoom: 14, animate: true });

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
                                        el.classList.add('ward-pulse');
                                        // Clear the spotlight after the pulse but keep the
                                        // camera on the selected ward (no fly-back to Madison).
                                        setTimeout(() => {
                                            el.classList.remove('ward-pulse');
                                            if (onReset) onReset();
                                        }, 4000);
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

/** Component that listens for map-level clicks to dismiss pinned tooltip */
function MapClickDismiss({ onDismiss }: { onDismiss: () => void }) {
    const map = useMap();
    useEffect(() => {
        map.on('click', onDismiss);
        return () => { map.off('click', onDismiss); };
    }, [map, onDismiss]);
    return null;
}

export { assignCandidateColors };
export type { HSL };

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

/** Returns a tooltip style that keeps the box within the viewport. */
function getSafeTooltipStyle(x: number, y: number): React.CSSProperties {
    const TOOLTIP_W = 290;
    const TOOLTIP_H = 240;
    const MARGIN = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    let left = x + 16;
    let top = y - 8;
    let transform = 'translateY(-100%)';

    // Flip left if near right edge
    if (left + TOOLTIP_W > vw - MARGIN) {
        left = x - TOOLTIP_W - 16;
    }
    // Clamp to left margin
    if (left < MARGIN) left = MARGIN;

    // Flip down if near top
    if (top - TOOLTIP_H < MARGIN) {
        transform = 'translateY(8px)';
    }
    // Clamp bottom
    if (top + TOOLTIP_H > vh - MARGIN) {
        top = vh - TOOLTIP_H - MARGIN;
    }

    return {
        position: 'fixed',
        left,
        top,
        transform,
        zIndex: 9999,
        pointerEvents: 'none',
        minWidth: '220px',
        maxWidth: `${TOOLTIP_W}px`,
    };
}

export default function Map({
    precinctResults,
    isLoading,
    selectedWard,
    raceResult,
    onReset,
    overlayMode,
    onWardHover,
    historicalLabel,
    focusedCandidate,
    projectionData,
    onWardClick,
    dormantPoolData,
    dropoffData,
    simulateHighlightedWards,
    turnoutByWard,
    comparisonTurnoutByWard,
    comparisonLabel,
}: MapProps) {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [candidateColors, setCandidateColors] = useState<Record<string, HSL>>({});
    const [hoveredWard, setHoveredWard] = useState<HoveredWard | null>(null);
    const [pinnedWard, setPinnedWard] = useState<HoveredWard | null>(null);
    const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

    // Start loading historical data when the race changes
    useEffect(() => {
        if (raceResult?.id && raceResult?.type) {
            startLoadingHistoricalData(raceResult.type);
        }
    }, [raceResult?.id]);

    // Clear pinned ward when race changes
    useEffect(() => { setPinnedWard(null); }, [raceResult?.id, overlayMode]);

    const maxDormantPool = useMemo(() => {
        if (!dormantPoolData) return 1;
        const vals = Object.values(dormantPoolData);
        return vals.length > 0 ? Math.max(...vals, 1) : 1;
    }, [dormantPoolData]);

    const maxDropoff = useMemo(() => {
        if (!dropoffData) return 1;
        const vals = Object.values(dropoffData).map(d => d.dropoff);
        return vals.length > 0 ? Math.max(...vals, 1) : 1;
    }, [dropoffData]);

    const resultsMap = useMemo(() => {
        const map: Record<string, PrecinctResult[]> = {};
        if (precinctResults) {
            precinctResults.forEach(r => {
                const wardNum = parseInt(r.wardNumber).toString();
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
        fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/dane_wards.geojson`)
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Error loading GeoJSON:', err));
    }, []);

    const style = useCallback((feature: any, currentSelectedWard: { name: string; num: string } | null = null) => {
        const municipality = feature.properties.NAME;
        const wardNum = parseInt(feature.properties.WardNumber).toString();

        let baseStyle = {
            fillColor: '#0f172a',
            weight: 1,
            opacity: 0.5,
            color: '#1e293b',
            fillOpacity: 0.3
        };

        if (overlayMode === 'CANVASS_PRIORITY') {
            if (dormantPoolData) {
                const normalizedKey = buildProjectionKey(municipality, wardNum);
                if (simulateHighlightedWards && simulateHighlightedWards.size > 0 && !simulateHighlightedWards.has(normalizedKey)) {
                    return { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.08 };
                }
                const pool = dormantPoolData[normalizedKey];
                if (pool !== undefined) {
                    if (pool > 0) {
                        const intensity = Math.min(pool / maxDormantPool, 1.0);
                        const l = Math.round(90 - intensity * 54);
                        const s = Math.round(15 + intensity * 80);
                        baseStyle = { fillColor: `hsl(243, ${s}%, ${l}%)`, weight: 1, opacity: 1, color: '#334155', fillOpacity: 0.85 };
                    } else {
                        baseStyle = { fillColor: '#1e293b', weight: 0.5, opacity: 0.4, color: '#334155', fillOpacity: 0.3 };
                    }
                } else {
                    baseStyle = { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.08 };
                }
            }
        } else if (overlayMode === 'PRIMARY_DROPOFF') {
            if (dropoffData) {
                const normalizedKey = buildProjectionKey(municipality, wardNum);
                if (simulateHighlightedWards && simulateHighlightedWards.size > 0 && !simulateHighlightedWards.has(normalizedKey)) {
                    return { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.08 };
                }
                const info = dropoffData[normalizedKey];
                if (info) {
                    if (info.dropoff > 0) {
                        const intensity = Math.min(info.dropoff / maxDropoff, 1.0);
                        const l = Math.round(90 - intensity * 52);
                        const s = Math.round(15 + intensity * 85);
                        baseStyle = { fillColor: `hsl(28, ${s}%, ${l}%)`, weight: 1, opacity: 1, color: '#334155', fillOpacity: 0.85 };
                    } else {
                        baseStyle = { fillColor: '#1e293b', weight: 0.5, opacity: 0.4, color: '#334155', fillOpacity: 0.3 };
                    }
                } else {
                    baseStyle = { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.08 };
                }
            }
        } else {
            const potentialMatches = resultsMap[wardNum] || [];
            const relevantResults = potentialMatches.filter((r: PrecinctResult) =>
                r.precinctName.toLowerCase().includes(municipality.toLowerCase()) ||
                municipality.toLowerCase().includes(r.precinctName.toLowerCase())
            );

            if (relevantResults.length > 0) {
                const total = relevantResults[0].ballotscast;
                const sorted = relevantResults.sort((a: PrecinctResult, b: PrecinctResult) => b.votes - a.votes);
                const winner = sorted[0];
                const runnerUp = sorted[1];

                if (focusedCandidate) {
                    const candidateResult = relevantResults.find(r => r.candidateName.trim() === focusedCandidate.trim());
                    if (candidateResult && total > 0) {
                        const baseColor = candidateColors[focusedCandidate.trim()] || { h: 215, s: 80, l: 50 };
                        const votePct = candidateResult.votes / total;
                        const t = Math.min(votePct / 0.7, 1.0);
                        const lightness = Math.round(88 - t * 52);
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
                        baseStyle = { fillColor: '#1e293b', weight: 1, opacity: 0.3, color: '#1e293b', fillOpacity: 0.15 };
                    }
                } else if (overlayMode === 'NONE') {
                    const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                    const baseColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 75, l: 50 };
                    const t = Math.min(margin / 0.45, 1.0);
                    const lightness = Math.round(82 - t * 40);
                    const saturation = Math.round(25 + t * Math.max(0, baseColor.s - 25));
                    baseStyle = { fillColor: `hsl(${baseColor.h}, ${saturation}%, ${lightness}%)`, weight: 1, opacity: 1, color: '#334155', fillOpacity: 0.75 };
                } else if (overlayMode === 'TURNOUT') {
                    // Real ballots-cast comparison (from the county's BALLOTS CAST tally),
                    // falling back to the historical race baseline if turnout data is missing.
                    const tk = `${municipality}|${wardNum}`;
                    const curBallots = turnoutByWard?.[tk];
                    const baseBallots = comparisonTurnoutByWard?.[tk];
                    let ratio: number | null = null;
                    if (curBallots !== undefined && baseBallots !== undefined && baseBallots > 0) {
                        ratio = curBallots / baseBallots;
                    } else {
                        const wardAnalysis = getWardAnalysis(wardNum, municipality);
                        const historicalRef = wardAnalysis.historicalVotes > 0 ? wardAnalysis.historicalVotes : (getCachedAvgVotes() ?? 0);
                        if (historicalRef > 0 && total > 0) ratio = total / historicalRef;
                    }
                    if (ratio === null) {
                        baseStyle = { fillColor: '#1e293b', weight: 1, opacity: 0.4, color: '#334155', fillOpacity: 0.5 };
                    } else {
                        let h: number, s: number, l: number;
                        if (ratio < 1.0) {
                            h = 0; const intensity = Math.min((1.0 - ratio) / 0.5, 1);
                            l = 90 - (intensity * 40); s = intensity * 80;
                        } else {
                            h = 140; const intensity = Math.min((ratio - 1.0) / 0.5, 1);
                            l = 90 - (intensity * 50); s = intensity * 100;
                        }
                        baseStyle = { fillColor: `hsl(${h}, ${s}%, ${l}%)`, weight: 1, opacity: 1, color: '#334155', fillOpacity: 0.75 };
                    }
                } else if (overlayMode === 'PROJECTION') {
                    if (!projectionData) {
                        baseStyle = { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.1 };
                    } else {
                        const normalizedKey = buildProjectionKey(municipality, wardNum);
                        const ratio = projectionData[normalizedKey] ?? -1;
                        if (ratio < 0) {
                            baseStyle = { fillColor: '#0f172a', weight: 0.5, opacity: 0.2, color: '#1e293b', fillOpacity: 0.08 };
                        } else {
                            let h: number, s: number, l: number;
                            if (ratio < 1.0) {
                                h = 0; const intensity = Math.min((1.0 - ratio) / 0.6, 1);
                                l = 90 - intensity * 45; s = intensity * 85;
                            } else {
                                h = 140; const intensity = Math.min((ratio - 1.0) / 0.6, 1);
                                l = 90 - intensity * 52; s = intensity * 100;
                            }
                            baseStyle = { fillColor: `hsl(${h}, ${s}%, ${l}%)`, weight: 1, opacity: 1, color: '#334155', fillOpacity: 0.8 };
                        }
                    }
                } else if (overlayMode === 'SWING') {
                    const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
                    const winnerColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 80, l: 50 };
                    const intensity = Math.min(margin / 0.4, 1);
                    baseStyle = {
                        fillColor: `hsl(${winnerColor.h}, ${Math.round(intensity * 85)}%, ${Math.round(90 - intensity * 40)}%)`,
                        weight: 1, opacity: 1, color: '#334155', fillOpacity: 0.8
                    };
                }
            }
        }

        // Spotlight effect when a ward is selected
        if (currentSelectedWard) {
            const isSelected = parseInt(wardNum) === parseInt(currentSelectedWard.num) &&
                (currentSelectedWard.name.toLowerCase().includes(municipality.toLowerCase()) ||
                    municipality.toLowerCase().includes(currentSelectedWard.name.toLowerCase()));
            if (!isSelected) {
                baseStyle.fillOpacity = baseStyle.fillOpacity * 0.1;
                baseStyle.opacity = 0.1;
                baseStyle.color = '#1e293b';
            } else {
                baseStyle.weight = 3;
                baseStyle.color = '#ffffff';
                baseStyle.opacity = 1;
                baseStyle.fillOpacity = 0.9;
            }
        }

        return baseStyle;
    }, [resultsMap, candidateColors, overlayMode, focusedCandidate, projectionData, dormantPoolData, dropoffData, maxDormantPool, maxDropoff, simulateHighlightedWards, turnoutByWard, comparisonTurnoutByWard]);

    /** Build a HoveredWard from feature data + pointer coordinates */
    const buildWardData = useCallback((feature: { municipality: string; wardNum: string }, x: number, y: number): HoveredWard | null => {
        const { municipality, wardNum } = feature;
        const isSimOverlay = overlayMode === 'CANVASS_PRIORITY' || overlayMode === 'PRIMARY_DROPOFF';
        const normalizedKey = isSimOverlay ? buildProjectionKey(municipality, wardNum) : '';

        if (isSimOverlay) {
            const hasSimData = (overlayMode === 'CANVASS_PRIORITY' && dormantPoolData && normalizedKey in dormantPoolData) ||
                               (overlayMode === 'PRIMARY_DROPOFF' && dropoffData && normalizedKey in dropoffData);
            if (!hasSimData) return null;
            return {
                municipality, wardNum,
                results: [], total: 0, x, y, analysis: null, fillColor: '',
                dormantPool: overlayMode === 'CANVASS_PRIORITY' ? dormantPoolData![normalizedKey] : undefined,
                dropoffInfo: overlayMode === 'PRIMARY_DROPOFF' ? dropoffData![normalizedKey] : undefined,
            };
        }

        const potentialMatches = resultsMap[wardNum] || [];
        const relevantResults = potentialMatches.filter((r: PrecinctResult) =>
            r.precinctName.toLowerCase().includes(municipality.toLowerCase()) ||
            municipality.toLowerCase().includes(r.precinctName.toLowerCase())
        );
        if (relevantResults.length === 0) return null;

        const total = relevantResults[0].ballotscast;
        const sorted = [...relevantResults].sort((a, b) => b.votes - a.votes);
        const analysis = getWardAnalysis(wardNum, municipality);
        const winner = sorted[0];
        const baseColor = candidateColors[winner.candidateName.trim()] || { h: 215, s: 16, l: 47 };
        const runnerUp = sorted[1];
        const margin = runnerUp ? (winner.votes - runnerUp.votes) / total : 1.0;
        const lightness = 65 - (Math.min(margin, 0.5) * 30);
        const fillColor = `hsl(${baseColor.h}, ${baseColor.s}%, ${lightness}%)`;

        const tk = `${municipality}|${wardNum}`;
        return {
            municipality, wardNum,
            results: sorted.map((r: PrecinctResult) => ({
                candidateName: r.candidateName,
                votes: r.votes,
                pct: total > 0 ? (r.votes / total) * 100 : 0,
            })),
            total, x, y, analysis, fillColor,
            turnoutBallots: turnoutByWard?.[tk],
            comparisonBallots: comparisonTurnoutByWard?.[tk],
        };
    }, [resultsMap, candidateColors, overlayMode, dormantPoolData, dropoffData, turnoutByWard, comparisonTurnoutByWard]);

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

        const isSimOverlay = overlayMode === 'CANVASS_PRIORITY' || overlayMode === 'PRIMARY_DROPOFF';
        const normalizedKey = isSimOverlay ? buildProjectionKey(municipality, wardNum) : '';
        const hasSimData = isSimOverlay && (
            (overlayMode === 'CANVASS_PRIORITY' && dormantPoolData && normalizedKey in dormantPoolData) ||
            (overlayMode === 'PRIMARY_DROPOFF' && dropoffData && normalizedKey in dropoffData)
        );

        const isProjectionClickable = overlayMode === 'PROJECTION' && !!onWardClick;
        const isInteractive = hasData || hasSimData;

        layer.on({
            mouseover: (e: any) => {
                e.target.setStyle({ weight: 2, color: '#ffffff', opacity: 1 });
                e.target.bringToFront();

                if (!isInteractive) return;
                const ward = buildWardData(
                    { municipality, wardNum },
                    e.originalEvent.clientX,
                    e.originalEvent.clientY
                );
                if (ward) {
                    setHoveredWard(ward);
                    onWardHover?.(ward);
                }
            },
            mousemove: (e: any) => {
                if (isInteractive) {
                    setHoveredWard(prev => prev ? { ...prev, x: e.originalEvent.clientX, y: e.originalEvent.clientY } : null);
                }
            },
            mouseout: (e: any) => {
                e.target.setStyle({ weight: 1, color: defaultBorderColor, opacity: defaultBorderOpacity });
                setHoveredWard(null);
                onWardHover?.(null);
            },
            click: (e: any) => {
                if (isProjectionClickable) {
                    onWardClick!({ name: municipality, num: wardNum });
                    return;
                }
                if (!isInteractive) return;

                // Get coordinates from mouse or touch
                const clientX = e.originalEvent.clientX
                    ?? e.originalEvent.changedTouches?.[0]?.clientX
                    ?? e.originalEvent.touches?.[0]?.clientX
                    ?? 0;
                const clientY = e.originalEvent.clientY
                    ?? e.originalEvent.changedTouches?.[0]?.clientY
                    ?? e.originalEvent.touches?.[0]?.clientY
                    ?? 0;

                const ward = buildWardData({ municipality, wardNum }, clientX, clientY);
                if (!ward) return;

                // Toggle pin: same ward = dismiss, different ward = show new
                setPinnedWard(prev =>
                    prev && prev.wardNum === wardNum && prev.municipality === municipality
                        ? null
                        : ward
                );
                // Stop event from propagating to map (which would dismiss via MapClickDismiss)
                L.DomEvent.stopPropagation(e);
            },
        });

        if (isProjectionClickable || isInteractive) {
            (layer as any).options = { ...((layer as any).options || {}), className: 'cursor-pointer' };
        }
    }, [resultsMap, candidateColors, onWardHover, overlayMode, onWardClick, dormantPoolData, dropoffData, buildWardData]);

    // Which ward to display in the tooltip: pinned takes priority
    const displayWard = pinnedWard ?? hoveredWard;

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
                            key={`${selectedWard ? selectedWard.num : 'all'}-${raceResult?.id || 'default'}-${overlayMode}-${Object.keys(candidateColors).length}-${historicalLabel || 'loading'}-${focusedCandidate || 'none'}-${projectionData ? Object.keys(projectionData).length : 0}-${dormantPoolData ? 'dp' : 'ndp'}-${dropoffData ? 'do' : 'ndo'}-${simulateHighlightedWards ? simulateHighlightedWards.size : 0}-${turnoutByWard ? Object.keys(turnoutByWard).length : 0}-${comparisonTurnoutByWard ? Object.keys(comparisonTurnoutByWard).length : 0}`}
                            data={geoJsonData}
                            style={(feature) => style(feature, selectedWard)}
                            onEachFeature={onEachFeature}
                            ref={geoJsonLayerRef}
                        />
                        <MapController geoJsonData={geoJsonData} selectedWard={selectedWard} onReset={onReset} />
                        <MapClickDismiss onDismiss={() => setPinnedWard(null)} />
                    </>
                )}
            </MapContainer>

            {displayWard && (
                <div style={getSafeTooltipStyle(displayWard.x, displayWard.y)}>
                    <div style={{
                        background: '#0f172a',
                        border: `1px solid ${pinnedWard ? '#3b82f6' : '#334155'}`,
                        borderRadius: '10px',
                        overflow: 'hidden',
                        boxShadow: pinnedWard ? '0 8px 32px rgba(59,130,246,0.3)' : '0 8px 32px rgba(0,0,0,0.65)',
                        color: 'white',
                        fontSize: '13px',
                        fontFamily: 'system-ui, sans-serif',
                    }}>
                        {/* Header */}
                        <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>
                                    {overlayMode === 'CANVASS_PRIORITY' ? 'Canvass Priority' :
                                     overlayMode === 'PRIMARY_DROPOFF' ? 'Primary Dropoff' :
                                     (raceResult?.raceName || 'Election Results')}
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '15px', color: '#f1f5f9' }}>
                                    {displayWard.municipality} · Wd.&nbsp;{displayWard.wardNum}
                                </div>
                            </div>
                            {pinnedWard && (
                                <button
                                    onClick={() => setPinnedWard(null)}
                                    style={{
                                        background: 'none', border: 'none', color: '#64748b',
                                        cursor: 'pointer', fontSize: '16px', lineHeight: 1,
                                        padding: '0 0 0 8px', pointerEvents: 'auto',
                                    }}
                                    aria-label="Close"
                                >×</button>
                            )}
                        </div>

                        {/* CANVASS PRIORITY body */}
                        {displayWard.dormantPool !== undefined && (
                            <div style={{ padding: '10px 14px 12px' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Dormant voter pool</div>
                                <div style={{ fontSize: '22px', fontWeight: 800, color: '#818cf8' }}>
                                    {displayWard.dormantPool.toLocaleString()}
                                </div>
                                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                                    Avg voters who turn out in general elections but skip primaries
                                </div>
                            </div>
                        )}

                        {/* PRIMARY DROPOFF body */}
                        {displayWard.dropoffInfo !== undefined && (
                            <div style={{ padding: '10px 14px 12px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>Spring Election</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                                            {displayWard.dropoffInfo.general.toLocaleString()}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '10px', color: '#64748b' }}>Spring Primary</div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                                            {displayWard.dropoffInfo.primary.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Dropoff</span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fb923c' }}>
                                        −{displayWard.dropoffInfo.dropoff.toLocaleString()} ({displayWard.dropoffInfo.dropoffPct.toFixed(1)}%)
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Standard candidate rows */}
                        {displayWard.results.length > 0 && (
                            <div style={{ padding: '10px 14px' }}>
                                {(() => {
                                    const isPresidential = raceResult?.type === 'Presidential';
                                    const partyMap: Record<string, string | undefined> = Object.fromEntries(
                                        (raceResult?.candidates ?? []).map(c => [c.candidateName.trim(), c.party])
                                    );
                                    const visibleResults = isPresidential
                                        ? displayWard.results.filter(r => {
                                            const party = partyMap[r.candidateName.trim()];
                                            const name = r.candidateName;
                                            return party === 'Democratic' || party === 'Republican'
                                                || name.includes('Biden') || name.includes('Harris') || name.includes('Trump');
                                        })
                                        : displayWard.results;
                                    return visibleResults.map((r, i) => {
                                        const hsl = candidateColors[r.candidateName.trim()];
                                        const barColor = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '#64748b';
                                        const isWinner = i === 0;
                                        return (
                                            <div key={i} style={{ marginBottom: i < visibleResults.length - 1 ? '10px' : 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                                    <span title={r.candidateName} style={{ color: isWinner ? '#f1f5f9' : '#94a3b8', fontWeight: isWinner ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
                                                        {isWinner ? '▲ ' : '   '}{r.candidateName}
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
                        )}

                        {/* Margin comparison row */}
                        {overlayMode !== 'TURNOUT' && displayWard.results.length > 0 && displayWard.analysis?.historicalRaceName && displayWard.analysis.historicalMargin !== 0 && (() => {
                            const histMarginPct = displayWard.analysis!.historicalMargin * 100;
                            const currentMarginPct = displayWard.results.length >= 2
                                ? displayWard.results[0].pct - displayWard.results[1].pct : 100;
                            const diff = currentMarginPct - Math.abs(histMarginPct);
                            const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' pts';
                            const diffColor = diff >= 0 ? '#4ade80' : '#f87171';
                            const year = displayWard.analysis!.historicalDate
                                ? new Date(displayWard.analysis!.historicalDate).getFullYear() : '?';
                            return (
                                <div style={{ padding: '5px 14px 6px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>
                                        vs {year} {displayWard.analysis!.historicalRaceName.split(' ').slice(0, 2).join(' ')}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: diffColor }}>{diffStr}</span>
                                </div>
                            );
                        })()}

                        {/* Turnout delta row — real ballots-cast comparison when available */}
                        {overlayMode === 'TURNOUT' && displayWard.turnoutBallots !== undefined
                            && displayWard.comparisonBallots !== undefined && displayWard.comparisonBallots > 0 && (() => {
                            const cur = displayWard.turnoutBallots!;
                            const prev = displayWard.comparisonBallots!;
                            const deltaPct = ((cur - prev) / prev) * 100;
                            const isAbove = deltaPct >= 0;
                            const deltaColor = isAbove ? '#4ade80' : '#f87171';
                            const diffStr = (isAbove ? '+' : '') + (cur - prev).toLocaleString();
                            return (
                                <div style={{ padding: '5px 14px 6px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }} title={comparisonLabel ?? undefined}>
                                        Turnout: {cur.toLocaleString()} vs {prev.toLocaleString()}{comparisonLabel ? ` (${comparisonLabel})` : ''}
                                    </span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: deltaColor }}>
                                        {isAbove ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(0)}% · {diffStr}
                                    </span>
                                </div>
                            );
                        })()}
                        {/* Fallback: historical race baseline */}
                        {overlayMode === 'TURNOUT' && (displayWard.turnoutBallots === undefined || !displayWard.comparisonBallots)
                            && displayWard.analysis && displayWard.analysis.historicalVotes > 0 && (() => {
                            const ratio = displayWard.total / displayWard.analysis!.historicalVotes;
                            const deltaPct = (ratio - 1) * 100;
                            const isAbove = deltaPct >= 0;
                            const arrow = isAbove ? '↑' : '↓';
                            const deltaColor = isAbove ? '#4ade80' : '#f87171';
                            const year = displayWard.analysis!.historicalDate
                                ? new Date(displayWard.analysis!.historicalDate).getFullYear() : '?';
                            const prevVotes = displayWard.analysis!.historicalVotes.toLocaleString();
                            const ballotDiff = displayWard.total - displayWard.analysis!.historicalVotes;
                            const diffStr = (isAbove ? '+' : '') + ballotDiff.toLocaleString();
                            return (
                                <div style={{ padding: '5px 14px 6px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', color: '#475569' }}>vs {year} baseline · {prevVotes} ballots</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: deltaColor }}>
                                        {arrow} {Math.abs(deltaPct).toFixed(0)}% · {diffStr} ballots
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Footer */}
                        {displayWard.results.length >= 2 && (
                            <div style={{ padding: '7px 14px 10px', borderTop: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: '#475569' }}>
                                    {displayWard.total.toLocaleString()} ballots cast
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    +{Math.abs(displayWard.results[0].pct - displayWard.results[1].pct).toFixed(1)}% margin
                                </span>
                            </div>
                        )}

                        {/* Tap hint on mobile when pinned */}
                        {pinnedWard && (
                            <div style={{ padding: '4px 14px 8px', fontSize: '10px', color: '#334155', textAlign: 'center' }}>
                                Tap another ward or the × to dismiss
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
