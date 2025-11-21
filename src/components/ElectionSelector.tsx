'use client';

import { Election } from '@/lib/api';
import { ChevronDown, Calendar } from 'lucide-react';
import { useState } from 'react';

interface ElectionSelectorProps {
    elections: Election[] | undefined;
    selectedElectionId: string | null;
    onSelectElection: (electionId: string) => void;
}

export default function ElectionSelector({ elections, selectedElectionId, onSelectElection }: ElectionSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (!elections) return null;

    const selectedElection = elections.find(e => e.electionId === selectedElectionId);

    return (
        <div className="relative z-[1000]">
            {/* Backdrop to close on click outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-50 flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg border border-slate-700 transition-colors"
            >
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                    {selectedElection?.electionName || 'Select Election'}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="max-h-[60vh] overflow-y-auto">
                        {elections.map(election => (
                            <button
                                key={election.electionId}
                                onClick={() => {
                                    onSelectElection(election.electionId);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-0 ${selectedElectionId === election.electionId ? 'bg-slate-800/50 text-blue-400' : 'text-slate-300'
                                    }`}
                            >
                                <div className="font-medium text-sm">{election.electionName}</div>
                                <div className="text-xs text-slate-500">{election.electionDate}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
