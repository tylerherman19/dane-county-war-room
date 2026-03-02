'use client';

import { useState } from 'react';
import { useDebugLog, clearLog, LogEntry } from '@/lib/debug-log';
import { HoveredWard, HSL } from './Map';
import { assignCandidateColors } from '@/lib/candidate-colors';
import { RaceResult } from '@/lib/api';
import { normalizeWardName } from '@/lib/analysis-data';

interface DebugPanelProps {
    wardData: HoveredWard | null;
    raceResult: RaceResult | undefined;
}

const LEVEL_COLOR: Record<string, string> = {
    info:    '#94a3b8',
    success: '#4ade80',
    warn:    '#fbbf24',
    error:   '#f87171',
};

const LEVEL_ICON: Record<string, string> = {
    info:    'ℹ',
    success: '✓',
    warn:    '⚠',
    error:   '✗',
};

function LogRow({ entry }: { entry: LogEntry }) {
    const [open, setOpen] = useState(false);
    const color = LEVEL_COLOR[entry.level] || '#94a3b8';
    return (
        <div
            style={{ borderBottom: '1px solid #1e293b', padding: '4px 10px', cursor: entry.data ? 'pointer' : 'default' }}
            onClick={() => entry.data && setOpen(o => !o)}
        >
            <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', flexShrink: 0 }}>{entry.time}</span>
                <span style={{ fontSize: '11px', color, flexShrink: 0 }}>{LEVEL_ICON[entry.level]}</span>
                <span style={{ fontSize: '10px', color: '#64748b', flexShrink: 0, background: '#1e293b', borderRadius: '3px', padding: '0 4px' }}>{entry.tag}</span>
                <span style={{ fontSize: '11px', color: '#e2e8f0', wordBreak: 'break-word' }}>{entry.message}</span>
                {entry.elapsed !== undefined && (
                    <span style={{ fontSize: '10px', color: '#475569', marginLeft: 'auto', flexShrink: 0 }}>{entry.elapsed}ms</span>
                )}
            </div>
            {open && entry.data !== undefined && (
                <pre style={{ fontSize: '10px', color: '#94a3b8', background: '#020617', borderRadius: '4px', padding: '6px', marginTop: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(entry.data, null, 2)}
                </pre>
            )}
        </div>
    );
}

function WardInspector({ wardData, raceResult }: { wardData: HoveredWard | null; raceResult: RaceResult | undefined }) {
    if (!wardData) {
        return (
            <div style={{ padding: '16px', color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>
                Hover over a ward to inspect it
            </div>
        );
    }

    const candidateColors: Record<string, HSL> = raceResult?.candidates
        ? assignCandidateColors(raceResult.candidates)
        : {};

    const wardKey = normalizeWardName(wardData.municipality, wardData.wardNum);
    const winner = wardData.results[0];
    const runnerUp = wardData.results[1];
    const margin = winner && runnerUp ? winner.pct - runnerUp.pct : winner ? 100 : 0;
    const winnerHSL = winner ? (candidateColors[winner.candidateName.trim()] || { h: 215, s: 16, l: 47 }) : null;
    const lightness = 65 - (Math.min(margin / 100, 0.5) * 30);

    const S = (props: { label: string; value: string | number | null | undefined; mono?: boolean; dim?: boolean }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
            <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0 }}>{props.label}</span>
            <span style={{
                color: props.dim ? '#475569' : '#cbd5e1',
                fontSize: '11px',
                fontFamily: props.mono ? 'monospace' : 'inherit',
                textAlign: 'right',
                wordBreak: 'break-all',
            }}>
                {props.value ?? '—'}
            </span>
        </div>
    );

    return (
        <div style={{ fontSize: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 160px)' }}>
            {/* Ward header */}
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b' }}>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '13px' }}>
                    {wardData.municipality} · Ward {wardData.wardNum}
                </div>
                <div style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace', marginTop: '2px' }}>
                    key: {wardKey}
                </div>
            </div>

            {/* Raw results */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e293b' }}>
                <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Raw Results</div>
                {wardData.results.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span style={{ color: i === 0 ? '#e2e8f0' : '#64748b', fontSize: '11px' }}>
                            {i === 0 ? '▲ ' : '\u00a0\u00a0 '}{r.candidateName}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>
                            {r.votes.toLocaleString()} ({r.pct.toFixed(1)}%)
                        </span>
                    </div>
                ))}
                <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px', borderTop: '1px solid #1e293b', paddingTop: '4px' }}>
                    {wardData.total.toLocaleString()} ballots cast
                </div>
            </div>

            {/* Historical analysis */}
            {wardData.analysis && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Historical Baseline</div>
                    <S label="Race" value={wardData.analysis.historicalRaceName} />
                    <S label="Date" value={wardData.analysis.historicalDate?.slice(0, 10)} mono />
                    <S label="Hist. margin" value={wardData.analysis.historicalMargin !== null ? `${(wardData.analysis.historicalMargin * 100).toFixed(1)}%` : '—'} mono />
                    <S label="Hist. votes" value={wardData.analysis.historicalVotes ? wardData.analysis.historicalVotes.toLocaleString() : '—'} mono />
                    {wardData.analysis.historicalMargin !== 0 && winner && (
                        (() => {
                            const diff = (margin / 100) - wardData.analysis.historicalMargin;
                            const sign = diff > 0 ? '+' : '';
                            return (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                    <span style={{ color: '#64748b', fontSize: '11px' }}>Δ vs baseline</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: '11px', color: diff > 0 ? '#60a5fa' : '#f87171' }}>
                                        {sign}{(diff * 100).toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })()
                    )}
                </div>
            )}

            {/* Color calc */}
            <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Color Calculation</div>
                <S label="Fill" value={wardData.fillColor} mono />
                {winnerHSL && (
                    <>
                        <S label="Winner HSL" value={`h=${winnerHSL.h} s=${winnerHSL.s} l=${winnerHSL.l}`} mono />
                        <S label="Margin" value={`${margin.toFixed(1)}% → L=${lightness.toFixed(0)}%`} mono />
                    </>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                    <div style={{ width: '40px', height: '16px', borderRadius: '3px', background: wardData.fillColor, flexShrink: 0, border: '1px solid #334155' }} />
                    <span style={{ fontSize: '10px', color: '#475569', fontFamily: 'monospace' }}>{wardData.fillColor}</span>
                </div>
            </div>
        </div>
    );
}

export default function DebugPanel({ wardData, raceResult }: DebugPanelProps) {
    const [tab, setTab] = useState<'ward' | 'log'>('ward');
    const logs = useDebugLog();

    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '5px 12px',
        fontSize: '11px',
        fontWeight: active ? 600 : 400,
        color: active ? '#f1f5f9' : '#64748b',
        background: active ? '#1e293b' : 'transparent',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
    });

    return (
        <div style={{
            position: 'fixed',
            top: '60px',
            right: '0',
            width: '320px',
            maxHeight: 'calc(100vh - 80px)',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
            fontFamily: 'system-ui, sans-serif',
        }}>
            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button style={tabStyle(tab === 'ward')} onClick={() => setTab('ward')}>Ward</button>
                    <button style={tabStyle(tab === 'log')}>
                        <span onClick={() => setTab('log')}>
                            API Log {logs.length > 0 && <span style={{ color: '#64748b' }}>({logs.length})</span>}
                        </span>
                    </button>
                </div>
                <span style={{ fontSize: '10px', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DEBUG</span>
            </div>

            {/* Tab content */}
            {tab === 'ward' ? (
                <WardInspector wardData={wardData} raceResult={raceResult} />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', borderBottom: '1px solid #1e293b' }}>
                        <button
                            style={{ fontSize: '10px', color: '#64748b', background: 'transparent', border: '1px solid #334155', borderRadius: '3px', padding: '2px 8px', cursor: 'pointer' }}
                            onClick={clearLog}
                        >
                            Clear
                        </button>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {logs.length === 0 ? (
                            <div style={{ padding: '16px', color: '#475569', fontSize: '11px', textAlign: 'center' }}>No log entries yet</div>
                        ) : (
                            logs.map(entry => <LogRow key={entry.id} entry={entry} />)
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
