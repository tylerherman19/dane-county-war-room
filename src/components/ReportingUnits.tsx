'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ReportingUnit {
    name: string;
    registeredVoters: number;
    hasReported: boolean;
}

interface ReportingUnitsProps {
    totalUnits: number;
    reportedUnits: number;
    outstandingUnits: ReportingUnit[];
}

export function ReportingUnits({ totalUnits, reportedUnits, outstandingUnits }: ReportingUnitsProps) {
    const percentage = (reportedUnits / totalUnits) * 100;
    const top20Outstanding = outstandingUnits
        .filter(u => !u.hasReported)
        .sort((a, b) => b.registeredVoters - a.registeredVoters)
        .slice(0, 20);

    return (
        <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-3xl text-white">Reporting Units</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-zinc-400 text-lg">Units Reporting</span>
                        <span className="text-5xl font-bold text-white">
                            {reportedUnits} <span className="text-3xl text-zinc-500">/ {totalUnits}</span>
                        </span>
                    </div>
                    <Progress value={percentage} className="h-4" />
                </div>

                <div>
                    <h3 className="text-xl font-semibold text-white mb-4">
                        Top 20 Largest Wards Still Outstanding
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {top20Outstanding.map((unit, idx) => (
                            <div
                                key={idx}
                                className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className="bg-zinc-900 text-zinc-300 border-zinc-700">
                                        #{idx + 1}
                                    </Badge>
                                    <span className="text-white font-medium">{unit.name}</span>
                                </div>
                                <span className="text-zinc-400">
                                    {unit.registeredVoters.toLocaleString()} voters
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
