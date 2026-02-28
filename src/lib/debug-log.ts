import { useEffect, useState } from 'react';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
    id: number;
    time: string;
    level: LogLevel;
    tag: string;
    message: string;
    data?: unknown;
    elapsed?: number; // ms
}

let idCounter = 0;
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
    listeners.forEach(l => l());
}

export function addLog(level: LogLevel, tag: string, message: string, data?: unknown, elapsed?: number) {
    const entry: LogEntry = {
        id: ++idCounter,
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        level,
        tag,
        message,
        ...(data !== undefined && { data }),
        ...(elapsed !== undefined && { elapsed }),
    };
    // Prepend (newest first), cap at 200 entries
    entries = [entry, ...entries].slice(0, 200);
    notify();
}

export function clearLog() {
    entries = [];
    notify();
}

export function getLog(): LogEntry[] {
    return entries;
}

export function useDebugLog(): LogEntry[] {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const trigger = () => forceUpdate(n => n + 1);
        listeners.add(trigger);
        return () => { listeners.delete(trigger); };
    }, []);

    return entries;
}
