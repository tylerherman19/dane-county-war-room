'use client';

import { MapPin, X } from 'lucide-react';
import { DistrictFilter, districtLabel, getDistrictOptions } from '@/lib/districts';

interface DistrictFilterControlProps {
    filter: DistrictFilter | null;
    onChange: (filter: DistrictFilter | null) => void;
}

/** Seat picker: scopes the dashboard to one district's wards for targeting. */
export default function DistrictFilterControl({ filter, onChange }: DistrictFilterControlProps) {
    const options = getDistrictOptions();
    const value = filter ? `${filter.kind}:${filter.num}` : '';

    return (
        <div className="absolute top-[86px] md:top-[92px] left-2 md:left-16 z-[900] w-[calc(100%-100px)] md:w-80 max-w-sm">
            <div className={`flex items-center gap-2 bg-slate-900/90 backdrop-blur border rounded-lg shadow-xl px-3 py-2 ${filter ? 'border-blue-500/60' : 'border-slate-700'}`}>
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${filter ? 'text-blue-400' : 'text-slate-500'}`} />
                <select
                    className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer [&>optgroup]:bg-slate-900 [&>option]:bg-slate-900"
                    value={value}
                    onChange={e => {
                        const v = e.target.value;
                        if (!v) { onChange(null); return; }
                        const [kind, num] = v.split(':');
                        onChange({ kind: kind as DistrictFilter['kind'], num });
                    }}
                    title={filter ? districtLabel(filter) : 'Scope the dashboard to one seat'}
                >
                    <option value="">All of Dane County</option>
                    {options.map(group => (
                        <optgroup key={group.kind} label={group.label}>
                            {group.districts.map(num => (
                                <option key={num} value={`${group.kind}:${num}`}>
                                    {group.label} District {num}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {filter && (
                    <button
                        onClick={() => onChange(null)}
                        className="shrink-0 text-slate-500 hover:text-white transition-colors"
                        title="Clear district filter"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
