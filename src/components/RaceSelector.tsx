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
        <div className="absolute top-3 md:top-4 left-2 md:left-16 z-[1000] w-[calc(100%-100px)] md:w-80 max-w-sm">
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
                    className="w-full bg-white border border-[#cccccc] text-[#222] px-3 py-2.5 rounded-[3px] shadow-[0_1px_6px_rgba(0,0,0,0.15)] flex items-center justify-between hover:bg-[#f7f7f7] transition-colors text-left"
                >
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-[#999] uppercase tracking-[0.08em] font-bold">Current Race</div>
                        <div className="font-bold truncate text-sm md:text-base" title={headerLabel}>{headerLabel || 'Select a Race'}</div>
                        {selectedRace && selectedRace.totalPrecincts > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1 bg-[#e8e8e8] overflow-hidden">
                                    <div
                                        className="h-full bg-[#008fd5] transition-all"
                                        style={{ width: `${Math.round((selectedRace.precinctsReporting / selectedRace.totalPrecincts) * 100)}%` }}
                                    />
                                </div>
                                <span className="text-[11px] text-[#666] num shrink-0">
                                    {selectedRace.precinctsReporting}/{selectedRace.totalPrecincts}
                                </span>
                            </div>
                        )}
                        {selectedGroupKey && !selectedRace && (
                            <div className="text-xs text-[#008fd5] mt-0.5">All districts overview</div>
                        )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#999] shrink-0 ml-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white border border-[#cccccc] rounded-[3px] shadow-[0_2px_12px_rgba(0,0,0,0.18)] overflow-hidden z-50">
                        {/* Category Tabs */}
                        <div className="flex border-b border-[#e0e0e0] bg-[#f7f7f7]">
                            {(['All', 'Federal', 'State', 'Local'] as const).map(cat => (
                                <button
                                    key={cat}
                                    onClick={(e) => { e.stopPropagation(); setCategory(cat); }}
                                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-[0.04em] transition-colors border-b-2 ${category === cat ? 'text-[#222] border-[#222] bg-white' : 'text-[#999] border-transparent hover:text-[#222]'
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
                                    <div key={groupKey} className="border-b border-[#e0e0e0] last:border-0">
                                        {/* Group header row */}
                                        <div className={`flex items-center px-3 py-2.5 ${isActiveGroup ? 'bg-[#eaf5fb]' : 'hover:bg-[#f7f7f7]'} transition-colors`}>
                                            {/* Expand/collapse toggle */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleGroup(groupKey); }}
                                                className="p-0.5 text-[#999] hover:text-[#222] shrink-0 mr-1"
                                                title={isExpanded ? 'Collapse' : 'Expand races'}
                                            >
                                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                            </button>

                                            {/* Group label + count */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold text-sm truncate ${isActiveGroup ? 'text-[#008fd5]' : 'text-[#222]'}`}>
                                                    {groupKey}
                                                </div>
                                                <div className="text-xs text-[#999]">{groupRaces.length} districts</div>
                                            </div>

                                            {/* "View All" button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectGroup?.(groupKey);
                                                    setIsOpen(false);
                                                }}
                                                title="View all districts overview"
                                                className={`shrink-0 ml-2 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-[3px] border transition-colors ${
                                                    isActiveGroup
                                                        ? 'border-[#008fd5] text-[#008fd5] bg-white'
                                                        : 'border-[#cccccc] text-[#666] hover:text-[#222] hover:border-[#999] bg-white'
                                                }`}
                                            >
                                                <LayoutList className="w-3 h-3" />
                                                All
                                            </button>
                                        </div>

                                        {/* Individual races within the group */}
                                        {isExpanded && (
                                            <div className="bg-[#fafafa]">
                                                {groupRaces.map(race => (
                                                    <button
                                                        key={race.id}
                                                        onClick={() => {
                                                            onSelectRace(race.id);
                                                            onSelectGroup?.(null);
                                                            setIsOpen(false);
                                                        }}
                                                        className={`w-full text-left pl-9 pr-4 py-2.5 hover:bg-[#f0f0f0] transition-colors border-t border-[#e8e8e8] ${selectedRaceId === race.id ? 'text-[#008fd5] font-bold' : 'text-[#444]'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-sm truncate" title={race.name}>{race.name}</span>
                                                            {HISTORICAL_TYPES.has(race.type) && (
                                                                <span className="shrink-0 text-[10px] text-[#008fd5] font-bold uppercase tracking-[0.04em]">Historical</span>
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
                                    className={`w-full text-left px-4 py-3 hover:bg-[#f7f7f7] transition-colors border-b border-[#e0e0e0] last:border-0 ${selectedRaceId === race.id ? 'text-[#008fd5]' : 'text-[#222]'
                                        }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium truncate" title={race.name}>{race.name}</span>
                                        {HISTORICAL_TYPES.has(race.type) && (
                                            <span className="shrink-0 text-[10px] text-[#008fd5] font-bold uppercase tracking-[0.04em]">Historical</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[#999] mt-0.5">{race.type}</div>
                                </button>
                            ))}

                            {filteredRaces.length === 0 && (
                                <div className="p-4 text-center text-[#999] text-sm">No races in this category</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
