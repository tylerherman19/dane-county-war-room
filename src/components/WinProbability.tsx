'use client';

import { Card, CardContent } from '@/components/ui/card';

interface WinProbabilityProps {
    probability: number;
    candidateName: string;
}

export function WinProbability({ probability, candidateName }: WinProbabilityProps) {
    const circumference = 2 * Math.PI * 90;
    const offset = circumference - (probability / 100) * circumference;

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                    Win Probability
                </h3>
                <div className="flex flex-col items-center">
                    <div className="relative w-48 h-48">
                        <svg className="transform -rotate-90 w-48 h-48">
                            <circle
                                cx="96"
                                cy="96"
                                r="90"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                className="text-slate-700"
                            />
                            <circle
                                cx="96"
                                cy="96"
                                r="90"
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={offset}
                                className="text-blue-500 transition-all duration-1000 ease-out"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <div className="text-6xl font-bold text-white">{probability}%</div>
                            <div className="text-sm text-slate-400 mt-1">Chance of</div>
                            <div className="text-sm text-slate-400">Victory</div>
                        </div>
                    </div>
                    <p className="text-slate-300 mt-4 text-center text-sm">
                        {candidateName}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
