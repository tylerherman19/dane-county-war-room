'use client';

import { ReactNode } from 'react';
import { Moon, Sun, Radio } from 'lucide-react';
import { useState, useEffect } from 'react';

interface LayoutProps {
    children: ReactNode;
    sidebar: ReactNode;
    lastUpdated?: string;
}

export default function Layout({ children, sidebar, lastUpdated }: LayoutProps) {
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
            <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-50 relative shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </div>
                        <span className="text-red-500 font-bold text-xs tracking-wider uppercase">Live Results</span>
                    </div>
                    <h1 className="text-xl font-bold text-white tracking-tight">Dane County <span className="text-slate-400 font-normal">War Room</span></h1>
                </div>

                <div className="flex items-center gap-6">
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
