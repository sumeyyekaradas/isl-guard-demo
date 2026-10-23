import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Menu,
  RotateCcw,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import { TimestepSummary, InterventionConfig } from '../types/islData';

interface NavbarProps {
  currentTimestep: TimestepSummary | null;
  intervention: InterventionConfig;
  isModalOpen: boolean;
  onOpenModal: () => void;
  onApproveIntervention: () => void;
  onRejectIntervention: () => void;
  onResetSimulation: () => void;
  onToggleSidebar: () => void;
  selectedScenario: string;
  onSelectScenario: (sc: string) => void;
  scenarios: string[];
  onTriggerWarningTest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTimestep,
  intervention,
  isModalOpen,
  onOpenModal,
  onApproveIntervention,
  onRejectIntervention,
  onResetSimulation,
  onToggleSidebar,
  selectedScenario,
  onSelectScenario,
  scenarios,
  onTriggerWarningTest,
}) => {
  const isInterventionActive =
    intervention.status === 'active' ||
    intervention.status === 'approved' ||
    intervention.status === 'auto_tripped';
  const isTrip = intervention.status === 'auto_tripped';
  const isAwaiting = intervention.status === 'awaiting_approval';
  const isAlert = currentTimestep?.combinedAlert;

  return (
    <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Left Branding */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-base sm:text-lg font-black tracking-wide text-white truncate">
                  ISL GUARD
                </span>
                <span className="hidden xl:inline text-xs text-slate-500">·</span>
                <span className="hidden xl:inline text-xs text-cyan-400 font-medium truncate">
                  Simulation Mode
                </span>
                <span className="hidden 2xl:inline text-xs text-slate-500">·</span>
                <span className="hidden 2xl:inline text-xs text-slate-400 truncate">
                  Synthetic Data — Proof of Concept
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block truncate">
                Closed-Loop In-Situ Leaching Excursion Prevention &amp; Decision Support
              </p>
            </div>
          </div>
        </div>

        {/* Right Controls & System Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Scenario Quick Selector */}
          <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
            <span className="text-slate-400">Scenario:</span>
            <select
              value={selectedScenario}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="bg-transparent text-cyan-300 font-semibold focus:outline-hidden cursor-pointer max-w-[170px] truncate"
            >
              <option value="ALL" className="bg-slate-900 text-white">
                All Scenarios (180d)
              </option>
              {scenarios.map((sc) => (
                <option key={sc} value={sc} className="bg-slate-900 text-white">
                  {sc}
                </option>
              ))}
            </select>
          </div>

          {/* Test Warning & Supervisor Authorization Flow */}
          <button
            onClick={onTriggerWarningTest}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/40 hover:bg-amber-500/25 transition-colors cursor-pointer"
            title="Trigger excursion warning and supervisor authorization countdown"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulate Warning</span>
          </button>

          {/* System Status Text Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
            {isTrip ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-red-400">Status: Auto-Stopped</span>
              </>
            ) : isAwaiting ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                <span className="text-amber-300">
                  Awaiting Approval ({intervention.countdownRemaining}s)
                </span>
              </>
            ) : isInterventionActive ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-cyan-300">Status: Mitigation Active</span>
              </>
            ) : isAlert ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-300">Status: Excursion Warning</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-emerald-400">Status: Nominal</span>
              </>
            )}
          </div>

          {/* Compact PoC Sub-row for medium screens */}
          <span className="hidden lg:inline xl:hidden text-[11px] text-slate-400">
            Simulation · Synthetic PoC
          </span>

          {/* Reset simulation button */}
          <button
            onClick={onResetSimulation}
            title="Reset simulation state to nominal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-header metadata strip for mobile/tablet visibility of required labels */}
      <div className="xl:hidden border-t border-slate-900 bg-slate-950/95 px-4 py-1.5 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400 font-medium">Simulation Mode</span>
          <span>·</span>
          <span>Synthetic Data — Proof of Concept</span>
        </div>
        <button
          onClick={onTriggerWarningTest}
          className="sm:hidden text-amber-300 font-semibold underline cursor-pointer"
        >
          Simulate Warning
        </button>
      </div>

      {/* Non-blocking Supervisor Action Banner when modal is dismissed during active warning or auto-stop */}
      {!isModalOpen && isAwaiting && (
        <div className="bg-amber-950/90 border-t border-amber-700/70 px-4 py-2 text-xs text-amber-100">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
              <span>
                <strong>Supervisor Authorization Required:</strong> Excursion warning active. If no response is received within{' '}
                <strong className="font-mono text-amber-300 text-sm">
                  {intervention.countdownRemaining}s
                </strong>
                , injection will stop automatically.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onApproveIntervention}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition-colors cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Approve Stop
              </button>
              <button
                onClick={onRejectIntervention}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reject
              </button>
              <button
                onClick={onOpenModal}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-900/70 hover:bg-amber-800 text-amber-200 font-medium transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Details
              </button>
            </div>
          </div>
        </div>
      )}

      {!isModalOpen && isTrip && (
        <div className="bg-red-950/85 border-t border-red-800/80 px-4 py-2 text-xs text-red-100">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                <strong>Fail-Safe Auto-Stop Engaged:</strong> Injection automatically halted (Q_inj = 0.0 m³/h) due to supervisor timeout or emergency trip. You can freely inspect all charts or reset simulation.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenModal}
                className="px-2.5 py-1 rounded-lg bg-red-900/70 hover:bg-red-800 text-red-100 font-medium transition-colors cursor-pointer"
              >
                View Notice
              </button>
              <button
                onClick={onResetSimulation}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                Reset to Normal
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
