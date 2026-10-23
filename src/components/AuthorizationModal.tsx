import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  StopCircle,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  ArrowLeft,
} from 'lucide-react';
import { TimestepSummary, InterventionConfig, RiskThresholds } from '../types/islData';

interface AuthorizationModalProps {
  isOpen: boolean;
  intervention: InterventionConfig;
  currentTimestep: TimestepSummary | null;
  thresholds: RiskThresholds;
  onApprove: () => void;
  onReject: () => void;
  onImmediateStop: () => void;
  onRestart: () => void;
  onClose: () => void;
}

export const AuthorizationModal: React.FC<AuthorizationModalProps> = ({
  isOpen,
  intervention,
  currentTimestep,
  thresholds,
  onApprove,
  onReject,
  onImmediateStop,
  onRestart,
  onClose,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Always allow closing with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Play subtle warning beep on countdown tick and properly close AudioContext
  useEffect(() => {
    if (!soundEnabled || !isOpen || intervention.status !== 'awaiting_approval') return;

    let ctx: AudioContext | null = null;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(
          intervention.countdownRemaining <= 5 ? 880 : 587.33,
          ctx.currentTime
        );
        gain.gain.setValueAtTime(0.035, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
        setTimeout(() => {
          if (ctx && ctx.state !== 'closed') {
            ctx.close().catch(() => {});
          }
        }, 220);
      }
    } catch {
      // Blocked by browser autoplay policy
    }

    return () => {
      if (ctx && ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    };
  }, [intervention.countdownRemaining, isOpen, intervention.status, soundEnabled]);

  if (!isOpen) return null;

  const isAutoTripped = intervention.status === 'auto_tripped';
  const isAwaitingApproval = intervention.status === 'awaiting_approval';
  const isApproved = intervention.status === 'approved';
  const isRejected = intervention.status === 'rejected';

  const progressPercent = Math.max(
    0,
    Math.min(100, (intervention.countdownRemaining / Math.max(thresholds.countdownSeconds, 1)) * 100)
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div
        className={`w-full max-w-2xl bg-slate-900 border-2 rounded-2xl shadow-2xl overflow-hidden transition-all ${
          isAutoTripped
            ? 'border-red-600'
            : isAwaitingApproval
            ? 'border-amber-500'
            : 'border-slate-700'
        }`}
      >
        {/* Top Header Banner */}
        <div
          className={`px-5 py-4 flex items-center justify-between gap-3 text-white ${
            isAutoTripped
              ? 'bg-red-900'
              : isAwaitingApproval
              ? 'bg-amber-700'
              : isApproved
              ? 'bg-emerald-800'
              : 'bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isAutoTripped ? (
              <StopCircle className="w-7 h-7 text-white shrink-0 animate-pulse" />
            ) : isAwaitingApproval ? (
              <AlertTriangle className="w-7 h-7 text-amber-100 shrink-0" />
            ) : (
              <CheckCircle className="w-7 h-7 text-emerald-200 shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black tracking-wide uppercase truncate">
                {isAutoTripped
                  ? 'Fail-Safe Auto-Stop Engaged — Injection Halted'
                  : isAwaitingApproval
                  ? 'Supervisor Authorization Required — Excursion Warning'
                  : isApproved
                  ? 'Intervention Approved — Mitigation Active'
                  : 'Supervisor Override Recorded'}
              </h3>
              <p className="text-xs text-white/85 mt-0.5">
                {isAutoTripped
                  ? 'No supervisor response within countdown window; injection stopped automatically.'
                  : 'Excursion risk detected. Authorize shutdown now, or injection will stop automatically on timeout.'}
              </p>
            </div>
          </div>

          {/* Header Controls: Mute & Dismiss */}
          <div className="flex items-center gap-2 shrink-0">
            {isAwaitingApproval && (
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-lg bg-black/25 hover:bg-black/40 text-white transition-colors cursor-pointer"
                title={soundEnabled ? 'Mute alert tone' : 'Unmute alert tone'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 hover:bg-black/50 text-white text-xs font-bold transition-colors cursor-pointer"
              title="Close dialog and return to dashboard (ESC)"
            >
              <span>Close</span>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-5 text-slate-200 text-sm">
          {/* Telemetry Snapshot */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold uppercase tracking-wider">
                Triggering Telemetry Snapshot
              </span>
              {currentTimestep && (
                <span className="font-mono text-cyan-400">
                  Day {currentTimestep.day.toFixed(2)} · {currentTimestep.scenarioName}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block font-sans">Injection Rate</span>
                <span className="font-bold text-cyan-400 text-sm">
                  {currentTimestep ? currentTimestep.injectionRate.toFixed(1) : '0.0'} m³/h
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block font-sans">Flow Imbalance</span>
                <span className="font-bold text-rose-400 text-sm">
                  {currentTimestep
                    ? `${currentTimestep.netImbalance >= 0 ? '+' : ''}${currentTimestep.netImbalance.toFixed(2)}`
                    : '0.00'}{' '}
                  m³/h
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block font-sans">Boundary pH (Min)</span>
                <span className="font-bold text-amber-400 text-sm">
                  {currentTimestep?.boundaryPhMin !== null && currentTimestep?.boundaryPhMin !== undefined
                    ? currentTimestep.boundaryPhMin.toFixed(2)
                    : 'MISSING'}
                </span>
              </div>
              <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-500 block font-sans">Boundary Sulfate</span>
                <span className="font-bold text-purple-400 text-sm">
                  {currentTimestep?.boundarySulfateMax !== null && currentTimestep?.boundarySulfateMax !== undefined
                    ? `${currentTimestep.boundarySulfateMax.toFixed(1)} mg/L`
                    : 'MISSING'}
                </span>
              </div>
            </div>
          </div>

          {/* 1. ACTIVE COUNTDOWN STATE */}
          {isAwaitingApproval && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-xl space-y-2.5 text-xs text-amber-200">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-2 text-sm text-amber-300">
                    <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                    Supervisor Response Window:
                  </span>
                  <span className="font-mono text-2xl font-black text-amber-300">
                    {intervention.countdownRemaining}s
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-amber-800/80">
                  <div
                    className="h-full bg-amber-400 transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="text-xs text-amber-200/90 leading-relaxed pt-0.5">
                  <strong>Fail-Safe Protocol:</strong> Supervisor authorization is requested to halt/throttle injection. If no decision is submitted before the timer reaches 0s, the simulation automatically stops injection (<strong>Q_inj = 0.0 m³/h</strong>) while maintaining extraction containment.
                </p>
              </div>

              {/* Primary Supervisor Decision Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onApprove}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-sm transition-colors cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve Intervention (Stop / Mitigate)
                </button>

                <button
                  type="button"
                  onClick={onReject}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm border border-slate-700 transition-colors cursor-pointer"
                >
                  <XCircle className="w-5 h-5 text-slate-400" />
                  Reject Warning (Continue Baseline)
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Return to Dashboard (Timer continues in top bar)
                </button>
                <button
                  type="button"
                  onClick={onImmediateStop}
                  className="px-3.5 py-2 rounded-lg bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Emergency Stop Immediately (Q_inj = 0)
                </button>
              </div>
            </div>
          )}

          {/* 2. AUTO-TRIPPED STATE */}
          {isAutoTripped && (
            <div className="space-y-4">
              <div className="p-4 bg-red-950/60 border border-red-700 rounded-xl space-y-2 text-xs text-red-100">
                <div className="font-bold text-sm text-red-300 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                  Automatic Injection Shutdown Applied (No Supervisor Response)
                </div>
                <p className="leading-relaxed">
                  No response was received within the {thresholds.countdownSeconds}-second approval window. Under closed-loop safety rules, simulated injection has been stopped (<strong className="font-mono text-white">Q_inj = 0.0 m³/h</strong>) while extraction continues according to scenario settings to restore inward hydraulic containment.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Close &amp; Inspect Dashboard Results
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset Simulation to Nominal
                </button>
              </div>
            </div>
          )}

          {/* 3. APPROVED STATE */}
          {isApproved && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-950/60 border border-emerald-700 rounded-xl space-y-2 text-xs text-emerald-200">
                <div className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  Supervisor Approved Intervention
                </div>
                <p className="leading-relaxed">
                  Post-intervention flow balance and risk indicators have been recalculated across the timeline.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* 4. REJECTED STATE */}
          {isRejected && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
                <div className="font-bold text-sm text-amber-400 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-amber-400 shrink-0" />
                  Supervisor Rejected Intervention (Manual Override)
                </div>
                <p className="leading-relaxed text-slate-400">
                  Baseline flow rates remain unaltered and the override decision has been recorded in the audit log.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
