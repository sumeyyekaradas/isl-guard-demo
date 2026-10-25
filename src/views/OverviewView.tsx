import React, { useState, useMemo, useEffect } from 'react';
import {
  Droplets,
  Activity,
  Compass,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  ArrowUpRight,
  TrendingDown,
  Clock,
} from 'lucide-react';
import { TimestepSummary, RiskThresholds, WellConfig } from '../types/islData';
import { AIDecisionReport } from '../services/aiDecisionService';
import { EngineeringChart } from '../components/EngineeringChart';
import { WellfieldMap } from '../components/WellfieldMap';
import { AIDecisionCenterCard } from '../components/AIDecisionCenterCard';

interface OverviewViewProps {
  timesteps: TimestepSummary[];
  currentTimestep: TimestepSummary | null;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  thresholds: RiskThresholds;
  selectedScenario: string;
  onSelectScenario: (sc: string) => void;
  scenarios: string[];
  wells?: WellConfig[];
  aiReport: AIDecisionReport;
  onApplyAiRecommendation: (strategy: 'full_shutdown' | 'throttle_to_extraction') => void;
  onLaunchTracerForWell: (wellId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  timesteps,
  currentTimestep,
  selectedDay,
  onSelectDay,
  thresholds,
  selectedScenario,
  onSelectScenario,
  scenarios,
  wells,
  aiReport,
  onApplyAiRecommendation,
  onLaunchTracerForWell,
}) => {
  const minDay = timesteps.length > 0 ? timesteps[0].day : 0;
  const maxDay = timesteps.length > 0 ? timesteps[timesteps.length - 1].day : 180;

  const [windowStart, setWindowStart] = useState<number>(minDay);
  const [windowEnd, setWindowEnd] = useState<number>(maxDay);

  useEffect(() => {
    setWindowStart(minDay);
    setWindowEnd(maxDay);
  }, [minDay, maxDay, selectedScenario]);

  const windowedTimesteps = useMemo(() => {
    const start = Math.min(windowStart, windowEnd);
    const end = Math.max(windowStart, windowEnd);
    const filtered = timesteps.filter((t) => t.day >= start && t.day <= end);
    return filtered.length > 0 ? filtered : timesteps;
  }, [timesteps, windowStart, windowEnd]);

  const latest =
    currentTimestep ||
    windowedTimesteps[windowedTimesteps.length - 1] ||
    timesteps[timesteps.length - 1];

  if (!latest) {
    return (
      <div className="p-8 text-center text-slate-400">
        No operational records available for the selected scenario.
      </div>
    );
  }

  // Chronologically sorted chart vectors from windowed timesteps
  const dayLabels = windowedTimesteps.map((t) => t.day.toFixed(2));
  const injectionSeries = windowedTimesteps.map((t) => t.injectionRate);
  const extractionSeries = windowedTimesteps.map((t) => t.extractionRate);
  const imbalanceSeries = windowedTimesteps.map((t) => t.netImbalance);
  const gradientSeries = windowedTimesteps.map((t) => t.hydraulicGradient);
  const phSeries = windowedTimesteps.map((t) => t.boundaryPhMin);
  const sulfateSeries = windowedTimesteps.map((t) => t.boundarySulfateMax);
  const riskSeries = windowedTimesteps.map((t) => t.riskScore);
  const aiScoreSeries = windowedTimesteps.map((t) => t.aiAnomalyScore);

  const renderRiskStatus = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <div className="flex items-center gap-1.5 text-sm font-black text-red-400">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>CRITICAL RISK</span>
          </div>
        );
      case 'HIGH':
        return (
          <div className="flex items-center gap-1.5 text-sm font-black text-orange-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>HIGH RISK</span>
          </div>
        );
      case 'ELEVATED':
        return (
          <div className="flex items-center gap-1.5 text-sm font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>ELEVATED RISK</span>
          </div>
        );
      case 'LOW':
        return (
          <div className="flex items-center gap-1.5 text-sm font-bold text-cyan-400">
            <span>LOW RISK</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>SAFE / NOMINAL</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Interactive Time Range / Scenario Controls */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-400" />
              Operational Command &amp; AI Surveillance Overview
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Select any operational scenario (e.g. <span className="text-cyan-300 font-semibold">Yavas Dengesizlik / Sizi</span>) or scrub days — when thresholds or AI bounds are exceeded, supervisor authorization triggers automatically.
            </p>
          </div>

          {/* Scenario Selector */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400">Scenario:</span>
              <select
                value={selectedScenario}
                onChange={(e) => onSelectScenario(e.target.value)}
                className="bg-transparent text-cyan-400 font-semibold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-slate-900 text-white">
                  All Scenarios (Full 180 Days)
                </option>
                {scenarios.map((sc) => (
                  <option key={sc} value={sc} className="bg-slate-900 text-white">
                    {sc}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Interactive Inspection Day Scrubber & Chart Time Window */}
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center text-xs">
          {/* Inspected Day Slider */}
          <div className="lg:col-span-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                Inspected Timestamp (Auto-Checks AI &amp; Threshold Limits):
              </span>
              <span className="font-mono font-bold text-cyan-300">
                Day {latest.day.toFixed(2)} ({latest.scenarioName})
              </span>
            </div>
            <input
              type="range"
              min={minDay}
              max={maxDay}
              step={0.25}
              value={selectedDay}
              onChange={(e) => onSelectDay(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Chart Time Range Controls */}
          <div className="lg:col-span-6 flex flex-wrap items-center justify-between lg:justify-end gap-2">
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Chart Window:
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <input
                type="number"
                min={minDay}
                max={windowEnd}
                step={1}
                value={windowStart}
                onChange={(e) => setWindowStart(Math.max(minDay, parseFloat(e.target.value) || minDay))}
                className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs"
                aria-label="Window start day"
              />
              <span className="text-slate-500">to</span>
              <input
                type="number"
                min={windowStart}
                max={maxDay}
                step={1}
                value={windowEnd}
                onChange={(e) => setWindowEnd(Math.min(maxDay, parseFloat(e.target.value) || maxDay))}
                className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-slate-200 text-xs"
                aria-label="Window end day"
              />
              <span className="text-slate-500 font-sans">days</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setWindowStart(minDay);
                setWindowEnd(maxDay);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Full Range
            </button>
          </div>
        </div>
      </div>

      {/* Central AI Decision Support & Sensor Intelligence Hub */}
      <AIDecisionCenterCard
        currentTimestep={latest}
        aiReport={aiReport}
        onApplyRecommendation={onApplyAiRecommendation}
        onLaunchTracerForWell={onLaunchTracerForWell}
      />

      {/* 6 Required KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        {/* 1. Current Injection Rate */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Current Injection Rate</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-100">
              {latest.injectionRate.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">m³/h</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            INJ-01 · ΔQ {latest.netImbalance >= 0 ? `+${latest.netImbalance.toFixed(1)}` : latest.netImbalance.toFixed(1)} m³/h
          </div>
        </div>

        {/* 2. Current Extraction Rate */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Current Extraction Rate</span>
            <TrendingDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-slate-100">
              {latest.extractionRate.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">m³/h</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            EXT-01..04 Aggregate
          </div>
        </div>

        {/* 3. Gradient Proxy */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Gradient Proxy</span>
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-cyan-400">
              {latest.hydraulicGradient !== null ? latest.hydraulicGradient.toFixed(2) : 'MISSING'}
            </span>
            {latest.hydraulicGradient !== null && (
              <span className="text-xs font-semibold text-slate-500">ΔP</span>
            )}
          </div>
          <div className="mt-2 text-[11px]">
            {latest.hydraulicGradient === null ? (
              <span className="text-amber-400 font-medium">Sensor telemetry missing</span>
            ) : latest.hydraulicGradient >= thresholds.gradientLowerLimit ? (
              <span className="text-emerald-400 font-medium">Inward containment</span>
            ) : (
              <span className="text-red-400 font-medium">Gradient below limit</span>
            )}
          </div>
        </div>

        {/* 4. Boundary pH */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Boundary pH</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black font-mono ${
                latest.boundaryPhMin === null
                  ? 'text-amber-400 text-lg'
                  : latest.phAlert
                  ? 'text-red-400'
                  : 'text-slate-100'
              }`}
            >
              {latest.boundaryPhMin !== null ? latest.boundaryPhMin.toFixed(2) : 'MISSING'}
            </span>
            {latest.boundaryPhMin !== null && (
              <span className="text-xs font-semibold text-slate-500">pH</span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Limit: &ge; {thresholds.phLowerLimit.toFixed(2)}
          </div>
        </div>

        {/* 5. Boundary Sulfate */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Boundary / RCV Sulfate</span>
            <ArrowUpRight className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black font-mono ${
                latest.boundarySulfateMax === null
                  ? 'text-amber-400 text-lg'
                  : latest.sulfateAlert
                  ? 'text-red-400'
                  : 'text-slate-100'
              }`}
            >
              {latest.boundarySulfateMax !== null ? latest.boundarySulfateMax.toFixed(1) : 'MISSING'}
            </span>
            {latest.boundarySulfateMax !== null && (
              <span className="text-xs font-semibold text-slate-500">mg/L</span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Limit: &le; {thresholds.sulfateUpperLimit.toFixed(0)} mg/L
          </div>
        </div>

        {/* 6. Current Risk Status */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400">AI + Rule Risk Status</div>
          <div className="my-2">{renderRiskStatus(latest.riskLevel)}</div>
          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Risk: {(latest.riskScore * 100).toFixed(0)}%</span>
            <span className="font-mono text-cyan-400">
              AI: {latest.aiAnomalyScore !== null ? latest.aiAnomalyScore.toFixed(2) : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Time-series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngineeringChart
          title="Injection vs. Extraction Flow Balance"
          subtitle="Chronological flow trajectories from central injector INJ-01 and corner recovery wells EXT-01..04"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Flow Rate (m³/h)"
          series={[
            {
              name: 'Injection (INJ-01)',
              color: '#38bdf8',
              strokeWidth: 2,
              data: injectionSeries,
              unit: 'm³/h',
            },
            {
              name: 'Total Extraction (EXT-01..04)',
              color: '#34d399',
              strokeWidth: 2,
              data: extractionSeries,
              unit: 'm³/h',
            },
            {
              name: 'Net Imbalance (ΔQ)',
              color: '#fb923c',
              strokeWidth: 1.5,
              data: imbalanceSeries,
              unit: 'm³/h',
            },
          ]}
          thresholds={[
            {
              value: thresholds.allowedImbalance,
              label: 'Max Allowed Imbalance',
              color: '#ef4444',
              dash: '4 4',
            },
          ]}
        />

        <EngineeringChart
          title="Boundary & Receptor Water Chemistry (pH & Sulfate)"
          subtitle="Minimum pH and maximum sulfate across monitoring ring (MON-01..12) and distant receptors (RCV-01..03)"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="pH / Sulfate (mg/L)"
          series={[
            {
              name: 'Boundary pH (Min)',
              color: '#facc15',
              strokeWidth: 2,
              data: phSeries,
              unit: 'pH',
            },
            {
              name: 'Boundary & Receptor Sulfate (Max)',
              color: '#a855f7',
              strokeWidth: 2,
              data: sulfateSeries,
              unit: 'mg/L',
            },
          ]}
          thresholds={[
            {
              value: thresholds.phLowerLimit,
              label: 'pH Lower Limit',
              color: '#f43f5e',
              dash: '3 3',
            },
            {
              value: thresholds.sulfateUpperLimit,
              label: 'Sulfate Upper Limit',
              color: '#ec4899',
              dash: '4 3',
            },
          ]}
        />
      </div>

      {/* Hydraulic Gradient & Composite Risk Score Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngineeringChart
          title="Hydraulic Gradient Proxy (Containment Cone)"
          subtitle="Pressure head differential between boundary monitoring ring and production extraction zone"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Gradient Proxy"
          series={[
            {
              name: 'Gradient Proxy',
              color: '#06b6d4',
              strokeWidth: 2,
              data: gradientSeries,
            },
          ]}
          thresholds={[
            {
              value: thresholds.gradientLowerLimit,
              label: 'Minimum Inward Gradient',
              color: '#ef4444',
              dash: '4 4',
            },
          ]}
        />

        <EngineeringChart
          title="Built-In Isolation Forest AI & Composite Risk Score"
          subtitle="Combining 8-channel Isolation Forest anomaly score (cyan) with deterministic containment rules (rose)"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Score (0 - 1)"
          yMin={0}
          yMax={1}
          series={[
            {
              name: 'Composite Risk Score',
              color: '#f43f5e',
              strokeWidth: 2,
              data: riskSeries,
            },
            {
              name: 'Isolation Forest AI Score',
              color: '#22d3ee',
              strokeWidth: 1.5,
              data: aiScoreSeries,
            },
          ]}
          thresholds={[
            {
              value: Number(latest.aiAnomalyCutoff.toFixed(3)),
              label: 'AI Anomaly Cutoff',
              color: '#f59e0b',
              dash: '4 4',
            },
          ]}
        />
      </div>

      {/* Spatial Pattern Map */}
      <WellfieldMap
        currentScenario={latest.scenarioName}
        hasAlert={latest.combinedAlert}
        wells={wells}
        currentWellRecords={latest.wellRecords}
      />
    </div>
  );
};
