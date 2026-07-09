'use client';

import { ReactNode, useState, useEffect } from 'react';
import { AlertTriangle, BarChart2, X } from 'lucide-react';
import { Election } from '@/lib/api';
import ElectionSelector from './ElectionSelector';

interface LayoutProps {
    children: ReactNode;
    sidebar: ReactNode;
    lastUpdated?: string;
    elections?: Election[];
    selectedElectionId?: string | null;
    onSelectElection?: (id: string) => void;
    viewMode: 'LIVE' | 'BOARD' | 'ARCHIVE' | 'TRENDS' | 'COALITION' | 'SIMULATE' | 'PRIMARY';
    onToggleViewMode: (mode: 'LIVE' | 'BOARD' | 'ARCHIVE' | 'TRENDS' | 'COALITION' | 'SIMULATE' | 'PRIMARY') => void;
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
    const [relativeTime, setRelativeTime] = useState<string | null>(null);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [countdown, setCountdown] = useState(30);

    // Countdown to the next auto-refresh (data polls every 30s in live views)
    const isLiveView = viewMode === 'LIVE' || viewMode === 'BOARD';
    useEffect(() => {
        if (!isLiveView) return;
        setCountdown(30);
        const id = setInterval(() => setCountdown(c => (c <= 1 ? 30 : c - 1)), 1000);
        return () => clearInterval(id);
    }, [isLiveView]);

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

    const modes: Array<{ id: LayoutProps['viewMode']; label: string; short: string }> = [
        { id: 'LIVE', label: 'Live', short: 'Live' },
        { id: 'BOARD', label: 'Board', short: 'Board' },
        { id: 'ARCHIVE', label: 'Archive', short: 'Archive' },
        { id: 'TRENDS', label: 'Trends', short: 'Trends' },
        { id: 'COALITION', label: 'Coalition', short: 'Coal' },
        { id: 'SIMULATE', label: 'Simulate', short: 'Sim' },
        { id: 'PRIMARY', label: 'AD76 Primary', short: 'AD76' },
    ];

    return (
        <div className="flex flex-col h-screen bg-white text-[#222] overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-[#e0e0e0] shrink-0 z-[2000] relative">
                {/* Top row: wordmark + live tag + timestamp */}
                <div className="h-11 md:h-14 flex items-center px-3 md:px-6 gap-3">
                    <h1 className="min-w-0 truncate text-base md:text-xl tracking-tight">
                        <span className="font-bold">Dane County</span>{' '}
                        <span className="font-normal text-[#666]">War Room</span>
                    </h1>
                    {viewMode === 'LIVE' && (
                        <span className="shrink-0 bg-[#fc4f30] text-white text-[10px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 leading-none rounded-[2px]">
                            Live
                        </span>
                    )}

                    {/* Desktop: mode tabs centered */}
                    <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 h-full items-stretch">
                        {modes.map(m => (
                            <button
                                key={m.id}
                                onClick={() => onToggleViewMode(m.id)}
                                className={`px-4 text-[13px] font-bold uppercase tracking-[0.05em] border-b-[3px] transition-colors ${
                                    viewMode === m.id
                                        ? 'border-[#222] text-[#222]'
                                        : 'border-transparent text-[#999] hover:text-[#222]'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-4 ml-auto">
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
                            <div className="hidden lg:block text-xs text-[#999] whitespace-nowrap">
                                Updated <span className="text-[#666] num">{relativeTime}</span>
                            </div>
                        )}
                        {isLiveView && (
                            <div className="hidden md:flex items-center gap-1.5 text-xs whitespace-nowrap" title="Next automatic refresh">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6d904f]" />
                                <span className="text-[#999]">refresh <span className="text-[#567a3a] num">{countdown}s</span></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile: mode tabs on their own row, full words, scrollable */}
                <nav className="md:hidden flex items-stretch border-t border-[#e0e0e0] overflow-x-auto">
                    {modes.map(m => (
                        <button
                            key={m.id}
                            onClick={() => onToggleViewMode(m.id)}
                            className={`flex-1 whitespace-nowrap px-2 py-2 text-[12px] font-bold uppercase tracking-[0.04em] border-b-[3px] transition-colors ${
                                viewMode === m.id
                                    ? 'border-[#222] text-[#222]'
                                    : 'border-transparent text-[#999]'
                            }`}
                        >
                            {m.short}
                        </button>
                    ))}
                </nav>
            </header>

            {/* Archive election selector — mobile second row */}
            {viewMode === 'ARCHIVE' && elections && onSelectElection && (
                <div className="md:hidden bg-white border-b border-[#e0e0e0] px-3 py-2 relative z-[1500]">
                    <ElectionSelector
                        elections={elections}
                        selectedElectionId={selectedElectionId || null}
                        onSelectElection={onSelectElection}
                    />
                </div>
            )}

            {/* Error Banner */}
            {hasError && (
                <div className="bg-[#fff8e6] border-b border-[#e5ae38] px-3 md:px-6 py-2 flex items-center gap-2 text-[#7a5c00] text-xs md:text-sm z-[1999]">
                    <AlertTriangle className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" />
                    <span>Unable to reach the election results API. Data may be stale. Retrying.</span>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Map area */}
                <main className="flex-1 relative bg-[#f0f0f0] min-w-0">
                    {children}
                </main>

                {/* Desktop sidebar */}
                {sidebar && (
                    <aside className="hidden md:block w-96 shrink-0 z-40 relative overflow-hidden border-l border-[#e0e0e0]">
                        {sidebar}
                    </aside>
                )}

                {/* Mobile sidebar backdrop */}
                {sidebar && mobileSidebarOpen && (
                    <div
                        className="md:hidden fixed inset-0 z-[3000] bg-black/40"
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-hidden="true"
                    />
                )}

                {/* Mobile sidebar bottom sheet */}
                {sidebar && (
                <aside
                    className={`mobile-sheet md:hidden fixed bottom-0 left-0 right-0 z-[3001] transition-transform duration-300 ease-out ${
                        mobileSidebarOpen ? 'translate-y-0' : 'translate-y-full'
                    }`}
                    style={{
                        borderRadius: '8px 8px 0 0',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#ffffff',
                        borderTop: '1px solid #cccccc',
                        boxShadow: '0 -2px 16px rgba(0,0,0,0.18)',
                    }}
                    aria-label="Results panel"
                >
                    {/* Sheet handle + close */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-white border-b border-[#e0e0e0] shrink-0">
                        <div className="w-10 h-1 rounded-full bg-[#cccccc]" />
                        <button
                            onClick={() => setMobileSidebarOpen(false)}
                            className="p-1.5 text-[#666] hover:text-[#222] transition-colors ml-4"
                            aria-label="Close results panel"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto overscroll-contain">
                        {sidebar}
                    </div>
                </aside>
                )}
            </div>

            {/* Mobile: open results panel (the sheet has its own close) */}
            {sidebar && !mobileSidebarOpen && (
                <button
                    className="md:hidden fixed left-1/2 -translate-x-1/2 z-[2999] flex items-center gap-2 px-5 py-2.5 rounded-[3px] text-sm font-bold text-white bg-[#222] transition-transform active:scale-95"
                    style={{
                        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.3)',
                    }}
                    onClick={() => setMobileSidebarOpen(true)}
                    aria-label="Show results"
                >
                    <BarChart2 className="w-4 h-4" />
                    Results
                </button>
            )}
        </div>
    );
}
