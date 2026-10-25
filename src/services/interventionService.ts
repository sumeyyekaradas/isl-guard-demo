import { TimestepSummary, RiskThresholds } from '../types/islData';
import { TrainedAnomalyModel, extractTimestepFeatureVector } from './dataService';

export interface InterventionComparison {
  before: {
    phExceedanceHours: number;
    sulfateExceedanceHours: number;
    imbalanceExceedanceHours: number;
    aiAnomalyHours: number;
    riskyHours: number;
    totalPositiveImbalanceM3: number;
    averageRiskScore: number;
    interventionsTriggered: number;
  };
  after: {
    phExceedanceHours: number;
    sulfateExceedanceHours: number;
    imbalanceExceedanceHours: number;
    aiAnomalyHours: number;
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
    aiAnomalyHoursReduction: number;
  };
  simulatedTimesteps: TimestepSummary[];
}

export function computeInterventionScenario(
  timesteps: TimestepSummary[],
  appliedAtDay: number | null,
  strategy: 'throttle_to_extraction' | 'full_shutdown',
  maintainExtraction: boolean,
  thresholds: RiskThresholds,
  aiModel?: TrainedAnomalyModel | null
): InterventionComparison {
  const stepDurationHours = 6; // 0.25 days per record
  const aiCutoff = aiModel ? aiModel.getCutoff(thresholds.aiPercentileCutoff) : 0.6;

  // 1. Calculate BEFORE metrics
  let beforePhExceedHours = 0;
  let beforeSulfateExceedHours = 0;
  let beforeImbalanceExceedHours = 0;
  let beforeAiAnomalyHours = 0;
  let beforeRiskyHours = 0;
  let beforePositiveImbalanceVolume = 0;
  let beforeRiskScoreSum = 0;
  let beforeInterventions = 0;

  for (const t of timesteps) {
    if (t.phAlert) beforePhExceedHours += stepDurationHours;
    if (t.sulfateAlert) beforeSulfateExceedHours += stepDurationHours;
    if (t.imbalanceAlert) beforeImbalanceExceedHours += stepDurationHours;
    if (t.aiAnomalyFlag) beforeAiAnomalyHours += stepDurationHours;
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
  let afterAiAnomalyHours = 0;
  let afterRiskyHours = 0;
  let afterPositiveImbalanceVolume = 0;
  let afterRiskScoreSum = 0;

  let recoveryHoursElapsed = 0;

  for (const t of timesteps) {
    const isPostIntervention = appliedAtDay !== null && t.day >= appliedAtDay;

    let injectionRate = t.injectionRate;
    let extractionRate = t.extractionRate;

    if (isPostIntervention) {
      recoveryHoursElapsed += stepDurationHours;

      if (strategy === 'full_shutdown') {
        injectionRate = 0;
      } else {
        injectionRate = Math.min(t.injectionRate, t.extractionRate * 0.94);
      }

      if (!maintainExtraction) {
        extractionRate = 0;
      }
    }

    const netImbalance = injectionRate - extractionRate;

    let boundaryPhMin = t.boundaryPhMin;
    let boundarySulfateMax = t.boundarySulfateMax;
    let receptorSulfateMax = t.receptorSulfateMax;
    let hydraulicGradient = t.hydraulicGradient;
    let boundaryConductivityAvg = t.boundaryConductivityAvg;

    if (isPostIntervention && maintainExtraction && recoveryHoursElapsed > 0) {
      if (hydraulicGradient !== null) {
        hydraulicGradient = Math.min(
          0.65,
          hydraulicGradient + 0.12 * Math.min(recoveryHoursElapsed / 24, 10)
        );
      }
      if (boundaryPhMin !== null && boundaryPhMin < 6.48) {
        const phDeficit = 6.48 - boundaryPhMin;
        const recovered = phDeficit * Math.min(1.0, recoveryHoursElapsed / 36);
        boundaryPhMin = Math.min(6.48, boundaryPhMin + recovered);
      }
      if (boundarySulfateMax !== null && boundarySulfateMax > 46) {
        const excess = boundarySulfateMax - 46;
        const flushed = excess * Math.min(1.0, recoveryHoursElapsed / 48);
        boundarySulfateMax = Math.max(46, boundarySulfateMax - flushed);
      }
      if (receptorSulfateMax !== null && receptorSulfateMax > 31) {
        const excessRcv = receptorSulfateMax - 31;
        const flushedRcv = excessRcv * Math.min(1.0, recoveryHoursElapsed / 48);
        receptorSulfateMax = Math.max(31, receptorSulfateMax - flushedRcv);
      }
      if (boundaryConductivityAvg !== null && boundaryConductivityAvg > 515) {
        const excessCond = boundaryConductivityAvg - 515;
        const flushedCond = excessCond * Math.min(1.0, recoveryHoursElapsed / 48);
        boundaryConductivityAvg = Math.max(515, boundaryConductivityAvg - flushedCond);
      }
    }

    // Recompute Rule Alerts
    const imbalanceAlert = netImbalance > thresholds.allowedImbalance;
    const phAlert = boundaryPhMin !== null ? boundaryPhMin < thresholds.phLowerLimit : false;
    const sulfateAlert =
      boundarySulfateMax !== null ? boundarySulfateMax > thresholds.sulfateUpperLimit : false;
    const gradientAlert =
      hydraulicGradient !== null ? hydraulicGradient < thresholds.gradientLowerLimit : false;
    const ruleAlert = imbalanceAlert || phAlert || sulfateAlert || gradientAlert;

    // Recompute AI Isolation Forest Score on post-intervention state
    const evalInj = isPostIntervention ? Math.min(50, extractionRate) : injectionRate;
    const evalImb = evalInj - extractionRate;
    const featureVec = extractTimestepFeatureVector({
      injectionRate: evalInj,
      extractionRate,
      netImbalance: evalImb,
      hydraulicGradient,
      boundaryPhMin,
      boundarySulfateMax,
      receptorSulfateMax,
      boundaryConductivityAvg,
    });

    const aiAnomalyScore =
      aiModel && featureVec !== null ? aiModel.scoreVector(featureVec) : t.aiAnomalyScore;

    const isBenignPostRecovery =
      !ruleAlert &&
      boundaryPhMin !== null &&
      boundaryPhMin >= 6.3 &&
      boundarySulfateMax !== null &&
      boundarySulfateMax <= 52.0 &&
      hydraulicGradient !== null &&
      hydraulicGradient >= 0.25 &&
      netImbalance <= 0.5;

    const aiAnomalyFlag =
      aiAnomalyScore !== null && aiAnomalyScore > aiCutoff && !isBenignPostRecovery;
    const aiEarlyWarning = aiAnomalyFlag && !ruleAlert;

    const combinedAlert = ruleAlert || aiAnomalyFlag;

    let score = 0;
    if (netImbalance > 0) score += Math.min(0.28, (netImbalance / 8) * 0.28);
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
    if (t.missingSensorCount > 0 || t.faultySensorCount > 0) {
      score += Math.min(0.15, (t.missingSensorCount + t.faultySensorCount) * 0.04);
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

    if (phAlert) afterPhExceedHours += stepDurationHours;
    if (sulfateAlert) afterSulfateExceedHours += stepDurationHours;
    if (imbalanceAlert) afterImbalanceExceedHours += stepDurationHours;
    if (aiAnomalyFlag) afterAiAnomalyHours += stepDurationHours;
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
      receptorSulfateMax,
      boundaryConductivityAvg,
      hydraulicGradient,
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

  const afterAvgRisk = timesteps.length > 0 ? afterRiskScoreSum / timesteps.length : 0;

  const riskyReduction = Math.max(0, beforeRiskyHours - afterRiskyHours);
  const riskyPercent = beforeRiskyHours > 0 ? (riskyReduction / beforeRiskyHours) * 100 : 0;
  const volReduction = Math.max(0, beforePositiveImbalanceVolume - afterPositiveImbalanceVolume);

  return {
    before: {
      phExceedanceHours: beforePhExceedHours,
      sulfateExceedanceHours: beforeSulfateExceedHours,
      imbalanceExceedanceHours: beforeImbalanceExceedHours,
      aiAnomalyHours: beforeAiAnomalyHours,
      riskyHours: beforeRiskyHours,
      totalPositiveImbalanceM3: beforePositiveImbalanceVolume,
      averageRiskScore: beforeAvgRisk,
      interventionsTriggered: beforeInterventions,
    },
    after: {
      phExceedanceHours: afterPhExceedHours,
      sulfateExceedanceHours: afterSulfateExceedHours,
      imbalanceExceedanceHours: afterImbalanceExceedHours,
      aiAnomalyHours: afterAiAnomalyHours,
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
      aiAnomalyHoursReduction: Math.max(0, beforeAiAnomalyHours - afterAiAnomalyHours),
    },
    simulatedTimesteps,
  };
}
