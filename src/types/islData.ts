export type WellType = 'enjeksiyon' | 'cekim' | 'izleme' | 'alici';

export type SensorStatus = 'NORMAL' | 'EKSIK_VERI' | 'ARIZALI';

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
  hydraulicGradient: number | null;
  boundaryPhMin: number | null;
  boundaryPhAvg: number | null;
  boundarySulfateMax: number | null;
  boundarySulfateAvg: number | null;
  receptorSulfateMax: number | null; // RCV-01..03 outer receptor max sulfate (mg/L)
  boundaryConductivityAvg: number | null;
  actualLeakRate: number; // Synthetic ground-truth excursion flow (m³/h)
  missingSensorCount: number;
  faultySensorCount: number;
  hasMissingData: boolean;
  wellRecords: RawWellRecord[];
  // Explainable Rule-Based Alerts
  imbalanceAlert: boolean;
  phAlert: boolean;
  sulfateAlert: boolean;
  gradientAlert: boolean;
  ruleAlert: boolean;
  // Unsupervised ML (Isolation Forest) Anomaly Detection — Built-in Core Engine
  aiAnomalyScore: number | null;
  aiAnomalyCutoff: number;
  aiAnomalyFlag: boolean;
  aiEarlyWarning: boolean; // True when AI flags multivariate drift before any hard rule limit breaks
  // Integrated AI + Rule Decision Output
  combinedAlert: boolean;
  riskScore: number; // 0.0 to 1.0
  riskLevel: RiskLevel;
}

export interface RiskThresholds {
  allowedImbalance: number; // m³/h (default 1.5)
  phLowerLimit: number; // pH (default 6.15)
  sulfateUpperLimit: number; // mg/L (default 65.0)
  gradientLowerLimit: number; // ΔP proxy (default 0.20)
  countdownSeconds: number; // default 15s
  aiPercentileCutoff: number; // default 97 (90% - 99%)
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
