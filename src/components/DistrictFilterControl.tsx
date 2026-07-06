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
            <div className={`flex items-center gap-2 bg-white border rounded-[3px] shadow-[0_1px_6px_rgba(0,0,0,0.15)] px-3 py-2 ${filter ? 'border-[#008fd5]' : 'border-[#cccccc]'}`}>
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${filter ? 'text-[#008fd5]' : 'text-[#999]'}`} />
                <select
                    className="flex-1 min-w-0 bg-transparent text-sm text-[#222] focus:outline-none cursor-pointer"
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
                        className="shrink-0 text-[#999] hover:text-[#222] transition-colors"
                        title="Clear district filter"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}
