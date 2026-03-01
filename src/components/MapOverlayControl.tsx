import { Layers, TrendingUp, Users } from 'lucide-react';

export type OverlayMode = 'NONE' | 'TURNOUT' | 'SWING';

interface MapOverlayControlProps {
    currentMode: OverlayMode;
    onChange: (mode: OverlayMode) => void;
    historicalLabel?: string | null;
}

export default function MapOverlayControl({ currentMode, onChange, historicalLabel }: MapOverlayControlProps) {
    const turnoutReady = !!historicalLabel;

    const options: { id: OverlayMode; label: string; icon: any; description: string; disabled?: boolean }[] = [
        {
            id: 'NONE',
            label: 'Standard View',
            icon: Layers,
            description: 'Winner & Margin'
        },
        {
            id: 'TURNOUT',
            label: 'Turnout Heatmap',
            icon: Users,
            description: turnoutReady
                ? `vs. ${historicalLabel}`
                : 'Loading baseline...',
            disabled: !turnoutReady,
        },
        {
            id: 'SWING',
            label: 'Margin Intensity',
            icon: TrendingUp,
            description: 'Toss-up vs. Landslide'
        }
    ];

    return (
        <div className="absolute top-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-xl shadow-xl overflow-hidden w-64">
            <div className="p-3 border-b border-slate-700/50 bg-slate-800/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3 h-3" />
                    Map Layers
                </h3>
            </div>
            <div className="p-1">
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
                            <div>
                                <div className={`text-sm font-medium ${
                                    isDisabled ? 'text-slate-600' : isActive ? 'text-blue-400' : 'text-slate-200'
                                }`}>
                                    {option.label}
                                </div>
                                <div className="text-xs text-slate-500">
                                    {option.description}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Legend / Key based on active mode */}
            {currentMode !== 'NONE' && (
                <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                    <div className="text-xs font-medium text-slate-400 mb-2">Legend</div>
                    {currentMode === 'TURNOUT' && (
                        <div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                <span>−50%</span>
                                <span>Avg</span>
                                <span>+50%</span>
                            </div>
                            <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-slate-700 to-green-500">
                                {/* Center tick */}
                                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 opacity-60" />
                            </div>
                            <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                                <span>Below baseline</span>
                                <span>Above baseline</span>
                            </div>
                        </div>
                    )}
                    {currentMode === 'SWING' && (
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Toss-up</span>
                            <div className="h-2 flex-1 mx-2 rounded-full bg-gradient-to-r from-slate-200 to-blue-600"></div>
                            <span>Landslide</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
