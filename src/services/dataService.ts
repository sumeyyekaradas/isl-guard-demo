import {
  RawWellRecord,
  JsonFieldConfig,
  TimestepSummary,
  RiskThresholds,
  SensorStatus,
  WellType,
} from '../types/islData';
import { FastIsolationForest } from '../utils/islSimulation';

export interface TrainedAnomalyModel {
  forest: FastIsolationForest;
  sortedBaselineScores: number[];
  trainingSampleCount: number;
  trainingScenarioLabel: string;
  getCutoff: (percentile: number) => number;
  scoreVector: (vec: number[]) => number;
}

export function extractTimestepFeatureVector(params: {
  injectionRate: number;
  extractionRate: number;
  netImbalance: number;
  hydraulicGradient: number | null;
  boundaryPhMin: number | null;
  boundarySulfateMax: number | null;
  receptorSulfateMax: number | null;
  boundaryConductivityAvg: number | null;
}): number[] | null {
  const {
    injectionRate,
    extractionRate,
    netImbalance,
    hydraulicGradient,
    boundaryPhMin,
    boundarySulfateMax,
    receptorSulfateMax,
    boundaryConductivityAvg,
  } = params;

  if (
    hydraulicGradient === null ||
    boundaryPhMin === null ||
    boundarySulfateMax === null ||
    boundaryConductivityAvg === null ||
    isNaN(injectionRate) ||
    isNaN(extractionRate)
  ) {
    return null;
  }

  return [
    injectionRate,
    extractionRate,
    netImbalance,
    hydraulicGradient,
    boundaryPhMin,
    boundarySulfateMax,
    receptorSulfateMax ?? 31.0,
    boundaryConductivityAvg,
  ];
}

export function parseCSVText(csvText: string): RawWellRecord[] {
  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) return [];

  const records: RawWellRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 14) continue;

    const day = parseFloat(parts[0]);
    const wellId = parts[1].trim();
    const type = parts[2].trim() as WellType;
    const x = parseFloat(parts[3]);
    const y = parseFloat(parts[4]);
    const flow = parseFloat(parts[5]);
    const pressure = parts[6] === '' || parts[6] === 'null' ? null : parseFloat(parts[6]);
    const ph = parts[7] === '' || parts[7] === 'null' ? null : parseFloat(parts[7]);
    const sulfate = parts[8] === '' || parts[8] === 'null' ? null : parseFloat(parts[8]);
    const conductivity = parts[9] === '' || parts[9] === 'null' ? null : parseFloat(parts[9]);
    const scenarioId = parseInt(parts[10], 10) || 1;
    const scenarioName = parts[11].trim();
    const actualLeak = parseFloat(parts[12]) || 0;
    const status = parts[13].trim() as SensorStatus;

    records.push({
      zaman_gun: day,
      kuyu_id: wellId,
      tip: type,
      x,
      y,
      debi: flow,
      basinç: isNaN(pressure as number) ? null : pressure,
      pH: isNaN(ph as number) ? null : ph,
      sulfat_mgL: isNaN(sulfate as number) ? null : sulfate,
      iletkenlik_uScm: isNaN(conductivity as number) ? null : conductivity,
      senaryo_id: scenarioId,
      senaryo_adi: scenarioName,
      gercek_sizinti_debisi: actualLeak,
      sensor_durumu: status,
    });
  }

  return records;
}

/**
 * Trains an Unsupervised Isolation Forest (100 trees) strictly on complete
 * normal-operation baseline timesteps from the loaded CSV dataset across 8 sensor dimensions.
 */
export function trainIsolationForestOnCSV(allRecords: RawWellRecord[]): TrainedAnomalyModel | null {
  if (allRecords.length === 0) return null;

  const groups = new Map<number, RawWellRecord[]>();
  for (const r of allRecords) {
    const list = groups.get(r.zaman_gun);
    if (!list) groups.set(r.zaman_gun, [r]);
    else list.push(r);
  }

  const sortedDays = Array.from(groups.keys()).sort((a, b) => a - b);
  const normalVectors: number[][] = [];
  const allValidVectors: number[][] = [];
  let trainingScenarioLabel = 'Normal Operation Baseline';

  for (const day of sortedDays) {
    const wellList = groups.get(day)!;
    let injectionRate = 0;
    let extractionRate = 0;
    const extPressures: number[] = [];
    const monPressures: number[] = [];
    const monPhs: number[] = [];
    const monSulfates: number[] = [];
    const rcvSulfates: number[] = [];
    const monConductivities: number[] = [];
    let actualLeakRate = 0;
    let scenarioId = 1;
    let scenarioName = '';

    for (const w of wellList) {
      scenarioId = w.senaryo_id;
      scenarioName = w.senaryo_adi;
      if (w.gercek_sizinti_debisi > actualLeakRate) actualLeakRate = w.gercek_sizinti_debisi;
      if (w.tip === 'enjeksiyon') {
        injectionRate += w.debi;
      } else if (w.tip === 'cekim') {
        extractionRate += Math.abs(w.debi);
        if (w.basinç !== null) extPressures.push(w.basinç);
      } else if (w.tip === 'izleme') {
        if (w.basinç !== null) monPressures.push(w.basinç);
        if (w.pH !== null) monPhs.push(w.pH);
        if (w.sulfat_mgL !== null) monSulfates.push(w.sulfat_mgL);
        if (w.iletkenlik_uScm !== null) monConductivities.push(w.iletkenlik_uScm);
      } else if (w.tip === 'alici') {
        if (w.sulfat_mgL !== null) rcvSulfates.push(w.sulfat_mgL);
      }
    }

    const netImbalance = injectionRate - extractionRate;
    const extractionPressureAvg =
      extPressures.length > 0 ? extPressures.reduce((a, b) => a + b, 0) / extPressures.length : null;
    const boundaryPressureAvg =
      monPressures.length > 0 ? monPressures.reduce((a, b) => a + b, 0) / monPressures.length : null;
    const hydraulicGradient =
      boundaryPressureAvg !== null && extractionPressureAvg !== null
        ? boundaryPressureAvg - extractionPressureAvg + 0.5
        : null;
    const boundaryPhMin = monPhs.length > 0 ? Math.min(...monPhs) : null;
    const receptorSulfateMax = rcvSulfates.length > 0 ? Math.max(...rcvSulfates) : null;
    const combinedSulfates = [...monSulfates, ...rcvSulfates];
    const boundarySulfateMax = combinedSulfates.length > 0 ? Math.max(...combinedSulfates) : null;
    const boundaryConductivityAvg =
      monConductivities.length > 0
        ? monConductivities.reduce((a, b) => a + b, 0) / monConductivities.length
        : null;

    const vec = extractTimestepFeatureVector({
      injectionRate,
      extractionRate,
      netImbalance,
      hydraulicGradient,
      boundaryPhMin,
      boundarySulfateMax,
      receptorSulfateMax,
      boundaryConductivityAvg,
    });

    if (vec) {
      allValidVectors.push(vec);
      const isBaselineNormal =
        (scenarioId === 1 || scenarioName.toLowerCase().includes('normal')) && actualLeakRate === 0;
      if (isBaselineNormal) {
        normalVectors.push(vec);
        if (scenarioName) trainingScenarioLabel = scenarioName;
      }
    }
  }

  const trainingSet =
    normalVectors.length >= 16
      ? normalVectors
      : allValidVectors.slice(0, Math.max(16, Math.floor(allValidVectors.length * 0.2)));

  if (trainingSet.length === 0) return null;

  const forest = new FastIsolationForest(42);
  forest.fit(trainingSet);

  const baselineScores = forest.scoreSamples(trainingSet).sort((a, b) => a - b);

  return {
    forest,
    sortedBaselineScores: baselineScores,
    trainingSampleCount: trainingSet.length,
    trainingScenarioLabel,
    getCutoff: (percentile: number) => {
      const clamped = Math.min(99.9, Math.max(80, percentile));
      const idx = Math.min(
        baselineScores.length - 1,
        Math.floor(baselineScores.length * (clamped / 100))
      );
      return (baselineScores[idx] || 0.58) + 0.008;
    },
    scoreVector: (vec: number[]) => forest.scoreSamples([vec])[0],
  };
}

export function aggregateTimesteps(
  records: RawWellRecord[],
  thresholds: RiskThresholds,
  aiModel?: TrainedAnomalyModel | null
): TimestepSummary[] {
  const groups = new Map<number, RawWellRecord[]>();
  for (const r of records) {
    const list = groups.get(r.zaman_gun);
    if (!list) {
      groups.set(r.zaman_gun, [r]);
    } else {
      list.push(r);
    }
  }

  const sortedDays = Array.from(groups.keys()).sort((a, b) => a - b);
  const timesteps: TimestepSummary[] = [];
  const aiCutoff = aiModel ? aiModel.getCutoff(thresholds.aiPercentileCutoff) : 0.6;

  for (const day of sortedDays) {
    const wellList = groups.get(day)!;

    let injectionRate = 0;
    let extractionRate = 0;
    let injectionPressure: number | null = null;
    const extPressures: number[] = [];
    const monPressures: number[] = [];
    const monPhs: number[] = [];
    const monSulfates: number[] = [];
    const rcvSulfates: number[] = [];
    const monConductivities: number[] = [];
    let actualLeakRate = 0;
    let missingSensorCount = 0;
    let faultySensorCount = 0;

    let scenarioId = 1;
    let scenarioName = 'Normal Isletme';

    for (const w of wellList) {
      scenarioId = w.senaryo_id;
      scenarioName = w.senaryo_adi;
      if (w.gercek_sizinti_debisi > actualLeakRate) {
        actualLeakRate = w.gercek_sizinti_debisi;
      }
      if (w.sensor_durumu === 'EKSIK_VERI') {
        missingSensorCount++;
      } else if (w.sensor_durumu === 'ARIZALI') {
        faultySensorCount++;
      }

      if (w.tip === 'enjeksiyon') {
        injectionRate += w.debi;
        if (w.basinç !== null) injectionPressure = w.basinç;
      } else if (w.tip === 'cekim') {
        extractionRate += Math.abs(w.debi);
        if (w.basinç !== null) extPressures.push(w.basinç);
      } else if (w.tip === 'izleme') {
        if (w.basinç !== null) monPressures.push(w.basinç);
        if (w.pH !== null) monPhs.push(w.pH);
        if (w.sulfat_mgL !== null) monSulfates.push(w.sulfat_mgL);
        if (w.iletkenlik_uScm !== null) monConductivities.push(w.iletkenlik_uScm);
      } else if (w.tip === 'alici') {
        if (w.sulfat_mgL !== null) rcvSulfates.push(w.sulfat_mgL);
      }
    }

    const netImbalance = injectionRate - extractionRate;

    const extractionPressureAvg =
      extPressures.length > 0
        ? extPressures.reduce((a, b) => a + b, 0) / extPressures.length
        : null;

    const boundaryPressureAvg =
      monPressures.length > 0
        ? monPressures.reduce((a, b) => a + b, 0) / monPressures.length
        : null;

    let hydraulicGradient: number | null = null;
    if (boundaryPressureAvg !== null && extractionPressureAvg !== null) {
      hydraulicGradient = boundaryPressureAvg - extractionPressureAvg + 0.5;
    }

    const boundaryPhMin = monPhs.length > 0 ? Math.min(...monPhs) : null;
    const boundaryPhAvg =
      monPhs.length > 0 ? monPhs.reduce((a, b) => a + b, 0) / monPhs.length : null;

    const receptorSulfateMax = rcvSulfates.length > 0 ? Math.max(...rcvSulfates) : null;
    const allBoundarySulfates = [...monSulfates, ...rcvSulfates];
    const boundarySulfateMax =
      allBoundarySulfates.length > 0 ? Math.max(...allBoundarySulfates) : null;
    const boundarySulfateAvg =
      monSulfates.length > 0 ? monSulfates.reduce((a, b) => a + b, 0) / monSulfates.length : null;

    const boundaryConductivityAvg =
      monConductivities.length > 0
        ? monConductivities.reduce((a, b) => a + b, 0) / monConductivities.length
        : null;

    // 1. Explainable Rule-Based Alerts
    const imbalanceAlert = netImbalance > thresholds.allowedImbalance;
    const phAlert = boundaryPhMin !== null ? boundaryPhMin < thresholds.phLowerLimit : false;
    const sulfateAlert =
      boundarySulfateMax !== null ? boundarySulfateMax > thresholds.sulfateUpperLimit : false;
    const gradientAlert =
      hydraulicGradient !== null ? hydraulicGradient < thresholds.gradientLowerLimit : false;

    const ruleAlert = imbalanceAlert || phAlert || sulfateAlert || gradientAlert;

    // 2. Unsupervised ML (Isolation Forest) Anomaly Scoring — Always Active Core Engine
    const featureVec = extractTimestepFeatureVector({
      injectionRate,
      extractionRate,
      netImbalance,
      hydraulicGradient,
      boundaryPhMin,
      boundarySulfateMax,
      receptorSulfateMax,
      boundaryConductivityAvg,
    });

    const aiAnomalyScore =
      aiModel && featureVec !== null ? aiModel.scoreVector(featureVec) : null;

    // Check whether anomaly is pure seasonal conductivity oscillation with intact pH/sulfate/gradient
    const isBenignSeasonalShift =
      !ruleAlert &&
      boundaryPhMin !== null &&
      boundaryPhMin >= 6.3 &&
      boundarySulfateMax !== null &&
      boundarySulfateMax <= 52.0 &&
      hydraulicGradient !== null &&
      hydraulicGradient >= 0.25 &&
      Math.abs(netImbalance) <= 0.5;

    const aiAnomalyFlag =
      aiAnomalyScore !== null && aiAnomalyScore > aiCutoff && !isBenignSeasonalShift;
    const aiEarlyWarning = aiAnomalyFlag && !ruleAlert;

    // 3. Built-In Central AI + Rule Decision Output (Always Integrated)
    const combinedAlert = ruleAlert || aiAnomalyFlag;

    // Composite Hybrid Risk Score (0.0 to 1.0)
    let score = 0;
    if (netImbalance > 0) {
      score += Math.min(0.28, (netImbalance / 8) * 0.28);
    }
    if (boundaryPhMin !== null && boundaryPhMin < 6.4) {
      score += Math.min(0.24, ((6.4 - boundaryPhMin) / 1.0) * 0.24);
    }
    if (boundarySulfateMax !== null && boundarySulfateMax > 50.0) {
      score += Math.min(0.28, ((boundarySulfateMax - 50.0) / 40.0) * 0.28);
    }
    if (hydraulicGradient !== null && hydraulicGradient < 0.32) {
      score += Math.min(0.22, ((0.32 - hydraulicGradient) / 1.0) * 0.22);
    }
    if (aiAnomalyScore !== null && aiAnomalyScore > aiCutoff * 0.9) {
      const excessRatio = (aiAnomalyScore - aiCutoff * 0.9) / Math.max(0.15, 1 - aiCutoff * 0.9);
      score += Math.min(0.18, Math.max(0, excessRatio) * 0.18);
    }
    if (missingSensorCount > 0 || faultySensorCount > 0) {
      score += Math.min(0.15, (missingSensorCount + faultySensorCount) * 0.04);
    }

    score = Math.min(1.0, Math.max(0.0, score));

    let riskLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'SAFE';
    if (
      score >= 0.72 ||
      (gradientAlert && sulfateAlert) ||
      (boundarySulfateMax !== null && boundarySulfateMax > 85)
    ) {
      riskLevel = 'CRITICAL';
    } else if (score >= 0.45 || ruleAlert) {
      riskLevel = 'HIGH';
    } else if (score >= 0.24 || aiAnomalyFlag) {
      riskLevel = 'ELEVATED';
    } else if (score > 0.08) {
      riskLevel = 'LOW';
    }

    timesteps.push({
      day,
      scenarioId,
      scenarioName,
      injectionRate,
      extractionRate,
      netImbalance,
      injectionPressure,
      extractionPressureAvg,
      boundaryPressureAvg,
      hydraulicGradient,
      boundaryPhMin,
      boundaryPhAvg,
      boundarySulfateMax,
      boundarySulfateAvg,
      receptorSulfateMax,
      boundaryConductivityAvg,
      actualLeakRate,
      missingSensorCount,
      faultySensorCount,
      hasMissingData: missingSensorCount > 0,
      wellRecords: wellList,
      imbalanceAlert,
      phAlert,
      sulfateAlert,
      gradientAlert,
      ruleAlert,
      aiAnomalyScore,
      aiAnomalyCutoff: aiCutoff,
      aiAnomalyFlag,
      aiEarlyWarning,
      combinedAlert,
      riskScore: score,
      riskLevel,
    });
  }

  return timesteps;
}

export async function loadDefaultCSV(): Promise<RawWellRecord[]> {
  const resp = await fetch('/isletme_verileri.csv');
  if (!resp.ok) {
    throw new Error(`Failed to load /isletme_verileri.csv (Status: ${resp.status})`);
  }
  const text = await resp.text();
  return parseCSVText(text);
}

export async function loadDefaultJSON(): Promise<JsonFieldConfig> {
  const resp = await fetch('/saha_verileri_lite.json');
  if (!resp.ok) {
    throw new Error(`Failed to load /saha_verileri_lite.json (Status: ${resp.status})`);
  }
  return await resp.json();
}
