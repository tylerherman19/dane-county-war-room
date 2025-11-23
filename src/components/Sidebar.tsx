'use client';

import { RaceResult, HistoricalTurnout, PrecinctResult } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Search, ExternalLink, Download } from 'lucide-react';
import { useState } from 'react';
import TrendSparkline from './TrendSparkline';
import { getWardAnalysis } from '@/lib/analysis-data';

interface SidebarProps {
    raceResult: RaceResult | undefined;
    turnoutData: HistoricalTurnout | undefined;
    precinctResults: PrecinctResult[] | undefined;
    isLoading: boolean;
    onSelectWard: (ward: { name: string; num: string }) => void;
}

export default function Sidebar({ raceResult, turnoutData, precinctResults, isLoading, onSelectWard }: SidebarProps) {
    const [searchTerm, setSearchTerm] = useState('');

    if (isLoading) {
        return <div className="h-full bg-slate-900 border-l border-slate-800 p-6 animate-pulse">
            <div className="h-32 bg-slate-800 rounded-xl mb-6"></div>
            <div className="h-64 bg-slate-800 rounded-xl mb-6"></div>
            <div className="h-96 bg-slate-800 rounded-xl"></div>
        </div>;
    }

    if (!raceResult) return <div className="h-full bg-slate-900 border-l border-slate-800 p-6 text-slate-400">Select a race to view details</div>;

    const sortedCandidates = [...raceResult.candidates].sort((a, b) => b.votes - a.votes);
    const totalVotes = raceResult.totalVotes;

    // Filter wards
    const filteredWards = precinctResults?.filter(w =>
        w.precinctName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.wardNumber.toString().includes(searchTerm)
    ) || [];

    // Group by ward for list view (since precinctResults has one row per candidate)
    const uniqueWards = Array.from(new Set(filteredWards.map(w => `${w.precinctName}-${w.wardNumber}`)))
        .map(key => {
            const [name, num] = key.split('-');
            // Find results for this ward
            const wardResults = filteredWards.filter(w => w.precinctName === name && w.wardNumber === num);
            const total = wardResults[0]?.ballotscast || 0;
            const winner = wardResults.sort((a, b) => b.votes - a.votes)[0];
            return { name, num, total, winner };
        })
        .sort((a, b) => {
            // Sort by Municipality Name first
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0) return nameCompare;
            // Then by Ward Number (numeric)
            return parseInt(a.num) - parseInt(b.num);
        });
    // Removed .slice(0, 50) to show all wards as requested

    return (
        <div className="h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Outstanding Ballots Card */}
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Estimated Outstanding</h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white">
                            {turnoutData?.outstandingEstimate.toLocaleString()}
                        </span>
                        <span className="text-slate-400 text-sm">ballots remaining</span>
                    </div>
                    <div className="mt-2 w-full bg-slate-700/50 h-2 rounded-full overflow-hidden">
                        <div
                            className="bg-blue-500 h-full transition-all duration-1000"
                            style={{ width: `${(totalVotes / (turnoutData?.expectedBallots || 1)) * 100}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-500">
                        <span>Counted: {totalVotes.toLocaleString()}</span>
                        <span>Expected: {turnoutData?.expectedBallots.toLocaleString()}</span>
                    </div>
                </div>

                {/* Race Summary Card */}
                <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Race Summary</h3>

                    <div className="space-y-4">
                        {sortedCandidates.map((candidate, idx) => (
                            <div key={candidate.candidateName}>
                                <div className="flex justify-between items-end mb-1">
                                    <span className="font-medium text-white truncate max-w-[60%]">{candidate.candidateName}</span>
                                    <div className="text-right">
                                        <span className="font-bold text-white">{candidate.percentage.toFixed(1)}%</span>
                                        <span className="text-slate-500 text-xs ml-2">{candidate.votes.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-700/30 h-2 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${idx === 0 ? 'bg-blue-500' : 'bg-slate-500'}`}
                                        style={{ width: `${candidate.percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Ward List */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col max-h-96">
                    <div className="p-4 border-b border-slate-700/50">
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Ward Results</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search wards..."
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-1">
                        {uniqueWards.map(ward => (
                            <button
                                key={`${ward.name}-${ward.num}`}
                                onClick={() => onSelectWard({ name: ward.name, num: ward.num })}
                                className="w-full text-left p-3 hover:bg-slate-700/30 rounded-lg transition-colors group"
                            >
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-200">{ward.name} Ward {ward.num}</span>
                                    <span className="text-xs text-slate-500 group-hover:text-blue-400 transition-colors">View</span>
                                </div>
                                <div className="flex justify-between items-end mt-1">
                                    <div className="text-xs text-slate-500">
                                        <div>Leader: {ward.winner?.candidateName || 'N/A'}</div>
                                        <div>Votes: {ward.total}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {uniqueWards.length === 0 && (
                            <div className="p-4 text-center text-slate-500 text-sm">No wards found</div>
                        )}
                    </div>
                </div>

            </div>

            {/* Footer / Exports */}
            <div className="p-4 border-t border-slate-800 bg-slate-900">
                <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                    <button className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2 px-4 rounded-lg transition-colors">
                        <ExternalLink className="w-4 h-4" />
                        Share
                    </button>
                </div>
            </div>
        </div>
    );
}
