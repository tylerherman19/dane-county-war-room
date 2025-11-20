'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface SimulatorProps {
    onSimulate?: (values: { madison: number; suburbs: number; rural: number }) => void;
}

export function WhatIfSimulator({ onSimulate }: SimulatorProps) {
    const [madison, setMadison] = useState(100);
    const [suburbs, setSuburbs] = useState(100);
    const [rural, setRural] = useState(0);

    const handleChange = () => {
        onSimulate?.({ madison, suburbs, rural });
    };

    return (
        <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
                <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-6">
                    What-If Simulator
                </h3>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm text-slate-300">Madison Turnout</label>
                            <span className="text-sm font-semibold text-white">{madison}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={madison}
                            onChange={(e) => {
                                setMadison(Number(e.target.value));
                                handleChange();
                            }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm text-slate-300">Suburbs Turnout</label>
                            <span className="text-sm font-semibold text-white">{suburbs}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={suburbs}
                            onChange={(e) => {
                                setSuburbs(Number(e.target.value));
                                handleChange();
                            }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-sm text-slate-300">Rural Shift</label>
                            <span className="text-sm font-semibold text-white">{rural}%</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={rural}
                            onChange={(e) => {
                                setRural(Number(e.target.value));
                                handleChange();
                            }}
                            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
