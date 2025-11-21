'use client';

import { ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Election } from '@/lib/api';
import ElectionSelector from './ElectionSelector';

interface LayoutProps {
    children: ReactNode;
    sidebar: ReactNode;
    lastUpdated?: string;
    elections?: Election[];
    selectedElectionId?: string | null;
    onSelectElection?: (id: string) => void;
    viewMode: 'LIVE' | 'ARCHIVE';
    onToggleViewMode: (mode: 'LIVE' | 'ARCHIVE') => void;
}

export default function Layout({ children, sidebar, lastUpdated, elections, selectedElectionId, onSelectElection, viewMode, onToggleViewMode }: LayoutProps) {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
            {/* Header */}
            <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-[2000] relative shadow-lg">
                <div className="flex items-center gap-4">
                    {viewMode === 'LIVE' ? (
                        <div className="flex items-center gap-2">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </div>
                            <span className="text-red-500 font-bold text-xs tracking-wider uppercase">Live Results</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full bg-slate-600"></div>
                            <span className="text-slate-500 font-bold text-xs tracking-wider uppercase">Archive Mode</span>
                        </div>
                    )}
                    <h1 className="text-xl font-bold text-white tracking-tight">Dane County <span className="text-slate-400 font-normal">War Room</span></h1>
                </div>

                {/* Mode Toggle */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => onToggleViewMode('LIVE')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'LIVE' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        LIVE
                    </button>
                    <button
                        onClick={() => onToggleViewMode('ARCHIVE')}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'ARCHIVE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        ARCHIVE
                    </button>
                </div>

                <div className="flex items-center gap-6">
                    {viewMode === 'ARCHIVE' && elections && onSelectElection && (
                        <ElectionSelector
                            elections={elections}
                            selectedElectionId={selectedElectionId || null}
                            onSelectElection={onSelectElection}
                        />
                    )}

                    {lastUpdated && (
                        <div className="hidden md:block text-xs text-slate-500 font-mono">
                            Last Updated: <span className="text-slate-400">{new Date(lastUpdated).toLocaleTimeString()}</span>
                        </div>
                    )}

                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left: Map Area */}
                <main className="flex-1 relative bg-slate-950">
                    {children}
                </main>

                {/* Right: Sidebar */}
                <aside className="w-96 shrink-0 z-40 shadow-2xl relative">
                    {sidebar}
                </aside>
            </div>
        </div>
    );
}
