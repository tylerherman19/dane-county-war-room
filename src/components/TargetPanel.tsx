'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, Download, MapPin, Info } from 'lucide-react';
import { fetchHistoricalData, HistoricalRaceData } from '@/lib/historical-api-data';
import { buildTurnoutProfile, TurnoutTier } from '@/lib/target-data';
import { DistrictFilter, DistrictKind, getDistrictOptions, getWardsInDistrict, districtLabel } from '@/lib/districts';
import { toCsv, downloadCsv, fileSlug } from '@/lib/csv';

export interface TargetUpdate {
    scoreByWard: Record<string, number> | null;
    label: string | null;
}

interface TargetPanelProps {
    districtFilter: DistrictFilter | null;
    onDistrictChange: (f: DistrictFilter | null) => void;
    onTargetUpdate: (u: TargetUpdate) => void;
}

const TIER_LABEL: Record<TurnoutTier, string> = {
    CONSISTENT: 'Consistent',
    MIXED: 'Mixed',
    PRESIDENTIAL_ONLY: 'Pres-only',
};
const TIER_STYLE: Record<TurnoutTier, string> = {
    CONSISTENT: 'border-[#6d904f] text-[#567a3a]',
    MIXED: 'border-[#e5ae38] text-[#a16207]',
    PRESIDENTIAL_ONLY: 'border-[#fc4f30] text-[#c73a1d]',
};

const DISTRICT_VALUE_SEP = ':';

export default function TargetPanel({
    districtFilter,
    onDistrictChange,
    onTargetUpdate,
}: TargetPanelProps) {
    const [data, setData] = useState<Map<string, HistoricalRaceData[]> | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [sort, setSort] = useState<'CONSISTENT' | 'FALLOFF'>('CONSISTENT');

    useEffect(() => {
        fetchHistoricalData()
            .then(d => {
                if (d.size === 0) setLoadError(true);
                else setData(d);
            })
            .catch(() => setLoadError(true));
    }, []);

    const districtWardKeys = useMemo(
        () => (districtFilter ? getWardsInDistrict(districtFilter) : null),
        [districtFilter]
    );

    const profile = useMemo(() => {
        if (!data) return null;
        return buildTurnoutProfile(data, districtWardKeys);
    }, [data, districtWardKeys]);

    const scopeLabel = districtFilter ? districtLabel(districtFilter) : 'All wards (county)';

    // Ranked either most-consistent-first or biggest-falloff-first.
    const rankedWards = useMemo(() => {
        if (!profile) return [];
        return sort === 'CONSISTENT' ? profile.wards : [...profile.wards].reverse();
    }, [profile, sort]);

    // Push the consistency score map to the choropleth overlay.
    useEffect(() => {
        if (!profile || profile.wards.length === 0) {
            onTargetUpdate({ scoreByWard: null, label: null });
            return;
        }
        onTargetUpdate({ scoreByWard: profile.scoreByWard, label: `Turnout consistency · ${scopeLabel}` });
    }, [profile, scopeLabel, onTargetUpdate]);

    const districtOptions = useMemo(() => getDistrictOptions(), []);

    function handleDistrictSelect(value: string) {
        if (value === '') {
            onDistrictChange(null);
            return;
        }
        const [kind, num] = value.split(DISTRICT_VALUE_SEP);
        onDistrictChange({ kind: kind as DistrictKind, num });
    }

    function handleExport() {
        if (!profile || profile.wards.length === 0) return;
        const headers = ['Rank', 'Ward', 'Ward #', `${profile.peakLabel} ballots`, `${profile.offCycleLabel} ballots`, 'Consistency %', 'Falloff %', 'Tier'];
        const rows = rankedWards.map((w, i) => [
            i + 1,
            w.displayName,
            w.wardNumber,
            w.presidential,
            w.offCycle,
            w.consistency,
            w.falloff,
            TIER_LABEL[w.tier],
        ]);
        const csv = toCsv(headers, rows);
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCsv(`turnout-consistency-${fileSlug(scopeLabel)}-${stamp}`, csv);
    }

    const selectValue = districtFilter ? `${districtFilter.kind}${DISTRICT_VALUE_SEP}${districtFilter.num}` : '';

    return (
        <div className="h-full bg-white flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Intro */}
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222] mb-1 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Turnout Targeting
                    </h3>
                    <p className="text-xs text-[#666]">
                        How consistently each ward votes: off-cycle turnout as a share of its presidential
                        turnout. High = reliable base that votes in every election. Low = shows up only for
                        president and falls off in primaries.
                    </p>
                    {profile && profile.wards.length > 0 && (
                        <p className="text-[10px] text-[#999] mt-1.5">
                            {profile.offCycleLabel} ÷ {profile.peakLabel}, per ward.
                        </p>
                    )}
                </div>

                {/* District scope */}
                <div className="border border-[#e0e0e0] rounded-[3px] p-3">
                    <div className="kicker mb-2 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> Scope
                    </div>
                    <select
                        className="w-full bg-white text-[#222] text-sm rounded-[3px] px-2 py-2 border border-[#cccccc] focus:outline-none focus:border-[#008fd5]"
                        value={selectValue}
                        onChange={e => handleDistrictSelect(e.target.value)}
                    >
                        <option value="">All wards (county)</option>
                        {districtOptions.map(group => (
                            <optgroup key={group.kind} label={group.label}>
                                {group.districts.map(num => (
                                    <option key={`${group.kind}${DISTRICT_VALUE_SEP}${num}`} value={`${group.kind}${DISTRICT_VALUE_SEP}${num}`}>
                                        {group.label} {num}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {/* Summary + export */}
                {profile && profile.wards.length > 0 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222]">Turnout Profile</h3>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] bg-[#222] hover:bg-black text-white text-[11px] font-bold transition-colors"
                                title="Download the full ranked list as CSV"
                            >
                                <Download className="w-3 h-3" /> CSV
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-2xl font-bold text-[#222] num">{profile.avgConsistency.toFixed(0)}%</div>
                                <div className="text-[10px] text-[#999]">avg consistency</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[#222] num">{profile.wards.length}</div>
                                <div className="text-[10px] text-[#999]">wards measured</div>
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] text-[#999]">
                            Map shades each ward by consistency — green votes consistently, red is presidential-only.
                        </div>
                    </div>
                )}

                {/* Sort toggle */}
                {profile && profile.wards.length > 0 && (
                    <div className="flex gap-1">
                        {([
                            { id: 'CONSISTENT', label: 'Most consistent' },
                            { id: 'FALLOFF', label: 'Biggest falloff' },
                        ] as const).map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => setSort(opt.id)}
                                className={`flex-1 px-2.5 py-1.5 rounded-[3px] text-[11px] font-bold transition-colors border ${
                                    sort === opt.id
                                        ? 'bg-[#222] text-white border-[#222]'
                                        : 'bg-white text-[#666] border-[#cccccc] hover:text-[#222] hover:border-[#999]'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Ranked ward list */}
                {profile && profile.wards.length > 0 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                        <div className="px-3 py-2 border-b border-[#e0e0e0] bg-[#fafafa] flex items-center text-[10px] font-bold uppercase tracking-[0.06em] text-[#999]">
                            <span className="w-5 text-right shrink-0">#</span>
                            <span className="flex-1 pl-2">Ward</span>
                            <span className="w-12 text-right shrink-0" title={profile.peakLabel}>Pres</span>
                            <span className="w-12 text-right shrink-0" title={profile.offCycleLabel}>Spring</span>
                            <span className="w-12 text-right shrink-0">Cons.</span>
                        </div>
                        <div className="divide-y divide-[#eeeeee] max-h-[420px] overflow-y-auto">
                            {rankedWards.map((w, i) => (
                                <div key={w.wardKey} className="px-3 py-2 flex items-center">
                                    <span className="w-5 text-right shrink-0 text-[10px] text-[#999] num">{i + 1}</span>
                                    <div className="flex-1 min-w-0 pl-2">
                                        <div className="text-xs text-[#222] truncate">{w.displayName}</div>
                                        <span className={`inline-block mt-0.5 text-[9px] font-bold px-1 py-px rounded-[2px] border ${TIER_STYLE[w.tier]}`}>
                                            {TIER_LABEL[w.tier]}
                                        </span>
                                    </div>
                                    <span className="w-12 text-right shrink-0 text-[11px] text-[#666] num">
                                        {w.presidential.toLocaleString()}
                                    </span>
                                    <span className="w-12 text-right shrink-0 text-[11px] text-[#666] num">
                                        {w.offCycle.toLocaleString()}
                                    </span>
                                    <span className="w-12 text-right shrink-0 text-xs font-bold num text-[#008fd5]">
                                        {w.consistency}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty / loading / error states */}
                {loadError && (
                    <div className="text-center text-[#c73a1d] text-xs px-6 py-6">
                        Couldn&apos;t load historical turnout data.
                    </div>
                )}
                {!loadError && !data && (
                    <div className="text-center text-[#999] text-xs px-6 py-6">Loading turnout history…</div>
                )}
                {!loadError && data && profile && profile.wards.length === 0 && (
                    <div className="text-center text-[#999] text-xs px-6 py-8 leading-relaxed flex flex-col items-center gap-2">
                        <Info className="w-4 h-4" />
                        No wards with both presidential and spring turnout in this scope. Turnout history
                        currently covers Madison wards — try a Madison district or county-wide.
                    </div>
                )}
            </div>
        </div>
    );
}
