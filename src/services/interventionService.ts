import { TimestepSummary, RiskThresholds } from '../types/islData';

export interface InterventionComparison {
  before: {
    phExceedanceHours: number;
    sulfateExceedanceHours: number;
    imbalanceExceedanceHours: number;
    riskyHours: number;
    totalPositiveImbalanceM3: number;
    averageRiskScore: number;
    interventionsTriggered: number;
  };
  after: {
    phExceedanceHours: number;
    sulfateExceedanceHours: number;
    imbalanceExceedanceHours: number;
    riskyHours: number;
    totalPositiveImbalanceM3: number;
    averageRiskScore: number;
    interventionsExecuted: number;
  };
  delta: {
    riskyHoursReduction: number;
    riskyHoursReductionPercent: number;
    imbalanceVolumeReductionM3: number;
    phExceedanceReduction: number;
    sulfateExceedanceReduction: number;
  };
  simulatedTimesteps: TimestepSummary[];
}

export function computeInterventionScenario(
  timesteps: TimestepSummary[],
  appliedAtDay: number | null,
  strategy: 'throttle_to_extraction' | 'full_shutdown',
  maintainExtraction: boolean,
  thresholds: RiskThresholds
): InterventionComparison {
  const stepDurationHours = 6; // 0.25 days per record

  // 1. Calculate BEFORE metrics
  let beforePhExceedHours = 0;
  let beforeSulfateExceedHours = 0;
  let beforeImbalanceExceedHours = 0;
  let beforeRiskyHours = 0;
  let beforePositiveImbalanceVolume = 0;
  let beforeRiskScoreSum = 0;
  let beforeInterventions = 0;

  for (const t of timesteps) {
    if (t.phAlert) beforePhExceedHours += stepDurationHours;
    if (t.sulfateAlert) beforeSulfateExceedHours += stepDurationHours;
    if (t.imbalanceAlert) beforeImbalanceExceedHours += stepDurationHours;
    if (t.combinedAlert) {
      beforeRiskyHours += stepDurationHours;
      beforeInterventions++;
    }
    if (t.netImbalance > 0) {
      beforePositiveImbalanceVolume += t.netImbalance * stepDurationHours;
    }
    beforeRiskScoreSum += t.riskScore;
  }

  const beforeAvgRisk = timesteps.length > 0 ? beforeRiskScoreSum / timesteps.length : 0;

  // 2. Recompute AFTER intervention timesteps
  const simulatedTimesteps: TimestepSummary[] = [];

  let afterPhExceedHours = 0;
  let afterSulfateExceedHours = 0;
  let afterImbalanceExceedHours = 0;
  let afterRiskyHours = 0;
  let afterPositiveImbalanceVolume = 0;
  let afterRiskScoreSum = 0;
  let afterInterventions = 0;

  // Recovery decay kinetics (as inward cone pulls water back)
  let recoveryHoursElapsed = 0;

  for (const t of timesteps) {
    const isPostIntervention = appliedAtDay !== null && t.day >= appliedAtDay;

    let injectionRate = t.injectionRate;
    let extractionRate = t.extractionRate;

    if (isPostIntervention) {
      recoveryHoursElapsed += stepDurationHours;
      afterInterventions++;

      // Action: throttle or shutdown injection
      if (strategy === 'full_shutdown') {
        injectionRate = 0;
      } else {
        // Throttle to match extraction or below allowed imbalance
        injectionRate = Math.min(t.injectionRate, t.extractionRate * 0.98); // 2% bleed
      }

      if (!maintainExtraction) {
        extractionRate = 0;
      }
    }

    const netImbalance = injectionRate - extractionRate;

    // Chemical recovery simulation over time if inward gradient maintained
    let boundaryPhMin = t.boundaryPhMin;
    let boundarySulfateMax = t.boundarySulfateMax;
    let hydraulicGradient = t.hydraulicGradient;

    if (isPostIntervention && maintainExtraction && recoveryHoursElapsed > 0) {
      // Inward drawdown restores hydraulic gradient
      if (hydraulicGradient !== null) {
        hydraulicGradient = Math.min(1.2, hydraulicGradient + 0.05 * Math.min(recoveryHoursElapsed / 24, 10));
      }
      // pH recovers back towards ~6.6
      if (boundaryPhMin !== null && boundaryPhMin < 6.5) {
        const phDeficit = 6.5 - boundaryPhMin;
        const recovered = phDeficit * Math.min(1.0, recoveryHoursElapsed / (48)); // recovers over 48h
        boundaryPhMin = Math.min(6.5, boundaryPhMin + recovered);
      }
      // Sulfate flushes back down towards baseline ~45 mg/L
      if (boundarySulfateMax !== null && boundarySulfateMax > 45) {
        const excess = boundarySulfateMax - 45;
        const flushed = excess * Math.min(1.0, recoveryHoursElapsed / (72)); // flushes over 72h
        boundarySulfateMax = Math.max(45, boundarySulfateMax - flushed);
      }
    }

    // Recompute alerts
    const imbalanceAlert = netImbalance > thresholds.allowedImbalance;
    const phAlert = boundaryPhMin !== null ? boundaryPhMin < thresholds.phLowerLimit : false;
    const sulfateAlert = boundarySulfateMax !== null ? boundarySulfateMax > thresholds.sulfateUpperLimit : false;
    const gradientAlert = hydraulicGradient !== null ? hydraulicGradient < thresholds.gradientLowerLimit : false;
    const combinedAlert = imbalanceAlert || phAlert || sulfateAlert || gradientAlert;

    // Recompute score
    let score = 0;
    if (netImbalance > 0) score += Math.min(0.35, (netImbalance / 10) * 0.35);
    if (boundaryPhMin !== null && boundaryPhMin < 6.8) {
      score += Math.min(0.25, ((6.8 - boundaryPhMin) / 1.5) * 0.25);
    }
    if (boundarySulfateMax !== null && boundarySulfateMax > 45.0) {
      score += Math.min(0.25, ((boundarySulfateMax - 45.0) / 40.0) * 0.25);
    }
    if (hydraulicGradient !== null && hydraulicGradient < 0.6) {
      score += Math.min(0.15, ((0.6 - hydraulicGradient) / 0.8) * 0.15);
    }
    if (t.missingSensorCount > 0) {
      score += Math.min(0.15, t.missingSensorCount * 0.05);
    }
    score = Math.min(1.0, Math.max(0.0, score));

    let riskLevel: 'SAFE' | 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL' = 'SAFE';
    if (score >= 0.75 || (imbalanceAlert && (phAlert || sulfateAlert))) riskLevel = 'CRITICAL';
    else if (score >= 0.5 || combinedAlert) riskLevel = 'HIGH';
    else if (score >= 0.25) riskLevel = 'ELEVATED';
    else if (score > 0.08) riskLevel = 'LOW';

    if (phAlert) afterPhExceedHours += stepDurationHours;
    if (sulfateAlert) afterSulfateExceedHours += stepDurationHours;
    if (imbalanceAlert) afterImbalanceExceedHours += stepDurationHours;
    if (combinedAlert) afterRiskyHours += stepDurationHours;
    if (netImbalance > 0) afterPositiveImbalanceVolume += netImbalance * stepDurationHours;
    afterRiskScoreSum += score;

    simulatedTimesteps.push({
      ...t,
      injectionRate,
      extractionRate,
      netImbalance,
      boundaryPhMin,
      boundarySulfateMax,
      hydraulicGradient,
      imbalanceAlert,
      phAlert,
      sulfateAlert,
      gradientAlert,
      combinedAlert,
      riskScore: score,
      riskLevel,
    });
  }

  const afterAvgRisk = timesteps.length > 0 ? afterRiskScoreSum / timesteps.length : 0;

  const riskyReduction = Math.max(0, beforeRiskyHours - afterRiskyHours);
  const riskyPercent = beforeRiskyHours > 0 ? (riskyReduction / beforeRiskyHours) * 100 : 0;
  const volReduction = Math.max(0, beforePositiveImbalanceVolume - afterPositiveImbalanceVolume);

  return {
    before: {
      phExceedanceHours: beforePhExceedHours,
      sulfateExceedanceHours: beforeSulfateExceedHours,
      imbalanceExceedanceHours: beforeImbalanceExceedHours,
      riskyHours: beforeRiskyHours,
      totalPositiveImbalanceM3: beforePositiveImbalanceVolume,
      averageRiskScore: beforeAvgRisk,
      interventionsTriggered: beforeInterventions,
    },
    after: {
      phExceedanceHours: afterPhExceedHours,
      sulfateExceedanceHours: afterSulfateExceedHours,
      imbalanceExceedanceHours: afterImbalanceExceedHours,
      riskyHours: afterRiskyHours,
      totalPositiveImbalanceM3: afterPositiveImbalanceVolume,
      averageRiskScore: afterAvgRisk,
      interventionsExecuted: appliedAtDay !== null ? 1 : 0,
    },
    delta: {
      riskyHoursReduction: riskyReduction,
      riskyHoursReductionPercent: riskyPercent,
      imbalanceVolumeReductionM3: volReduction,
      phExceedanceReduction: Math.max(0, beforePhExceedHours - afterPhExceedHours),
      sulfateExceedanceReduction: Math.max(0, beforeSulfateExceedHours - afterSulfateExceedHours),
    },
    simulatedTimesteps,
  };
}
