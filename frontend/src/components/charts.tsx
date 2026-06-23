"use client";
// Lightweight inline SVG charts for the organizer dashboard.

export function Sparkline({
  values,
  color = "rgb(var(--accent))",
  width = 96,
  height = 32,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1 || 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  const id = "sl" + values.length + Math.round(max);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} />
    </svg>
  );
}

export function Donut({
  segments,
  size = 168,
  thickness = 22,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={thickness} />
        {segments.map((seg, i) => {
          const len = (seg.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

export function BarChart({
  bars,
  height = 200,
  formatValue,
}: {
  bars: { l: string; v: number }[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.v), 1);
  const niceMax = Math.ceil(max / 10) * 10;
  const gridLines = [1, 0.66, 0.33, 0];
  const labelStep = Math.ceil(bars.length / 8);

  return (
    <div className="flex gap-3">
      {/* Y axis */}
      <div className="flex flex-col justify-between py-1 text-right text-[0.65rem] text-faint" style={{ height }}>
        {gridLines.map((g) => (
          <span key={g}>{formatValue ? formatValue(niceMax * g) : Math.round(niceMax * g)}</span>
        ))}
      </div>

      {/* Plot */}
      <div className="relative flex-1">
        {/* gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between" style={{ height }}>
          {gridLines.map((g) => (
            <span key={g} className="block h-px w-full bg-line" />
          ))}
        </div>

        {/* bars */}
        <div className="relative flex items-end justify-between gap-[3px]" style={{ height }}>
          {bars.map((b, i) => (
            <div key={i} className="group/bar flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-ink/[0.14] transition-colors duration-200 hover:bg-accent"
                style={{ height: `${(b.v / niceMax) * 100}%`, minWidth: 3 }}
                title={`${b.l}: ${formatValue ? formatValue(b.v) : b.v}`}
              />
            </div>
          ))}
        </div>

        {/* X labels */}
        <div className="mt-2 flex justify-between gap-[3px]">
          {bars.map((b, i) => (
            <span key={i} className="flex-1 text-center text-[0.65rem] text-faint">
              {i % labelStep === 0 ? b.l : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
