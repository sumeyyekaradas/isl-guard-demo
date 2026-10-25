import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  Play,
  Pause,
  FastForward,
  Cpu,
} from 'lucide-react';
import { calculateTracerCurve, downloadCSV } from '../utils/islSimulation';
import { WellConfig } from '../types/islData';
import { WELLS } from '../data/wellfieldData';
import { EngineeringChart } from '../components/EngineeringChart';

interface TracerTestViewProps {
  wells?: WellConfig[];
  initialTargetWellId?: string | null;
  autoStartSignal?: number;
}

interface TracerLogEvent {
  hour: number;
  type: 'INJECT' | 'ARRIVAL' | 'PEAK' | 'COMPLETE' | 'WARNING';
  message: string;
}

export const TracerTestView: React.FC<TracerTestViewProps> = ({
  wells,
  initialTargetWellId,
  autoStartSignal = 0,
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

  const injectorWell = useMemo(
    () => activeWells.find((w) => w.type === 'enjeksiyon') || activeWells[0],
    [activeWells]
  );

  const targetWells = useMemo(
    () => activeWells.filter((w) => w.type === 'cekim' || w.type === 'izleme'),
    [activeWells]
  );

  // Interactive Tracer Simulation Parameters
  const [targetWellId, setTargetWellId] = useState<string>(initialTargetWellId || 'EXT-01');
  const [durationHours, setDurationHours] = useState<number>(96);
  const [peakSettingHours, setPeakSettingHours] = useState<number>(36);
  const [spreadHours, setSpreadHours] = useState<number>(8);
  const [seed, setSeed] = useState<number>(42);

  // Live Interactive Execution State
  const [testState, setTestState] = useState<'ready' | 'running' | 'paused' | 'completed'>('completed');
  const [elapsedHour, setElapsedHour] = useState<number>(96);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 3 | 8>(3);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Respond when launched directly from AI Decision Support Card
  useEffect(() => {
    if (initialTargetWellId) {
      const matched = targetWells.find((w) => w.id === initialTargetWellId);
      if (matched) {
        setTargetWellId(matched.id);
        if (matched.type === 'izleme') {
          setPeakSettingHours(54);
          setDurationHours(120);
        } else {
          setPeakSettingHours(36);
          setDurationHours(96);
        }
        setElapsedHour(0);
        setTestState('running');
      }
    }
  }, [initialTargetWellId, autoStartSignal, targetWells]);

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

  const effectivePeak = Math.min(peakSettingHours, Math.max(10, durationHours - 6));

  // Full analytical breakthrough curve
  const tracerResult = useMemo(() => {
    return calculateTracerCurve(durationHours, effectivePeak, spreadHours, seed);
  }, [durationHours, effectivePeak, spreadHours, seed]);

  // Keep elapsedHour clamped if durationHours shrinks while completed
  useEffect(() => {
    if (testState === 'completed') {
      setElapsedHour(durationHours);
    } else if (elapsedHour > durationHours) {
      setElapsedHour(durationHours);
    }
  }, [durationHours, testState, elapsedHour]);

  // Real-time live runner timer
  useEffect(() => {
    if (testState !== 'running') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const intervalMs = playbackSpeed === 8 ? 55 : playbackSpeed === 3 ? 130 : 320;
    timerRef.current = setInterval(() => {
      setElapsedHour((prev) => {
        if (prev >= durationHours) {
          setTestState('completed');
          return durationHours;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [testState, playbackSpeed, durationHours]);

  // Start / Pause / Reset handlers
  const handleStartLiveTest = () => {
    setElapsedHour(0);
    setTestState('running');
  };

  const handleTogglePause = () => {
    if (testState === 'running') setTestState('paused');
    else if (testState === 'paused') setTestState('running');
    else {
      setElapsedHour(0);
      setTestState('running');
    }
  };

  const handleShowInstantComplete = () => {
    setTestState('completed');
    setElapsedHour(durationHours);
  };

  const handleResetDefaults = () => {
    setTestState('ready');
    setElapsedHour(0);
    setTargetWellId('EXT-01');
    setDurationHours(96);
    setPeakSettingHours(36);
    setSpreadHours(8);
    setSeed(42);
  };

  // Progressive live series up to elapsedHour
  const liveConcentrations = useMemo(() => {
    return tracerResult.times.map((hr, idx) =>
      hr <= elapsedHour ? tracerResult.concentrations[idx] : null
    );
  }, [tracerResult, elapsedHour]);

  const currentConcentration =
    tracerResult.concentrations[Math.min(elapsedHour, tracerResult.concentrations.length - 1)] ?? 0;

  // Plume center-of-mass position along inter-well path (0 to distanceMeters)
  const plumeProgressRatio = Math.min(1.15, Math.max(0, elapsedHour / Math.max(1, effectivePeak)));
  const plumeDistanceMeters = Math.min(distanceMeters, plumeProgressRatio * distanceMeters);
  const isSensorDetectingNow = currentConcentration > 0.05;

  // Derived hydrogeological transport indicators (revealed as test progresses or completes)
  const observedFirstArrival =
    tracerResult.firstArrival !== null && elapsedHour >= tracerResult.firstArrival
      ? tracerResult.firstArrival
      : null;
  const observedPeakHour = elapsedHour >= tracerResult.peakHour ? tracerResult.peakHour : null;

  const advectiveVelocityMh =
    tracerResult.peakHour > 0 ? distanceMeters / tracerResult.peakHour : 0;
  const advectiveVelocityMday = advectiveVelocityMh * 24;

  const hasChannelingWarning =
    (tracerResult.firstArrival !== null && tracerResult.firstArrival < 12) ||
    (selectedTarget?.type === 'izleme' && tracerResult.peakValue > 0.1);

  // Live chronological milestone events up to current elapsedHour
  const liveEvents: TracerLogEvent[] = useMemo(() => {
    const events: TracerLogEvent[] = [];
    if (elapsedHour >= 0 && testState !== 'ready') {
      events.push({
        hour: 0,
        type: 'INJECT',
        message: `Conservative bromide/fluorescein pulse injected at ${
          injectorWell?.id || 'INJ-01'
        } (t = 0h). Monitoring fluorometer at ${selectedTarget?.id} (${distanceMeters.toFixed(1)} m).`,
      });
    }
    if (tracerResult.firstArrival !== null && elapsedHour >= tracerResult.firstArrival) {
      events.push({
        hour: tracerResult.firstArrival,
        type: selectedTarget?.type === 'izleme' || tracerResult.firstArrival < 12 ? 'WARNING' : 'ARRIVAL',
        message: `First Arrival Detected! Relative concentration C/C0 exceeded 0.05 detection threshold at ${
          selectedTarget?.id
        } after ${tracerResult.firstArrival} hours.`,
      });
    }
    if (elapsedHour >= tracerResult.peakHour && tracerResult.peakHour > 0) {
      events.push({
        hour: tracerResult.peakHour,
        type: 'PEAK',
        message: `Peak Breakthrough Reached at t = ${
          tracerResult.peakHour
        }h (C/C0 = ${tracerResult.peakValue.toFixed(
          3
        )}). Apparent pore velocity: ${advectiveVelocityMh.toFixed(2)} m/h (${advectiveVelocityMday.toFixed(
          1
        )} m/day).`,
      });
    }
    if (elapsedHour >= durationHours && testState === 'completed') {
      events.push({
        hour: durationHours,
        type: 'COMPLETE',
        message: `Tracer sampling cycle completed (${durationHours}h). Integrated mass recovery index: ${tracerResult.area.toFixed(
          2
        )} (C/C0)·h.`,
      });
    }
    return events.reverse();
  }, [
    elapsedHour,
    testState,
    injectorWell,
    selectedTarget,
    distanceMeters,
    tracerResult,
    advectiveVelocityMh,
    advectiveVelocityMday,
    durationHours,
  ]);

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
    for (let i = 0; i <= Math.min(elapsedHour, tracerResult.times.length - 1); i++) {
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
      {/* Live Tracer Test Execution Console Header */}
      <div className="bg-slate-900/95 border border-cyan-800/70 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-cyan-400" />
              Interactive Live Tracer Test &amp; Subsurface Plume Tracker
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Inject a conservative tracer pulse at <code className="font-mono text-cyan-300">{injectorWell?.id || 'INJ-01'}</code> anytime, watch subsurface transport live hour-by-hour, and evaluate AI pathway diagnostics.
            </p>
          </div>

          {/* Primary Start / Watch / Speed Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleStartLiveTest}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors cursor-pointer shadow-lg shadow-emerald-950/50"
            >
              <Play className="w-4 h-4" />
              <span>{testState === 'running' ? 'Restart Tracer Pulse (t=0h)' : 'Start Live Tracer Test'}</span>
            </button>

            {(testState === 'running' || testState === 'paused') && (
              <button
                type="button"
                onClick={handleTogglePause}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors cursor-pointer"
              >
                {testState === 'running' ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Resume</span>
                  </>
                )}
              </button>
            )}

            {elapsedHour < durationHours && (
              <button
                type="button"
                onClick={handleShowInstantComplete}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Complete Instantly</span>
              </button>
            )}

            {/* Playback Speed Selector */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
              {([1, 3, 8] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleExportTracerCSV}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Live Subsurface Well-Pair Animation Visualizer */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-full ${
                  testState === 'running'
                    ? 'bg-emerald-400 animate-ping'
                    : testState === 'paused'
                    ? 'bg-amber-400'
                    : testState === 'completed'
                    ? 'bg-cyan-400'
                    : 'bg-slate-500'
                }`}
              />
              <span className="font-bold text-slate-200 uppercase tracking-wide">
                Live Aquifer Corridor: {injectorWell?.id || 'INJ-01'} &rarr; {selectedTarget?.id}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-cyan-300">
                Elapsed: {elapsedHour}h / {durationHours}h
              </span>
            </div>

            <div className="flex items-center gap-4 font-mono">
              <span className="text-slate-400">
                Plume Front:{' '}
                <strong className="text-emerald-400">{plumeDistanceMeters.toFixed(1)} m</strong> /{' '}
                {distanceMeters.toFixed(1)} m
              </span>
              <span className="text-slate-400">
                Live Fluorometer C/C0:{' '}
                <strong
                  className={
                    isSensorDetectingNow ? 'text-amber-300 text-sm' : 'text-cyan-400 text-sm'
                  }
                >
                  {currentConcentration.toFixed(4)}
                </strong>
              </span>
            </div>
          </div>

          {/* 2D Subsurface Cross-Section SVG */}
          <svg
            viewBox="0 0 800 135"
            className="w-full h-32 bg-[#060c1a] rounded-xl border border-slate-800/80"
          >
            <defs>
              <radialGradient id="tracerPlumeGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.85" />
                <stop offset="55%" stopColor="#06b6d4" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Confining Shale Layers Top & Bottom */}
            <rect x="0" y="0" width="800" height="22" fill="#0f172a" />
            <text x="400" y="14" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">
              UPPER CONFINING CLAY / SHALE AQUITARD
            </text>
            <rect x="0" y="113" width="800" height="22" fill="#0f172a" />
            <text x="400" y="127" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="600">
              LOWER BASAL CONFINING LAYER
            </text>

            {/* Permeable Ore-Bearing Sandstone Horizon */}
            <rect x="0" y="22" width="800" height="91" fill="#08142c" />

            {/* Distance Axis Guideline */}
            <line
              x1="110"
              y1="68"
              x2="690"
              y2="68"
              stroke="#1e293b"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
            <text x="400" y="104" textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
              Euclidean Well-Pair Distance L = {distanceMeters.toFixed(1)} m (Advective Velocity ={' '}
              {advectiveVelocityMh.toFixed(2)} m/h)
            </text>

            {/* Migrating Tracer Plume Cloud */}
            {elapsedHour > 0 && (
              <g>
                {(() => {
                  const centerX = 110 + Math.min(1.12, elapsedHour / Math.max(1, effectivePeak)) * 580;
                  const rx = Math.max(28, Math.min(140, (spreadHours / durationHours) * 580 * 1.8));
                  return (
                    <>
                      <ellipse
                        cx={centerX}
                        cy={68}
                        rx={rx}
                        ry={34}
                        fill="url(#tracerPlumeGrad)"
                      />
                      <circle cx={Math.min(690, centerX)} cy={68} r="5" fill="#67e8f9" />
                    </>
                  );
                })()}
              </g>
            )}

            {/* Left Wellbore: INJ-01 */}
            <rect x="103" y="8" width="14" height="92" rx="3" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="110" y="52" textAnchor="end" dx="-14" fill="#38bdf8" fontSize="12" fontWeight="800">
              {injectorWell?.id || 'INJ-01'}
            </text>
            <text x="110" y="67" textAnchor="end" dx="-14" fill="#94a3b8" fontSize="10">
              Pulse Source
            </text>

            {/* Right Wellbore: Observation / Recovery Well */}
            <rect
              x="683"
              y="8"
              width="14"
              height="92"
              rx="3"
              fill={
                isSensorDetectingNow
                  ? '#f59e0b'
                  : selectedTarget?.type === 'izleme'
                  ? '#a855f7'
                  : '#10b981'
              }
              stroke="#f8fafc"
              strokeWidth="1.5"
            />
            {isSensorDetectingNow && (
              <circle
                cx="690"
                cy="68"
                r="20"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />
            )}
            <text x="690" y="52" textAnchor="start" dx="14" fill="#f8fafc" fontSize="12" fontWeight="800">
              {selectedTarget?.id}
            </text>
            <text
              x="690"
              y="67"
              textAnchor="start"
              dx="14"
              fill={isSensorDetectingNow ? '#fbbf24' : '#94a3b8'}
              fontSize="10"
              fontWeight={isSensorDetectingNow ? '700' : '400'}
            >
              {isSensorDetectingNow ? 'DETECTED!' : 'Fluorometer'}
            </text>
          </svg>

          {/* Interactive Hour Scrubber */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-semibold shrink-0">Scrub Test Hour:</span>
            <input
              type="range"
              min={0}
              max={durationHours}
              step={1}
              value={elapsedHour}
              onChange={(e) => {
                setTestState('paused');
                setElapsedHour(parseInt(e.target.value, 10));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono font-bold text-cyan-300 w-16 text-right">
              {elapsedHour}h
            </span>
          </div>
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
              {observedFirstArrival !== null
                ? `${observedFirstArrival}h`
                : testState === 'running' || testState === 'paused'
                ? 'Waiting...'
                : 'None'}
            </span>
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
              {observedPeakHour !== null ? `${observedPeakHour}h` : 'In Transit...'}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            Peak C/C0: {observedPeakHour !== null ? tracerResult.peakValue.toFixed(3) : '—'}
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

      {/* Parameter Control Panel + AI Tracer Interpretation */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Sliders className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-slate-100">
            Tracer Injection &amp; Aquifer Dispersion Parameters
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
                  setPeakSettingHours(56);
                }
                setElapsedHour(0);
                setTestState('running');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 font-semibold focus:outline-hidden cursor-pointer"
            >
              {targetWells.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900 text-white">
                  {w.id} ({w.type === 'cekim' ? 'Recovery EXT' : 'Perimeter MON'})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Changing well automatically launches a fresh pulse.
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
            <p className="text-[11px] text-slate-500">Total fluorometer sampling window.</p>
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
            <p className="text-[11px] text-slate-500">Fluorometer background noise seed.</p>
          </div>
        </div>

        {/* AI Tracer Decision Support Diagnostic */}
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            hasChannelingWarning
              ? 'bg-amber-950/40 border-amber-800 text-amber-200'
              : 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200'
          }`}
        >
          <Cpu
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              hasChannelingWarning ? 'text-amber-400' : 'text-emerald-400'
            }`}
          />
          <div className="space-y-1">
            <div className="font-black uppercase tracking-wide">
              AI Tracer Pathway Diagnosis &amp; Operational Recommendation
            </div>
            {selectedTarget?.type === 'izleme' ? (
              <p>
                <strong>Perimeter Escape Confirmed ({selectedTarget.id}):</strong> Tracer detection at a 250 m monitoring ring well confirms hydraulic migration outside the 5-spot recovery cell (linear velocity {advectiveVelocityMday.toFixed(1)} m/day). <strong>AI Recommendation:</strong> Throttle INJ-01 below corner extraction rate immediately to reverse the perimeter streamline.
              </p>
            ) : tracerResult.firstArrival !== null && tracerResult.firstArrival < 12 ? (
              <p>
                <strong>Fracture Channeling / Thief-Zone Warning ({tracerResult.firstArrival}h arrival):</strong> Premature arrival between {injectorWell?.id} and {selectedTarget?.id} indicates high-permeability fracture short-circuiting ({advectiveVelocityMday.toFixed(1)} m/day), reducing ore-body sweep efficiency. <strong>AI Recommendation:</strong> Reduce injection wellhead pressure and balance corner extraction rates.
              </p>
            ) : (
              <p>
                <strong>Controlled Porous-Media 5-Spot Sweep ({injectorWell?.id} &rarr; {selectedTarget?.id}):</strong> First arrival at {tracerResult.firstArrival ?? '-'}h and Gaussian peak at {tracerResult.peakHour}h ({advectiveVelocityMday.toFixed(1)} m/day) confirm uniform pore-space leaching within the capture cone.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Real-Time Progressive Breakthrough Curve + Live Milestone Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <EngineeringChart
            title={`Live Tracer Breakthrough Curve (${injectorWell?.id || 'INJ-01'} → ${
              selectedTarget?.id || targetWellId
            })`}
            subtitle={`Observed fluorometer concentration C/C0 from 0h to ${elapsedHour}h (Total window: ${durationHours}h)`}
            xLabels={tracerResult.times.map((t) => `${t}h`)}
            xAxisTitle="Elapsed Time Since Tracer Pulse (Hours)"
            yAxisTitle="Relative Concentration (C / C0)"
            yMin={0}
            yMax={1.15}
            series={[
              {
                name: 'Observed Live Concentration (C/C0)',
                color: '#22d3ee',
                strokeWidth: 2.5,
                data: liveConcentrations,
              },
            ]}
            thresholds={[
              {
                value: 0.05,
                label: 'First Arrival Threshold (0.05)',
                color: '#f59e0b',
                dash: '4 4',
              },
            ]}
          />
        </div>

        {/* Live Test Event Feed */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Live Tracer Test Log
            </h3>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 text-xs">
              {liveEvents.length > 0 ? (
                liveEvents.map((ev, idx) => (
                  <div
                    key={`${ev.hour}-${idx}`}
                    className={`p-3 rounded-xl border ${
                      ev.type === 'WARNING'
                        ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                        : ev.type === 'PEAK'
                        ? 'bg-cyan-950/40 border-cyan-800 text-cyan-200'
                        : ev.type === 'COMPLETE'
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                      <span className="font-bold">t = {ev.hour}h</span>
                      <span className="uppercase">{ev.type}</span>
                    </div>
                    <p className="leading-relaxed">{ev.message}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                  Click <strong>Start Live Tracer Test</strong> above to inject a tracer pulse and watch live arrival milestones.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span>
              Anchored to exact well coordinates from <code className="font-mono text-cyan-300">saha_verileri_lite.json</code> using analytical Gaussian advection-dispersion.
            </span>
          </div>
        </div>
      </div>

      {/* Hourly Breakthrough Data Table (Up to Current Elapsed Hour) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-100">
            Observed Fluorometer Telemetry Table (0h &ndash; {elapsedHour}h)
          </h3>
          {hasChannelingWarning ? (
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Pathway Advisory Active
            </span>
          ) : (
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Normal Sweep Transit
            </span>
          )}
        </div>
        <div className="overflow-x-auto max-h-64 border border-slate-800 rounded-xl">
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
              {tracerResult.times
                .slice(0, elapsedHour + 1)
                .reverse()
                .map((hr) => {
                  const conc = tracerResult.concentrations[hr];
                  const isPeak = hr === tracerResult.peakHour && elapsedHour >= tracerResult.peakHour;
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
