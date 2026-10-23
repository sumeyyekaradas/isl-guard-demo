import React from 'react';
import {
  Scale,
  TrendingDown,
  Info,
  Calendar,
  Download,
} from 'lucide-react';
import { InterventionComparison } from '../services/interventionService';
import { TimestepSummary, RiskThresholds } from '../types/islData';
import { EngineeringChart } from '../components/EngineeringChart';

interface BeforeAfterComparisonViewProps {
  baselineTimesteps: TimestepSummary[];
  comparison: InterventionComparison;
  thresholds: RiskThresholds;
  appliedAtDay: number | null;
}

export const BeforeAfterComparisonView: React.FC<BeforeAfterComparisonViewProps> = ({
  baselineTimesteps,
  comparison,
  thresholds,
  appliedAtDay,
}) => {
  const { before, after, delta, simulatedTimesteps } = comparison;
  const dayLabels = baselineTimesteps.map((t) => t.day.toFixed(2));

  const handleDownloadComparisonCSV = () => {
    const headers = [
      'day',
      'scenario',
      'baseline_injection_m3h',
      'simulated_injection_m3h',
      'baseline_extraction_m3h',
      'simulated_extraction_m3h',
      'baseline_imbalance_m3h',
      'simulated_imbalance_m3h',
      'baseline_ph_min',
      'simulated_ph_min',
      'baseline_sulfate_max',
      'simulated_sulfate_max',
      'baseline_risk_score',
      'simulated_risk_score',
    ];

    const lines = [headers.join(',')];
    for (let i = 0; i < baselineTimesteps.length; i++) {
      const b = baselineTimesteps[i];
      const s = simulatedTimesteps[i];
      if (!s) continue;
      lines.push(
        [
          b.day.toFixed(2),
          `"${b.scenarioName}"`,
          b.injectionRate.toFixed(2),
          s.injectionRate.toFixed(2),
          b.extractionRate.toFixed(2),
          s.extractionRate.toFixed(2),
          b.netImbalance.toFixed(2),
          s.netImbalance.toFixed(2),
          b.boundaryPhMin !== null ? b.boundaryPhMin.toFixed(2) : '',
          s.boundaryPhMin !== null ? s.boundaryPhMin.toFixed(2) : '',
          b.boundarySulfateMax !== null ? b.boundarySulfateMax.toFixed(1) : '',
          s.boundarySulfateMax !== null ? s.boundarySulfateMax.toFixed(1) : '',
          b.riskScore.toFixed(3),
          s.riskScore.toFixed(3),
        ].join(',')
      );
    }

    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isl_guard_before_after_comparison_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
              <Scale className="w-6 h-6 text-cyan-400" />
              Before-and-After Intervention Comparison
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Evaluated over the exact same timestamps ({baselineTimesteps.length * 6} total hours) and identical threshold criteria.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-xs">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-400">Intervention Timestamp:</span>
              <span className="font-mono font-bold text-cyan-300">
                {appliedAtDay !== null ? `Day ${appliedAtDay.toFixed(2)}` : 'No Intervention Applied Yet'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleDownloadComparisonCSV}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Export Comparison CSV
            </button>
          </div>
        </div>

        {/* Simulation Honesty Disclosure */}
        <div className="p-3.5 bg-blue-950/40 border border-blue-900 rounded-xl text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong>Simulation Scope Disclosure:</strong> Flow balance (ΔQ) after intervention is deterministically recomputed from the simulated pump cutback. Because static CSV data cannot run a 3D groundwater solute transport solver (MODFLOW/MT3DMS) in real time, post-intervention pH and sulfate recovery curves represent a simplified analytical bleed-flushing model rather than verified field aquifer performance.
          </p>
        </div>
      </div>

      {/* Summary KPI Comparison Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Risky Hours</div>
          <div className="my-2">
            <span className="text-xl font-bold font-mono text-rose-400">{before.riskyHours}h</span>
            <span className="text-slate-500 mx-1.5">&rarr;</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{after.riskyHours}h</span>
          </div>
          <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>-{delta.riskyHoursReduction}h ({delta.riskyHoursReductionPercent.toFixed(1)}%)</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Boundary pH Exceedances</div>
          <div className="my-2">
            <span className="text-xl font-bold font-mono text-amber-400">{before.phExceedanceHours / 6}</span>
            <span className="text-slate-500 mx-1.5">&rarr;</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{after.phExceedanceHours / 6}</span>
            <span className="text-xs text-slate-500 ml-1">steps</span>
          </div>
          <div className="text-xs font-semibold text-emerald-400">
            <span>{before.phExceedanceHours}h &rarr; {after.phExceedanceHours}h</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Sulfate Exceedances</div>
          <div className="my-2">
            <span className="text-xl font-bold font-mono text-purple-400">{before.sulfateExceedanceHours / 6}</span>
            <span className="text-slate-500 mx-1.5">&rarr;</span>
            <span className="text-xl font-bold font-mono text-emerald-400">{after.sulfateExceedanceHours / 6}</span>
            <span className="text-xs text-slate-500 ml-1">steps</span>
          </div>
          <div className="text-xs font-semibold text-emerald-400">
            <span>{before.sulfateExceedanceHours}h &rarr; {after.sulfateExceedanceHours}h</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Injection-Extraction Imbalance</div>
          <div className="my-2">
            <span className="text-lg font-bold font-mono text-slate-200">
              {before.totalPositiveImbalanceM3.toFixed(0)}
            </span>
            <span className="text-slate-500 mx-1.5">&rarr;</span>
            <span className="text-lg font-bold font-mono text-cyan-400">
              {after.totalPositiveImbalanceM3.toFixed(0)} m³
            </span>
          </div>
          <div className="text-xs font-semibold text-cyan-400">
            <span>-{delta.imbalanceVolumeReductionM3.toFixed(0)} m³ excess volume</span>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Simulated Intervention Count</div>
          <div className="my-2">
            <span className="text-2xl font-black font-mono text-slate-100">
              {after.interventionsExecuted}
            </span>
            <span className="text-xs font-normal text-slate-500 ml-1">applied</span>
          </div>
          <div className="text-xs text-slate-400">
            {before.interventionsTriggered} baseline alert steps
          </div>
        </div>
      </div>

      {/* Standardized Comparative Metric Audit Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Scale className="w-5 h-5 text-cyan-400" />
          Before-and-After Summary Table
        </h3>

        <div className="overflow-x-auto border border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Metric</th>
                <th className="py-3 px-4">Threshold Definition</th>
                <th className="py-3 px-4">Before Intervention (Baseline)</th>
                <th className="py-3 px-4">After Intervention (Simulated)</th>
                <th className="py-3 px-4">Calculated Difference (&Delta;)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-sans font-semibold text-slate-200">
                  Boundary pH threshold exceedances
                </td>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  pH &lt; {thresholds.phLowerLimit.toFixed(1)}
                </td>
                <td className="py-2.5 px-4 text-amber-400">
                  {before.phExceedanceHours / 6} steps ({before.phExceedanceHours} hrs)
                </td>
                <td className="py-2.5 px-4 text-emerald-400">
                  {after.phExceedanceHours / 6} steps ({after.phExceedanceHours} hrs)
                </td>
                <td className="py-2.5 px-4 text-emerald-400 font-bold">
                  -{delta.phExceedanceReduction / 6} steps (-{delta.phExceedanceReduction} hrs)
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-sans font-semibold text-slate-200">
                  Boundary sulfate threshold exceedances
                </td>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  SO4 &gt; {thresholds.sulfateUpperLimit.toFixed(0)} mg/L
                </td>
                <td className="py-2.5 px-4 text-purple-400">
                  {before.sulfateExceedanceHours / 6} steps ({before.sulfateExceedanceHours} hrs)
                </td>
                <td className="py-2.5 px-4 text-emerald-400">
                  {after.sulfateExceedanceHours / 6} steps ({after.sulfateExceedanceHours} hrs)
                </td>
                <td className="py-2.5 px-4 text-emerald-400 font-bold">
                  -{delta.sulfateExceedanceReduction / 6} steps (-{delta.sulfateExceedanceReduction} hrs)
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-sans font-semibold text-slate-200">
                  Risky hours
                </td>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  Any active threshold breach
                </td>
                <td className="py-2.5 px-4 text-rose-400 font-bold">{before.riskyHours} hrs</td>
                <td className="py-2.5 px-4 text-emerald-400 font-bold">{after.riskyHours} hrs</td>
                <td className="py-2.5 px-4 text-emerald-400 font-bold">
                  -{delta.riskyHoursReduction} hrs (-{delta.riskyHoursReductionPercent.toFixed(1)}%)
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-sans font-semibold text-slate-200">
                  Injection-extraction imbalance (excess volume)
                </td>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  Cumulative &Delta;Q &gt; 0 (m³)
                </td>
                <td className="py-2.5 px-4 text-slate-300">
                  {before.totalPositiveImbalanceM3.toFixed(1)} m³ ({before.imbalanceExceedanceHours} breach hrs)
                </td>
                <td className="py-2.5 px-4 text-cyan-400">
                  {after.totalPositiveImbalanceM3.toFixed(1)} m³ ({after.imbalanceExceedanceHours} breach hrs)
                </td>
                <td className="py-2.5 px-4 text-cyan-400 font-bold">
                  -{delta.imbalanceVolumeReductionM3.toFixed(1)} m³
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-2.5 px-4 font-sans font-semibold text-slate-200">
                  Simulated intervention count
                </td>
                <td className="py-2.5 px-4 font-sans text-slate-400">
                  Operator approval or timeout auto-stop
                </td>
                <td className="py-2.5 px-4 text-slate-400">0 applied ({before.interventionsTriggered} alerts)</td>
                <td className="py-2.5 px-4 text-emerald-400 font-bold">
                  {after.interventionsExecuted} intervention applied
                </td>
                <td className="py-2.5 px-4 text-slate-300 font-bold">
                  +{after.interventionsExecuted} simulated action
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Overlay Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngineeringChart
          title="Flow Imbalance (ΔQ): Before vs. After Intervention"
          subtitle="Direct comparison across identical timeline hours"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Net Imbalance ΔQ (m³/h)"
          series={[
            {
              name: 'Baseline Imbalance (Before)',
              color: '#f97316',
              strokeWidth: 2,
              data: baselineTimesteps.map((t) => t.netImbalance),
              unit: 'm³/h',
            },
            {
              name: 'Simulated Imbalance (After)',
              color: '#10b981',
              strokeWidth: 2,
              data: simulatedTimesteps.map((t) => t.netImbalance),
              unit: 'm³/h',
            },
          ]}
          thresholds={[
            {
              value: thresholds.allowedImbalance,
              label: 'Demo Imbalance Limit',
              color: '#ef4444',
              dash: '4 4',
            },
          ]}
        />

        <EngineeringChart
          title="Risk Score: Before vs. After Intervention"
          subtitle="Recalculated rule-based risk score under identical threshold definitions"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Risk Score (0 - 1)"
          yMin={0}
          yMax={1}
          series={[
            {
              name: 'Baseline Risk (Before)',
              color: '#f43f5e',
              strokeWidth: 2,
              data: baselineTimesteps.map((t) => t.riskScore),
            },
            {
              name: 'Simulated Risk (After)',
              color: '#10b981',
              strokeWidth: 2,
              data: simulatedTimesteps.map((t) => t.riskScore),
            },
          ]}
          thresholds={[
            {
              value: 0.5,
              label: 'Warning Reference',
              color: '#ef4444',
              dash: '4 4',
            },
          ]}
        />
      </div>
    </div>
  );
};
