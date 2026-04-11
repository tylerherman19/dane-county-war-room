'use client';

import { Race } from '@/lib/api';
import { getRaceGroupKey, extractDistrictNumber } from '@/lib/api';
import { ChevronDown, ChevronRight, LayoutList } from 'lucide-react';
import { useState, useEffect } from 'react';

interface RaceSelectorProps {
    races: Race[] | undefined;
    selectedRaceId: string | null;
    onSelectRace: (raceId: string) => void;
    selectedGroupKey?: string | null;
    onSelectGroup?: (groupKey: string | null) => void;
}

// Race types that have historical baseline data in historical-ward-data.json
const HISTORICAL_TYPES = new Set(['Presidential', 'Mayor', 'Governor', 'Senate', 'Congress']);

function getCategoryForType(type: string): 'Federal' | 'State' | 'Local' | 'All' {
    if (['Presidential', 'Senate', 'Congress'].includes(type)) return 'Federal';
    if (['Governor', 'StateSenate', 'Assembly', 'Referendum'].includes(type)) return 'State';
    if (['Mayor', 'Alder', 'Supervisor', 'Other'].includes(type)) return 'Local';
    return 'All';
}

export default function RaceSelector({ races, selectedRaceId, onSelectRace, selectedGroupKey, onSelectGroup }: RaceSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const selectedRace = races?.find(r => r.id === selectedRaceId);

    // Default category tab to the one that contains the selected race or group
    const defaultCategory = selectedRace ? getCategoryForType(selectedRace.type) : 'All';
    const [category, setCategory] = useState<'All' | 'Federal' | 'State' | 'Local'>(defaultCategory);

    // Keep category in sync when the selected race changes (e.g. auto-selection)
    useEffect(() => {
        if (selectedRace) {
            setCategory(getCategoryForType(selectedRace.type));
        }
    }, [selectedRace?.type]);

    // Expand the group containing the active group key when dropdown opens
    useEffect(() => {
        if (isOpen && selectedGroupKey) {
            setExpandedGroups(prev => new Set([...prev, selectedGroupKey]));
        }
    }, [isOpen, selectedGroupKey]);

    if (!races) return null;

    const filteredRaces = races.filter(race => {
        if (category === 'All') return true;
        if (category === 'Federal') return ['Presidential', 'Senate', 'Congress'].includes(race.type);
        if (category === 'State') return ['Governor', 'StateSenate', 'Assembly', 'Referendum'].includes(race.type);
        if (category === 'Local') return ['Mayor', 'Alder', 'Supervisor', 'Other'].includes(race.type);
        return true;
    });

    // Build grouped structure: group key → races (only multi-race groups)
    const groupMap = new Map<string, Race[]>();
    const standaloneRaces: Race[] = [];

    for (const race of filteredRaces) {
        const key = getRaceGroupKey(race);
        if (key) {
            const existing = groupMap.get(key) ?? [];
            existing.push(race);
            groupMap.set(key, existing);
        } else {
            standaloneRaces.push(race);
        }
    }

    // Groups with only 1 race fall through to standalone
    const multiRaceGroups = new Map<string, Race[]>();
    for (const [key, groupRaces] of groupMap) {
        if (groupRaces.length >= 2) {
            multiRaceGroups.set(key, [...groupRaces].sort((a, b) => extractDistrictNumber(a.name) - extractDistrictNumber(b.name)));
        } else {
            standaloneRaces.push(...groupRaces);
        }
    }

    // Determine display label for the header button
    let headerLabel = selectedRace?.name;
    if (!headerLabel && selectedGroupKey) {
        headerLabel = selectedGroupKey;
    }

    // Render items: groups first (sorted), then standalone races
    const sortedGroupKeys = [...multiRaceGroups.keys()].sort();

    function toggleGroup(key: string) {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    return (
        <div className="absolute top-4 left-16 z-[1000] w-80">
            {/* Backdrop to close on click outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <div className="relative z-50">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center justify-between hover:bg-slate-800 transition-colors text-left"
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Race</div>
                        <div className="font-bold truncate" title={headerLabel}>{headerLabel || 'Select a Race'}</div>
                        {selectedRace && selectedRace.totalPrecincts > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 rounded-full transition-all"
                                        style={{ width: `${Math.round((selectedRace.precinctsReporting / selectedRace.totalPrecincts) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-slate-500 shrink-0">
                                    {selectedRace.precinctsReporting}/{selectedRace.totalPrecincts}
                                </span>
                            </div>
                        )}
                        {selectedGroupKey && !selectedRace && (
                            <div className="text-xs text-blue-400 mt-0.5">All districts • overview</div>
                        )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 ml-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                        {/* Category Tabs */}
                        <div className="flex border-b border-slate-800 bg-slate-950">
                            {(['All', 'Federal', 'State', 'Local'] as const).map(cat => (
                                <button
                                    key={cat}
                                    onClick={(e) => { e.stopPropagation(); setCategory(cat); }}
                                    className={`flex-1 py-2 text-xs font-medium transition-colors ${category === cat ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Race List */}
                        <div className="max-h-[60vh] overflow-y-auto">
                            {/* Multi-race groups */}
                            {sortedGroupKeys.map(groupKey => {
                                const groupRaces = multiRaceGroups.get(groupKey)!;
                                const isExpanded = expandedGroups.has(groupKey);
                                const isActiveGroup = selectedGroupKey === groupKey;

                                return (
                                    <div key={groupKey} className="border-b border-slate-800 last:border-0">
                                        {/* Group header row */}
                                        <div className={`flex items-center px-3 py-2.5 ${isActiveGroup ? 'bg-blue-500/10' : 'hover:bg-slate-800/60'} transition-colors`}>
                                            {/* Expand/collapse toggle */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}
                                                className="p-0.5 text-slate-500 hover:text-slate-300 shrink-0 mr-1"
                                                title={isExpanded ? 'Collapse' : 'Expand races'}
                                            >
                                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>

                                            {/* Group label + count */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-semibold text-sm truncate ${isActiveGroup ? 'text-blue-400' : 'text-slate-200'}`}>
                                                    {groupKey}
                                                </div>
                                                <div className="text-xs text-slate-500">{groupRaces.length} districts</div>
                                            </div>

                                            {/* "View All" button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectGroup?.(groupKey);
                                                    setIsOpen(false);
                                                }}
                                                title="View all districts overview"
                                                className={`shrink-0 ml-2 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors ${
                                                    isActiveGroup
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                            >
                                                <LayoutList className="w-3 h-3" />
                                                All
                                            </button>
                                        </div>

                                        {/* Individual races within the group */}
                                        {isExpanded && (
                                            <div className="bg-slate-950/40">
                                                {groupRaces.map(race => (
                                                    <button
                                                        key={race.id}
                                                        onClick={() => {
                                                            onSelectRace(race.id);
                                                            onSelectGroup?.(null);
                                                            setIsOpen(false);
                                                        }}
                                                        className={`w-full text-left pl-9 pr-4 py-2.5 hover:bg-slate-800 transition-colors border-t border-slate-800/60 ${selectedRaceId === race.id ? 'bg-slate-800/50 text-blue-400' : 'text-slate-400'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-sm font-medium truncate" title={race.name}>{race.name}</span>
                                                            {HISTORICAL_TYPES.has(race.type) && (
                                                                <span className="shrink-0 text-xs text-blue-400 font-medium">● Historical</span>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Standalone races */}
                            {standaloneRaces.map(race => (
                                <button
                                    key={race.id}
                                    onClick={() => {
                                        onSelectRace(race.id);
                                        onSelectGroup?.(null);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${selectedRaceId === race.id ? 'bg-slate-800/50 text-blue-400' : 'text-slate-300'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium truncate" title={race.name}>{race.name}</span>
                                        {HISTORICAL_TYPES.has(race.type) && (
                                            <span className="shrink-0 text-xs text-blue-400 font-medium">● Historical</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">{race.type}</div>
                                </button>
                            ))}

                            {filteredRaces.length === 0 && (
                                <div className="p-4 text-center text-slate-500 text-sm">No races in this category</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
