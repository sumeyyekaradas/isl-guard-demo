import React from 'react';
import {
  AlertOctagon,
  Sliders,
  Info,
  RotateCcw,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { TimestepSummary, RiskThresholds } from '../types/islData';
import { TrainedAnomalyModel } from '../services/dataService';
import { AIDecisionReport } from '../services/aiDecisionService';
import { EngineeringChart } from '../components/EngineeringChart';
import { AIDecisionCenterCard } from '../components/AIDecisionCenterCard';

interface RiskAnalysisViewProps {
  timesteps: TimestepSummary[];
  currentTimestep: TimestepSummary | null;
  thresholds: RiskThresholds;
  aiModel: TrainedAnomalyModel | null;
  aiReport: AIDecisionReport;
  onUpdateThresholds: (t: RiskThresholds) => void;
  onResetThresholds: () => void;
  onApplyAiRecommendation: (strategy: 'full_shutdown' | 'throttle_to_extraction') => void;
  onLaunchTracerForWell: (wellId: string) => void;
}

export const RiskAnalysisView: React.FC<RiskAnalysisViewProps> = ({
  timesteps,
  currentTimestep,
  thresholds,
  aiModel,
  aiReport,
  onUpdateThresholds,
  onResetThresholds,
  onApplyAiRecommendation,
  onLaunchTracerForWell,
}) => {
  const stepHours = 6; // 0.25 day intervals
  let integratedRiskyHours = 0;
  let ruleOnlyHours = 0;
  let aiAnomalyCount = 0;
  let aiEarlyWarningCount = 0;
  let imbalanceCount = 0;
  let phExceedCount = 0;
  let sulfateExceedCount = 0;
  let gradientExceedCount = 0;

  const gradientDeltas: (number | null)[] = [];
  let steepestDrop = 0;

  for (let i = 0; i < timesteps.length; i++) {
    const t = timesteps[i];
    if (t.combinedAlert) integratedRiskyHours += stepHours;
    if (t.ruleAlert) ruleOnlyHours += stepHours;
    if (t.aiAnomalyFlag) aiAnomalyCount++;
    if (t.aiEarlyWarning) aiEarlyWarningCount++;
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
  const aiScores = timesteps.map((t) => t.aiAnomalyScore);
  const currentAiCutoff = aiModel ? aiModel.getCutoff(thresholds.aiPercentileCutoff) : 0.6;

  const aiFlaggedSteps = timesteps.filter((t) => t.aiAnomalyFlag || t.ruleAlert);

  return (
    <div className="space-y-6">
      {/* Core Built-In AI + Rule Engine Header Banner (No Optional Checkbox — AI Always Active) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <AlertOctagon className="w-6 h-6 text-cyan-400" />
              Core AI Anomaly &amp; Physical Containment Risk Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Unsupervised 100-Tree Isolation Forest ML and deterministic hydrogeological rules operate together continuously at the core of ISL Guard.
            </p>
          </div>

          {/* Permanent Built-In AI Status Indicator */}
          <div className="flex items-center gap-2 bg-cyan-950/50 border border-cyan-700/70 px-3.5 py-2 rounded-xl text-xs">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-bold text-cyan-200">
              AI Core Permanently Active (100-Tree Isolation Forest + Multi-Sensor Rules)
            </span>
          </div>
        </div>

        {/* AI Architecture & Methodology Disclosure */}
        <div className="p-3.5 bg-blue-950/40 border border-blue-900 rounded-xl text-xs text-blue-200 flex items-start gap-3">
          <Cpu className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong>Built-In Machine Learning Architecture:</strong>{' '}
              {aiModel ? (
                <>
                  Trained with <strong>100 Isolation Trees</strong> strictly on{' '}
                  <strong>{aiModel.trainingSampleCount} normal-operation baseline timesteps</strong> (
                  <code className="font-mono text-cyan-300">{aiModel.trainingScenarioLabel}</code>) across 8 multivariate channels (<em>Q_inj, Q_ext, ΔQ, Gradient, Min pH, Perimeter SO₄, Receptor RCV SO₄, Conductivity</em>). Current P{thresholds.aiPercentileCutoff} anomaly cutoff:{' '}
                  <strong className="font-mono text-cyan-300">{currentAiCutoff.toFixed(3)}</strong>.
                </>
              ) : (
                'Calibrating Isolation Forest baseline on normal operation records.'
              )}
            </p>
            <p className="text-slate-400 text-[11px]">
              <Info className="w-3 h-3 inline mr-1 text-slate-400" />
              Whenever either the AI multivariate anomaly score OR any physical containment rule exceeds its limit, ISL Guard automatically triggers the Supervisor Warning &amp; Fail-Safe Countdown.
            </p>
          </div>
        </div>
      </div>

      {/* Central AI Decision Support Card for Active Inspected Day */}
      <AIDecisionCenterCard
        currentTimestep={currentTimestep || timesteps[0] || null}
        aiReport={aiReport}
        onApplyRecommendation={onApplyAiRecommendation}
        onLaunchTracerForWell={onLaunchTracerForWell}
      />

      {/* KPI Cards: Integrated Risk vs Rule vs AI Early Warning */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Total AI + Rule Risky Hours</div>
          <div className="text-2xl font-black font-mono text-rose-400 mt-1">
            {integratedRiskyHours} <span className="text-xs font-semibold text-slate-500">hrs</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Integrated Core Trigger
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Physical Rule Breach Hours</div>
          <div className="text-2xl font-black font-mono text-orange-400 mt-1">
            {ruleOnlyHours} <span className="text-xs font-semibold text-slate-500">hrs</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            ΔQ:{imbalanceCount} · pH:{phExceedCount} · SO4:{sulfateExceedCount} · Grad:{gradientExceedCount}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">AI Anomaly Detections</div>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {aiAnomalyCount} <span className="text-xs font-semibold text-slate-500">steps</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {aiAnomalyCount * stepHours} hrs above {currentAiCutoff.toFixed(3)} cutoff
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">AI Pre-Threshold Early Warnings</div>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {aiEarlyWarningCount} <span className="text-xs font-semibold text-slate-500">steps</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {aiEarlyWarningCount * stepHours} hrs caught BEFORE rule breach
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Max Gradient Drop Rate</div>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {steepestDrop.toFixed(2)} <span className="text-xs font-semibold text-slate-500">/day</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {gradientExceedCount} steps below {thresholds.gradientLowerLimit.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Calibrated Thresholds & AI Sensitivity Calibration */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">
              Engineering Safety Thresholds &amp; AI Quantile Calibration
            </h3>
          </div>
          <button
            type="button"
            onClick={onResetThresholds}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Calibrated Defaults
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-5 text-xs">
          {/* 1. Allowed Imbalance */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Allowed ΔQ</span>
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
            <p className="text-[11px] text-slate-500">Max excess injection flow.</p>
          </div>

          {/* 2. Boundary pH Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Min pH Limit</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.phLowerLimit.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="5.0"
              max="6.4"
              step="0.05"
              value={thresholds.phLowerLimit}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, phLowerLimit: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Minimum perimeter pH.</p>
          </div>

          {/* 3. Sulfate Upper Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Sulfate Limit</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.sulfateUpperLimit.toFixed(0)} mg/L
              </span>
            </div>
            <input
              type="range"
              min="52"
              max="120"
              step="2"
              value={thresholds.sulfateUpperLimit}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, sulfateUpperLimit: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Max MON / RCV sulfate.</p>
          </div>

          {/* 4. Hydraulic Gradient Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Gradient Limit</span>
              <span className="font-mono font-bold text-cyan-400">
                {thresholds.gradientLowerLimit.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min="-0.2"
              max="0.5"
              step="0.05"
              value={thresholds.gradientLowerLimit}
              onChange={(e) =>
                onUpdateThresholds({ ...thresholds, gradientLowerLimit: parseFloat(e.target.value) })
              }
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">Min inward gradient proxy.</p>
          </div>

          {/* 5. AI Cutoff Percentile */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">AI Sensitivity</span>
              <span className="font-mono font-bold text-emerald-400">
                P{thresholds.aiPercentileCutoff}
              </span>
            </div>
            <input
              type="range"
              min="90"
              max="99"
              step="1"
              value={thresholds.aiPercentileCutoff}
              onChange={(e) =>
                onUpdateThresholds({
                  ...thresholds,
                  aiPercentileCutoff: parseInt(e.target.value, 10),
                })
              }
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500">
              Isolation Forest cutoff ({currentAiCutoff.toFixed(3)}).
            </p>
          </div>

          {/* 6. Approval Timeout */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-300">Approval Timer</span>
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
            <p className="text-[11px] text-slate-500">Auto-stop timeout window.</p>
          </div>
        </div>
      </div>

      {/* Isolation Forest Anomaly Score Chart */}
      <EngineeringChart
        title="Isolation Forest Unsupervised AI Anomaly Score Trajectory"
        subtitle="Path-length anomaly score s(x, n) across 8 sensor dimensions; points above cutoff flag multivariate excursion signatures"
        xLabels={dayLabels}
        xAxisTitle="Timeline (Days)"
        yAxisTitle="AI Anomaly Score (0 - 1)"
        yMin={0.35}
        yMax={0.85}
        series={[
          {
            name: 'Isolation Forest Score',
            color: '#22d3ee',
            strokeWidth: 2,
            data: aiScores,
          },
        ]}
        thresholds={[
          {
            value: Number(currentAiCutoff.toFixed(3)),
            label: `P${thresholds.aiPercentileCutoff} Normal Baseline Cutoff`,
            color: '#f59e0b',
            dash: '4 4',
          },
        ]}
      />

      {/* Composite Risk & Gradient Rate-of-Change Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngineeringChart
          title="Integrated AI + Rule Risk Score Trajectory"
          subtitle="Combining deterministic threshold rules, Isolation Forest anomaly score, and missing/faulty sensor uncertainty"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Risk Score (0 - 1)"
          yMin={0}
          yMax={1}
          series={[
            {
              name: 'Integrated Risk Score',
              color: '#f43f5e',
              strokeWidth: 2,
              data: riskScores,
            },
          ]}
          thresholds={[
            {
              value: 0.45,
              label: 'High Risk Reference (0.45)',
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
              color: '#a855f7',
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

      {/* AI vs Rule Detection Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 mb-3">
          AI Anomaly &amp; Physical Threshold Detection Log ({aiFlaggedSteps.length} Flagged Timesteps)
        </h3>
        <div className="overflow-x-auto max-h-80 border border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2 px-3">Day</th>
                <th className="py-2 px-3">Scenario</th>
                <th className="py-2 px-3">Gradient</th>
                <th className="py-2 px-3">Min pH</th>
                <th className="py-2 px-3">Max Sulfate</th>
                <th className="py-2 px-3">AI Score</th>
                <th className="py-2 px-3">Detection Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              {aiFlaggedSteps.length > 0 ? (
                aiFlaggedSteps.slice(0, 140).map((t) => (
                  <tr key={t.day} className="hover:bg-slate-800/40">
                    <td className="py-1.5 px-3 font-sans">{t.day.toFixed(2)}</td>
                    <td className="py-1.5 px-3 font-sans text-slate-400">{t.scenarioName}</td>
                    <td className={`py-1.5 px-3 ${t.gradientAlert ? 'text-red-400 font-bold' : ''}`}>
                      {t.hydraulicGradient !== null ? t.hydraulicGradient.toFixed(2) : 'MISSING'}
                    </td>
                    <td className={`py-1.5 px-3 ${t.phAlert ? 'text-red-400 font-bold' : ''}`}>
                      {t.boundaryPhMin !== null ? t.boundaryPhMin.toFixed(2) : 'MISSING'}
                    </td>
                    <td className={`py-1.5 px-3 ${t.sulfateAlert ? 'text-red-400 font-bold' : ''}`}>
                      {t.boundarySulfateMax !== null ? `${t.boundarySulfateMax.toFixed(1)} mg/L` : 'MISSING'}
                    </td>
                    <td className="py-1.5 px-3 text-cyan-400 font-bold">
                      {t.aiAnomalyScore !== null ? t.aiAnomalyScore.toFixed(3) : 'N/A'}
                    </td>
                    <td className="py-1.5 px-3 font-sans">
                      {t.aiEarlyWarning ? (
                        <span className="text-emerald-400 font-bold">
                          AI Early Warning (Pre-Threshold Drift)
                        </span>
                      ) : t.aiAnomalyFlag && t.ruleAlert ? (
                        <span className="text-rose-400 font-bold">
                          Confirmed AI + Rule Breach
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold">
                          Physical Rule Breach
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center font-sans text-slate-500">
                    No rule breaches or AI anomalies detected in the selected scenario window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
