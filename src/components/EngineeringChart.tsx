import React, { useState } from 'react';

export interface ChartSeries {
  name: string;
  color: string;
  strokeWidth?: number;
  data: (number | null)[];
  unit?: string;
}

export interface ThresholdLine {
  value: number;
  label: string;
  color: string;
  dash?: string;
}

interface EngineeringChartProps {
  title: string;
  subtitle?: string;
  xLabels: string[];
  xAxisTitle?: string;
  yAxisTitle?: string;
  series: ChartSeries[];
  thresholds?: ThresholdLine[];
  height?: number;
  yMin?: number;
  yMax?: number;
  showMissingBand?: boolean;
}

export const EngineeringChart: React.FC<EngineeringChartProps> = ({
  title,
  subtitle,
  xLabels,
  xAxisTitle = 'Time (Days)',
  yAxisTitle,
  series,
  thresholds = [],
  height = 260,
  yMin,
  yMax,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const n = xLabels.length;
  if (n === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center text-slate-400 text-sm">
        No data available for chart
      </div>
    );
  }

  // Determine Y range
  let computedMin = Infinity;
  let computedMax = -Infinity;

  for (const s of series) {
    for (const val of s.data) {
      if (val !== null && !isNaN(val)) {
        if (val < computedMin) computedMin = val;
        if (val > computedMax) computedMax = val;
      }
    }
  }

  for (const t of thresholds) {
    if (t.value < computedMin) computedMin = t.value;
    if (t.value > computedMax) computedMax = t.value;
  }

  if (yMin !== undefined) computedMin = yMin;
  if (yMax !== undefined) computedMax = yMax;

  if (computedMin === Infinity || computedMax === -Infinity) {
    computedMin = 0;
    computedMax = 100;
  }

  if (computedMin === computedMax) {
    computedMin -= 1;
    computedMax += 1;
  }

  const padding = (computedMax - computedMin) * 0.1 || 1;
  const finalMin = yMin !== undefined ? yMin : computedMin - padding;
  const finalMax = yMax !== undefined ? yMax : computedMax + padding;
  const ySpan = finalMax - finalMin || 1;

  // SVG dimensions
  const svgWidth = 850;
  const svgHeight = height;
  const padLeft = 65;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 45;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getX = (i: number) => padLeft + (i / Math.max(n - 1, 1)) * plotWidth;
  const getY = (val: number) => padTop + plotHeight - ((val - finalMin) / ySpan) * plotHeight;

  // Grid ticks
  const numYTicks = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= numYTicks; i++) {
    yTicks.push(finalMin + (i / numYTicks) * ySpan);
  }

  const numXTicks = Math.min(8, n);
  const xTickIndices: number[] = [];
  for (let i = 0; i < numXTicks; i++) {
    const idx = Math.round((i / (numXTicks - 1 || 1)) * (n - 1));
    if (!xTickIndices.includes(idx)) xTickIndices.push(idx);
  }

  // Polyline generator supporting disconnected null intervals
  const generatePaths = (data: (number | null)[]) => {
    const segments: string[] = [];
    let currentSegment: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      if (val === null || isNaN(val)) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment.join(' '));
          currentSegment = [];
        }
      } else {
        currentSegment.push(`${getX(i).toFixed(1)},${getY(val).toFixed(1)}`);
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment.join(' '));
    }
    return segments;
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    if (mouseX >= padLeft && mouseX <= padLeft + plotWidth) {
      const ratio = (mouseX - padLeft) / plotWidth;
      const idx = Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))));
      setHoverIndex(idx);
    } else {
      setHoverIndex(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur-md transition-all">
      {/* Title & Legend Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            {title}
          </h4>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 font-medium text-slate-300">
              <span className="w-3.5 h-1 rounded-sm inline-block" style={{ backgroundColor: s.color }} />
              <span>{s.name}</span>
            </div>
          ))}
          {thresholds.map((t, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-slate-400 font-medium">
              <span
                className="w-3.5 border-t-2 border-dashed inline-block"
                style={{ borderColor: t.color }}
              />
              <span>{t.label} ({t.value})</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Plot background */}
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="#0b1329"
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* Horizontal Grid lines */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tick >= 100 ? tick.toFixed(0) : tick >= 10 ? tick.toFixed(1) : tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* X Grid & Ticks */}
          {xTickIndices.map((idx) => {
            const x = getX(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={padTop + plotHeight}
                  x2={x}
                  y2={padTop + plotHeight + 5}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padTop + plotHeight + 18}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {xLabels[idx]}
                </text>
              </g>
            );
          })}

          {/* Y Axis Title */}
          {yAxisTitle && (
            <text
              transform={`rotate(-90 ${padLeft - 45} ${padTop + plotHeight / 2})`}
              x={padLeft - 45}
              y={padTop + plotHeight / 2}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {yAxisTitle}
            </text>
          )}

          {/* X Axis Title */}
          {xAxisTitle && (
            <text
              x={padLeft + plotWidth / 2}
              y={padTop + plotHeight + 36}
              textAnchor="middle"
              fill="#94a3b8"
              fontSize="11"
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {xAxisTitle}
            </text>
          )}

          {/* Threshold Lines */}
          {thresholds.map((t, idx) => {
            const y = getY(t.value);
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke={t.color}
                  strokeWidth="1.5"
                  strokeDasharray={t.dash || '4 3'}
                />
              </g>
            );
          })}

          {/* Data Lines */}
          {series.map((s) => {
            const segments = generatePaths(s.data);
            return (
              <g key={s.name}>
                {segments.map((pts, segIdx) => (
                  <polyline
                    key={segIdx}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.strokeWidth || 2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={pts}
                  />
                ))}
              </g>
            );
          })}

          {/* Hover Crosshair */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padTop}
                x2={getX(hoverIndex)}
                y2={padTop + plotHeight}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              {series.map((s) => {
                const val = s.data[hoverIndex];
                if (val === null || isNaN(val)) return null;
                return (
                  <circle
                    key={s.name}
                    cx={getX(hoverIndex)}
                    cy={getY(val)}
                    r="4.5"
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 bg-slate-950/95 border border-slate-700 text-white text-xs px-3 py-2 rounded-lg shadow-2xl backdrop-blur-md z-20"
            style={{
              left: `${Math.min(Math.max((getX(hoverIndex) / svgWidth) * 100, 12), 88)}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-cyan-400 pb-1 border-b border-slate-800 flex items-center justify-between gap-4">
              <span>Day {xLabels[hoverIndex]}</span>
            </div>
            <div className="mt-1.5 space-y-1">
              {series.map((s) => {
                const val = s.data[hoverIndex];
                return (
                  <div key={s.name} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                      <span>{s.name}:</span>
                    </span>
                    <span className="font-mono font-bold text-white">
                      {val !== null ? (
                        `${val > 100 ? val.toFixed(1) : val.toFixed(2)}${s.unit ? ' ' + s.unit : ''}`
                      ) : (
                        <span className="text-amber-400 font-sans italic text-[11px]">MISSING (EKSIK)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
