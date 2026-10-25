import React from 'react';
import {
  LayoutDashboard,
  Gauge,
  AlertOctagon,
  Sliders,
  Scale,
  Database,
  BookOpen,
  X,
  Radio,
  FlaskConical,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'sensors'
  | 'risk'
  | 'intervention'
  | 'comparison'
  | 'tracer'
  | 'explorer'
  | 'methodology';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  totalRecords: number;
  totalDays: number;
  missingDataCount: number;
  currentRiskScore: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  totalRecords,
  totalDays,
  missingDataCount,
  currentRiskScore,
}) => {
  const navItems = [
    {
      id: 'overview' as NavTab,
      label: 'Overview',
      icon: LayoutDashboard,
      description: 'KPI Cards & Executive Status',
    },
    {
      id: 'sensors' as NavTab,
      label: 'Sensor Monitoring',
      icon: Gauge,
      description: 'Well Telemetry & Missing Data',
    },
    {
      id: 'risk' as NavTab,
      label: 'Risk Analysis',
      icon: AlertOctagon,
      description: 'Explainable Rule-Based Engine',
    },
    {
      id: 'intervention' as NavTab,
      label: 'Intervention Simulation',
      icon: Sliders,
      description: 'Operator Cockpit & Emergency Trip',
    },
    {
      id: 'comparison' as NavTab,
      label: 'Before-and-After Comparison',
      icon: Scale,
      description: 'Deterministic Impact Metrics',
    },
    {
      id: 'tracer' as NavTab,
      label: 'Tracer Test',
      icon: FlaskConical,
      description: 'Breakthrough Curve & Pore Velocity',
    },
    {
      id: 'explorer' as NavTab,
      label: 'Data Explorer',
      icon: Database,
      description: 'Raw CSV, JSON & Uploads',
    },
    {
      id: 'methodology' as NavTab,
      label: 'Methodology',
      icon: BookOpen,
      description: 'ISL 5-Spot Hydrogeology & Rules',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Mobile Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
            <span className="font-bold text-slate-100 text-sm">Navigation Menu</span>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[11px] font-bold tracking-wider uppercase text-slate-500">
              Control Panel
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? 'bg-linear-to-r from-cyan-950/90 to-blue-950/50 text-cyan-400 border border-cyan-800/80 shadow-md shadow-cyan-950/50'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mt-0.5 shrink-0 ${
                      isActive ? 'text-cyan-400' : 'text-slate-500'
                    }`}
                  />
                  <div>
                    <div className="text-sm font-semibold">{item.label}</div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">
                      {item.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom System Telemetry Box */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/90">
          <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                Live Telemetry
              </span>
              <span className="font-mono text-cyan-400 font-bold">{totalDays} Days</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Total Well Records:</span>
              <span className="font-mono text-slate-200">{totalRecords.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Missing Data Points:</span>
              <span
                className={`font-mono font-semibold ${
                  missingDataCount > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {missingDataCount} (Flagged)
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800">
              <span>Risk Score:</span>
              <span
                className={`font-mono font-bold ${
                  currentRiskScore > 0.6
                    ? 'text-red-400'
                    : currentRiskScore > 0.3
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {(currentRiskScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-center text-slate-500">
            Decision Support Proof of Concept
          </div>
        </div>
      </aside>
    </>
  );
};
