'use client';

import { Card, CardContent } from '@/components/ui/card';

interface RemainingVoteItem {
    area: string;
    votesLeft: string;
    lean: string;
}

interface RemainingVoteProps {
    items: RemainingVoteItem[];
}

export function RemainingVote({ items }: RemainingVoteProps) {
    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                    Remaining Vote
                </h3>
                <div className="space-y-3">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                            <div>
                                <div className="text-white font-medium">{item.area}</div>
                                <div className="text-sm text-slate-400">{item.lean}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-white font-semibold">{item.votesLeft}</div>
                                <div className="text-xs text-slate-500">left</div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
