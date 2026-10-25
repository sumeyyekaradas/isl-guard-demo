import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Sliders,
  Download,
  RotateCcw,
  Info,
  Compass,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { calculateTracerCurve, downloadCSV } from '../utils/islSimulation';
import { WellConfig } from '../types/islData';
import { WELLS } from '../data/wellfieldData';
import { EngineeringChart } from '../components/EngineeringChart';

interface TracerTestViewProps {
  wells?: WellConfig[];
}

export const TracerTestView: React.FC<TracerTestViewProps> = ({ wells }) => {
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

  const injectorWell = useMemo(
    () => activeWells.find((w) => w.type === 'enjeksiyon') || activeWells[0],
    [activeWells]
  );

  const targetWells = useMemo(
    () => activeWells.filter((w) => w.type === 'cekim' || w.type === 'izleme'),
    [activeWells]
  );

  // Interactive Tracer Simulation Parameters (preserving original GitHub app.py logic)
  const [targetWellId, setTargetWellId] = useState<string>('EXT-01');
  const [durationHours, setDurationHours] = useState<number>(96);
  const [peakSettingHours, setPeakSettingHours] = useState<number>(36);
  const [spreadHours, setSpreadHours] = useState<number>(8);
  const [seed, setSeed] = useState<number>(42);

  const selectedTarget = useMemo(
    () => targetWells.find((w) => w.id === targetWellId) || targetWells[0],
    [targetWells, targetWellId]
  );

  // Exact Euclidean inter-well distance from saha_verileri_lite.json coordinates
  const distanceMeters = useMemo(() => {
    if (!injectorWell || !selectedTarget) return 212.13;
    const dx = selectedTarget.x - injectorWell.x;
    const dy = selectedTarget.y - injectorWell.y;
    return Math.hypot(dx, dy);
  }, [injectorWell, selectedTarget]);

  // Keep peak setting bounded safely within duration
  const effectivePeak = Math.min(peakSettingHours, Math.max(10, durationHours - 6));

  // Compute breakthrough curve using preserved calculateTracerCurve engine
  const tracerResult = useMemo(() => {
    return calculateTracerCurve(durationHours, effectivePeak, spreadHours, seed);
  }, [durationHours, effectivePeak, spreadHours, seed]);

  // Derived hydrogeological transport indicators
  const advectiveVelocityMh =
    tracerResult.peakHour > 0 ? distanceMeters / tracerResult.peakHour : 0;
  const advectiveVelocityMday = advectiveVelocityMh * 24;

  // Early channeling / short-circuit check
  const hasChannelingWarning =
    (tracerResult.firstArrival !== null && tracerResult.firstArrival < 10) ||
    (selectedTarget?.type === 'izleme' && tracerResult.peakValue > 0.1);

  const handleResetDefaults = () => {
    setTargetWellId('EXT-01');
    setDurationHours(96);
    setPeakSettingHours(36);
    setSpreadHours(8);
    setSeed(42);
  };

  const handleExportTracerCSV = () => {
    const headers = [
      'hour',
      'source_well',
      'target_well',
      'interwell_distance_m',
      'relative_concentration_C_C0',
      'above_detection_limit_0_05',
    ];
    const lines = [headers.join(',')];
    for (let i = 0; i < tracerResult.times.length; i++) {
      const t = tracerResult.times[i];
      const c = tracerResult.concentrations[i];
      lines.push(
        [
          t,
          injectorWell?.id || 'INJ-01',
          selectedTarget?.id || targetWellId,
          distanceMeters.toFixed(2),
          c.toFixed(4),
          c > 0.05 ? 1 : 0,
        ].join(',')
      );
    }
    downloadCSV(`isl_guard_tracer_test_${selectedTarget?.id || 'well'}.csv`, lines.join('\n'));
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-cyan-400" />
              Conservative Tracer Breakthrough Simulation
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Inter-well residence time distribution (RTD), preferential pathway screening, and advective pore velocity estimation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Parameters
            </button>
            <button
              type="button"
              onClick={handleExportTracerCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export Breakthrough CSV
            </button>
          </div>
        </div>

        {/* Data Source & Simulation Disclosure */}
        <div className="p-3.5 bg-blue-950/40 border border-blue-900 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong>Simulation Scope Disclosure:</strong> Because <code className="font-mono text-cyan-300">isletme_verileri.csv</code> does not contain physical bromide or fluorescein tracer sensor columns, this module executes the analytical Gaussian breakthrough model from the original prototype anchored to exact Euclidean well-pair distances in <code className="font-mono text-cyan-300">saha_verileri_lite.json</code>.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Inter-Well Distance (L)</span>
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-100">
              {distanceMeters.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">m</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            {injectorWell?.id || 'INJ-01'} &rarr; {selectedTarget?.id}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>First Arrival (C/C0 &gt; 0.05)</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-amber-400">
              {tracerResult.firstArrival !== null ? `${tracerResult.firstArrival}` : 'None'}
            </span>
            {tracerResult.firstArrival !== null && (
              <span className="text-xs font-semibold text-slate-500">hrs</span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            Initial breakthrough detection
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Peak Breakthrough Time</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-cyan-400">
              {tracerResult.peakHour}
            </span>
            <span className="text-xs font-semibold text-slate-500">hrs</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            Peak C/C0: {tracerResult.peakValue.toFixed(3)}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Apparent Pore Velocity</span>
            <Compass className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {advectiveVelocityMh.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-slate-500">m/h</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            {advectiveVelocityMday.toFixed(1)} m/day linear travel
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Integrated Curve Area</span>
            <FlaskConical className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-purple-400">
              {tracerResult.area.toFixed(2)}
            </span>
            <span className="text-xs font-semibold text-slate-500">(C/C0)·h</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            Trapezoidal mass recovery index
          </div>
        </div>
      </div>

      {/* Parameter Control Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-slate-100">
            Tracer Injection &amp; Aquifer Dispersion Controls
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 text-xs">
          {/* Well Pair Selector */}
          <div className="space-y-2">
            <label className="font-semibold text-slate-300 block">
              Observation / Recovery Well
            </label>
            <select
              value={targetWellId}
              onChange={(e) => {
                const nextId = e.target.value;
                setTargetWellId(nextId);
                const nextWell = targetWells.find((w) => w.id === nextId);
                if (nextWell?.type === 'izleme' && peakSettingHours < 48) {
                  setPeakSettingHours(60);
                }
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 font-semibold focus:outline-hidden cursor-pointer"
            >
              {targetWells.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                  {w.id} ({w.type === 'cekim' ? 'Recovery' : 'Perimeter MON'})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Selects target well coordinate from JSON field geometry.
            </p>
          </div>

          {/* Test Duration */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Test Duration</span>
              <span className="font-mono font-bold text-cyan-400">{durationHours} hrs</span>
            </div>
            <input
              type="range"
              min="24"
              max="240"
              step="12"
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Total sampling window in hours.</p>
          </div>

          {/* Mean Travel / Peak Time */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Mean Transit Time</span>
              <span className="font-mono font-bold text-cyan-400">{effectivePeak} hrs</span>
            </div>
            <input
              type="range"
              min="10"
              max={Math.max(18, durationHours - 6)}
              step="2"
              value={effectivePeak}
              onChange={(e) => setPeakSettingHours(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Advective center-of-mass arrival hour.</p>
          </div>

          {/* Longitudinal Dispersion / Spread */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Dispersion Spread (σ)</span>
              <span className="font-mono font-bold text-cyan-400">{spreadHours} hrs</span>
            </div>
            <input
              type="range"
              min="2"
              max="40"
              step="1"
              value={spreadHours}
              onChange={(e) => setSpreadHours(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Hydrodynamic dispersion width of plume.</p>
          </div>

          {/* Sensor Noise Seed */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Analytical Seed</span>
              <span className="font-mono font-bold text-slate-300">#{seed}</span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              step="1"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Deterministic fluorometer sensor noise seed.</p>
          </div>
        </div>

        {/* Hydrogeological Interpretation Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            hasChannelingWarning
              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
              : 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200'
          }`}
        >
          {hasChannelingWarning ? (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div>
            {selectedTarget?.type === 'izleme' ? (
              <span>
                <strong>Perimeter Excursion Diagnostic ({selectedTarget.id}):</strong> Observing tracer arrival at a perimeter monitoring ring well ({distanceMeters.toFixed(0)} m radius) indicates hydraulic escape beyond the corner recovery wells. Increase extraction bleed rate immediately in field operations.
              </span>
            ) : tracerResult.firstArrival !== null && tracerResult.firstArrival < 10 ? (
              <span>
                <strong>Rapid Early Breakthrough Detected ({tracerResult.firstArrival}h):</strong> Very fast arrival between {injectorWell?.id} and {selectedTarget?.id} suggests high-permeability fracture channeling or thief-zone short-circuiting rather than uniform porous-media sweep.
              </span>
            ) : (
              <span>
                <strong>Expected 5-Spot Sweep Profile ({injectorWell?.id} &rarr; {selectedTarget?.id}):</strong> Breakthrough occurs at {tracerResult.firstArrival ?? '-'}h with peak arrival at {tracerResult.peakHour}h, consistent with controlled inter-well advective-dispersive transport inside the production zone.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Breakthrough Curve Chart */}
      <EngineeringChart
        title={`Tracer Breakthrough Curve (${injectorWell?.id || 'INJ-01'} → ${selectedTarget?.id || targetWellId})`}
        subtitle={`Normalized relative tracer concentration (C/C0) over ${durationHours} hours across ${distanceMeters.toFixed(1)} m inter-well path`}
        xLabels={tracerResult.times.map((t) => `${t}h`)}
        xAxisTitle="Elapsed Time Since Tracer Pulse (Hours)"
        yAxisTitle="Relative Concentration (C / C0)"
        yMin={0}
        yMax={1.15}
        series={[
          {
            name: 'Relative Tracer Concentration (C/C0)',
            color: '#22d3ee',
            strokeWidth: 2.5,
            data: tracerResult.concentrations,
          },
        ]}
        thresholds={[
          {
            value: 0.05,
            label: 'First Arrival Detection Threshold (0.05)',
            color: '#f59e0b',
            dash: '4 4',
          },
        ]}
      />

      {/* Hourly Breakthrough Data Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 mb-3">
          Hourly Tracer Breakthrough Data Table
        </h3>
        <div className="overflow-x-auto max-h-72 border border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2 px-3">Elapsed Hour</th>
                <th className="py-2 px-3">Well Pair</th>
                <th className="py-2 px-3">Distance (m)</th>
                <th className="py-2 px-3">Relative Concentration (C/C0)</th>
                <th className="py-2 px-3">Detection Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {tracerResult.times.map((hr, idx) => {
                const conc = tracerResult.concentrations[idx];
                const isPeak = hr === tracerResult.peakHour;
                const isDetected = conc > 0.05;
                return (
                  <tr
                    key={hr}
                    className={`hover:bg-slate-800/40 ${isPeak ? 'bg-cyan-950/30' : ''}`}
                  >
                    <td className="py-1.5 px-3 font-sans text-slate-300">{hr} h</td>
                    <td className="py-1.5 px-3 text-slate-400">
                      {injectorWell?.id || 'INJ-01'} &rarr; {selectedTarget?.id}
                    </td>
                    <td className="py-1.5 px-3 text-slate-400">{distanceMeters.toFixed(1)} m</td>
                    <td className="py-1.5 px-3 text-cyan-400 font-bold">{conc.toFixed(4)}</td>
                    <td className="py-1.5 px-3 font-sans">
                      {isPeak ? (
                        <span className="text-cyan-300 font-bold">Peak Breakthrough</span>
                      ) : isDetected ? (
                        <span className="text-amber-300 font-medium">Tracer Detected (&gt; 0.05)</span>
                      ) : (
                        <span className="text-slate-500">Background (&le; 0.05)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
