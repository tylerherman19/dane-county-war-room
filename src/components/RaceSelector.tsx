'use client';

import { Race } from '@/lib/api';
import { ChevronDown } from 'lucide-react';

interface RaceSelectorProps {
    races: Race[] | undefined;
    selectedRaceId: number | null;
    onSelectRace: (raceId: number) => void;
}

export default function RaceSelector({ races, selectedRaceId, onSelectRace }: RaceSelectorProps) {
    if (!races) return null;

    const selectedRace = races.find(r => r.raceNumber === selectedRaceId);

    return (
        <div className="absolute top-4 left-16 z-[1000] w-80">
            <div className="relative group">
                <button className="w-full bg-slate-900/90 backdrop-blur border border-slate-700 text-white px-4 py-3 rounded-lg shadow-xl flex items-center justify-between hover:bg-slate-800 transition-colors text-left">
                    <div>
                        <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Current Race</div>
                        <div className="font-bold truncate">{selectedRace?.raceName || 'Select a Race'}</div>
                    </div>
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                </button>

                <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden hidden group-hover:block max-h-[60vh] overflow-y-auto">
                    {races.map(race => (
                        <button
                            key={race.raceNumber}
                            onClick={() => onSelectRace(race.raceNumber)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${selectedRaceId === race.raceNumber ? 'bg-slate-800/50 text-blue-400' : 'text-slate-300'
                                }`}
                        >
                            <div className="font-medium">{race.raceName}</div>
                            <div className="text-xs text-slate-500">{race.raceType}</div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
