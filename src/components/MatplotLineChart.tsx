import React, { useState, useId } from 'react';

export interface SeriesData {
  name: string;
  color: string;
  strokeWidth?: number;
  data: number[];
}

export interface RefLine {
  type: 'horizontal' | 'vertical';
  value: number;
  label: string;
  color: string;
  dash?: string;
}

interface MatplotLineChartProps {
  title?: string;
  xLabels: string[];
  xAxisTitle?: string;
  yAxisTitle?: string;
  series: SeriesData[];
  refLines?: RefLine[];
  yRange?: [number, number];
  height?: number;
}

export const MatplotLineChart: React.FC<MatplotLineChartProps> = ({
  title,
  xLabels,
  xAxisTitle,
  yAxisTitle,
  series,
  refLines = [],
  yRange,
  height = 240,
}) => {
  const chartId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const n = xLabels.length;
  if (n === 0) return null;

  // Calculate y bounds
  let minY = Infinity;
  let maxY = -Infinity;

  series.forEach((s) => {
    s.data.forEach((val) => {
      if (!isNaN(val)) {
        if (val < minY) minY = val;
        if (val > maxY) maxY = val;
      }
    });
  });

  refLines.forEach((r) => {
    if (r.type === 'horizontal') {
      if (r.value < minY) minY = r.value;
      if (r.value > maxY) maxY = r.value;
    }
  });

  if (yRange) {
    minY = Math.min(minY, yRange[0]);
    maxY = Math.max(maxY, yRange[1]);
  }

  // Padding
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const yPadding = (maxY - minY) * 0.08 || 0.5;
  const computedMinY = yRange ? yRange[0] : minY - yPadding;
  const computedMaxY = yRange ? yRange[1] : maxY + yPadding;
  const ySpan = computedMaxY - computedMinY || 1;

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = height;
  const padLeft = 65;
  const padRight = 30;
  const padTop = title ? 35 : 20;
  const padBottom = 45;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getX = (i: number) => padLeft + (i / Math.max(n - 1, 1)) * plotWidth;
  const getY = (val: number) =>
    padTop + plotHeight - ((val - computedMinY) / ySpan) * plotHeight;

  // Grid steps (approx 4-5 horizontal lines)
  const yTicks: number[] = [];
  const numYTicks = 5;
  for (let step = 0; step <= numYTicks; step++) {
    yTicks.push(computedMinY + (step / numYTicks) * ySpan);
  }

  // X ticks (e.g. 5-7 evenly spaced points)
  const xTickIndices: number[] = [];
  const numXTicks = Math.min(6, n);
  for (let i = 0; i < numXTicks; i++) {
    const idx = Math.round((i / (numXTicks - 1 || 1)) * (n - 1));
    if (!xTickIndices.includes(idx)) {
      xTickIndices.push(idx);
    }
  }

  // Build SVG polyline paths
  const paths = series.map((s) => {
    const pts = s.data.map((val, idx) => `${getX(idx).toFixed(1)},${getY(val).toFixed(1)}`);
    return {
      ...s,
      pathStr: pts.join(' '),
    };
  });

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

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div className="w-full bg-white border border-slate-200 rounded-lg p-3 my-3 shadow-xs">
      {/* Legend & Title */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1">
        <div>
          {title && <h4 className="text-sm font-semibold text-slate-800">{title}</h4>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-1.5 font-medium text-slate-600">
              <span
                className="w-3 h-0.5 inline-block rounded-xs"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.name}</span>
            </div>
          ))}
          {refLines.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 font-medium text-slate-500">
              <span
                className="w-3 border-t-2 border-dashed inline-block"
                style={{ borderColor: r.color }}
              />
              <span>{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto block select-none cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Background */}
          <rect
            x={padLeft}
            y={padTop}
            width={plotWidth}
            height={plotHeight}
            fill="#ffffff"
            stroke="#cbd5e1"
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
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {tick > 100 ? tick.toFixed(0) : tick > 10 ? tick.toFixed(1) : tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* X ticks */}
          {xTickIndices.map((idx) => {
            const x = getX(idx);
            const label = xLabels[idx] || '';
            const displayLabel = label.length > 11 ? label.slice(5) : label;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={padTop + plotHeight}
                  x2={x}
                  y2={padTop + plotHeight + 4}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padTop + plotHeight + 16}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="sans-serif"
                >
                  {displayLabel}
                </text>
              </g>
            );
          })}

          {/* Y Axis Label */}
          {yAxisTitle && (
            <text
              transform={`rotate(-90 ${padLeft - 45} ${padTop + plotHeight / 2})`}
              x={padLeft - 45}
              y={padTop + plotHeight / 2}
              textAnchor="middle"
              fill="#475569"
              fontSize="11"
              fontWeight="500"
              fontFamily="sans-serif"
            >
              {yAxisTitle}
            </text>
          )}

          {/* X Axis Label */}
          {xAxisTitle && (
            <text
              x={padLeft + plotWidth / 2}
              y={padTop + plotHeight + 36}
              textAnchor="middle"
              fill="#475569"
              fontSize="11"
              fontWeight="500"
              fontFamily="sans-serif"
            >
              {xAxisTitle}
            </text>
          )}

          {/* Ref Lines */}
          {refLines.map((r, i) => {
            if (r.type === 'horizontal') {
              const y = getY(r.value);
              return (
                <line
                  key={i}
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + plotWidth}
                  y2={y}
                  stroke={r.color}
                  strokeWidth="1.5"
                  strokeDasharray={r.dash || '4 4'}
                />
              );
            }
            if (r.type === 'vertical') {
              // find x index or value
              const xVal = r.value;
              const xPos = padLeft + (xVal / (n - 1 || 1)) * plotWidth;
              return (
                <line
                  key={i}
                  x1={xPos}
                  y1={padTop}
                  x2={xPos}
                  y2={padTop + plotHeight}
                  stroke={r.color}
                  strokeWidth="1.5"
                  strokeDasharray={r.dash || '4 4'}
                />
              );
            }
            return null;
          })}

          {/* Data Lines */}
          {paths.map((s) => (
            <polyline
              key={s.name}
              fill="none"
              stroke={s.color}
              strokeWidth={s.strokeWidth || 1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.pathStr}
            />
          ))}

          {/* Hover indicator */}
          {hoverIndex !== null && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padTop}
                x2={getX(hoverIndex)}
                y2={padTop + plotHeight}
                stroke="#334155"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {series.map((s) => {
                const val = s.data[hoverIndex];
                if (val === undefined || isNaN(val)) return null;
                const x = getX(hoverIndex);
                const y = getY(val);
                return (
                  <circle
                    key={s.name}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 bg-slate-900/90 text-white text-xs px-2.5 py-1.5 rounded-md shadow-md backdrop-blur-xs z-10"
            style={{
              left: `${Math.min(
                Math.max((getX(hoverIndex) / svgWidth) * 100, 10),
                90
              )}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-slate-300 pb-0.5 border-b border-slate-700 mb-1">
              {xLabels[hoverIndex]}
            </div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.name}:</span>
                </span>
                <span className="font-mono font-medium">
                  {s.data[hoverIndex] !== undefined
                    ? s.data[hoverIndex] > 50
                      ? s.data[hoverIndex].toFixed(1)
                      : s.data[hoverIndex].toFixed(2)
                    : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
