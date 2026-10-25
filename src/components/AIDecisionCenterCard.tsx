import React from 'react';
import {
  Cpu,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  FlaskConical,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { AIDecisionReport } from '../services/aiDecisionService';
import { TimestepSummary } from '../types/islData';

interface AIDecisionCenterCardProps {
  currentTimestep: TimestepSummary | null;
  aiReport: AIDecisionReport;
  onApplyRecommendation: (strategy: 'full_shutdown' | 'throttle_to_extraction') => void;
  onLaunchTracerForWell: (wellId: string) => void;
}

export const AIDecisionCenterCard: React.FC<AIDecisionCenterCardProps> = ({
  currentTimestep,
  aiReport,
  onApplyRecommendation,
  onLaunchTracerForWell,
}) => {
  if (!currentTimestep) return null;

  const borderStyle =
    aiReport.urgency === 'CRITICAL'
      ? 'border-red-600/80 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950/30'
      : aiReport.urgency === 'WARNING'
      ? 'border-amber-500/80 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/25'
      : aiReport.urgency === 'ADVISORY'
      ? 'border-cyan-600/70 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/25'
      : 'border-emerald-700/60 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20';

  const statusTextColor =
    aiReport.urgency === 'CRITICAL'
      ? 'text-red-400'
      : aiReport.urgency === 'WARNING'
      ? 'text-amber-300'
      : aiReport.urgency === 'ADVISORY'
      ? 'text-cyan-300'
      : 'text-emerald-400';

  const canApplyMitigation = aiReport.recommendedStrategy !== 'nominal';

  return (
    <div className={`border-2 rounded-2xl p-5 shadow-2xl space-y-4 ${borderStyle}`}>
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/90">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black tracking-wider uppercase text-cyan-400">
                Central AI Decision Support Engine
              </span>
              <span className="text-slate-600">·</span>
              <span className={`text-xs font-black uppercase flex items-center gap-1 ${statusTextColor}`}>
                {aiReport.urgency === 'CRITICAL' ? (
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : aiReport.urgency === 'WARNING' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                {aiReport.urgency} PRIORITY
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-100 mt-0.5">
              {aiReport.headline}
            </h3>
          </div>
        </div>

        {/* Built-In Isolation Forest Live Telemetry Readout */}
        <div className="flex items-center gap-4 bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-2.5 text-xs shrink-0">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">
              Isolation Forest Score
            </span>
            <span
              className={`font-mono text-base font-black ${
                currentTimestep.aiAnomalyFlag ? 'text-rose-400' : 'text-cyan-400'
              }`}
            >
              {currentTimestep.aiAnomalyScore !== null
                ? currentTimestep.aiAnomalyScore.toFixed(3)
                : 'MISSING'}
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              {' '}
              / {currentTimestep.aiAnomalyCutoff.toFixed(3)}
            </span>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">
              Target INJ-01 Rate
            </span>
            <span className="font-mono text-base font-black text-emerald-400">
              {aiReport.recommendedInjectionRateM3h.toFixed(1)} m³/h
            </span>
          </div>
        </div>
      </div>

      {/* Diagnostic Explanation */}
      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
        {aiReport.summaryExplanation}
      </p>

      {/* Two-Column Core Intelligence Grid: Multi-Sensor Evidence + Actionable Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
        {/* Left: Sensor Findings & Flagged Wells */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="font-bold text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Multi-Sensor Evidence &amp; Spatial Cross-Check</span>
          </div>
          <ul className="space-y-1.5 text-slate-300">
            {aiReport.sensorFindings.map((finding, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>

          {aiReport.affectedWells.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-400 font-semibold">Flagged Wells:</span>
              {aiReport.affectedWells.slice(0, 10).map((wellId) => (
                <span
                  key={wellId}
                  className="font-mono text-[11px] font-bold text-amber-300 bg-amber-950/50 border border-amber-800/60 px-2 py-0.5 rounded-md"
                >
                  {wellId}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: AI Control Prescription & Action Steps */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="font-bold text-slate-200 flex items-center justify-between gap-2">
              <span>AI Recommended Control &amp; Field Actions</span>
              <span className="text-[11px] font-mono text-emerald-400">
                {aiReport.recommendedStrategyLabel}
              </span>
            </div>
            <ul className="space-y-1.5 text-slate-300">
              {aiReport.actionRecommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interactive Decision Execution Buttons */}
          <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2.5">
            {canApplyMitigation && (
              <button
                type="button"
                onClick={() =>
                  onApplyRecommendation(
                    aiReport.recommendedStrategy === 'full_shutdown'
                      ? 'full_shutdown'
                      : 'throttle_to_extraction'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs transition-colors cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  Apply AI Recommendation (
                  {aiReport.recommendedStrategy === 'full_shutdown'
                    ? 'Stop INJ-01 = 0 m³/h'
                    : `Throttle INJ-01 = ${aiReport.recommendedInjectionRateM3h.toFixed(1)} m³/h`}
                  )
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onLaunchTracerForWell(aiReport.recommendedTracerWellId)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 font-bold text-xs transition-colors cursor-pointer"
            >
              <FlaskConical className="w-4 h-4 text-cyan-400" />
              <span>Run Live Tracer Test (INJ-01 &rarr; {aiReport.recommendedTracerWellId})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
