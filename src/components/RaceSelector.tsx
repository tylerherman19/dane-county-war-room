'use client';

import { Race } from '@/lib/api';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface RaceSelectorProps {
    races: Race[] | undefined;
    selectedRaceId: string | null;
    onSelectRace: (raceId: string) => void;
}

export default function RaceSelector({ races, selectedRaceId, onSelectRace }: RaceSelectorProps) {
    const [category, setCategory] = useState<'All' | 'Federal' | 'State' | 'Local'>('All');

    if (!races) return null;

    const selectedRace = races.find(r => r.id === selectedRaceId);

    const filteredRaces = races.filter(race => {
        if (category === 'All') return true;
        if (category === 'Federal') return ['Presidential', 'Senate', 'Congress'].includes(race.type);
        if (category === 'State') return ['StateSenate', 'Assembly', 'Governor', 'Referendum'].includes(race.type);
        if (category === 'Local') return ['Mayor', 'CountyExecutive', 'Aldermanic', 'SchoolBoard'].includes(race.type);
        return true;
    });

    return (
        <div className="absolute top-4 left-16 z-[1000] w-80">
            <div className="relative group">
                <button className="w-full bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center justify-between hover:bg-slate-800 transition-colors text-left">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Race</div>
                        <div className="font-bold truncate">{selectedRace?.name || 'Select a Race'}</div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                </button>

                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block">
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
                    <div className="max-h-[50vh] overflow-y-auto">
                        {filteredRaces.map(race => (
                            <button
                                key={race.id}
                                onClick={() => onSelectRace(race.id)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${selectedRaceId === race.id ? 'bg-slate-800/50 text-blue-400' : 'text-slate-300'
                                    }`}
                            >
                                <div className="font-medium">{race.name}</div>
                                <div className="text-xs text-slate-500">{race.type}</div>
                            </button>
                        ))}
                        {filteredRaces.length === 0 && (
                            <div className="p-4 text-center text-slate-500 text-sm">No races found</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
