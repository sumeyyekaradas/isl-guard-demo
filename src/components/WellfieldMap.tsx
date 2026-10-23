import React, { useState, useMemo } from 'react';
import { WELLS } from '../data/wellfieldData';
import { WellConfig, RawWellRecord } from '../types/islData';
import { MapPin, Info, AlertTriangle } from 'lucide-react';

interface WellfieldMapProps {
  currentScenario: string;
  hasAlert: boolean;
  wells?: WellConfig[];
  currentWellRecords?: RawWellRecord[];
}

export const WellfieldMap: React.FC<WellfieldMapProps> = ({
  currentScenario,
  hasAlert,
  wells,
  currentWellRecords = [],
}) => {
  const activeWells: WellConfig[] = useMemo(() => {
    if (wells && wells.length > 0) return wells;
    return WELLS.map((w) => ({
      id: w.id,
      type: w.type,
      x: w.x,
      y: w.y,
      base_rate: w.base_rate,
    }));
  }, [wells]);

  const [selectedWellId, setSelectedWellId] = useState<string>('INJ-01');

  const selectedWell = useMemo(() => {
    return activeWells.find((w) => w.id === selectedWellId) || activeWells[0] || null;
  }, [activeWells, selectedWellId]);

  const liveRecord = useMemo(() => {
    if (!selectedWell) return null;
    return currentWellRecords.find((r) => r.kuyu_id === selectedWell.id) || null;
  }, [currentWellRecords, selectedWell]);

  const getTypeColor = (type: WellConfig['type']) => {
    switch (type) {
      case 'enjeksiyon':
        return '#06b6d4'; // cyan-500
      case 'cekim':
        return '#10b981'; // emerald-500
      case 'izleme':
        return '#f59e0b'; // amber-500
      case 'alici':
        return '#a855f7'; // purple-500
      default:
        return '#64748b';
    }
  };

  const getTypeName = (type: WellConfig['type']) => {
    switch (type) {
      case 'enjeksiyon':
        return 'Central Injection Well (INJ)';
      case 'cekim':
        return 'Recovery / Extraction Well (EXT)';
      case 'izleme':
        return 'Perimeter Monitoring Well (MON)';
      case 'alici':
        return 'Regional Receiver Well (RCV)';
      default:
        return type;
    }
  };

  const injCount = activeWells.filter((w) => w.type === 'enjeksiyon').length;
  const extCount = activeWells.filter((w) => w.type === 'cekim').length;
  const monCount = activeWells.filter((w) => w.type === 'izleme').length;
  const rcvCount = activeWells.filter((w) => w.type === 'alici').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-3">
        <div>
          <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm sm:text-base">
            <MapPin className="w-4 h-4 text-cyan-400" />
            ISL Wellfield Spatial Geometry (5-Spot Pattern &amp; Monitoring Ring)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Coordinates mapped directly from field configuration JSON ({activeWells.length} configured wells)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
            Injection ({injCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            Extraction ({extCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Monitoring ({monCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
            Receiver ({rcvCount})
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-4">
        {/* Interactive 2D Map SVG */}
        <div className="lg:col-span-2 relative bg-slate-950 border border-slate-800 rounded-xl p-3 overflow-hidden flex items-center justify-center">
          <svg viewBox="0 0 1000 1000" className="w-full max-h-[430px] aspect-square select-none">
            <defs>
              <pattern id="wellfield-grid" width="100" height="100" patternUnits="userSpaceOnUse">
                <path
                  d="M 100 0 L 0 0 0 100"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="1000" height="1000" fill="#070d1e" />
            <rect width="1000" height="1000" fill="url(#wellfield-grid)" />

            {/* Monitoring circle boundary around ISL pattern */}
            <circle
              cx="500"
              cy="500"
              r="250"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="6 6"
              opacity="0.55"
            />
            <text
              x="500"
              y="236"
              textAnchor="middle"
              fill="#fbbf24"
              fontSize="15"
              opacity="0.85"
              fontFamily="sans-serif"
            >
              Monitoring Ring Perimeter (r = 250 m)
            </text>

            {/* In-situ leaching pattern flow vectors (from INJ to EXT) */}
            <line x1="500" y1="500" x2="350" y2="350" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
            <line x1="500" y1="500" x2="650" y2="350" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
            <line x1="500" y1="500" x2="350" y2="650" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
            <line x1="500" y1="500" x2="650" y2="650" stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />

            {/* Anomaly warning plume if alert is active */}
            {hasAlert && (
              <circle
                cx="625"
                cy="716"
                r="72"
                fill="rgba(239, 68, 68, 0.08)"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeDasharray="5 4"
                opacity="0.9"
              >
                <animate attributeName="r" values="60;82;60" dur="3s" repeatCount="indefinite" />
              </circle>
            )}

            {/* Render Wells */}
            {activeWells.map((w) => {
              const isSelected = selectedWell?.id === w.id;
              const col = getTypeColor(w.type);
              const wellRec = currentWellRecords.find((r) => r.kuyu_id === w.id);
              const isMissing = wellRec?.sensor_durumu === 'EKSIK_VERI';
              const isAlertWell =
                hasAlert &&
                ((wellRec?.pH !== undefined && wellRec?.pH !== null && wellRec.pH < 6.0) ||
                  (wellRec?.sulfat_mgL !== undefined && wellRec?.sulfat_mgL !== null && wellRec.sulfat_mgL > 65));

              return (
                <g
                  key={w.id}
                  onClick={() => setSelectedWellId(w.id)}
                  className="cursor-pointer"
                >
                  {isSelected && (
                    <circle
                      cx={w.x}
                      cy={w.y}
                      r="23"
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                    />
                  )}

                  <circle
                    cx={w.x}
                    cy={w.y}
                    r={w.type === 'enjeksiyon' ? 14 : 11}
                    fill={col}
                    stroke={isAlertWell ? '#ef4444' : isMissing ? '#fbbf24' : '#f8fafc'}
                    strokeWidth={isAlertWell || isMissing ? 3 : 2}
                  />

                  <circle cx={w.x} cy={w.y} r="4" fill="#0f172a" />

                  <text
                    x={w.x}
                    y={w.y - 16}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="13"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {w.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Well Inspector Panel */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-100 pb-2.5 border-b border-slate-800">
              Selected Well Telemetry
            </h4>

            {selectedWell ? (
              <div className="mt-3 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Well Identifier:</span>
                  <span className="font-mono font-bold text-cyan-300">
                    {selectedWell.id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Classification:</span>
                  <span className="font-medium text-slate-200">{getTypeName(selectedWell.type)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Coordinates (X, Y):</span>
                  <span className="font-mono text-slate-300">
                    ({selectedWell.x.toFixed(1)} m, {selectedWell.y.toFixed(1)} m)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Nominal Base Flow:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {selectedWell.base_rate > 0 ? `+${selectedWell.base_rate}` : selectedWell.base_rate} m³/h
                  </span>
                </div>

                {liveRecord && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Current Timestep Reading (Day {liveRecord.zaman_gun.toFixed(2)})
                    </div>
                    {liveRecord.sensor_durumu === 'EKSIK_VERI' && (
                      <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 flex items-center gap-1.5 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Sensor Missing Flag (EKSIK_VERI) — Not evaluated as safe</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block font-sans">Flow:</span>
                        <span className="text-cyan-300 font-bold">{liveRecord.debi.toFixed(1)} m³/h</span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block font-sans">Pressure:</span>
                        <span className="text-slate-200 font-bold">
                          {liveRecord.basinç !== null ? `${liveRecord.basinç.toFixed(2)} bar` : 'MISSING'}
                        </span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block font-sans">pH:</span>
                        <span className="text-amber-300 font-bold">
                          {liveRecord.pH !== null ? liveRecord.pH.toFixed(2) : 'MISSING'}
                        </span>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-500 block font-sans">Sulfate:</span>
                        <span className="text-purple-300 font-bold">
                          {liveRecord.sulfat_mgL !== null ? `${liveRecord.sulfat_mgL.toFixed(1)} mg/L` : 'MISSING'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 leading-relaxed">
                  <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                    Hydrogeological Role
                  </div>
                  {selectedWell.type === 'enjeksiyon' && (
                    <p>
                      Delivers lixiviant into the mineralized zone. Excess flow or pressure relative to corner recovery wells disrupts inward containment.
                    </p>
                  )}
                  {selectedWell.type === 'cekim' && (
                    <p>
                      Pumps pregnant leach solution to the surface plant. Combined extraction across EXT-01..04 must maintain an inward hydraulic gradient.
                    </p>
                  )}
                  {selectedWell.type === 'izleme' && (
                    <p>
                      250 m perimeter sentinel well. Drops in pH or spikes in dissolved sulfate provide early warning of lixiviant excursion.
                    </p>
                  )}
                  {selectedWell.type === 'alici' && (
                    <p>
                      Far-field regional observation point verifying background aquifer protection beyond the mining block.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-4">Click any well on the map to inspect parameters.</p>
            )}
          </div>

          <div className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-400">
              Scenario: <strong className="text-slate-200">{currentScenario}</strong>
            </div>
            {hasAlert ? (
              <div className="text-red-400 font-semibold mt-1">
                Excursion warning detected on current timestep
              </div>
            ) : (
              <div className="text-emerald-400 font-medium mt-1">
                Hydraulic containment balanced across wellfield
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
