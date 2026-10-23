import React from 'react';
import {
  AlertOctagon,
  Sliders,
  Info,
  RotateCcw,
} from 'lucide-react';
import { TimestepSummary, RiskThresholds } from '../types/islData';
import { EngineeringChart } from '../components/EngineeringChart';

interface RiskAnalysisViewProps {
  timesteps: TimestepSummary[];
  thresholds: RiskThresholds;
  onUpdateThresholds: (t: RiskThresholds) => void;
  onResetThresholds: () => void;
}

export const RiskAnalysisView: React.FC<RiskAnalysisViewProps> = ({
  timesteps,
  thresholds,
  onUpdateThresholds,
  onResetThresholds,
}) => {
  const stepHours = 6; // 0.25 day intervals
  let totalRiskyHours = 0;
  let imbalanceCount = 0;
  let phExceedCount = 0;
  let sulfateExceedCount = 0;
  let gradientExceedCount = 0;

  // Compute temporal change in hydraulic gradient (dG/dt per day)
  const gradientDeltas: (number | null)[] = [];
  let steepestDrop = 0;

  for (let i = 0; i < timesteps.length; i++) {
    const t = timesteps[i];
    if (t.combinedAlert) totalRiskyHours += stepHours;
    if (t.imbalanceAlert) imbalanceCount++;
    if (t.phAlert) phExceedCount++;
    if (t.sulfateAlert) sulfateExceedCount++;
    if (t.gradientAlert) gradientExceedCount++;

    if (i === 0) {
      gradientDeltas.push(0);
    } else {
      const prev = timesteps[i - 1];
      const dt = t.day - prev.day;
      if (t.hydraulicGradient !== null && prev.hydraulicGradient !== null && dt > 0 && dt <= 1) {
        const ratePerDay = (t.hydraulicGradient - prev.hydraulicGradient) / dt;
        gradientDeltas.push(ratePerDay);
        if (ratePerDay < steepestDrop) steepestDrop = ratePerDay;
      } else {
        gradientDeltas.push(null);
      }
    }
  }

  const dayLabels = timesteps.map((t) => t.day.toFixed(2));
  const riskScores = timesteps.map((t) => t.riskScore);

  return (
    <div className="space-y-6">
      {/* Explainable Engine Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <AlertOctagon className="w-6 h-6 text-cyan-400" />
              Explainable Rule-Based Risk Analysis Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic evaluation of flow imbalance, hydraulic gradient rate-of-change, and boundary chemistry thresholds.
            </p>
          </div>
          <div className="text-xs text-cyan-400 font-semibold">
            Rule-Based Evaluation Only · No ML Forecasting Active
          </div>
        </div>

        {/* Methodology & Demo Threshold Disclosure */}
        <div className="mt-4 p-3.5 bg-blue-950/40 border border-blue-900 rounded-xl text-xs text-blue-200 flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong>Analysis Disclosure:</strong> No machine learning or speculative time-series forecasting model is loaded. All warnings, exceedance counts, and risk scores are computed strictly via explainable rule-based engineering thresholds on historical/synthetic CSV timesteps.
            </p>
            <p className="text-slate-400 text-[11px]">
              Because <code className="font-mono text-cyan-300">saha_verileri_lite.json</code> defines well geometry without statutory regulatory limits, the thresholds below are explicitly labeled <strong>hypothetical user-editable demonstration thresholds</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Exceedance Metrics (Counts + Hours + Gradient Change) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Risky Operating Hours</div>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {totalRiskyHours} <span className="text-xs font-semibold text-slate-500">hrs</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {((totalRiskyHours / Math.max(timesteps.length * stepHours, 1)) * 100).toFixed(1)}% of active window
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Flow Imbalance Breaches</div>
          <div className="text-2xl font-black font-mono text-orange-400 mt-1">
            {imbalanceCount} <span className="text-xs font-semibold text-slate-500">steps</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {imbalanceCount * stepHours} hrs (&gt; {thresholds.allowedImbalance.toFixed(1)} m³/h)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Boundary pH Exceedances</div>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {phExceedCount} <span className="text-xs font-semibold text-slate-500">steps</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {phExceedCount * stepHours} hrs (&lt; {thresholds.phLowerLimit.toFixed(1)} pH)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Sulfate Exceedances</div>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {sulfateExceedCount} <span className="text-xs font-semibold text-slate-500">steps</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {sulfateExceedCount * stepHours} hrs (&gt; {thresholds.sulfateUpperLimit.toFixed(0)} mg/L)
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Gradient Decay Breaches</div>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {gradientExceedCount} <span className="text-xs font-semibold text-slate-500">steps</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Max drop rate: {steepestDrop.toFixed(2)} /day
          </div>
        </div>
      </div>

      {/* User-Configurable Hypothetical Demo Thresholds */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">
              Hypothetical Demonstration Thresholds (User-Editable)
            </h3>
          </div>
          <button
            type="button"
            onClick={onResetThresholds}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 text-xs">
          {/* 1. Allowed Imbalance */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Allowed Imbalance (ΔQ)</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.allowedImbalance.toFixed(1)} m³/h
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="5.0"
              step="0.1"
              value={thresholds.allowedImbalance}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, allowedImbalance: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Demo threshold for excess injection over total extraction.
            </p>
          </div>

          {/* 2. Boundary pH Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Demo pH Lower Limit</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.phLowerLimit.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="4.5"
              max="7.0"
              step="0.1"
              value={thresholds.phLowerLimit}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, phLowerLimit: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Hypothetical minimum pH at boundary monitoring wells.
            </p>
          </div>

          {/* 3. Sulfate Upper Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Demo Sulfate Limit</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.sulfateUpperLimit.toFixed(0)} mg/L
              </span>
            </div>
            <input
              type="range"
              min="40"
              max="150"
              step="5"
              value={thresholds.sulfateUpperLimit}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, sulfateUpperLimit: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Hypothetical maximum dissolved sulfate at perimeter wells.
            </p>
          </div>

          {/* 4. Hydraulic Gradient Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Demo Gradient Limit</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.gradientLowerLimit.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={thresholds.gradientLowerLimit}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, gradientLowerLimit: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Minimum inward head gradient proxy before containment alert.
            </p>
          </div>

          {/* 5. Supervisor Approval Timeout */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Approval Timeout</span>
              <span className="font-mono font-bold text-amber-400">
                {thresholds.countdownSeconds}s
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={thresholds.countdownSeconds}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, countdownSeconds: parseInt(e.target.value, 10) })
              }
              className="w-full accent-amber-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Seconds to wait for supervisor decision before automatic shutdown.
            </p>
          </div>
        </div>
      </div>

      {/* Charts: Risk Trajectory & Hydraulic Gradient Rate-of-Change */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngineeringChart
          title="Composite Rule-Based Risk Score Trajectory"
          subtitle="Evaluated across active timeline using user-configured demonstration thresholds"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Risk Score (0 - 1)"
          yMin={0}
          yMax={1}
          series={[
            {
              name: 'Composite Risk Score',
              color: '#f43f5e',
              strokeWidth: 2,
              data: riskScores,
            },
          ]}
          thresholds={[
            {
              value: 0.5,
              label: 'Warning Reference (0.50)',
              color: '#ef4444',
              dash: '4 4',
            },
          ]}
        />

        <EngineeringChart
          title="Temporal Gradient Rate-of-Change (dG/dt)"
          subtitle="Negative spikes indicate rapid loss of inward hydraulic containment over consecutive timesteps"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="dG / dt (per Day)"
          series={[
            {
              name: 'Gradient Change Rate (dG/dt)',
              color: '#06b6d4',
              strokeWidth: 2,
              data: gradientDeltas,
              unit: '/day',
            },
          ]}
          thresholds={[
            {
              value: 0,
              label: 'Steady-State Equilibrium (0.00)',
              color: '#64748b',
              dash: '3 3',
            },
          ]}
        />
      </div>
    </div>
  );
};
