interface TrendSparklineProps {
    data: number[]; // Array of margins (e.g. [0.3, 0.4, 0.45])
    width?: number;
    height?: number;
}

export default function TrendSparkline({ data, width = 60, height = 20 }: TrendSparklineProps) {
    if (!data || data.length < 2) return null;

    const min = Math.min(...data, 0);
    const max = Math.max(...data, 0.1); // Ensure some height
    const range = max - min || 1;

    // Calculate points
    const points = data.map((val, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    // Determine color based on trend (last vs first)
    const isUp = data[data.length - 1] > data[0];
    const color = isUp ? '#3b82f6' : '#ef4444'; // Blue if trending up, Red if down

    return (
        <svg width={width} height={height} className="overflow-visible">
            {/* Baseline (0 if visible, or just bottom) */}
            {/* <line x1="0" y1={height} x2={width} y2={height} stroke="#334155" strokeWidth="1" /> */}

            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* End dot */}
            <circle
                cx={width}
                cy={height - ((data[data.length - 1] - min) / range) * height}
                r="2"
                fill={color}
            />
        </svg>
    );
}
