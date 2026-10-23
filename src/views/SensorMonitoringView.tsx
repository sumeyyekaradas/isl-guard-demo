import React, { useState } from 'react';
import {
  Gauge,
  Droplets,
  Zap,
  Activity,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { TimestepSummary, RawWellRecord, RiskThresholds } from '../types/islData';
import { EngineeringChart } from '../components/EngineeringChart';

interface SensorMonitoringViewProps {
  timesteps: TimestepSummary[];
  allRecords: RawWellRecord[];
  thresholds: RiskThresholds;
}

export const SensorMonitoringView: React.FC<SensorMonitoringViewProps> = ({
  timesteps,
  allRecords,
  thresholds,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    'flow' | 'pressure' | 'gradient' | 'chemistry' | 'conductivity' | 'missing'
  >('flow');

  const dayLabels = timesteps.map((t) => t.day.toFixed(2));
  const missingRecords = allRecords.filter((r) => r.sensor_durumu === 'EKSIK_VERI');

  const renderNullable = (val: number | null, decimals = 2, suffix = '') => {
    if (val === null || isNaN(val)) {
      return (
        <span className="text-amber-400 font-sans font-bold text-[11px]">
          MISSING (EKSIK_VERI)
        </span>
      );
    }
    return `${val.toFixed(decimals)}${suffix ? ` ${suffix}` : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <Gauge className="w-6 h-6 text-cyan-400" />
            Sensor Monitoring &amp; Telemetry Integrity
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Strictly mapped from verified columns in <code className="text-cyan-400 font-mono">isletme_verileri.csv</code>. Missing telemetry is explicitly flagged and never evaluated as a safe measurement.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-amber-950/70 border border-amber-800/80 px-3.5 py-2 rounded-xl text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>{missingRecords.length} Missing Sensor Records</strong> isolated in active filter
          </span>
        </div>
      </div>

      {/* Interactive Measurement Category Selector */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveCategory('flow')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeCategory === 'flow'
              ? 'bg-cyan-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Droplets className="w-4 h-4" />
          Flow Rates (Injection &amp; Extraction)
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('pressure')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeCategory === 'pressure'
              ? 'bg-cyan-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Gauge className="w-4 h-4" />
          Injection &amp; Extraction Pressures
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('gradient')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeCategory === 'gradient'
              ? 'bg-cyan-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          Hydraulic Gradient Proxy
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('chemistry')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeCategory === 'chemistry'
              ? 'bg-cyan-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Boundary pH &amp; Sulfate
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('conductivity')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeCategory === 'conductivity'
              ? 'bg-cyan-500 text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4" />
          Boundary Conductivity (µS/cm)
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('missing')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
            activeCategory === 'missing'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-900 text-amber-400 hover:text-white hover:bg-slate-800 border border-amber-800/50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Missing Data Audit ({missingRecords.length})
        </button>
      </div>

      {/* 1. FLOW RATES */}
      {activeCategory === 'flow' && (
        <div className="space-y-5">
          <EngineeringChart
            title="Injection & Extraction Flow Telemetry"
            subtitle="CSV Column: debi (m³/h) aggregated across INJ-01 and EXT-01..04"
            xLabels={dayLabels}
            xAxisTitle="Timeline (Days)"
            yAxisTitle="Flow Rate (m³/h)"
            series={[
              {
                name: 'Injection Rate (INJ-01)',
                color: '#38bdf8',
                strokeWidth: 2,
                data: timesteps.map((t) => t.injectionRate),
                unit: 'm³/h',
              },
              {
                name: 'Extraction Rate (EXT-01..04)',
                color: '#34d399',
                strokeWidth: 2,
                data: timesteps.map((t) => t.extractionRate),
                unit: 'm³/h',
              },
              {
                name: 'Net Imbalance (ΔQ)',
                color: '#f97316',
                strokeWidth: 1.5,
                data: timesteps.map((t) => t.netImbalance),
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

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h4 className="text-sm font-bold text-slate-100 mb-3">
              Flow Telemetry Data Table (Chronological Timesteps)
            </h4>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Injection (INJ-01)</th>
                    <th className="py-2 px-3">Extraction Total</th>
                    <th className="py-2 px-3">Net Imbalance (ΔQ)</th>
                    <th className="py-2 px-3">Missing Sensors</th>
                    <th className="py-2 px-3">Evaluation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {timesteps.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans">{t.day.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-sans text-slate-400">{t.scenarioName}</td>
                      <td className="py-1.5 px-3 text-cyan-400">{t.injectionRate.toFixed(2)} m³/h</td>
                      <td className="py-1.5 px-3 text-emerald-400">{t.extractionRate.toFixed(2)} m³/h</td>
                      <td className={`py-1.5 px-3 ${t.imbalanceAlert ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                        {t.netImbalance > 0 ? `+${t.netImbalance.toFixed(2)}` : t.netImbalance.toFixed(2)} m³/h
                      </td>
                      <td className="py-1.5 px-3 font-sans">
                        {t.missingSensorCount > 0 ? (
                          <span className="text-amber-400 font-semibold">{t.missingSensorCount} missing</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 font-sans">
                        {t.imbalanceAlert ? (
                          <span className="text-red-400 font-semibold">Imbalance Exceeded</span>
                        ) : (
                          <span className="text-emerald-400">Within Limit</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. WELLHEAD PRESSURES */}
      {activeCategory === 'pressure' && (
        <div className="space-y-5">
          <EngineeringChart
            title="Injection, Extraction & Perimeter Pressures"
            subtitle="CSV Column: basinç — Null sensor records create visible breaks rather than interpolated safe lines"
            xLabels={dayLabels}
            xAxisTitle="Timeline (Days)"
            yAxisTitle="Pressure (bar)"
            series={[
              {
                name: 'Injection Pressure (INJ-01)',
                color: '#38bdf8',
                strokeWidth: 2,
                data: timesteps.map((t) => t.injectionPressure),
                unit: 'bar',
              },
              {
                name: 'Extraction Pressure Avg (EXT)',
                color: '#34d399',
                strokeWidth: 2,
                data: timesteps.map((t) => t.extractionPressureAvg),
                unit: 'bar',
              },
              {
                name: 'Boundary Ring Pressure Avg (MON)',
                color: '#facc15',
                strokeWidth: 2,
                data: timesteps.map((t) => t.boundaryPressureAvg),
                unit: 'bar',
              },
            ]}
          />

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h4 className="text-sm font-bold text-slate-100 mb-3">
              Wellhead Pressure Data Table
            </h4>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Injection Pressure</th>
                    <th className="py-2 px-3">Extraction Pressure (Avg)</th>
                    <th className="py-2 px-3">Boundary Ring Pressure (Avg)</th>
                    <th className="py-2 px-3">Telemetry Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {timesteps.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans">{t.day.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-sans text-slate-400">{t.scenarioName}</td>
                      <td className="py-1.5 px-3 text-cyan-400">{renderNullable(t.injectionPressure, 2, 'bar')}</td>
                      <td className="py-1.5 px-3 text-emerald-400">{renderNullable(t.extractionPressureAvg, 2, 'bar')}</td>
                      <td className="py-1.5 px-3 text-amber-300">{renderNullable(t.boundaryPressureAvg, 2, 'bar')}</td>
                      <td className="py-1.5 px-3 font-sans">
                        {t.hasMissingData ? (
                          <span className="text-amber-400 font-semibold">Partial Missing ({t.missingSensorCount})</span>
                        ) : (
                          <span className="text-emerald-400">Complete</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. HYDRAULIC GRADIENT */}
      {activeCategory === 'gradient' && (
        <div className="space-y-5">
          <EngineeringChart
            title="Hydraulic Gradient Proxy Trajectory"
            subtitle="Derived from perimeter monitoring pressure minus extraction zone pressure"
            xLabels={dayLabels}
            xAxisTitle="Timeline (Days)"
            yAxisTitle="Gradient Proxy"
            series={[
              {
                name: 'Hydraulic Gradient Proxy',
                color: '#06b6d4',
                strokeWidth: 2,
                data: timesteps.map((t) => t.hydraulicGradient),
              },
            ]}
            thresholds={[
              {
                value: thresholds.gradientLowerLimit,
                label: `Demo Gradient Limit (${thresholds.gradientLowerLimit.toFixed(2)})`,
                color: '#ef4444',
                dash: '4 4',
              },
            ]}
          />

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h4 className="text-sm font-bold text-slate-100 mb-3">
              Hydraulic Gradient Proxy Data Table
            </h4>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Boundary Pressure</th>
                    <th className="py-2 px-3">Extraction Pressure</th>
                    <th className="py-2 px-3">Gradient Proxy</th>
                    <th className="py-2 px-3">Containment State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {timesteps.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans">{t.day.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-sans text-slate-400">{t.scenarioName}</td>
                      <td className="py-1.5 px-3">{renderNullable(t.boundaryPressureAvg, 2, 'bar')}</td>
                      <td className="py-1.5 px-3">{renderNullable(t.extractionPressureAvg, 2, 'bar')}</td>
                      <td className="py-1.5 px-3 text-cyan-400">{renderNullable(t.hydraulicGradient, 3)}</td>
                      <td className="py-1.5 px-3 font-sans">
                        {t.hydraulicGradient === null ? (
                          <span className="text-amber-400 font-semibold">Uncertain (Missing Sensor)</span>
                        ) : t.gradientAlert ? (
                          <span className="text-red-400 font-semibold">Gradient Reversal Risk</span>
                        ) : (
                          <span className="text-emerald-400">Inward Containment</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. WATER CHEMISTRY (pH & Sulfate) */}
      {activeCategory === 'chemistry' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <EngineeringChart
              title="Boundary Monitoring pH"
              subtitle="CSV Column: pH across MON-01..12 observation wells"
              xLabels={dayLabels}
              xAxisTitle="Timeline (Days)"
              yAxisTitle="pH Units"
              series={[
                {
                  name: 'Boundary pH Min',
                  color: '#eab308',
                  strokeWidth: 2,
                  data: timesteps.map((t) => t.boundaryPhMin),
                  unit: 'pH',
                },
                {
                  name: 'Boundary pH Avg',
                  color: '#38bdf8',
                  strokeWidth: 1.5,
                  data: timesteps.map((t) => t.boundaryPhAvg),
                  unit: 'pH',
                },
              ]}
              thresholds={[
                {
                  value: thresholds.phLowerLimit,
                  label: `Demo pH Limit (${thresholds.phLowerLimit.toFixed(1)})`,
                  color: '#ef4444',
                  dash: '4 4',
                },
              ]}
            />

            <EngineeringChart
              title="Boundary Sulfate Concentration"
              subtitle="CSV Column: sulfat_mgL across MON-01..12 observation wells"
              xLabels={dayLabels}
              xAxisTitle="Timeline (Days)"
              yAxisTitle="Sulfate (mg/L)"
              series={[
                {
                  name: 'Boundary Sulfate Max',
                  color: '#a855f7',
                  strokeWidth: 2,
                  data: timesteps.map((t) => t.boundarySulfateMax),
                  unit: 'mg/L',
                },
                {
                  name: 'Boundary Sulfate Avg',
                  color: '#c084fc',
                  strokeWidth: 1.5,
                  data: timesteps.map((t) => t.boundarySulfateAvg),
                  unit: 'mg/L',
                },
              ]}
              thresholds={[
                {
                  value: thresholds.sulfateUpperLimit,
                  label: `Demo Sulfate Limit (${thresholds.sulfateUpperLimit.toFixed(0)} mg/L)`,
                  color: '#ef4444',
                  dash: '4 4',
                },
              ]}
            />
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h4 className="text-sm font-bold text-slate-100 mb-3">
              Boundary Geochemistry Data Table (pH &amp; Sulfate)
            </h4>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Boundary pH (Min)</th>
                    <th className="py-2 px-3">Boundary pH (Avg)</th>
                    <th className="py-2 px-3">Boundary Sulfate (Max)</th>
                    <th className="py-2 px-3">Boundary Sulfate (Avg)</th>
                    <th className="py-2 px-3">Threshold Check</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {timesteps.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans">{t.day.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-sans text-slate-400">{t.scenarioName}</td>
                      <td className={`py-1.5 px-3 ${t.phAlert ? 'text-red-400 font-bold' : 'text-amber-300'}`}>
                        {renderNullable(t.boundaryPhMin, 2)}
                      </td>
                      <td className="py-1.5 px-3 text-slate-300">{renderNullable(t.boundaryPhAvg, 2)}</td>
                      <td className={`py-1.5 px-3 ${t.sulfateAlert ? 'text-red-400 font-bold' : 'text-purple-300'}`}>
                        {renderNullable(t.boundarySulfateMax, 1, 'mg/L')}
                      </td>
                      <td className="py-1.5 px-3 text-slate-300">{renderNullable(t.boundarySulfateAvg, 1, 'mg/L')}</td>
                      <td className="py-1.5 px-3 font-sans">
                        {t.boundaryPhMin === null || t.boundarySulfateMax === null ? (
                          <span className="text-amber-400 font-semibold">Uncertain (Missing Data)</span>
                        ) : t.phAlert || t.sulfateAlert ? (
                          <span className="text-red-400 font-semibold">Threshold Breach</span>
                        ) : (
                          <span className="text-emerald-400">Nominal</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. ELECTRICAL CONDUCTIVITY */}
      {activeCategory === 'conductivity' && (
        <div className="space-y-5">
          <EngineeringChart
            title="Boundary Electrical Conductivity"
            subtitle="CSV Column: iletkenlik_uScm (µS/cm) from perimeter monitoring ring wells"
            xLabels={dayLabels}
            xAxisTitle="Timeline (Days)"
            yAxisTitle="Conductivity (µS/cm)"
            series={[
              {
                name: 'Boundary Conductivity Avg',
                color: '#2dd4bf',
                strokeWidth: 2,
                data: timesteps.map((t) => t.boundaryConductivityAvg),
                unit: 'µS/cm',
              },
            ]}
          />

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h4 className="text-sm font-bold text-slate-100 mb-3">
              Electrical Conductivity Data Table
            </h4>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Boundary Conductivity (Avg)</th>
                    <th className="py-2 px-3">Missing Well Sensors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {timesteps.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-1.5 px-3 font-sans">{t.day.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-sans text-slate-400">{t.scenarioName}</td>
                      <td className="py-1.5 px-3 text-teal-400">{renderNullable(t.boundaryConductivityAvg, 1, 'µS/cm')}</td>
                      <td className="py-1.5 px-3 font-sans">
                        {t.missingSensorCount > 0 ? (
                          <span className="text-amber-400 font-semibold">{t.missingSensorCount} flagged</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. MISSING DATA AUDIT */}
      {activeCategory === 'missing' && (
        <div className="space-y-5">
          <div className="bg-amber-950/40 border border-amber-800 rounded-2xl p-5">
            <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Explicit Missing Data &amp; Sensor Failure Audit
            </h3>
            <p className="text-xs text-amber-200/85 mt-1">
              Records with <code className="font-mono text-amber-300">sensor_durumu == &quot;EKSIK_VERI&quot;</code> or null values are isolated as operational uncertainties and never treated as safe measurements.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-300">
                {missingRecords.length} Records with Missing Telemetry
              </span>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Day</th>
                    <th className="py-2 px-3">Well ID</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Pressure</th>
                    <th className="py-2 px-3">pH</th>
                    <th className="py-2 px-3">Sulfate</th>
                    <th className="py-2 px-3">Conductivity</th>
                    <th className="py-2 px-3">Scenario</th>
                    <th className="py-2 px-3">Status Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {missingRecords.slice(0, 150).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-800/40 bg-amber-950/15">
                      <td className="py-1.5 px-3 font-sans text-slate-400">{r.zaman_gun.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-bold text-amber-400">{r.kuyu_id}</td>
                      <td className="py-1.5 px-3 text-slate-300 font-sans">{r.tip}</td>
                      <td className="py-1.5 px-3">{renderNullable(r.basinç, 2, 'bar')}</td>
                      <td className="py-1.5 px-3">{renderNullable(r.pH, 2)}</td>
                      <td className="py-1.5 px-3">{renderNullable(r.sulfat_mgL, 1, 'mg/L')}</td>
                      <td className="py-1.5 px-3">{renderNullable(r.iletkenlik_uScm, 1, 'µS/cm')}</td>
                      <td className="py-1.5 px-3 font-sans text-slate-400">{r.senaryo_adi}</td>
                      <td className="py-1.5 px-3 font-sans text-amber-400 font-bold">
                        EKSIK_VERI
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {missingRecords.length > 150 && (
              <p className="text-[11px] text-slate-500 mt-2">
                Showing first 150 of {missingRecords.length} missing sensor records. Full export available in Data Explorer.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
