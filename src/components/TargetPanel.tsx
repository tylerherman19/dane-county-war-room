'use client';

import { useEffect, useMemo, useState } from 'react';
import { Target, Download, Users, MapPin, Info } from 'lucide-react';
import { getDormantPoolByWard } from '@/lib/dormant-voter-data';
import { buildTargets, TargetTier } from '@/lib/target-data';
import { DistrictFilter, DistrictKind, getDistrictOptions, getWardsInDistrict, districtLabel } from '@/lib/districts';
import { toCsv, downloadCsv, fileSlug } from '@/lib/csv';
import { CoalitionUpdate } from './CoalitionPanel';

export interface TargetUpdate {
    scoreByWard: Record<string, number> | null;
    label: string | null;
}

interface TargetPanelProps {
    coalition: CoalitionUpdate;
    districtFilter: DistrictFilter | null;
    onDistrictChange: (f: DistrictFilter | null) => void;
    onTargetUpdate: (u: TargetUpdate) => void;
    /** Drop the retained coalition, returning to raw-dormant Canvass ranking. */
    onClearCoalition: () => void;
}

const TIER_STYLE: Record<TargetTier, string> = {
    HIGH: 'border-[#fc4f30] text-[#c73a1d]',
    MEDIUM: 'border-[#e5ae38] text-[#a16207]',
    LOW: 'border-[#cccccc] text-[#666]',
};

const DISTRICT_VALUE_SEP = ':';

export default function TargetPanel({
    coalition,
    districtFilter,
    onDistrictChange,
    onTargetUpdate,
    onClearCoalition,
}: TargetPanelProps) {
    const [dormantPool, setDormantPool] = useState<Record<string, number> | null>(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        getDormantPoolByWard()
            .then(setDormantPool)
            .catch(() => setLoadError(true));
    }, []);

    const districtWardKeys = useMemo(
        () => (districtFilter ? getWardsInDistrict(districtFilter) : null),
        [districtFilter]
    );

    const result = useMemo(() => {
        if (!dormantPool) return null;
        return buildTargets({
            dormantPool,
            coalitionByWard: coalition.coalitionByWard,
            districtWardKeys,
        });
    }, [dormantPool, coalition.coalitionByWard, districtWardKeys]);

    const scopeLabel = districtFilter ? districtLabel(districtFilter) : 'All wards (county)';
    const overlayLabel = result?.mode === 'MOBILIZE' ? 'Mobilization score' : 'Canvass priority';

    // Push the score map to the choropleth overlay whenever it changes.
    useEffect(() => {
        if (!result || result.wards.length === 0) {
            onTargetUpdate({ scoreByWard: null, label: null });
            return;
        }
        onTargetUpdate({ scoreByWard: result.scoreByWard, label: `${overlayLabel} · ${scopeLabel}` });
    }, [result, overlayLabel, scopeLabel, onTargetUpdate]);

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
        if (!result || result.wards.length === 0) return;
        const headers = ['Rank', 'Ward', 'Ward #', 'Dormant voters', 'Base support %', 'Target score', 'Tier'];
        const rows = result.wards.map((w, i) => [
            i + 1,
            w.displayName,
            w.wardNumber,
            w.dormantPool,
            w.baseStrength === null ? '' : w.baseStrength.toFixed(1),
            w.score,
            w.tier,
        ]);
        const csv = toCsv(headers, rows);
        const stamp = new Date().toISOString().slice(0, 10);
        const name = `war-room-targets-${fileSlug(scopeLabel)}-${result.mode.toLowerCase()}-${stamp}`;
        downloadCsv(name, csv);
    }

    const selectValue = districtFilter ? `${districtFilter.kind}${DISTRICT_VALUE_SEP}${districtFilter.num}` : '';

    return (
        <div className="h-full bg-white flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Intro */}
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222] mb-1 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Turf Targeting
                    </h3>
                    <p className="text-xs text-[#666]">
                        Ranks wards for door-knocking by dormant voter pool — people who vote in April
                        finals but skip the primary. Build a slate in Coalition mode to weight it toward
                        <span className="font-semibold text-[#222]"> your</span> dormant voters.
                    </p>
                </div>

                {/* Coalition-bridge status */}
                <div className={`border rounded-[3px] p-3 ${
                    result?.mode === 'MOBILIZE'
                        ? 'border-[#008fd5] bg-[#f2f9fd]'
                        : 'border-[#e0e0e0] bg-[#fafafa]'
                }`}>
                    <div className="flex items-start gap-2">
                        <Users className={`w-4 h-4 shrink-0 mt-0.5 ${result?.mode === 'MOBILIZE' ? 'text-[#008fd5]' : 'text-[#999]'}`} />
                        {result?.mode === 'MOBILIZE' ? (
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-bold text-[#222]">Mobilize mode</div>
                                    <button
                                        onClick={onClearCoalition}
                                        className="shrink-0 text-[10px] text-[#666] hover:text-[#c73a1d] transition-colors"
                                        title="Drop the coalition weighting and rank by raw dormant pool"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="text-[11px] text-[#666] mt-0.5">
                                    Weighting by <span className="font-semibold">{coalition.label ?? 'your coalition'}</span>.
                                    Score = dormant pool × base support. Top wards are your softest turnout.
                                </div>
                            </div>
                        ) : (
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-[#222]">Canvass mode</div>
                                <div className="text-[11px] text-[#666] mt-0.5">
                                    Ranking by raw dormant pool. Add candidates in <span className="font-semibold">Coalition</span> mode
                                    to target your own voters instead.
                                </div>
                            </div>
                        )}
                    </div>
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
                {result && result.wards.length > 0 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#222]">Target Universe</h3>
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
                                <div className="text-2xl font-bold text-[#222] num">{result.totalDormant.toLocaleString()}</div>
                                <div className="text-[10px] text-[#999]">dormant voters in scope</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-[#222] num">{result.wards.length}</div>
                                <div className="text-[10px] text-[#999]">targetable wards</div>
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] text-[#999]">
                            Map shades each ward by {overlayLabel.toLowerCase()} — green high, red low.
                        </div>
                    </div>
                )}

                {/* Ranked ward list */}
                {result && result.wards.length > 0 && (
                    <div className="border border-[#e0e0e0] rounded-[3px] bg-white overflow-hidden">
                        <div className="px-3 py-2 border-b border-[#e0e0e0] bg-[#fafafa] flex items-center text-[10px] font-bold uppercase tracking-[0.06em] text-[#999]">
                            <span className="w-5 text-right shrink-0">#</span>
                            <span className="flex-1 pl-2">Ward</span>
                            <span className="w-14 text-right shrink-0">Dormant</span>
                            {result.mode === 'MOBILIZE' && <span className="w-10 text-right shrink-0">Base</span>}
                            <span className="w-10 text-right shrink-0">Score</span>
                        </div>
                        <div className="divide-y divide-[#eeeeee] max-h-[420px] overflow-y-auto">
                            {result.wards.map((w, i) => (
                                <div key={w.wardKey} className="px-3 py-2 flex items-center">
                                    <span className="w-5 text-right shrink-0 text-[10px] text-[#999] num">{i + 1}</span>
                                    <div className="flex-1 min-w-0 pl-2">
                                        <div className="text-xs text-[#222] truncate">{w.displayName}</div>
                                        <span className={`inline-block mt-0.5 text-[9px] font-bold px-1 py-px rounded-[2px] border ${TIER_STYLE[w.tier]}`}>
                                            {w.tier}
                                        </span>
                                    </div>
                                    <span className="w-14 text-right shrink-0 text-[11px] text-[#666] num">
                                        {w.dormantPool.toLocaleString()}
                                    </span>
                                    {result.mode === 'MOBILIZE' && (
                                        <span className="w-10 text-right shrink-0 text-[11px] text-[#666] num">
                                            {w.baseStrength === null ? '—' : `${w.baseStrength.toFixed(0)}%`}
                                        </span>
                                    )}
                                    <span className="w-10 text-right shrink-0 text-xs font-bold num text-[#008fd5]">
                                        {w.score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty / loading / error states */}
                {loadError && (
                    <div className="text-center text-[#c73a1d] text-xs px-6 py-6">
                        Couldn&apos;t load dormant voter history.
                    </div>
                )}
                {!loadError && !dormantPool && (
                    <div className="text-center text-[#999] text-xs px-6 py-6">Loading dormant voter history…</div>
                )}
                {!loadError && dormantPool && result && result.wards.length === 0 && (
                    <div className="text-center text-[#999] text-xs px-6 py-8 leading-relaxed flex flex-col items-center gap-2">
                        <Info className="w-4 h-4" />
                        {result.mode === 'MOBILIZE'
                            ? 'No wards where your coalition and dormant-voter data overlap in this scope. Try a wider scope or a different slate.'
                            : 'No dormant voter data for this scope.'}
                    </div>
                )}
            </div>
        </div>
    );
}
