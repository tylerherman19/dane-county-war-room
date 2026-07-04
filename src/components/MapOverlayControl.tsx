import { useState, useEffect } from 'react';
import { Layers, TrendingUp, Users, ChevronDown, Crosshair } from 'lucide-react';

export type OverlayMode = 'NONE' | 'TURNOUT' | 'SWING' | 'PROJECTION' | 'CANVASS_PRIORITY' | 'PRIMARY_DROPOFF' | 'SHIFT';

interface MapOverlayControlProps {
    currentMode: OverlayMode;
    onChange: (mode: OverlayMode) => void;
    comparisonLabel?: string | null;
    turnoutReady?: boolean;
    candidateLegend?: { name: string; h: number; s: number; l: number }[];
    benchmarkLabel?: string | null;
    benchmarkReady?: boolean;
}

export default function MapOverlayControl({
    currentMode,
    onChange,
    comparisonLabel,
    turnoutReady,
    candidateLegend,
    benchmarkLabel,
    benchmarkReady,
}: MapOverlayControlProps) {
    // Collapsed by default on mobile, expanded on desktop
    const [isCollapsed, setIsCollapsed] = useState(true);

    useEffect(() => {
        const checkViewport = () => setIsCollapsed(window.innerWidth < 768);
        checkViewport();
        window.addEventListener('resize', checkViewport);
        return () => window.removeEventListener('resize', checkViewport);
    }, []);

    const options: { id: OverlayMode; label: string; icon: any; description: string; disabled?: boolean }[] = [
        {
            id: 'NONE',
            label: 'Standard View',
            icon: Layers,
            description: 'Winner & Margin',
        },
        {
            id: 'TURNOUT',
            label: 'Turnout Heatmap',
            icon: Users,
            description: turnoutReady
                ? (comparisonLabel ? `Ballots cast vs. ${comparisonLabel}` : 'Ballots cast by ward')
                : 'Loading turnout...',
            disabled: !turnoutReady,
        },
        {
            id: 'SWING',
            label: 'Margin Intensity',
            icon: TrendingUp,
            description: 'Toss-up vs. Landslide',
        },
        {
            id: 'SHIFT',
            label: 'Benchmark',
            icon: Crosshair,
            description: benchmarkReady
                ? (benchmarkLabel ?? 'vs. past race')
                : 'Pick a benchmark in the sidebar',
            disabled: !benchmarkReady,
        },
    ];

    const activeOption = options.find(o => o.id === currentMode);
    const ActiveIcon = activeOption?.icon ?? Layers;

    return (
        <div className="absolute top-3 md:top-4 right-3 md:right-4 z-[1000] w-auto md:w-64">
            {/* Collapsed pill (mobile) / expanded header (desktop) */}
            <div
                className={`bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-xl overflow-hidden ${isCollapsed ? 'rounded-xl' : 'rounded-xl'}`}
            >
                {/* Toggle header — always visible */}
                <button
                    onClick={() => setIsCollapsed(c => !c)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-800/60 transition-colors"
                    aria-label="Toggle map layers"
                >
                    <div className={`p-1 rounded-md ${currentMode !== 'NONE' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <ActiveIcon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex-1 text-left hidden md:block">
                        Map Layers
                    </span>
                    <span className="text-xs font-medium text-slate-300 flex-1 text-left md:hidden">
                        {activeOption?.label ?? 'Map Layers'}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {/* Expandable body */}
                {!isCollapsed && (
                    <>
                        <div className="border-t border-slate-700/50 p-1">
                            {options.map((option) => {
                                const isActive = currentMode === option.id;
                                const isDisabled = !!option.disabled;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => !isDisabled && onChange(option.id)}
                                        disabled={isDisabled}
                                        title={isDisabled ? 'Historical baseline is loading...' : undefined}
                                        className={`w-full text-left p-2 rounded-lg transition-all flex items-start gap-3 group ${
                                            isDisabled
                                                ? 'opacity-40 cursor-not-allowed'
                                                : isActive
                                                    ? 'bg-blue-600/20 border border-blue-500/30'
                                                    : 'hover:bg-slate-800 border border-transparent cursor-pointer'
                                        }`}
                                    >
                                        <div className={`mt-1 p-1.5 rounded-md ${
                                            isDisabled
                                                ? 'bg-slate-800 text-slate-600'
                                                : isActive
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                                        }`}>
                                            <option.icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-sm font-medium ${
                                                isDisabled ? 'text-slate-600' : isActive ? 'text-blue-400' : 'text-slate-200'
                                            }`}>
                                                {option.label}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate" title={option.description}>
                                                {option.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* NONE mode: candidate color legend */}
                        {currentMode === 'NONE' && candidateLegend && candidateLegend.length > 0 && (
                            <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                                <div className="text-xs font-medium text-slate-400 mb-1.5">Legend</div>
                                <div className="space-y-1">
                                    {candidateLegend.map(c => (
                                        <div key={c.name} className="flex items-center gap-2">
                                            <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: `hsl(${c.h}, ${c.s}%, ${c.l}%)` }} />
                                            <span className="text-[10px] text-slate-400 truncate" title={c.name}>{c.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[9px] text-slate-600 mt-1.5">Lighter shade = closer race</div>
                            </div>
                        )}

                        {/* TURNOUT mode: gradient legend */}
                        {currentMode === 'TURNOUT' && (
                            <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                                <div className="text-xs font-medium text-slate-400 mb-2">Legend</div>
                                <div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                        <span>−50%</span>
                                        <span>Even</span>
                                        <span>+50%</span>
                                    </div>
                                    <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-white to-green-500">
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 opacity-60" />
                                    </div>
                                    <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                                        <span>Turnout down</span>
                                        <span>Turnout up</span>
                                    </div>
                                    {comparisonLabel && (
                                        <div className="text-[9px] text-slate-500 mt-1.5 text-center">
                                            Baseline: {comparisonLabel} · change it in the sidebar
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SHIFT (benchmark) legend */}
                        {currentMode === 'SHIFT' && (
                            <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                                <div className="text-xs font-medium text-slate-400 mb-2">Legend</div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                    <span>−15 pts</span>
                                    <span>Even</span>
                                    <span>+15 pts</span>
                                </div>
                                <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-white to-green-500">
                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 opacity-60" />
                                </div>
                                <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                                    <span>Running behind</span>
                                    <span>Running ahead</span>
                                </div>
                            </div>
                        )}

                        {/* SWING mode */}
                        {currentMode === 'SWING' && (
                            <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                                <div className="text-xs font-medium text-slate-400 mb-1.5">Legend</div>
                                {candidateLegend && candidateLegend.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {candidateLegend.map(c => (
                                            <div key={c.name} className="flex items-center gap-2">
                                                <div
                                                    className="w-16 h-2 rounded-full flex-shrink-0"
                                                    style={{ background: `linear-gradient(to right, hsl(${c.h},15%,90%), hsl(${c.h},${c.s}%,${c.l}%))` }}
                                                />
                                                <span className="text-[9px] text-slate-400 truncate" title={c.name}>{c.name}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-[8px] text-slate-600 mt-0.5">
                                            <span>Toss-up</span><span>Landslide</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                        <span>Toss-up</span>
                                        <div className="h-2 flex-1 mx-2 rounded-full bg-gradient-to-r from-slate-200 to-blue-600" />
                                        <span>Landslide</span>
                                    </div>
                                )}
                            </div>
                        )}

                    </>
                )}
            </div>
        </div>
    );
}
