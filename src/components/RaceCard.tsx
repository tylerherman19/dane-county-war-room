'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';

interface Candidate {
    candidateName: string;
    votes: number;
    percentage: number;
    party?: string;
}

interface RaceCardProps {
    raceName: string;
    candidates: Candidate[];
    totalVotes: number;
    precinctsReporting: number;
    totalPrecincts: number;
}

const PARTY_COLORS: Record<string, string> = {
    Democratic: '#3b82f6',
    Republican: '#ef4444',
    Nonpartisan: '#8b5cf6',
    Other: '#6b7280'
};

export function RaceCard({
    raceName,
    candidates,
    totalVotes,
    precinctsReporting,
    totalPrecincts
}: RaceCardProps) {
    const reportingPercentage = (precinctsReporting / totalPrecincts) * 100;
    const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes);
    const leader = sortedCandidates[0];
    const runnerUp = sortedCandidates[1];
    const leadDelta = leader && runnerUp ? leader.votes - runnerUp.votes : 0;

    const chartData = sortedCandidates.map(c => ({
        name: c.candidateName.split(' ')[0] + (c.candidateName.split(' ')[1] ? ' ' + c.candidateName.split(' ')[1].charAt(0) + '.' : ''),
        votes: c.votes,
        party: c.party || 'Other'
    }));

    return (
        <Card className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <CardTitle className="text-2xl text-white">{raceName}</CardTitle>
                    <Badge variant="outline" className="bg-zinc-800 text-zinc-300 border-zinc-700">
                        {precinctsReporting}/{totalPrecincts} precincts
                    </Badge>
                </div>
                <Progress value={reportingPercentage} className="h-2 mt-2" />
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {sortedCandidates.map((candidate, idx) => (
                        <div key={idx} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: PARTY_COLORS[candidate.party || 'Other'] }}
                                    />
                                    <span className="text-lg font-semibold text-white">
                                        {candidate.candidateName}
                                    </span>
                                    {idx === 0 && sortedCandidates.length > 1 && (
                                        <Badge className="bg-green-900 text-green-100 border-green-700">
                                            +{leadDelta.toLocaleString()}
                                        </Badge>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-white">
                                        {candidate.percentage.toFixed(1)}%
                                    </p>
                                    <p className="text-sm text-zinc-400">
                                        {candidate.votes.toLocaleString()} votes
                                    </p>
                                </div>
                            </div>
                            <Progress
                                value={candidate.percentage}
                                className="h-3"
                                style={{
                                    // @ts-ignore
                                    '--progress-background': PARTY_COLORS[candidate.party || 'Other']
                                }}
                            />
                        </div>
                    ))}
                </div>

                <div className="mt-6">
                    <ResponsiveContainer width="100%" height={120}>
                        <BarChart data={chartData} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#a1a1aa', fontSize: 12 }} />
                            <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PARTY_COLORS[entry.party]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
