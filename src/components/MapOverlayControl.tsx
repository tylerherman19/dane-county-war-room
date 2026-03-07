import { Layers, TrendingUp, Users } from 'lucide-react';
import { HistoricalRaceSummary } from '@/lib/historical-api-data';
import { RaceType } from '@/lib/api';

export type OverlayMode = 'NONE' | 'TURNOUT' | 'SWING' | 'PROJECTION' | 'CANVASS_PRIORITY' | 'PRIMARY_DROPOFF';

interface MapOverlayControlProps {
    currentMode: OverlayMode;
    onChange: (mode: OverlayMode) => void;
    historicalLabel?: string | null;
    availableRaces?: HistoricalRaceSummary[];
    selectedComparisonKey?: string | null;
    onComparisonChange?: (key: string) => void;
    isLoadingComparison?: boolean;
    historicalTotalVotes?: number | null;
    candidateLegend?: { name: string; h: number; s: number; l: number }[];
    currentRaceType?: RaceType;
}

export default function MapOverlayControl({ currentMode, onChange, historicalLabel, availableRaces, selectedComparisonKey, onComparisonChange, isLoadingComparison, historicalTotalVotes, candidateLegend, currentRaceType }: MapOverlayControlProps) {
    const turnoutReady = !!historicalLabel;

    const selectedRace = availableRaces?.find(
        r => `${r.electionId}|${r.raceId}` === selectedComparisonKey
    ) ?? null;
    const baselineBallots = selectedRace?.totalVotes ?? historicalTotalVotes ?? null;
    const selectTitle = selectedRace
        ? `${selectedRace.raceName} (${selectedRace.electionDate.slice(0, 4)}) — ${selectedRace.totalVotes.toLocaleString()} ballots`
        : 'Auto (best match)';

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
                                <div
                                    className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                                    style={{ background: `hsl(${c.h}, ${c.s}%, ${c.l}%)` }}
                                />
                                <span className="text-[10px] text-slate-400 truncate" title={c.name}>{c.name}</span>
                            </div>
                        ))}
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1.5">Lighter shade = closer race</div>
                </div>
            )}

            {/* TURNOUT mode: red-green gradient legend */}
            {currentMode === 'TURNOUT' && (
                <div className="p-3 border-t border-slate-700/50 bg-slate-800/30">
                    <div className="text-xs font-medium text-slate-400 mb-2">Legend</div>
                    <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span>−50%</span>
                            <span>Avg</span>
                            <span>+50%</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-white to-green-500">
                            {/* Center tick */}
                            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400 opacity-60" />
                        </div>
                        <div className="flex justify-between mt-1 text-[9px] text-slate-600">
                            <span>Below baseline</span>
                            <span>Above baseline</span>
                        </div>
                        {historicalTotalVotes != null && (
                            <div className="text-[9px] text-slate-500 mt-1.5 text-center">
                                Baseline: {historicalTotalVotes.toLocaleString()} ballots
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SWING mode: per-candidate gradient bars */}
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

            {/* Comparison race picker — shown in TURNOUT mode once races are loaded */}
            {currentMode === 'TURNOUT' && availableRaces && availableRaces.length > 0 && (
                <div className="p-3 border-t border-slate-700/50">
                    <div className="mb-2">
                        <div className="text-xs font-medium text-slate-400">Compare turnout to:</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">Races with overlapping wards</div>
                    </div>
                    <select
                        className="w-full bg-slate-800 text-slate-300 text-xs rounded-md px-2 py-1.5 border border-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={selectedComparisonKey || ''}
                        onChange={e => onComparisonChange?.(e.target.value)}
                        disabled={isLoadingComparison}
                        title={selectTitle}
                    >
                        <option value="">Auto (best match)</option>
                        {(() => {
                            const sameType = currentRaceType ? availableRaces.filter(r => r.raceType === currentRaceType) : [];
                            const otherTypes = currentRaceType ? availableRaces.filter(r => r.raceType !== currentRaceType) : availableRaces;
                            const renderOption = (r: HistoricalRaceSummary) => {
                                const key = `${r.electionId}|${r.raceId}`;
                                const year = r.electionDate.slice(0, 4);
                                const ballots = r.totalVotes.toLocaleString();
                                return (
                                    <option key={key} value={key} title={`${r.raceName} — ${ballots} total ballots`}>
                                        {year} — {r.raceName} · {ballots} ballots
                                    </option>
                                );
                            };
                            return (
                                <>
                                    {sameType.length > 0 && (
                                        <optgroup label="Same race type">
                                            {sameType.map(renderOption)}
                                        </optgroup>
                                    )}
                                    {otherTypes.length > 0 && (
                                        <optgroup label={sameType.length > 0 ? 'Other races' : 'Available races'}>
                                            {otherTypes.map(renderOption)}
                                        </optgroup>
                                    )}
                                </>
                            );
                        })()}
                    </select>
                    {isLoadingComparison && (
                        <div className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                            <span className="animate-spin inline-block">⟳</span> Loading comparison…
                        </div>
                    )}
                    {baselineBallots != null && !isLoadingComparison && (
                        <div className="text-[10px] text-slate-500 mt-1.5">
                            Baseline: <span className="text-slate-400">{baselineBallots.toLocaleString()}</span> total ballots
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
