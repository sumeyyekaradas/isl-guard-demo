import React from 'react';
import { BookOpen, ShieldCheck, Droplets, Compass, Activity, AlertTriangle, Layers, Info } from 'lucide-react';
import { WellfieldMap } from '../components/WellfieldMap';

export const MethodologyView: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Title Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-cyan-400" />
          ISL Hydraulic Containment & Scientific Methodology
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Hydrogeological principles of In-Situ Leaching (ISL / ISR), 5-spot pattern dynamics, and decision-support architecture.
        </p>
      </div>

      {/* 4 Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 1. 5-Spot Pattern & Well Geometry */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Droplets className="w-5 h-5" />
            1. The 5-Spot Wellfield Geometry
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            In In-Situ Leaching (ISL), the mineralized roll-front aquifer is accessed via a geometric grid of wells. In this prototype:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>
              <strong className="text-slate-200">Central Injector (INJ-01):</strong> Located at coordinates (500m, 500m). Injects pressurized lixiviant solution into the permeable host formation.
            </li>
            <li>
              <strong className="text-slate-200">Corner Recovery Wells (EXT-01 to EXT-04):</strong> Positioned on a 150m diagonal offset at (350,350), (650,350), (350,650), (650,650). Submersible pumps draw out pregnant leach solution (PLS).
            </li>
            <li>
              <strong className="text-slate-200">Perimeter Monitoring Ring (MON-01 to MON-12):</strong> 12 observation wells distributed radially along a 250m circular perimeter.
            </li>
            <li>
              <strong className="text-slate-200">Regional Receiver Wells (RCV-01 to RCV-03):</strong> Far-field points located at (150,150), (850,150), (500,900) establishing regional background baseline.
            </li>
          </ul>
        </div>

        {/* 2. Negative Water Balance & Bleed Rate */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Compass className="w-5 h-5" />
            2. The Bleed Principle & Hydraulic Containment
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            The fundamental environmental safeguard in commercial ISL operations is maintaining a <em>negative water balance</em> (over-extraction):
          </p>
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300">
            Q_extraction &gt; Q_injection &nbsp;(&Delta;Q = Q_inj - Q_ext &le; 0)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            By continuously extracting slightly more volume (typically a 0.5% to 2.0% bleed rate) than is injected, a cone of depression is established across the mining block. Groundwater from the surrounding unmined aquifer naturally migrates inward, preventing lixiviant from escaping outward into surrounding freshwater zones.
          </p>
        </div>

        {/* 3. Geochemical Excursion Indicators */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <Activity className="w-5 h-5" />
            3. Geochemical Excursion Early Warning
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            If hydraulic containment fails (due to pump trips, pressure surges, or imbalance), solution escapes beyond the production zone. This prototype monitors two key early-warning geochemical tracers:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>
              <strong className="text-slate-200">pH Depression:</strong> Leaching solution typically operates at lower pH (6.0 - 6.5) than background pristine aquifer water (6.8 - 7.3). An abrupt drop below 6.0 in monitoring ring wells flags an advancing front.
            </li>
            <li>
              <strong className="text-slate-200">Sulfate (SO4) Enrichment:</strong> Sulfate is a conservative, highly mobile tracer resulting from leaching chemistry. Values exceeding baseline (~45 mg/L) above 65 mg/L serve as primary regulatory excursion flags.
            </li>
          </ul>
        </div>

        {/* 4. Missing Data & Sensor Quality Integrity */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5" />
            4. Telemetry Integrity & Missing Data Protocol
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            In compliance with strict industrial safety principles:
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>
              Records marked <code className="text-amber-300 font-mono">sensor_durumu == &quot;EKSIK_VERI&quot;</code> or carrying null sensor values are <strong>NEVER</strong> filled with assumed baseline numbers.
            </li>
            <li>
              Missing telemetry is treated as an operational uncertainty that increases the risk index rather than masking an unmonitored excursion.
            </li>
            <li>
              All sensor channels (Injection, Extraction, Pressures, pH, Sulfate, Conductivity) are strictly mapped from real CSV columns.
            </li>
          </ul>
        </div>
      </div>

      {/* Engineering Proof of Concept Disclaimer */}
      <div className="p-5 bg-blue-950/40 border border-blue-900 rounded-2xl text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          Proof-of-Concept Decision Support Boundaries
        </div>
        <p className="leading-relaxed">
          This software is an engineering proof-of-concept (PoC) decision support interface. It provides visual analytics, rule-based alarm dispatching, and simulated closed-loop feedback using synthetic operational datasets.
        </p>
        <p className="leading-relaxed text-slate-400">
          Prior to physical plant integration, site-specific hydrogeological characterization—including multi-well pumping tests, convergent/divergent tracer tests, and calibrated transient groundwater flow modeling (e.g., USGS MODFLOW and MT3DMS solute transport)—must be conducted and approved by environmental regulatory authorities.
        </p>
      </div>

      {/* Spatial Geometry Map */}
      <WellfieldMap currentScenario="5-Spot Reference Pattern" hasAlert={false} />
    </div>
  );
};
