import { Layers, TrendingUp, Users, Activity } from 'lucide-react';

export type OverlayMode = 'NONE' | 'PRESIDENTIAL' | 'TURNOUT' | 'SWING';

interface MapOverlayControlProps {
    currentMode: OverlayMode;
    onChange: (mode: OverlayMode) => void;
    historicalLabel?: string | null;
}

export default function MapOverlayControl({ currentMode, onChange, historicalLabel }: MapOverlayControlProps) {
    const options: { id: OverlayMode; label: string; icon: any; description: string }[] = [
        {
            id: 'NONE',
            label: 'Standard View',
            icon: Layers,
            description: 'Winner & Margin'
        },
        {
            id: 'PRESIDENTIAL',
            label: 'Vs. Historical',
            icon: Activity,
            description: historicalLabel ? `Compare to ${historicalLabel}` : 'Loading baseline...'
        },
        {
            id: 'TURNOUT',
            label: 'Turnout Heatmap',
            icon: Users,
            description: historicalLabel ? `vs. ${historicalLabel} volume` : 'Loading baseline...'
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
                {options.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => onChange(option.id)}
                        className={`w-full text-left p-2 rounded-lg transition-all flex items-start gap-3 group ${currentMode === option.id
                                ? 'bg-blue-600/20 border border-blue-500/30'
                                : 'hover:bg-slate-800 border border-transparent'
                            }`}
                    >
                        <div className={`mt-1 p-1.5 rounded-md ${currentMode === option.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                            }`}>
                            <option.icon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className={`text-sm font-medium ${currentMode === option.id ? 'text-blue-400' : 'text-slate-200'
                                }`}>
                                {option.label}
                            </div>
                            <div className="text-xs text-slate-500">
                                {option.description}
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {/* Legend / Key based on active mode */}
            {currentMode !== 'NONE' && (
                <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                    <div className="text-xs font-medium text-slate-400 mb-2">Legend</div>
                    {currentMode === 'PRESIDENTIAL' && (
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Underperform</span>
                            <div className="h-2 flex-1 mx-2 rounded-full bg-gradient-to-r from-red-500 via-slate-700 to-blue-500"></div>
                            <span>Overperform</span>
                        </div>
                    )}
                    {currentMode === 'TURNOUT' && (
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>Below avg</span>
                            <div className="h-2 flex-1 mx-2 rounded-full bg-gradient-to-r from-red-500 via-slate-700 to-green-500"></div>
                            <span>Above avg</span>
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
