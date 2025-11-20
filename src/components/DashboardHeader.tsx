'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardHeaderProps {
    electionName: string;
    electionDate: string;
    lastUpdated: string;
    reportingPercentage: number;
}

export function DashboardHeader({
    electionName,
    electionDate,
    lastUpdated,
    reportingPercentage
}: DashboardHeaderProps) {
    const [soundEnabled, setSoundEnabled] = useState(false);

    return (
        <div className="border-b border-zinc-800 bg-zinc-950 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-5xl font-bold text-white mb-2">{electionName}</h1>
                        <p className="text-2xl text-zinc-400">{new Date(electionDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</p>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="bg-zinc-900 border-zinc-700 hover:bg-zinc-800"
                    >
                        {soundEnabled ? (
                            <Bell className="h-5 w-5 text-blue-400" />
                        ) : (
                            <BellOff className="h-5 w-5 text-zinc-500" />
                        )}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <p className="text-sm text-zinc-400 mb-1">Last Updated</p>
                            <p className="text-3xl font-bold text-white">
                                {new Date(lastUpdated).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                })}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900 border-zinc-800">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-zinc-400">Reporting Units</p>
                                <p className="text-3xl font-bold text-white">{reportingPercentage.toFixed(1)}%</p>
                            </div>
                            <Progress value={reportingPercentage} className="h-3" />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
