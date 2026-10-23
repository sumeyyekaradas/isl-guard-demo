import React from 'react';
import {
  Sliders,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Info,
  Scale,
} from 'lucide-react';
import { TimestepSummary, InterventionConfig, RiskThresholds, LogEntry } from '../types/islData';
import { InterventionComparison } from '../services/interventionService';
import { EngineeringChart } from '../components/EngineeringChart';

interface InterventionSimulationViewProps {
  timesteps: TimestepSummary[];
  currentTimestep: TimestepSummary | null;
  intervention: InterventionConfig;
  onApproveIntervention: () => void;
  onRejectIntervention: () => void;
  onManualTrip: () => void;
  onResetIntervention: () => void;
  onToggleMaintainExtraction: (maintain: boolean) => void;
  onSelectStrategy: (strat: 'throttle_to_extraction' | 'full_shutdown') => void;
  comparison: InterventionComparison;
  eventLogs: LogEntry[];
  thresholds: RiskThresholds;
  onTriggerWarningTest?: () => void;
  onOpenComparisonTab?: () => void;
}

export const InterventionSimulationView: React.FC<InterventionSimulationViewProps> = ({
  timesteps,
  currentTimestep,
  intervention,
  onApproveIntervention,
  onRejectIntervention,
  onManualTrip,
  onResetIntervention,
  onToggleMaintainExtraction,
  onSelectStrategy,
  comparison,
  eventLogs,
  thresholds,
  onTriggerWarningTest,
  onOpenComparisonTab,
}) => {
  const latest = currentTimestep || timesteps[timesteps.length - 1];
  const isPostIntervention =
    intervention.status === 'approved' ||
    intervention.status === 'auto_tripped' ||
    intervention.status === 'active';
  const isWarningActive =
    intervention.status === 'awaiting_approval' ||
    (Boolean(latest?.combinedAlert) && !isPostIntervention && intervention.status !== 'rejected');

  const dayLabels = comparison.simulatedTimesteps.map((t) => t.day.toFixed(2));

  return (
    <div className="space-y-6">
      {/* Simulation Cockpit Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-cyan-400" />
            Intervention Simulation &amp; Fail-Safe Control
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            When an excursion warning triggers, supervisor authorization is requested. If no response arrives before timeout, injection automatically shuts down.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onTriggerWarningTest && (
            <button
              type="button"
              onClick={onTriggerWarningTest}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/50 text-amber-300 hover:bg-amber-500/25 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Warning &amp; Supervisor Prompt</span>
            </button>
          )}

          {onOpenComparisonTab && (
            <button
              type="button"
              onClick={onOpenComparisonTab}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Full Before/After Audit</span>
            </button>
          )}
        </div>
      </div>

      {/* Operator Intervention Control Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">
              Supervisor Authorization &amp; Emergency Trip Console
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">
              Protocol Status:{' '}
              <strong className="text-slate-100 uppercase">
                {intervention.status.replace('_', ' ')}
              </strong>
            </span>
            <button
              type="button"
              onClick={onResetIntervention}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Simulation
            </button>
          </div>
        </div>

        {/* Live Warning / Action Panel */}
        {isWarningActive ? (
          <div className="p-5 bg-amber-950/40 border border-amber-700/80 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-200">
                    SUPERVISOR AUTHORIZATION REQUESTED — EXCURSION RISK WARNING
                  </h4>
                  <p className="text-xs text-amber-300/85 mt-0.5">
                    Inspected Day {latest ? latest.day.toFixed(2) : '0.00'} · Flow imbalance:{' '}
                    {latest ? latest.netImbalance.toFixed(1) : '0.0'} m³/h (Demo limit: {thresholds.allowedImbalance} m³/h).
                    If unanswered before countdown expires, injection automatically stops (Q_inj = 0 m³/h).
                  </p>
                </div>
              </div>

              {/* Countdown Display */}
              <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-950 px-4 py-2 rounded-xl border border-amber-800/80">
                <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-xs text-slate-400">Auto-Stop in:</span>
                <span className="text-lg font-black font-mono text-amber-300">
                  {intervention.countdownRemaining}s
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onApproveIntervention}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs transition-colors cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                Approve Intervention
              </button>

              <button
                type="button"
                onClick={onRejectIntervention}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                Reject Warning
              </button>

              <button
                type="button"
                onClick={onManualTrip}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-700 text-red-300 font-semibold text-xs transition-colors sm:ml-auto cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Immediate Emergency Shutdown (Q_inj = 0)
              </button>
            </div>
          </div>
        ) : isPostIntervention ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <div className="text-sm font-bold text-emerald-200">
                  {intervention.status === 'auto_tripped'
                    ? 'AUTOMATIC FAIL-SAFE SHUTDOWN ENGAGED (Supervisor Timeout / Emergency Trip)'
                    : 'INTERVENTION APPROVED BY SUPERVISOR'}
                </div>
                <div className="text-xs text-emerald-300/85 mt-0.5">
                  Applied from Day {intervention.appliedAtDay !== null ? intervention.appliedAtDay.toFixed(2) : '0.00'} ·
                  Injection: <strong>{intervention.mode === 'full_shutdown' ? 'Stopped (0.0 m³/h)' : 'Throttled to Extraction Bleed'}</strong> ·
                  Extraction: <strong>{intervention.maintainExtraction ? 'Continued (Inward Capture Cone)' : 'Stopped'}</strong>.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onResetIntervention}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Return to Nominal Baseline
            </button>
          </div>
        ) : (
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span>
              {intervention.status === 'rejected'
                ? 'Supervisor manually overrode the active warning; baseline pumping continues.'
                : 'No active warning on the currently inspected timestamp. Scrub to a risky day or click "Simulate Warning" to test the approval countdown.'}
            </span>
            <button
              type="button"
              onClick={onManualTrip}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 text-xs font-medium cursor-pointer"
            >
              Apply Immediate Shutdown
            </button>
          </div>
        )}

        {/* Intervention Strategy & Hydrogeological Scenario Assumptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-200 block mb-2.5">
              Injection Mitigation Strategy (When Approved)
            </span>
            <div className="space-y-2.5 text-xs">
              <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="strat"
                  checked={intervention.mode === 'full_shutdown'}
                  onChange={() => onSelectStrategy('full_shutdown')}
                  className="accent-cyan-400"
                />
                <span>Full Injection Shutdown (Q_inj = 0.0 m³/h — also used on Auto-Stop Timeout)</span>
              </label>
              <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="strat"
                  checked={intervention.mode === 'throttle_to_extraction'}
                  onChange={() => onSelectStrategy('throttle_to_extraction')}
                  className="accent-cyan-400"
                />
                <span>Throttle Injection Below Extraction Rate (98% Bleed Equilibrium)</span>
              </label>
            </div>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-200 block mb-2">
              Separate Extraction Scenario Assumption
            </span>
            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={intervention.maintainExtraction}
                onChange={(e) => onToggleMaintainExtraction(e.target.checked)}
                className="mt-0.5 accent-cyan-400"
              />
              <div>
                <span className="font-semibold text-cyan-300">
                  Continue Extraction Pumping After Injection Cutback
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Scenario assumption: Maintaining recovery pumping while injection is halted or throttled generates an inward hydraulic sink to recapture migrating lixiviant. Toggle off to compare simultaneous full-field shutdown.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Recalculated Before vs. After Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <EngineeringChart
          title="Recalculated Injection & Extraction Flow Rates"
          subtitle="Post-intervention flow balance across active scenario timeline"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Flow Rate (m³/h)"
          series={[
            {
              name: 'Simulated Injection Rate',
              color: '#38bdf8',
              strokeWidth: 2,
              data: comparison.simulatedTimesteps.map((t) => t.injectionRate),
              unit: 'm³/h',
            },
            {
              name: 'Simulated Extraction Rate',
              color: '#34d399',
              strokeWidth: 1.5,
              data: comparison.simulatedTimesteps.map((t) => t.extractionRate),
              unit: 'm³/h',
            },
          ]}
        />

        <EngineeringChart
          title="Recalculated Risk Score Trajectory"
          subtitle="Comparing baseline risk (rose) against post-intervention simulated risk (emerald)"
          xLabels={dayLabels}
          xAxisTitle="Timeline (Days)"
          yAxisTitle="Risk Score (0 - 1)"
          yMin={0}
          yMax={1}
          series={[
            {
              name: 'Baseline Risk Score',
              color: '#f43f5e',
              strokeWidth: 1.5,
              data: timesteps.map((t) => t.riskScore),
            },
            {
              name: 'Post-Intervention Risk Score',
              color: '#10b981',
              strokeWidth: 2,
              data: comparison.simulatedTimesteps.map((t) => t.riskScore),
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
      </div>

      {/* Hydrogeological Advisory Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Hydrogeological Validation Requirement: </strong>
          Site-specific hydrogeological verification—including multi-well aquifer pumping tests, tracer tests, and calibrated numerical groundwater modeling (MODFLOW / MT3DMS)—is mandatory prior to deploying automated pumping rules in real ISL operations. This proof-of-concept simulation performs zero physical equipment or PLC control.
        </div>
      </div>

      {/* Operator Protocol Event Log */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-slate-100 mb-3">
          Chronological Supervisor &amp; Fail-Safe Audit Log
        </h3>
        {eventLogs.length > 0 ? (
          <div className="overflow-x-auto max-h-60 border border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2 px-3 w-28">Timestamp</th>
                  <th className="py-2 px-3 w-24">Sim Day</th>
                  <th className="py-2 px-3 w-24">Category</th>
                  <th className="py-2 px-3">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {eventLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40">
                    <td className="py-1.5 px-3 font-sans text-slate-400">{log.timestamp}</td>
                    <td className="py-1.5 px-3 text-cyan-400">Day {log.day.toFixed(2)}</td>
                    <td className="py-1.5 px-3 font-sans font-bold">
                      <span
                        className={
                          log.type === 'ACTION'
                            ? 'text-emerald-400'
                            : log.type === 'CRITICAL' || log.type === 'ALERT'
                            ? 'text-red-400'
                            : log.type === 'WARNING'
                            ? 'text-amber-400'
                            : 'text-slate-300'
                        }
                      >
                        {log.type}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-sans text-slate-200">
                      <strong>{log.title}:</strong> {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-slate-500 p-3 text-center">
            No warning or intervention events logged in the current session.
          </div>
        )}
      </div>
    </div>
  );
};
