import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Cpu,
  Radio,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AIDecisionReport } from '../services/aiDecisionService';
import { TimestepSummary } from '../types/islData';

interface LiveSystemGuideProps {
  currentTimestep: TimestepSummary | null;
  aiReport: AIDecisionReport;
  isLivePlaying: boolean;
  liveSpeed: 1 | 3;
  onToggleLivePlay: () => void;
  onStepForward: () => void;
  onChangeLiveSpeed: (speed: 1 | 3) => void;
}

export const LiveSystemGuide: React.FC<LiveSystemGuideProps> = ({
  currentTimestep,
  aiReport,
  isLivePlaying,
  liveSpeed,
  onToggleLivePlay,
  onStepForward,
  onChangeLiveSpeed,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);

  return (
    <div className="bg-slate-900/95 border border-cyan-800/60 rounded-2xl p-4 shadow-xl mb-6 space-y-3">
      {/* Top Bar: Title + Live System Runner Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
              isLivePlaying
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 animate-pulse'
                : 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
            }`}
          >
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black tracking-wide text-slate-100 uppercase">
                Live System Guide &amp; Real-Time AI Telemetry Loop
              </span>
              {currentTimestep && (
                <span className="font-mono text-xs text-cyan-300 font-bold">
                  Day {currentTimestep.day.toFixed(2)} · {currentTimestep.scenarioName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Explains step-by-step how sensor telemetry, built-in Isolation Forest AI, decision recommendations, and fail-safe pump control operate right now.
            </p>
          </div>
        </div>

        {/* Interactive Live Playback & Expand Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleLivePlay}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
              isLivePlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {isLivePlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Live Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Live Stream</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onStepForward}
            title="Advance +6 hours (0.25 day)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
            <span>+6h</span>
          </button>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => onChangeLiveSpeed(1)}
              className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                liveSpeed === 1 ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              1x
            </button>
            <button
              type="button"
              onClick={() => onChangeLiveSpeed(3)}
              className={`px-2 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                liveSpeed === 3 ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              3x
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title={expanded ? 'Collapse system guide' : 'Expand system guide'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 4-Step Live Operational Narrator Grid */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 pt-2 border-t border-slate-800/90 text-xs">
          {/* Step 1 */}
          <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>1. Field Sensor Stream</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {aiReport.liveNarratorSteps.step1Telemetry}
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-purple-300">
              <Cpu className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>2. Core AI &amp; Threshold Scan</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {aiReport.liveNarratorSteps.step2AiAnalysis}
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>3. AI Decision Support</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {aiReport.liveNarratorSteps.step3DecisionSupport}
            </p>
          </div>

          {/* Step 4 */}
          <div className="bg-slate-950/85 border border-slate-800 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>4. Closed-Loop Control State</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {aiReport.liveNarratorSteps.step4ControlLoop}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
