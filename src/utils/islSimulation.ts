export type ScenarioType =
  | 'Normal çalışma'
  | 'Debi dengesizliği'
  | 'Olası sınır etkisi'
  | 'Erken müdahale';

export const SCENARIOS: ScenarioType[] = [
  'Normal çalışma',
  'Debi dengesizliği',
  'Olası sınır etkisi',
  'Erken müdahale',
];

export const FEATURES = [
  'injection_m3h',
  'extraction_m3h',
  'injection_pressure_kpa',
  'extraction_pressure_kpa',
  'boundary_ph',
  'boundary_sulfate_mg_l',
  'groundwater_level_m',
  'gradient_proxy',
] as const;

export interface ISLDataRow {
  timestamp: string;
  injection_m3h: number;
  extraction_m3h: number;
  injection_pressure_kpa: number;
  extraction_pressure_kpa: number;
  boundary_ph: number;
  boundary_sulfate_mg_l: number;
  groundwater_level_m: number;
  gradient_proxy: number;
  flow_imbalance_m3h: number;
  illustrative_risk_score: number;
  scenario: ScenarioType;
  anomaly_score: number;
  ai_anomaly: number;
  demo_rule_alert: number;
  combined_alert: number;
}

export interface SimulationParams {
  scenario: ScenarioType;
  hours: number;
  seed: number;
  allowedImbalance: number;
  phLimit: number;
  sulfateLimit: number;
  gradientLimit: number;
  countdownSeconds: number;
}

function createMulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNormalRNG(seed: number) {
  const uniform = createMulberry32(seed);
  let nextGaussian: number | null = null;
  return function (mean = 0, std = 1): number {
    if (nextGaussian !== null) {
      const val = nextGaussian;
      nextGaussian = null;
      return mean + val * std;
    }
    let u1 = uniform();
    let u2 = uniform();
    while (u1 <= 1e-15) u1 = uniform();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    nextGaussian = radius * Math.sin(theta);
    return mean + radius * Math.cos(theta) * std;
  };
}

function clip(val: number, min: number | null, max: number | null): number {
  let res = val;
  if (min !== null && res < min) res = min;
  if (max !== null && res > max) res = max;
  return res;
}

// ----------------------------------------------------
// Isolation Forest (compact implementation in TS)
// ----------------------------------------------------
interface ITreeNode {
  isLeaf: boolean;
  size?: number;
  featureIdx?: number;
  splitVal?: number;
  left?: ITreeNode;
  right?: ITreeNode;
}

function cFactor(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 1;
  const eulerGamma = 0.5772156649;
  return 2 * (Math.log(n - 1) + eulerGamma) - (2 * (n - 1)) / n;
}

function buildITree(
  X: number[][],
  currentDepth: number,
  maxDepth: number,
  rng: () => number
): ITreeNode {
  const n = X.length;
  if (currentDepth >= maxDepth || n <= 1) {
    return { isLeaf: true, size: n };
  }

  const numFeatures = X[0].length;
  const featureIdx = Math.floor(rng() * numFeatures);

  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = X[i][featureIdx];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  if (minVal === maxVal) {
    return { isLeaf: true, size: n };
  }

  const splitVal = minVal + rng() * (maxVal - minVal);
  const leftX: number[][] = [];
  const rightX: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (X[i][featureIdx] < splitVal) {
      leftX.push(X[i]);
    } else {
      rightX.push(X[i]);
    }
  }

  return {
    isLeaf: false,
    featureIdx,
    splitVal,
    left: buildITree(leftX, currentDepth + 1, maxDepth, rng),
    right: buildITree(rightX, currentDepth + 1, maxDepth, rng),
  };
}

function pathLength(x: number[], node: ITreeNode, currentDepth: number): number {
  if (node.isLeaf) {
    const size = node.size || 1;
    if (size <= 1) return currentDepth;
    return currentDepth + cFactor(size);
  }
  const fIdx = node.featureIdx!;
  const sVal = node.splitVal!;
  if (x[fIdx] < sVal) {
    return pathLength(x, node.left!, currentDepth + 1);
  } else {
    return pathLength(x, node.right!, currentDepth + 1);
  }
}

class FastIsolationForest {
  private trees: ITreeNode[] = [];
  private numTrees = 100;
  private subSampleSize: number = 256;
  private maxDepth: number = 8;
  private cN: number = 1;

  constructor(seed = 42) {
    this.seed = seed;
  }
  private seed: number;

  fit(X: number[][]) {
    const n = X.length;
    this.subSampleSize = Math.min(n, 256);
    this.maxDepth = Math.ceil(Math.log2(Math.max(this.subSampleSize, 2)));
    this.cN = cFactor(this.subSampleSize);

    const uniform = createMulberry32(this.seed);
    this.trees = [];

    for (let t = 0; t < this.numTrees; t++) {
      // Subsample
      const indices: number[] = [];
      for (let i = 0; i < this.subSampleSize; i++) {
        indices.push(Math.floor(uniform() * n));
      }
      const subX = indices.map((idx) => X[idx]);
      const tree = buildITree(subX, 0, this.maxDepth, uniform);
      this.trees.push(tree);
    }
  }

  scoreSamples(X: number[][]): number[] {
    const scores: number[] = [];
    for (let i = 0; i < X.length; i++) {
      const x = X[i];
      let totalPath = 0;
      for (let t = 0; t < this.trees.length; t++) {
        totalPath += pathLength(x, this.trees[t], 0);
      }
      const avgPath = totalPath / this.trees.length;
      // scikit-learn anomaly score: 2^(- avgPath / c(n))
      // In app.py: scores = -model.decision_function(X) which is positively correlated with anomaly
      const score = Math.pow(2, -avgPath / this.cN);
      scores.push(score);
    }
    return scores;
  }
}

// ----------------------------------------------------
// 1. DATA GENERATION
// ----------------------------------------------------
export function generateData(
  scenario: ScenarioType,
  hours: number,
  seed: number,
  allowedImbalance: number,
  phLimit: number,
  sulfateLimit: number,
  gradientLimit: number
): { rows: ISLDataRow[]; anomalyCutoff: number } {
  const rng = createNormalRNG(seed);
  const startDate = new Date('2026-11-01T00:00:00Z');

  const rows: Array<{
    timestamp: string;
    injection_m3h: number;
    extraction_m3h: number;
    injection_pressure_kpa: number;
    extraction_pressure_kpa: number;
    boundary_ph: number;
    boundary_sulfate_mg_l: number;
    groundwater_level_m: number;
    gradient_proxy: number;
    flow_imbalance_m3h: number;
    illustrative_risk_score: number;
    scenario: ScenarioType;
  }> = [];

  const rawVectors: number[][] = [];

  for (let i = 0; i < hours; i++) {
    const curDate = new Date(startDate.getTime() + i * 3600 * 1000);
    const dateStr = curDate.toISOString().replace('.000Z', '').replace('T', ' ').slice(0, 16);
    const x = hours > 1 ? i / (hours - 1) : 0;

    let injection = 50 + rng(0, 1);
    let extraction = 50 + rng(0, 1);
    let p_in = 250 + rng(0, 3);
    let p_out = 180 + rng(0, 3);
    let ph = 7.1 + rng(0, 0.08);
    let sulfate = 120 + rng(0, 5);
    let groundwater = 10 + rng(0, 0.03);
    let gradient = 1 + rng(0, 0.025);

    if (scenario === 'Debi dengesizliği') {
      const ramp = clip((x - 0.18) / 0.25, 0, 1);
      injection += 10 * ramp;
      extraction -= 2 * ramp;
      p_in += 18 * ramp;
      gradient -= 0.35 * ramp;
      ph -= 0.7 * ramp;
      sulfate += 115 * ramp;
    } else if (scenario === 'Olası sınır etkisi') {
      const ramp = clip((x - 0.35) / 0.3, 0, 1);
      injection += 5 * ramp;
      extraction += 1 * ramp;
      gradient -= 0.55 * ramp;
      ph -= 1.0 * ramp;
      sulfate += 210 * ramp;
      groundwater += 0.12 * ramp;
    } else if (scenario === 'Erken müdahale') {
      const ramp = clip((x - 0.2) / 0.18, 0, 1);
      injection += 9 * ramp;
      extraction += 1 * ramp;
      gradient -= 0.3 * ramp;
      ph -= 0.45 * ramp;
      sulfate += 75 * ramp;

      const response = clip((x - 0.6) / 0.12, 0, 1);
      injection -= 7 * response;
      extraction += 1.5 * response;
      gradient += 0.22 * response;
      ph += 0.28 * response;
      sulfate -= 35 * response;
    }

    injection = clip(injection, 0, null);
    extraction = clip(extraction, 0, null);
    ph = clip(ph, 3, 10);
    sulfate = clip(sulfate, 0, null);
    gradient = clip(gradient, -1, 1.5);

    const imbalance = injection - extraction;

    const risk_score =
      0.3 * clip(imbalance / 12, 0, 1) +
      0.25 * clip((7 - ph) / 2.5, 0, 1) +
      0.25 * clip((sulfate - 150) / 250, 0, 1) +
      0.2 * clip((0.65 - gradient) / 0.8, 0, 1);

    rows.push({
      timestamp: dateStr,
      injection_m3h: injection,
      extraction_m3h: extraction,
      injection_pressure_kpa: p_in,
      extraction_pressure_kpa: p_out,
      boundary_ph: ph,
      boundary_sulfate_mg_l: sulfate,
      groundwater_level_m: groundwater,
      gradient_proxy: gradient,
      flow_imbalance_m3h: imbalance,
      illustrative_risk_score: risk_score,
      scenario,
    });

    rawVectors.push([
      injection,
      extraction,
      p_in,
      p_out,
      ph,
      sulfate,
      groundwater,
      gradient,
    ]);
  }

  // ----------------------------------------------------
  // 2. AI ANOMALY TRAINING & SCORING
  // ----------------------------------------------------
  const baselineN = Math.min(
    rawVectors.length,
    Math.max(24, Math.floor(rawVectors.length * 0.2))
  );
  const baseline = rawVectors.slice(0, baselineN);

  const iforest = new FastIsolationForest(seed);
  iforest.fit(baseline);

  const anomalyScores = iforest.scoreSamples(rawVectors);
  const baselineScores = anomalyScores.slice(0, baselineN);

  // 95th percentile cutoff of baseline scores
  const sortedBaseline = [...baselineScores].sort((a, b) => a - b);
  const q95Idx = Math.min(
    sortedBaseline.length - 1,
    Math.floor(sortedBaseline.length * 0.95)
  );
  const anomalyCutoff = sortedBaseline[q95Idx] || 0.55;

  const resultRows: ISLDataRow[] = rows.map((r, idx) => {
    const demoRuleAlert =
      r.flow_imbalance_m3h > allowedImbalance ||
      r.boundary_ph < phLimit ||
      r.boundary_sulfate_mg_l > sulfateLimit ||
      r.gradient_proxy < gradientLimit
        ? 1
        : 0;

    const score = anomalyScores[idx];
    const aiAnomaly = score > anomalyCutoff ? 1 : 0;
    const combinedAlert = demoRuleAlert === 1 || aiAnomaly === 1 ? 1 : 0;

    return {
      ...r,
      anomaly_score: score,
      ai_anomaly: aiAnomaly,
      demo_rule_alert: demoRuleAlert,
      combined_alert: combinedAlert,
    };
  });

  return { rows: resultRows, anomalyCutoff };
}

// ----------------------------------------------------
// Recommendation
// ----------------------------------------------------
export function getRecommendation(row: ISLDataRow, allowedImbalance: number): {
  targetInjection: number;
  advice: string;
} {
  const target = Math.min(
    row.injection_m3h,
    row.extraction_m3h + allowedImbalance
  );

  let message = '';
  if (row.combined_alert === 1) {
    message =
      'Öncelikli inceleme önerilir. Debi, pH, sülfat ve gradyan göstergelerini doğrula.';
    if (target < row.injection_m3h) {
      message += ` Demo optimizasyonu enjeksiyon için ${target.toFixed(
        1
      )} m³/h hedefini hesaplıyor.`;
    }
    message +=
      ' Bu öneri gerçek pompa kontrolü değildir; saha kararı uzman onayı gerektirir.';
  } else {
    message =
      'Son kayıtta belirgin demo kuralı tetiklenmedi. İzleme ve veri kalitesi kontrolü sürdürülmeli.';
  }

  return { targetInjection: target, advice: message };
}

// ----------------------------------------------------
// Tracer Test Calculation
// ----------------------------------------------------
export interface TracerResult {
  times: number[];
  concentrations: number[];
  peakHour: number;
  peakValue: number;
  area: number;
  firstArrival: number | null;
}

export function calculateTracerCurve(
  duration: number,
  peakSetting: number,
  spread: number,
  seed: number
): TracerResult {
  const rng = createNormalRNG(seed + 100);
  const times: number[] = [];
  const concentrations: number[] = [];

  for (let t = 0; t < duration; t++) {
    times.push(t);
    const gauss = Math.exp(-0.5 * Math.pow((t - peakSetting) / spread, 2));
    const noise = rng(0, 0.008);
    const val = Math.max(0, gauss + noise);
    concentrations.push(val);
  }

  let peakIdx = 0;
  let maxVal = -1;
  for (let i = 0; i < concentrations.length; i++) {
    if (concentrations[i] > maxVal) {
      maxVal = concentrations[i];
      peakIdx = i;
    }
  }

  const peakHour = times[peakIdx];
  const peakValue = maxVal;

  // Trapezoidal area under curve
  let area = 0;
  for (let i = 0; i < times.length - 1; i++) {
    const dt = times[i + 1] - times[i];
    area += ((concentrations[i] + concentrations[i + 1]) / 2) * dt;
  }

  let firstArrival: number | null = null;
  for (let i = 0; i < concentrations.length; i++) {
    if (concentrations[i] > 0.05) {
      firstArrival = times[i];
      break;
    }
  }

  return {
    times,
    concentrations,
    peakHour,
    peakValue,
    area,
    firstArrival,
  };
}

// ----------------------------------------------------
// CSV exporter helper
// ----------------------------------------------------
export function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function islDataToCSV(rows: ISLDataRow[]): string {
  const headers = [
    'timestamp',
    'injection_m3h',
    'extraction_m3h',
    'injection_pressure_kpa',
    'extraction_pressure_kpa',
    'boundary_ph',
    'boundary_sulfate_mg_l',
    'groundwater_level_m',
    'gradient_proxy',
    'flow_imbalance_m3h',
    'illustrative_risk_score',
    'scenario',
    'anomaly_score',
    'ai_anomaly',
    'demo_rule_alert',
    'combined_alert',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.timestamp,
        r.injection_m3h.toFixed(3),
        r.extraction_m3h.toFixed(3),
        r.injection_pressure_kpa.toFixed(2),
        r.extraction_pressure_kpa.toFixed(2),
        r.boundary_ph.toFixed(3),
        r.boundary_sulfate_mg_l.toFixed(2),
        r.groundwater_level_m.toFixed(3),
        r.gradient_proxy.toFixed(3),
        r.flow_imbalance_m3h.toFixed(3),
        r.illustrative_risk_score.toFixed(4),
        `"${r.scenario}"`,
        r.anomaly_score.toFixed(4),
        r.ai_anomaly,
        r.demo_rule_alert,
        r.combined_alert,
      ].join(',')
    );
  }
  return lines.join('\n');
}
