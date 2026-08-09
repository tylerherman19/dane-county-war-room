'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapPin, Sliders, Users, X } from 'lucide-react';
import { PlanningData, WardPower } from '@/lib/planning-data';
import {
    AssignmentResult,
    CANDIDATE_PALETTE,
    computeAssignment,
    computeWardWeights,
    buildTurnoutPresets,
    defaultTopline,
    loadAssignState,
    saveAssignState,
    WardAssignState,
    WeightMode,
} from '@/lib/ward-model';

interface AssignPanelProps {
    data: PlanningData | null;
    isLoading: boolean;
    isError: boolean;
    power2024: WardPower | null;
    candidates: string[];
    /** wardKey ("City of Madison|46") most recently clicked on the map. */
    selectedWardKey: string | null;
    onSelectWard: (wardKey: string) => void;
    onClearSelection: () => void;
}

function fmt(n: number): string {
    return Math.round(n).toLocaleString('en-US');
}
function fmt1(n: number): string {
    return (Math.round(n * 10) / 10).toFixed(1);
}

export default function AssignPanel({
    data, isLoading, isError, power2024, candidates, selectedWardKey, onSelectWard, onClearSelection,
}: AssignPanelProps) {
    const wardKeys = useMemo(() => power2024?.rows.map(r => r.wardKey) ?? [], [power2024]);
    const presets = useMemo(() => (data ? buildTurnoutPresets(data) : []), [data]);

    const [state, setState] = useState<WardAssignState | null>(null);
    const [hydrated, setHydrated] = useState(false);

    // Load persisted state once wards + candidates are known (client only).
    useEffect(() => {
        if (wardKeys.length === 0 || candidates.length === 0 || hydrated) return;
        const fallback = presets.length > 0 ? defaultTopline(presets) : 15000;
        setState(loadAssignState(wardKeys, candidates, fallback));
        setHydrated(true);
    }, [wardKeys, candidates, presets, hydrated]);

    function update(mutator: (s: WardAssignState) => WardAssignState) {
        setState(prev => {
            if (!prev) return prev;
            const next = mutator(prev);
            saveAssignState(next);
            return next;
        });
    }

    const weights = useMemo(
        () => (data && power2024 ? computeWardWeights(data, power2024, state?.weightMode ?? 'y2024') : null),
        [data, power2024, state?.weightMode]
    );

    const result: AssignmentResult | null = useMemo(
        () => (weights && state ? computeAssignment(weights, state, candidates) : null),
        [weights, state, candidates]
    );

    const [fillOpen, setFillOpen] = useState(false);
    const [fillSplit, setFillSplit] = useState<Record<string, number> | null>(null);

    if (isLoading) {
        return <div className="p-5 space-y-4 animate-pulse"><div className="h-36 bg-[#f0f0f0]" /><div className="h-64 bg-[#f0f0f0]" /></div>;
    }
    if (isError || !data || !power2024 || !state || !result || !weights) {
        return <div className="flex items-center justify-center text-[#666] text-sm text-center p-6">Planning data hasn&apos;t loaded yet.</div>;
    }

    const topline = state.topline;
    const diff = result.allocated - topline;
    const diffOk = Math.abs(diff) < Math.max(3, topline * 0.002);
    const badRows = result.rows.filter(r => Math.abs(r.pctSum - 100) > 0.3).length;

    const selectedRow = selectedWardKey ? result.rows.find(r => r.wardKey === selectedWardKey) : null;

    const ranked = [...candidates].sort((a, b) => result.candidateTotals[b] - result.candidateTotals[a]);
    const maxTotal = Math.max(...candidates.map(c => result.candidateTotals[c]), 1);

    function setWardPct(wardKey: string, cand: string, pct: number) {
        update(s => ({ ...s, pct: { ...s.pct, [wardKey]: { ...s.pct[wardKey], [cand]: pct } } }));
    }

    function applyFillToAll(split: Record<string, number>) {
        update(s => {
            const nextPct = { ...s.pct };
            wardKeys.forEach(k => { nextPct[k] = { ...split }; });
            return { ...s, pct: nextPct };
        });
        setFillOpen(false);
    }

    return (
        <div>
            {/* ── Header ── */}
            <div className="px-4 py-4 border-b-2 border-[#222]">
                <div className="kicker mb-1 flex items-center gap-1.5" style={{ color: '#00729c' }}>
                    <Sliders className="w-3.5 h-3.5" /> Ward-by-Ward Vote Model
                </div>
                <div className="text-lg font-bold text-[#222] leading-tight">Your Projection</div>
                <p className="mt-1.5 text-[11px] text-[#999] leading-relaxed">
                    Set a topline turnout, then click wards on the map (or pick below) to assign each
                    candidate&apos;s expected share. This is your own estimate, not a model output.
                </p>
            </div>

            {/* ── Topline ── */}
            <div className="px-4 py-4 border-b border-[#e0e0e0]">
                <h3 className="kicker mb-3">Topline Turnout</h3>
                <input
                    type="number"
                    value={topline}
                    min={0}
                    step={50}
                    onChange={e => update(s => ({ ...s, topline: Number(e.target.value) || 0 }))}
                    className="w-full bg-white text-[#222] text-xl font-bold num rounded-[3px] px-2.5 py-1.5 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {presets.map(p => {
                        const active = topline === p.votes;
                        return (
                            <button
                                key={p.id}
                                onClick={() => update(s => ({ ...s, topline: p.votes }))}
                                className={`px-2 py-1.5 rounded-[3px] border text-left transition-colors ${
                                    active ? 'border-[#008fd5] bg-[#f2f9fd]' : 'border-[#e0e0e0] hover:border-[#cccccc]'
                                }`}
                            >
                                <div className={`text-[10px] font-bold ${active ? 'text-[#00729c]' : 'text-[#222]'}`}>{p.label}</div>
                                <div className="text-[11px] num text-[#666]">{fmt(p.votes)} · {p.note}</div>
                            </button>
                        );
                    })}
                </div>
                <p className="mt-2 text-[10px] text-[#999] leading-relaxed">
                    2024 was the last cycle on current lines but effectively uncontested. 2020 was the last
                    contested open-seat AD76 primary. Neither is a clean match for a five-way 2026 field —
                    pick your own number above.
                </p>
            </div>

            {/* ── Ward weighting mode ── */}
            <div className="px-4 py-4 border-b border-[#e0e0e0]">
                <h3 className="kicker mb-2">Ward Weighting</h3>
                <div className="grid grid-cols-2 gap-2">
                    {([
                        { id: 'y2024' as WeightMode, label: '2024 only', desc: 'current district lines' },
                        { id: 'blend' as WeightMode, label: 'Blend w/ 2020', desc: 'last contested open seat' },
                    ]).map(m => {
                        const active = state.weightMode === m.id;
                        return (
                            <button
                                key={m.id}
                                onClick={() => update(s => ({ ...s, weightMode: m.id }))}
                                className={`px-2 py-2 rounded-[3px] border text-left transition-colors ${
                                    active ? 'border-[#008fd5] bg-[#f2f9fd]' : 'border-[#e0e0e0] hover:border-[#cccccc]'
                                }`}
                            >
                                <div className={`text-[11px] font-bold ${active ? 'text-[#00729c]' : 'text-[#222]'}`}>{m.label}</div>
                                <div className="text-[9px] text-[#999] leading-tight mt-0.5">{m.desc}</div>
                            </button>
                        );
                    })}
                </div>
                {weights.blendUnavailable && (
                    <p className="mt-2 text-[10px] text-[#c73a1d]">2020 ward data unavailable — using 2024 only.</p>
                )}
            </div>

            {/* ── Reconciliation ── */}
            <div className="px-4 py-4 border-b border-[#e0e0e0]">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-[#666]">Allocated across candidates</span>
                    <span className="font-bold num text-[#222]">{fmt(result.allocated)} / {fmt(topline)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-[#666]">Difference</span>
                    <span className={`font-bold num ${diffOk ? 'text-[#567a3a]' : 'text-[#c73a1d]'}`}>
                        {diff >= 0 ? '+' : ''}{fmt(diff)}
                    </span>
                </div>
                {badRows > 0 && (
                    <div className="mt-1 text-[11px] text-[#c73a1d]">
                        {badRows} ward{badRows === 1 ? '' : 's'} don&apos;t sum to 100% yet
                    </div>
                )}
            </div>

            {/* ── Candidate totals ── */}
            <div className="px-4 py-4 border-b border-[#e0e0e0]">
                <h3 className="kicker mb-3 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> District Totals</h3>
                <div className="space-y-3">
                    {ranked.map(c => {
                        const idx = candidates.indexOf(c);
                        const color = CANDIDATE_PALETTE[idx % CANDIDATE_PALETTE.length];
                        const total = result.candidateTotals[c];
                        const pctOfTop = topline > 0 ? (total / topline) * 100 : 0;
                        return (
                            <div key={c}>
                                <div className="flex justify-between items-baseline mb-1">
                                    <span className="flex items-center gap-1.5 text-sm font-bold text-[#222] truncate">
                                        <span className="w-2.5 h-2.5 shrink-0 rounded-[2px]" style={{ background: color }} />
                                        {c}
                                    </span>
                                    <span className="text-sm font-bold num text-[#222] shrink-0 ml-2">{fmt(total)}</span>
                                </div>
                                <div className="h-1.5 bg-[#e8e8e8]">
                                    <div className="h-full transition-all" style={{ width: `${(total / maxTotal) * 100}%`, background: color }} />
                                </div>
                                <div className="text-[10px] text-[#999] num mt-0.5">{fmt1(pctOfTop)}% of topline</div>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={() => { setFillSplit(state.pct[wardKeys[0]] ?? {}); setFillOpen(o => !o); }}
                    className="mt-3 w-full text-[11px] font-bold text-[#008fd5] hover:text-[#00729c] transition-colors text-left"
                >
                    {fillOpen ? 'Cancel fill-all' : 'Apply one split to every ward →'}
                </button>
                {fillOpen && fillSplit && (
                    <div className="mt-2 border border-[#e0e0e0] rounded-[3px] p-3 space-y-2 bg-[#fafafa]">
                        {candidates.map((c, i) => (
                            <div key={c} className="flex items-center gap-2">
                                <span className="w-2 h-2 shrink-0 rounded-[2px]" style={{ background: CANDIDATE_PALETTE[i % CANDIDATE_PALETTE.length] }} />
                                <span className="text-[11px] text-[#666] flex-1 truncate">{c}</span>
                                <input
                                    type="range" min={0} max={100} step={0.5}
                                    value={fillSplit[c] ?? 0}
                                    onChange={e => setFillSplit(s => ({ ...(s ?? {}), [c]: Number(e.target.value) }))}
                                    className="w-20 h-1 rounded-full appearance-none cursor-pointer bg-[#e8e8e8]"
                                    style={{ accentColor: '#008fd5' }}
                                />
                                <input
                                    type="number" min={0} max={100} step={0.5}
                                    value={fillSplit[c] ?? 0}
                                    onChange={e => setFillSplit(s => ({ ...(s ?? {}), [c]: Number(e.target.value) }))}
                                    className="w-12 text-[11px] num text-right rounded-[3px] px-1 py-0.5 border border-[#cccccc]"
                                />
                            </div>
                        ))}
                        <button
                            onClick={() => applyFillToAll(fillSplit)}
                            className="w-full mt-1 px-2 py-1.5 rounded-[3px] bg-[#222] hover:bg-[#444] text-white text-[11px] font-bold transition-colors"
                        >
                            Apply to all {wardKeys.length} wards
                        </button>
                    </div>
                )}
            </div>

            {/* ── Selected ward editor ── */}
            <div className="px-4 py-4 border-b border-[#e0e0e0]">
                <h3 className="kicker mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Ward Editor</h3>
                {!selectedRow ? (
                    <div className="text-[12px] text-[#999] leading-relaxed">
                        Click a ward on the map to edit it, or pick one:
                        <div className="mt-2 max-h-40 overflow-y-auto border border-[#e0e0e0] rounded-[3px]">
                            {result.rows
                                .slice()
                                .sort((a, b) => b.weightPct - a.weightPct)
                                .map(r => (
                                    <button
                                        key={r.wardKey}
                                        onClick={() => onSelectWard(r.wardKey)}
                                        className="w-full text-left px-2.5 py-1.5 text-[11px] text-[#666] border-b border-[#f0f0f0] last:border-0 hover:bg-[#f7f7f7] hover:text-[#222] transition-colors"
                                    >
                                        {r.displayName} <span className="num text-[#999]">— {fmt1(r.weightPct)}%</span>
                                    </button>
                                ))}
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <div className="text-sm font-bold text-[#222]">{selectedRow.displayName}</div>
                                <div className="text-[11px] text-[#999] num">
                                    {fmt1(selectedRow.weightPct)}% of district · ~{fmt(selectedRow.wardVotes)} votes
                                </div>
                            </div>
                            <button onClick={onClearSelection} className="text-[#999] hover:text-[#222]" aria-label="Clear selection">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="mb-3">
                            <label className="text-[10px] text-[#999] uppercase tracking-[0.05em]">Ward weight override (%)</label>
                            <input
                                type="number" min={0} step={0.1}
                                value={state.wardWeightOverrides[selectedRow.wardKey] ?? Number(fmt1(selectedRow.weightPct))}
                                onChange={e => {
                                    const val = Number(e.target.value);
                                    update(s => ({ ...s, wardWeightOverrides: { ...s.wardWeightOverrides, [selectedRow.wardKey]: val } }));
                                }}
                                className="mt-1 w-full text-sm num rounded-[3px] px-2 py-1 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                            />
                            {state.wardWeightOverrides[selectedRow.wardKey] !== undefined && (
                                <button
                                    onClick={() => update(s => {
                                        const next = { ...s.wardWeightOverrides };
                                        delete next[selectedRow.wardKey];
                                        return { ...s, wardWeightOverrides: next };
                                    })}
                                    className="mt-1 text-[10px] text-[#008fd5] hover:text-[#00729c]"
                                >
                                    Reset to computed weight
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {candidates.map((c, i) => {
                                const color = CANDIDATE_PALETTE[i % CANDIDATE_PALETTE.length];
                                const pct = state.pct[selectedRow.wardKey]?.[c] ?? 0;
                                const votes = selectedRow.candidateVotes[c] ?? 0;
                                return (
                                    <div key={c}>
                                        <div className="flex items-center justify-between text-[12px] mb-1">
                                            <span className="flex items-center gap-1.5 font-bold text-[#222] truncate">
                                                <span className="w-2 h-2 shrink-0 rounded-[2px]" style={{ background: color }} />
                                                {c}
                                            </span>
                                            <span className="num text-[#999]">{fmt(votes)} votes</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="range" min={0} max={100} step={0.5}
                                                value={pct}
                                                onChange={e => setWardPct(selectedRow.wardKey, c, Number(e.target.value))}
                                                className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-[#e8e8e8]"
                                                style={{ accentColor: color }}
                                            />
                                            <input
                                                type="number" min={0} max={100} step={0.5}
                                                value={pct}
                                                onChange={e => setWardPct(selectedRow.wardKey, c, Number(e.target.value))}
                                                className="w-16 text-[12px] num text-right rounded-[3px] px-1.5 py-1 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                                            />
                                            <span className="text-[11px] text-[#999]">%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-3 pt-2 border-t border-[#e0e0e0] flex items-center justify-between text-[11px]">
                            <span className="text-[#999]">Row check</span>
                            <span className={`font-bold num ${Math.abs(selectedRow.pctSum - 100) > 0.3 ? 'text-[#c73a1d]' : 'text-[#567a3a]'}`}>
                                {fmt1(selectedRow.pctSum)}%
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <p className="px-4 py-3 text-[10px] text-[#999] leading-relaxed">
                Ward shares from the Dane County elections API. Every candidate split above is manually
                entered — nothing here is polling or a statistical projection. Autosaves to this browser.
            </p>
        </div>
    );
}
