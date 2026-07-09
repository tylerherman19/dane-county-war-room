import { useState, useEffect } from 'react';
import { Layers, TrendingUp, Users, ChevronDown, Crosshair } from 'lucide-react';

export type OverlayMode = 'NONE' | 'TURNOUT' | 'SWING' | 'PROJECTION' | 'CANVASS_PRIORITY' | 'PRIMARY_DROPOFF' | 'SHIFT' | 'PLANNING' | 'COALITION';

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
    // Collapsed by default on mobile, expanded on desktop. Track the
    // breakpoint with matchMedia — a plain resize listener re-collapses the
    // panel every time mobile browser chrome shows/hides during scroll.
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const apply = (matches: boolean) => { setIsMobile(matches); setIsCollapsed(matches); };
        apply(mq.matches);
        const onChange = (e: MediaQueryListEvent) => apply(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const options: { id: OverlayMode; label: string; icon: any; description: string; disabled?: boolean }[] = [
        {
            id: 'NONE',
            label: 'Standard View',
            icon: Layers,
            description: 'Winner and margin',
        },
        {
            id: 'TURNOUT',
            label: 'Turnout',
            icon: Users,
            description: turnoutReady
                ? (comparisonLabel ? `Ballots cast vs. ${comparisonLabel}` : 'Ballots cast by ward')
                : 'Loading turnout data',
            disabled: !turnoutReady,
        },
        {
            id: 'SWING',
            label: 'Margin Intensity',
            icon: TrendingUp,
            description: 'Toss-up vs. landslide',
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

    // Mobile collapsed state is a compact button so it doesn't collide
    // with the race selector to its left; expanding opens the full panel.
    const compact = isMobile && isCollapsed;

    return (
        <div className={`absolute top-3 md:top-4 right-3 md:right-4 z-[1000] ${compact ? 'w-auto' : 'w-64'}`}>
            <div className="bg-white border border-[#cccccc] shadow-[0_1px_6px_rgba(0,0,0,0.15)] rounded-[3px] overflow-hidden">
                {/* Toggle header — always visible */}
                <button
                    onClick={() => setIsCollapsed(c => !c)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#f7f7f7] transition-colors"
                    aria-label="Toggle map layers"
                >
                    <ActiveIcon className={`w-4 h-4 shrink-0 ${currentMode !== 'NONE' ? 'text-[#008fd5]' : 'text-[#666]'}`} />
                    {!compact && (
                        <>
                            <span className="text-[10px] font-bold text-[#222] uppercase tracking-[0.08em] flex-1 text-left hidden md:block">
                                Map Layers
                            </span>
                            <span className="text-xs font-bold text-[#222] flex-1 text-left md:hidden">
                                {activeOption?.label ?? 'Map Layers'}
                            </span>
                        </>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 text-[#999] transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
                </button>

                {/* Expandable body */}
                {!isCollapsed && (
                    <>
                        <div className="border-t border-[#e0e0e0]">
                            {options.map((option) => {
                                const isActive = currentMode === option.id;
                                const isDisabled = !!option.disabled;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => !isDisabled && onChange(option.id)}
                                        disabled={isDisabled}
                                        title={isDisabled ? 'Historical baseline is loading' : undefined}
                                        className={`w-full text-left px-3 py-2 transition-colors flex items-start gap-2.5 border-l-2 ${
                                            isDisabled
                                                ? 'opacity-40 cursor-not-allowed border-transparent'
                                                : isActive
                                                    ? 'border-[#008fd5] bg-[#f2f9fd]'
                                                    : 'border-transparent hover:bg-[#f7f7f7] cursor-pointer'
                                        }`}
                                    >
                                        <option.icon className={`w-4 h-4 mt-0.5 shrink-0 ${
                                            isDisabled ? 'text-[#cccccc]' : isActive ? 'text-[#008fd5]' : 'text-[#999]'
                                        }`} />
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-[13px] font-bold ${
                                                isDisabled ? 'text-[#999]' : 'text-[#222]'
                                            }`}>
                                                {option.label}
                                            </div>
                                            <div className="text-[11px] text-[#999] truncate" title={option.description}>
                                                {option.description}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* NONE mode: candidate color legend */}
                        {currentMode === 'NONE' && candidateLegend && candidateLegend.length > 0 && (
                            <div className="p-3 border-t border-[#e0e0e0] bg-[#fafafa]">
                                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#222] mb-1.5">Legend</div>
                                <div className="space-y-1">
                                    {candidateLegend.map(c => (
                                        <div key={c.name} className="flex items-center gap-2">
                                            <div className="w-3.5 h-3.5 shrink-0" style={{ background: `hsl(${c.h}, ${c.s}%, ${c.l}%)` }} />
                                            <span className="text-[11px] text-[#666] truncate" title={c.name}>{c.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="text-[10px] text-[#999] mt-1.5">Lighter shade = closer race</div>
                            </div>
                        )}

                        {/* TURNOUT mode: gradient legend */}
                        {currentMode === 'TURNOUT' && (
                            <div className="p-3 border-t border-[#e0e0e0] bg-[#fafafa]">
                                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#222] mb-2">Legend</div>
                                <div>
                                    <div className="flex items-center justify-between text-[10px] text-[#666] num mb-1">
                                        <span>−50%</span>
                                        <span>Even</span>
                                        <span>+50%</span>
                                    </div>
                                    <div className="relative h-2" style={{ background: 'linear-gradient(to right, #fc4f30, #ffffff, #6d904f)' }}>
                                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#999]" />
                                    </div>
                                    <div className="flex justify-between mt-1 text-[10px] text-[#999]">
                                        <span>Turnout down</span>
                                        <span>Turnout up</span>
                                    </div>
                                    {comparisonLabel && (
                                        <div className="text-[10px] text-[#999] mt-1.5">
                                            Baseline: {comparisonLabel}. Change it in the sidebar.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SHIFT (benchmark) legend */}
                        {currentMode === 'SHIFT' && (
                            <div className="p-3 border-t border-[#e0e0e0] bg-[#fafafa]">
                                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#222] mb-2">Legend</div>
                                <div className="flex items-center justify-between text-[10px] text-[#666] num mb-1">
                                    <span>−15 pts</span>
                                    <span>Even</span>
                                    <span>+15 pts</span>
                                </div>
                                <div className="relative h-2" style={{ background: 'linear-gradient(to right, #fc4f30, #ffffff, #6d904f)' }}>
                                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#999]" />
                                </div>
                                <div className="flex justify-between mt-1 text-[10px] text-[#999]">
                                    <span>Running behind</span>
                                    <span>Running ahead</span>
                                </div>
                            </div>
                        )}

                        {/* SWING mode */}
                        {currentMode === 'SWING' && (
                            <div className="p-3 border-t border-[#e0e0e0] bg-[#fafafa]">
                                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#222] mb-1.5">Legend</div>
                                {candidateLegend && candidateLegend.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {candidateLegend.map(c => (
                                            <div key={c.name} className="flex items-center gap-2">
                                                <div
                                                    className="w-16 h-2 shrink-0"
                                                    style={{ background: `linear-gradient(to right, hsl(${c.h},15%,92%), hsl(${c.h},${c.s}%,${c.l}%))` }}
                                                />
                                                <span className="text-[11px] text-[#666] truncate" title={c.name}>{c.name}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between text-[10px] text-[#999] mt-0.5">
                                            <span>Toss-up</span><span>Landslide</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between text-[10px] text-[#666]">
                                        <span>Toss-up</span>
                                        <div className="h-2 flex-1 mx-2" style={{ background: 'linear-gradient(to right, #e8e8e8, #008fd5)' }} />
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
