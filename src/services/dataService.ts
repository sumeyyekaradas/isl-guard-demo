import { RawWellRecord, WellConfig, JsonFieldConfig, TimestepSummary, RiskThresholds, SensorStatus, WellType } from '../types/islData';

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

export function aggregateTimesteps(
  records: RawWellRecord[],
  thresholds: RiskThresholds
): TimestepSummary[] {
  // Group records by zaman_gun
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

  for (const day of sortedDays) {
    const wellList = groups.get(day)!;

    let injectionRate = 0;
    let extractionRate = 0;
    let injectionPressure: number | null = null;
    const extPressures: number[] = [];
    const monPressures: number[] = [];
    const monPhs: number[] = [];
    const monSulfates: number[] = [];
    const monConductivities: number[] = [];
    let actualLeakRate = 0;
    let missingSensorCount = 0;

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

    // Hydraulic gradient indicator: Inward gradient = (Boundary Pressure - Pattern Extraction Pressure)
    // A positive value indicates inward water drive; dropping near or below 0 indicates outward pressure reversal.
    let hydraulicGradient: number | null = null;
    if (boundaryPressureAvg !== null && extractionPressureAvg !== null) {
      hydraulicGradient = boundaryPressureAvg - extractionPressureAvg + 0.5; // normalized offset
    }

    const boundaryPhMin = monPhs.length > 0 ? Math.min(...monPhs) : null;
    const boundaryPhAvg =
      monPhs.length > 0 ? monPhs.reduce((a, b) => a + b, 0) / monPhs.length : null;

    const boundarySulfateMax = monSulfates.length > 0 ? Math.max(...monSulfates) : null;
    const boundarySulfateAvg =
      monSulfates.length > 0 ? monSulfates.reduce((a, b) => a + b, 0) / monSulfates.length : null;

    const boundaryConductivityAvg =
      monConductivities.length > 0
        ? monConductivities.reduce((a, b) => a + b, 0) / monConductivities.length
        : null;

    // Explainable Rule-Based Alerts
    const imbalanceAlert = netImbalance > thresholds.allowedImbalance;
    const phAlert = boundaryPhMin !== null ? boundaryPhMin < thresholds.phLowerLimit : false;
    const sulfateAlert = boundarySulfateMax !== null ? boundarySulfateMax > thresholds.sulfateUpperLimit : false;
    const gradientAlert = hydraulicGradient !== null ? hydraulicGradient < thresholds.gradientLowerLimit : false;

    const combinedAlert = imbalanceAlert || phAlert || sulfateAlert || gradientAlert;

    // Composite explainable risk score (0.0 to 1.0)
    let score = 0;
    // 1. Imbalance factor (35%)
    if (netImbalance > 0) {
      score += Math.min(0.35, (netImbalance / 10) * 0.35);
    }
    // 2. pH departure (25%)
    if (boundaryPhMin !== null && boundaryPhMin < 6.8) {
      score += Math.min(0.25, ((6.8 - boundaryPhMin) / 1.5) * 0.25);
    }
    // 3. Sulfate excursion (25%)
    if (boundarySulfateMax !== null && boundarySulfateMax > 45.0) {
      score += Math.min(0.25, ((boundarySulfateMax - 45.0) / 40.0) * 0.25);
    }
    // 4. Gradient decay (15%)
    if (hydraulicGradient !== null && hydraulicGradient < 0.6) {
      score += Math.min(0.15, ((0.6 - hydraulicGradient) / 0.8) * 0.15);
    }
    // 5. Missing telemetry uncertainty penalty (missing sensors are never assumed safe)
    if (missingSensorCount > 0) {
      score += Math.min(0.15, missingSensorCount * 0.05);
    }

    score = Math.min(1.0, Math.max(0.0, score));

    let riskLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'SAFE';
    if (score >= 0.75 || (imbalanceAlert && (phAlert || sulfateAlert))) {
      riskLevel = 'CRITICAL';
    } else if (score >= 0.5 || combinedAlert) {
      riskLevel = 'HIGH';
    } else if (score >= 0.25) {
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
      boundaryConductivityAvg,
      actualLeakRate,
      missingSensorCount,
      hasMissingData: missingSensorCount > 0,
      wellRecords: wellList,
      imbalanceAlert,
      phAlert,
      sulfateAlert,
      gradientAlert,
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
