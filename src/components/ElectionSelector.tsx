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
                className="relative z-50 flex items-center gap-2 bg-white hover:bg-[#f7f7f7] text-[#222] px-3 py-2 rounded-[3px] border border-[#cccccc] transition-colors"
            >
                <Calendar className="w-4 h-4 text-[#999]" />
                <span className="text-sm font-medium truncate max-w-[200px]">
                    {selectedElection?.electionName || 'Select Election'}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#999] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 md:left-auto md:right-0 mt-1 w-72 max-w-[calc(100vw-24px)] bg-white border border-[#cccccc] rounded-[3px] shadow-[0_2px_12px_rgba(0,0,0,0.18)] overflow-hidden z-50">
                    <div className="max-h-[80vh] overflow-y-auto">
                        {elections.map(election => (
                            <button
                                key={election.electionId}
                                onClick={() => {
                                    onSelectElection(election.electionId);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-[#f7f7f7] transition-colors border-b border-[#eeeeee] last:border-0 ${selectedElectionId === election.electionId ? 'text-[#008fd5] font-bold' : 'text-[#222]'
                                    }`}
                            >
                                <div className="text-sm">{election.electionName}</div>
                                <div className="text-xs text-[#999] num">{election.electionDate}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
