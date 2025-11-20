'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    flexRender,
    createColumnHelper,
    SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface WardData {
    wardNumber: string;
    demCandidate: string;
    demVotes: number;
    demPercentage: number;
    totalVotes: number;
    turnoutPercentage: number;
    winner: string;
}

interface MadisonTableProps {
    wardData: WardData[];
}

const columnHelper = createColumnHelper<WardData>();

export function MadisonTable({ wardData }: MadisonTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const columns = useMemo(
        () => [
            columnHelper.accessor('wardNumber', {
                header: ({ column }) => (
                    <button
                        className="flex items-center gap-2 font-semibold text-white hover:text-blue-400"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        Ward
                        <ArrowUpDown className="h-4 w-4" />
                    </button>
                ),
                cell: (info) => (
                    <span className="text-xl font-bold text-white">
                        {info.getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor('demCandidate', {
                header: 'Candidate',
                cell: (info) => (
                    <span className="text-white">{info.getValue()}</span>
                ),
            }),
            columnHelper.accessor('demPercentage', {
                header: ({ column }) => (
                    <button
                        className="flex items-center gap-2 font-semibold text-white hover:text-blue-400"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        Performance
                        <ArrowUpDown className="h-4 w-4" />
                    </button>
                ),
                cell: (info) => {
                    const value = info.getValue();
                    const colorClass = value >= 70 ? 'text-green-400' : value >= 60 ? 'text-blue-400' : 'text-yellow-400';
                    return (
                        <span className={`text-2xl font-bold ${colorClass}`}>
                            {value.toFixed(1)}%
                        </span>
                    );
                },
            }),
            columnHelper.accessor('demVotes', {
                header: 'Votes',
                cell: (info) => (
                    <span className="text-white text-lg">
                        {info.getValue().toLocaleString()}
                    </span>
                ),
            }),
            columnHelper.accessor('turnoutPercentage', {
                header: ({ column }) => (
                    <button
                        className="flex items-center gap-2 font-semibold text-white hover:text-blue-400"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                    >
                        Turnout
                        <ArrowUpDown className="h-4 w-4" />
                    </button>
                ),
                cell: (info) => (
                    <span className="text-white text-lg">
                        {info.getValue().toFixed(1)}%
                    </span>
                ),
            }),
            columnHelper.accessor('winner', {
                header: 'Winner',
                cell: (info) => {
                    const winner = info.getValue();
                    const bgColor = winner.includes('Harris') || winner.includes('Baldwin') || winner.includes('Agard')
                        ? 'bg-blue-900 text-blue-100'
                        : 'bg-red-900 text-red-100';
                    return (
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${bgColor}`}>
                            {winner.split(' ')[0]}
                        </span>
                    );
                },
            }),
        ],
        []
    );

    const table = useReactTable({
        data: wardData,
        columns,
        state: {
            sorting,
        },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-3xl text-white">City of Madison - Ward Results</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <tr key={headerGroup.id} className="border-b border-zinc-800">
                                    {headerGroup.headers.map((header) => (
                                        <th key={header.id} className="px-4 py-3 text-left">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </th>
                                    ))}
                                </tr>
                            ))}
                        </thead>
                        <tbody>
                            {table.getRowModel().rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <td key={cell.id} className="px-4 py-4">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
