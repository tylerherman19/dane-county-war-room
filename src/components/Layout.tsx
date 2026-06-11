'use client';

import { ReactNode, useState, useEffect } from 'react';
import { Moon, Sun, AlertTriangle, BarChart2, X } from 'lucide-react';
import { Election } from '@/lib/api';
import ElectionSelector from './ElectionSelector';

interface LayoutProps {
    children: ReactNode;
    sidebar: ReactNode;
    lastUpdated?: string;
    elections?: Election[];
    selectedElectionId?: string | null;
    onSelectElection?: (id: string) => void;
    viewMode: 'LIVE' | 'ARCHIVE' | 'SIMULATE';
    onToggleViewMode: (mode: 'LIVE' | 'ARCHIVE' | 'SIMULATE') => void;
    hasError?: boolean;
}

export default function Layout({
    children,
    sidebar,
    lastUpdated,
    elections,
    selectedElectionId,
    onSelectElection,
    viewMode,
    onToggleViewMode,
    hasError,
}: LayoutProps) {
    const [isDark, setIsDark] = useState(true);
    const [relativeTime, setRelativeTime] = useState<string | null>(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', isDark);
    }, [isDark]);

    useEffect(() => {
        if (!lastUpdated) { setRelativeTime(null); return; }
        function compute() {
            try {
                const diffMs = Date.now() - new Date(lastUpdated!).getTime();
                if (isNaN(diffMs) || diffMs < 0) { setRelativeTime(null); return; }
                const secs = Math.floor(diffMs / 1000);
                const mins = Math.floor(secs / 60);
                const hours = Math.floor(mins / 60);
                const days = Math.floor(hours / 24);
                if (secs < 60) setRelativeTime('just now');
                else if (mins < 60) setRelativeTime(`${mins}m ago`);
                else if (hours < 24) setRelativeTime(`${hours}h ago`);
                else setRelativeTime(`${days}d ago`);
            } catch { setRelativeTime(null); }
        }
        compute();
        const id = setInterval(compute, 30000);
        return () => clearInterval(id);
    }, [lastUpdated]);

    // Close mobile sidebar when switching modes
    useEffect(() => { setMobileSidebarOpen(false); }, [viewMode]);

    const modeConfig = {
        LIVE: { label: 'Live', short: 'Live', active: 'bg-red-600 text-white shadow-lg' },
        ARCHIVE: { label: 'Archive', short: 'Arc', active: 'bg-blue-600 text-white shadow-lg' },
        SIMULATE: { label: 'Simulate', short: 'Sim', active: 'bg-violet-600 text-white shadow-lg' },
    };

    return (
        <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
            {/* Header */}
            <header className="h-14 md:h-16 bg-slate-900 border-b border-slate-800 flex items-center px-3 md:px-6 shrink-0 z-[2000] relative shadow-lg gap-3">

                {/* Left: live indicator + title */}
                <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-none">
                    {viewMode === 'LIVE' ? (
                        <div className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                        </div>
                    ) : (
                        <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${viewMode === 'SIMULATE' ? 'bg-violet-500' : 'bg-slate-600'}`} />
                    )}
                    <h1 className="font-bold text-white tracking-tight text-base md:text-xl truncate">
                        <span className="hidden sm:inline">Dane County </span>
                        <span className="sm:hidden">DC </span>
                        <span className="text-slate-400 font-normal">War Room</span>
                    </h1>
                </div>

                {/* Center: mode toggle (absolute-centered on desktop, inline on mobile) */}
                <div className="md:absolute md:left-1/2 md:-translate-x-1/2 flex bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
                    {(Object.keys(modeConfig) as Array<keyof typeof modeConfig>).map(mode => (
                        <button
                            key={mode}
                            onClick={() => onToggleViewMode(mode)}
                            className={`px-2.5 md:px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === mode ? modeConfig[mode].active : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <span className="hidden md:inline">{modeConfig[mode].label}</span>
                            <span className="md:hidden">{modeConfig[mode].short}</span>
                        </button>
                    ))}
                </div>

                {/* Right: election selector (desktop only), timestamp, dark mode */}
                <div className="flex items-center gap-2 md:gap-4 ml-auto">
                    {viewMode === 'ARCHIVE' && elections && onSelectElection && (
                        <div className="hidden md:block">
                            <ElectionSelector
                                elections={elections}
                                selectedElectionId={selectedElectionId || null}
                                onSelectElection={onSelectElection}
                            />
                        </div>
                    )}
                    {relativeTime && (
                        <div className="hidden lg:block text-xs text-slate-500 font-mono whitespace-nowrap">
                            Updated <span className="text-slate-400">{relativeTime}</span>
                        </div>
                    )}
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-1.5 md:p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                        aria-label="Toggle dark mode"
                    >
                        {isDark ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
                    </button>
                </div>
            </header>

            {/* Archive election selector — mobile second row */}
            {viewMode === 'ARCHIVE' && elections && onSelectElection && (
                <div className="md:hidden bg-slate-900 border-b border-slate-800 px-3 py-2">
                    <ElectionSelector
                        elections={elections}
                        selectedElectionId={selectedElectionId || null}
                        onSelectElection={onSelectElection}
                    />
                </div>
            )}

            {/* Error Banner */}
            {hasError && (
                <div className="bg-amber-900/80 border-b border-amber-700 px-3 md:px-6 py-2 flex items-center gap-2 text-amber-200 text-xs md:text-sm z-[1999]">
                    <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400 shrink-0" />
                    <span>Unable to reach the election results API. Data may be stale. Retrying…</span>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Map area */}
                <main className="flex-1 relative bg-slate-950 min-w-0">
                    {children}
                </main>

                {/* Desktop sidebar */}
                <aside className="hidden md:block w-96 shrink-0 z-40 shadow-2xl relative overflow-hidden">
                    {sidebar}
                </aside>

                {/* Mobile sidebar backdrop */}
                {mobileSidebarOpen && (
                    <div
                        className="md:hidden fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm"
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Mobile sidebar bottom sheet */}
                <aside
                    className={`md:hidden fixed bottom-0 left-0 right-0 z-[3001] transition-transform duration-300 ease-out ${
                        mobileSidebarOpen ? 'translate-y-0' : 'translate-y-full'
                    }`}
                    style={{
                        maxHeight: '82vh',
                        borderRadius: '16px 16px 0 0',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#0f172a',
                        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
                    }}
                    aria-label="Results panel"
                >
                    {/* Sheet handle + close */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-slate-900 border-b border-slate-800 shrink-0">
                        <div className="w-12 h-1 rounded-full bg-slate-600" />
                        <button
                            onClick={() => setMobileSidebarOpen(false)}
                            className="p-1.5 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-4"
                            aria-label="Close results panel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {sidebar}
                    </div>
                </aside>
            </div>

            {/* Mobile FAB — toggle results panel */}
            <button
                className="md:hidden fixed bottom-5 right-4 z-[2999] flex items-center gap-2 px-4 py-3 rounded-full text-sm font-bold text-white transition-all active:scale-95"
                style={{
                    background: mobileSidebarOpen ? '#475569' : '#2563eb',
                    boxShadow: mobileSidebarOpen
                        ? '0 4px 16px rgba(0,0,0,0.4)'
                        : '0 4px 24px rgba(37,99,235,0.55)',
                }}
                onClick={() => setMobileSidebarOpen(o => !o)}
                aria-label={mobileSidebarOpen ? 'Close results' : 'Show results'}
            >
                <BarChart2 className="w-4 h-4" />
                {mobileSidebarOpen ? 'Close' : 'Results'}
            </button>
        </div>
    );
}
