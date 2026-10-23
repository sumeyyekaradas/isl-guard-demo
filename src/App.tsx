import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  loadDefaultCSV,
  loadDefaultJSON,
  aggregateTimesteps,
} from './services/dataService';
import {
  computeInterventionScenario,
  InterventionComparison,
} from './services/interventionService';
import {
  RawWellRecord,
  JsonFieldConfig,
  RiskThresholds,
  InterventionConfig,
  LogEntry,
} from './types/islData';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { OverviewView } from './views/OverviewView';
import { SensorMonitoringView } from './views/SensorMonitoringView';
import { RiskAnalysisView } from './views/RiskAnalysisView';
import { InterventionSimulationView } from './views/InterventionSimulationView';
import { BeforeAfterComparisonView } from './views/BeforeAfterComparisonView';
import { DataExplorerView } from './views/DataExplorerView';
import { MethodologyView } from './views/MethodologyView';
import { AuthorizationModal } from './components/AuthorizationModal';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const DEFAULT_THRESHOLDS: RiskThresholds = {
  allowedImbalance: 1.5,
  phLowerLimit: 6.0,
  sulfateUpperLimit: 65.0,
  gradientLowerLimit: 0.65,
  countdownSeconds: 15,
};

export const App: React.FC = () => {
  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Data state
  const [records, setRecords] = useState<RawWellRecord[]>([]);
  const [jsonConfig, setJsonConfig] = useState<JsonFieldConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState<string>('isletme_verileri.csv');

  // Filter state
  const [selectedScenario, setSelectedScenario] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<number>(0);

  // Risk Thresholds state
  const [thresholds, setThresholds] = useState<RiskThresholds>(DEFAULT_THRESHOLDS);

  // Intervention simulation state
  const [intervention, setIntervention] = useState<InterventionConfig>({
    mode: 'full_shutdown',
    maintainExtraction: true,
    appliedAtDay: null,
    status: 'idle',
    countdownRemaining: DEFAULT_THRESHOLDS.countdownSeconds,
  });

  // Explicit modal visibility state — closing ALWAYS returns user to normal dashboard
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // Tracks already-prompted scenario+day key so Reset or Close never traps user in a re-open loop
  const [acknowledgedAlertKey, setAcknowledgedAlertKey] = useState<string | null>(null);
  const [eventLogs, setEventLogs] = useState<LogEntry[]>([]);

  // 1. Initial Load of CSV and JSON
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        setLoadError(null);
        const [csvData, jsonData] = await Promise.all([
          loadDefaultCSV(),
          loadDefaultJSON(),
        ]);
        setRecords(csvData);
        setJsonConfig(jsonData);
      } catch (err: any) {
        setLoadError(err.message || 'Failed to load operational dataset files.');
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Scenarios list
  const scenarios = useMemo(() => {
    const s = new Set<string>();
    for (const r of records) {
      if (r.senaryo_adi) s.add(r.senaryo_adi);
    }
    return Array.from(s);
  }, [records]);

  // Filter records by selected scenario
  const filteredRecords = useMemo(() => {
    if (selectedScenario === 'ALL') return records;
    return records.filter((r) => r.senaryo_adi === selectedScenario);
  }, [records, selectedScenario]);

  // Aggregated Timesteps (Baseline)
  const timesteps = useMemo(() => {
    if (filteredRecords.length === 0) return [];
    return aggregateTimesteps(filteredRecords, thresholds);
  }, [filteredRecords, thresholds]);

  // Keep selectedDay within bounds of current scenario's timesteps (defaults to start of window)
  useEffect(() => {
    if (timesteps.length > 0) {
      const minDay = timesteps[0].day;
      const maxDay = timesteps[timesteps.length - 1].day;
      if (selectedDay < minDay || selectedDay > maxDay) {
        // If user selected a specific scenario that contains alerts, focus on first alert day; otherwise first day
        if (selectedScenario !== 'ALL') {
          const firstAlertStep = timesteps.find((t) => t.combinedAlert);
          setSelectedDay(firstAlertStep ? firstAlertStep.day : minDay);
        } else {
          setSelectedDay(minDay);
        }
      }
    }
  }, [timesteps, selectedScenario, selectedDay]);

  // Scenario selection handler
  const handleSelectScenario = (sc: string) => {
    setSelectedScenario(sc);
    if (sc === 'ALL') {
      setSelectedDay(0);
    } else {
      const scRecords = records.filter((r) => r.senaryo_adi === sc);
      const scSteps = aggregateTimesteps(scRecords, thresholds);
      if (scSteps.length > 0) {
        const firstAlert = scSteps.find((t) => t.combinedAlert);
        setSelectedDay(firstAlert ? firstAlert.day : scSteps[0].day);
      }
    }
  };

  // Compute Before vs. After comparison scenario
  const comparison: InterventionComparison = useMemo(() => {
    return computeInterventionScenario(
      timesteps,
      intervention.appliedAtDay,
      intervention.mode,
      intervention.maintainExtraction,
      thresholds
    );
  }, [
    timesteps,
    intervention.appliedAtDay,
    intervention.mode,
    intervention.maintainExtraction,
    thresholds,
  ]);

  // Baseline inspected timestep (for alarm detection)
  const baselineCurrentTimestep = useMemo(() => {
    if (timesteps.length === 0) return null;
    let closest = timesteps[0];
    let minDiff = Math.abs(closest.day - selectedDay);
    for (const t of timesteps) {
      const diff = Math.abs(t.day - selectedDay);
      if (diff < minDiff) {
        minDiff = diff;
        closest = t;
      }
    }
    return closest;
  }, [timesteps, selectedDay]);

  // Active displayed timestep (reflects post-intervention state when mitigation is active)
  const isMitigationActive =
    intervention.status === 'approved' ||
    intervention.status === 'auto_tripped' ||
    intervention.status === 'active';

  const activeTimesteps = isMitigationActive ? comparison.simulatedTimesteps : timesteps;

  const currentTimestep = useMemo(() => {
    if (activeTimesteps.length === 0) return null;
    let closest = activeTimesteps[0];
    let minDiff = Math.abs(closest.day - selectedDay);
    for (const t of activeTimesteps) {
      const diff = Math.abs(t.day - selectedDay);
      if (diff < minDiff) {
        minDiff = diff;
        closest = t;
      }
    }
    return closest;
  }, [activeTimesteps, selectedDay]);

  // Countdown timer ref
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentDayRef = useRef<number>(0);
  useEffect(() => {
    currentDayRef.current = baselineCurrentTimestep ? baselineCurrentTimestep.day : 0;
  }, [baselineCurrentTimestep]);

  // Trigger supervisor authorization prompt when inspecting an unacknowledged alert timestep
  useEffect(() => {
    if (!baselineCurrentTimestep) return;
    const alertKey = `${selectedScenario}:${baselineCurrentTimestep.day.toFixed(2)}`;

    if (
      baselineCurrentTimestep.combinedAlert &&
      intervention.status === 'idle' &&
      acknowledgedAlertKey !== alertKey
    ) {
      setAcknowledgedAlertKey(alertKey);
      setIntervention((prev) => ({
        ...prev,
        status: 'awaiting_approval',
        countdownRemaining: thresholds.countdownSeconds,
      }));
      setIsModalOpen(true);

      setEventLogs((prev) => [
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toLocaleTimeString(),
          day: baselineCurrentTimestep.day,
          type: 'ALERT',
          title: 'Excursion Warning — Supervisor Authorization Requested',
          details: `Threshold breach detected on Day ${baselineCurrentTimestep.day.toFixed(
            2
          )}. Waiting ${thresholds.countdownSeconds}s for supervisor response before automatic shutdown.`,
        },
        ...prev,
      ]);
    }
  }, [
    baselineCurrentTimestep,
    selectedScenario,
    intervention.status,
    acknowledgedAlertKey,
    thresholds.countdownSeconds,
  ]);

  // Active countdown timer tick: if no answer arrives within countdown, automatically stop injection
  useEffect(() => {
    if (intervention.status !== 'awaiting_approval') {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setIntervention((prev) => {
        if (prev.status !== 'awaiting_approval') return prev;
        if (prev.countdownRemaining <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return {
            ...prev,
            mode: 'full_shutdown',
            status: 'auto_tripped',
            countdownRemaining: 0,
            appliedAtDay: currentDayRef.current,
          };
        }
        return { ...prev, countdownRemaining: prev.countdownRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [intervention.status]);

  // Log auto-trip event when status transitions to auto_tripped via timeout
  const prevStatusRef = useRef<string>(intervention.status);
  useEffect(() => {
    if (prevStatusRef.current !== intervention.status) {
      if (
        prevStatusRef.current === 'awaiting_approval' &&
        intervention.status === 'auto_tripped'
      ) {
        setEventLogs((prev) => [
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            day: currentDayRef.current,
            type: 'CRITICAL',
            title: 'Fail-Safe Auto-Stop Engaged (Timeout)',
            details:
              'No supervisor response received before countdown expired. Simulated injection automatically halted (Q_inj = 0.0 m³/h).',
          },
          ...prev,
        ]);
      }
      prevStatusRef.current = intervention.status;
    }
  }, [intervention.status]);

  // Manual trigger to test warning & supervisor auto-stop flow at any time
  const handleTriggerWarningTest = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const day = baselineCurrentTimestep ? baselineCurrentTimestep.day : 0;
    setAcknowledgedAlertKey(`${selectedScenario}:${day.toFixed(2)}`);
    setIntervention((prev) => ({
      ...prev,
      appliedAtDay: null,
      status: 'awaiting_approval',
      countdownRemaining: thresholds.countdownSeconds,
    }));
    setIsModalOpen(true);

    setEventLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        day,
        type: 'WARNING',
        title: 'Simulated Warning Triggered',
        details: `Supervisor shutdown authorization prompt initiated (${thresholds.countdownSeconds}s window). Injection will stop automatically if unanswered.`,
      },
      ...prev,
    ]);
  };

  // Supervisor Decision Handlers
  const handleApproveIntervention = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const day = baselineCurrentTimestep ? baselineCurrentTimestep.day : 0;
    setAcknowledgedAlertKey(`${selectedScenario}:${day.toFixed(2)}`);
    setIntervention((prev) => ({
      ...prev,
      status: 'approved',
      appliedAtDay: day,
    }));
    setIsModalOpen(false);
    setEventLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        day,
        type: 'ACTION',
        title: 'Supervisor Approved Intervention',
        details: `Mitigation engaged at Day ${day.toFixed(2)} (${
          intervention.mode === 'full_shutdown'
            ? 'Full injection shutdown'
            : 'Injection throttled to bleed equilibrium'
        }).`,
      },
      ...prev,
    ]);
  };

  const handleRejectIntervention = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const day = baselineCurrentTimestep ? baselineCurrentTimestep.day : 0;
    setAcknowledgedAlertKey(`${selectedScenario}:${day.toFixed(2)}`);
    setIntervention((prev) => ({
      ...prev,
      appliedAtDay: null,
      status: 'rejected',
    }));
    setIsModalOpen(false);
    setEventLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        day,
        type: 'WARNING',
        title: 'Supervisor Rejected Warning',
        details: `Intervention manually overridden on Day ${day.toFixed(
          2
        )}. Baseline operation continues.`,
      },
      ...prev,
    ]);
  };

  const handleManualTrip = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const day = baselineCurrentTimestep ? baselineCurrentTimestep.day : 0;
    setAcknowledgedAlertKey(`${selectedScenario}:${day.toFixed(2)}`);
    setIntervention((prev) => ({
      ...prev,
      status: 'auto_tripped',
      appliedAtDay: day,
      mode: 'full_shutdown',
      countdownRemaining: 0,
    }));
    setIsModalOpen(false);
    setEventLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        day,
        type: 'CRITICAL',
        title: 'Immediate Emergency Shutdown',
        details: `Manual emergency injection stop (Q_inj = 0.0 m³/h) applied at Day ${day.toFixed(2)}.`,
      },
      ...prev,
    ]);
  };

  const handleResetIntervention = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    const day = baselineCurrentTimestep ? baselineCurrentTimestep.day : 0;
    // Mark current day acknowledged so Reset returns cleanly to nominal dashboard without immediately re-popping modal
    setAcknowledgedAlertKey(`${selectedScenario}:${day.toFixed(2)}`);
    setIntervention({
      mode: 'full_shutdown',
      maintainExtraction: true,
      appliedAtDay: null,
      status: 'idle',
      countdownRemaining: thresholds.countdownSeconds,
    });
    setIsModalOpen(false);
    setEventLogs((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        day,
        type: 'INFO',
        title: 'Simulation Reset',
        details: 'Intervention state returned to nominal baseline monitoring.',
      },
      ...prev,
    ]);
  };

  // Missing data count
  const missingDataCount = useMemo(() => {
    return records.filter((r) => r.sensor_durumu === 'EKSIK_VERI').length;
  }, [records]);

  // Custom uploads
  const handleCustomCSVUpload = (customRecords: RawWellRecord[], filename: string) => {
    setRecords(customRecords);
    setDatasetName(filename);
    setSelectedScenario('ALL');
    setSelectedDay(0);
    setAcknowledgedAlertKey(null);
    handleResetIntervention();
  };

  const handleCustomJSONUpload = (customConfig: JsonFieldConfig, _filename: string) => {
    setJsonConfig(customConfig);
    handleResetIntervention();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <RefreshCw className="w-10 h-10 text-cyan-400 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-100">Loading ISL Guard Telemetry...</h2>
        <p className="text-xs text-slate-500 mt-1">
          Reading operational records from isletme_verileri.csv and saha_verileri_lite.json
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-300">
        <div className="bg-red-950/80 border border-red-800 p-6 rounded-2xl max-w-lg text-center space-y-3">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-red-200">Dataset Loading Error</h2>
          <p className="text-xs text-red-300">{loadError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-200 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navbar + Non-blocking Supervisor Action Strip */}
      <Navbar
        currentTimestep={currentTimestep}
        intervention={intervention}
        isModalOpen={isModalOpen}
        onOpenModal={() => setIsModalOpen(true)}
        onApproveIntervention={handleApproveIntervention}
        onRejectIntervention={handleRejectIntervention}
        onResetSimulation={handleResetIntervention}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        selectedScenario={selectedScenario}
        onSelectScenario={handleSelectScenario}
        scenarios={scenarios}
        onTriggerWarningTest={handleTriggerWarningTest}
      />

      {/* Main Container Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar Menu */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          totalRecords={records.length}
          totalDays={timesteps.length > 0 ? timesteps[timesteps.length - 1].day : 0}
          missingDataCount={missingDataCount}
          currentRiskScore={currentTimestep?.riskScore || 0}
        />

        {/* Dynamic Main Workspace Content */}
        <main className="flex-1 min-w-0 pb-12">
          {activeTab === 'overview' && (
            <OverviewView
              timesteps={activeTimesteps}
              currentTimestep={currentTimestep}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              thresholds={thresholds}
              selectedScenario={selectedScenario}
              onSelectScenario={handleSelectScenario}
              scenarios={scenarios}
              wells={jsonConfig?.wells}
            />
          )}

          {activeTab === 'sensors' && (
            <SensorMonitoringView
              timesteps={activeTimesteps}
              allRecords={filteredRecords}
              thresholds={thresholds}
            />
          )}

          {activeTab === 'risk' && (
            <RiskAnalysisView
              timesteps={activeTimesteps}
              thresholds={thresholds}
              onUpdateThresholds={setThresholds}
              onResetThresholds={() => setThresholds(DEFAULT_THRESHOLDS)}
            />
          )}

          {activeTab === 'intervention' && (
            <InterventionSimulationView
              timesteps={timesteps}
              currentTimestep={baselineCurrentTimestep}
              intervention={intervention}
              onApproveIntervention={handleApproveIntervention}
              onRejectIntervention={handleRejectIntervention}
              onManualTrip={handleManualTrip}
              onResetIntervention={handleResetIntervention}
              onToggleMaintainExtraction={(m) =>
                setIntervention((prev) => ({ ...prev, maintainExtraction: m }))
              }
              onSelectStrategy={(s) =>
                setIntervention((prev) => ({ ...prev, mode: s }))
              }
              comparison={comparison}
              eventLogs={eventLogs}
              thresholds={thresholds}
              onTriggerWarningTest={handleTriggerWarningTest}
              onOpenComparisonTab={() => setActiveTab('comparison')}
            />
          )}

          {activeTab === 'comparison' && (
            <BeforeAfterComparisonView
              baselineTimesteps={timesteps}
              comparison={comparison}
              thresholds={thresholds}
              appliedAtDay={intervention.appliedAtDay}
            />
          )}

          {activeTab === 'explorer' && (
            <DataExplorerView
              records={records}
              jsonConfig={jsonConfig}
              onCustomCSVUpload={handleCustomCSVUpload}
              onCustomJSONUpload={handleCustomJSONUpload}
              currentDatasetName={datasetName}
            />
          )}

          {activeTab === 'methodology' && <MethodologyView />}
        </main>
      </div>

      {/* Dismissible Supervisor Authorization & Fail-Safe Modal */}
      <AuthorizationModal
        isOpen={isModalOpen}
        intervention={intervention}
        currentTimestep={baselineCurrentTimestep}
        thresholds={thresholds}
        onApprove={handleApproveIntervention}
        onReject={handleRejectIntervention}
        onImmediateStop={handleManualTrip}
        onRestart={handleResetIntervention}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 mt-auto text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            <span className="font-bold text-slate-300">ISL Guard</span> · Closed-Loop Excursion Prevention System (Proof of Concept)
          </div>
          <div className="text-[11px] text-slate-400">
            Synthetic Data Decision Support · Does Not Control Physical Mining Equipment
          </div>
        </div>
      </footer>
    </div>
  );
};
