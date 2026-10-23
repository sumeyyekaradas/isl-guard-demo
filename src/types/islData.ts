export type WellType = 'enjeksiyon' | 'cekim' | 'izleme' | 'alici';

export type SensorStatus = 'NORMAL' | 'EKSIK_VERI';

export interface RawWellRecord {
  zaman_gun: number;
  kuyu_id: string;
  tip: WellType;
  x: number;
  y: number;
  debi: number;
  basinç: number | null;
  pH: number | null;
  sulfat_mgL: number | null;
  iletkenlik_uScm: number | null;
  senaryo_id: number;
  senaryo_adi: string;
  gercek_sizinti_debisi: number;
  sensor_durumu: SensorStatus;
}

export interface WellConfig {
  id: string;
  type: WellType;
  x: number;
  y: number;
  base_rate: number;
}

export interface JsonFieldConfig {
  wells: WellConfig[];
  summary_stats: {
    total_days: number;
    total_records: number;
    scenarios: number;
  };
  sample_timeseries?: RawWellRecord[];
}

export type RiskLevel = 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface TimestepSummary {
  day: number;
  scenarioId: number;
  scenarioName: string;
  injectionRate: number; // INJ-01 debi (m³/h)
  extractionRate: number; // Sum of EXT-01..04 |debi| (m³/h)
  netImbalance: number; // injectionRate - extractionRate (m³/h)
  injectionPressure: number | null;
  extractionPressureAvg: number | null;
  boundaryPressureAvg: number | null;
  hydraulicGradient: number | null; // (Boundary Pressure - Pattern Pressure) or gradient proxy
  boundaryPhMin: number | null;
  boundaryPhAvg: number | null;
  boundarySulfateMax: number | null;
  boundarySulfateAvg: number | null;
  boundaryConductivityAvg: number | null;
  actualLeakRate: number; // Synthetic ground-truth excursion flow (m³/h)
  missingSensorCount: number;
  hasMissingData: boolean;
  wellRecords: RawWellRecord[];
  // Risk fields computed dynamically
  imbalanceAlert: boolean;
  phAlert: boolean;
  sulfateAlert: boolean;
  gradientAlert: boolean;
  combinedAlert: boolean;
  riskScore: number; // 0.0 to 1.0
  riskLevel: RiskLevel;
}

export interface RiskThresholds {
  allowedImbalance: number; // m³/h (e.g. 1.5)
  phLowerLimit: number; // pH (e.g. 6.0)
  sulfateUpperLimit: number; // mg/L (e.g. 65.0)
  gradientLowerLimit: number; // (e.g. 0.0 or 0.65)
  countdownSeconds: number; // default 15s
}

export interface InterventionConfig {
  mode: 'throttle_to_extraction' | 'full_shutdown';
  maintainExtraction: boolean;
  appliedAtDay: number | null;
  status: 'idle' | 'warning' | 'awaiting_approval' | 'approved' | 'rejected' | 'auto_tripped' | 'active';
  countdownRemaining: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  day: number;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'ACTION' | 'CRITICAL';
  title: string;
  details: string;
}
