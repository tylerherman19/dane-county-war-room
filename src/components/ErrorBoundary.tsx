'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { addLog } from '@/lib/debug-log';

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Short label identifying which region crashed, for the log and fallback copy. */
    label: string;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: { componentStack?: string | null }) {
        addLog('error', 'UI', `✗ ${this.props.label} crashed: ${error.message}`, info.componentStack);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="h-full w-full flex items-center justify-center bg-[#f0f0f0] p-6">
                    <div className="max-w-sm w-full bg-white border border-[#e0e0e0] rounded-[3px] p-5 text-center">
                        <AlertTriangle className="w-6 h-6 text-[#e5ae38] mx-auto mb-2" />
                        <div className="text-sm font-bold text-[#222] mb-1">
                            {this.props.label} hit an error
                        </div>
                        <div className="text-xs text-[#666] mb-4">
                            The rest of the dashboard is still running. Reload to recover this panel.
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-bold uppercase tracking-[0.04em] text-white bg-[#222] hover:bg-[#333] transition-colors"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                            Reload
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
