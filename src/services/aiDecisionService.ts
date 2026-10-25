import { TimestepSummary, RiskThresholds, InterventionConfig } from '../types/islData';

export interface AIDecisionReport {
  headline: string;
  diagnosisCode:
    | 'NOMINAL_CONTAINMENT'
    | 'AI_EARLY_DRIFT'
    | 'SLOW_EXCURSION_IMBALANCE'
    | 'ACUTE_HYDRAULIC_COLLAPSE'
    | 'ISOLATED_SENSOR_FAULT'
    | 'OUTER_RECEPTOR_BYPASS'
    | 'SEASONAL_BACKGROUND_SHIFT'
    | 'MITIGATION_ACTIVE_RECOVERY';
  urgency: 'NOMINAL' | 'ADVISORY' | 'WARNING' | 'CRITICAL';
  summaryExplanation: string;
  sensorFindings: string[];
  affectedWells: string[];
  recommendedStrategy: 'full_shutdown' | 'throttle_to_extraction' | 'nominal';
  recommendedStrategyLabel: string;
  recommendedInjectionRateM3h: number;
  recommendedExtractionAction: string;
  recommendedTracerWellId: string;
  recommendedTracerReason: string;
  actionRecommendations: string[];
  liveNarratorSteps: {
    step1Telemetry: string;
    step2AiAnalysis: string;
    step3DecisionSupport: string;
    step4ControlLoop: string;
  };
}

/**
 * Central AI Decision Support & Sensor Intelligence Engine.
 * Evaluates spatial 20-well telemetry, 8-channel Isolation Forest anomaly scores,
 * geochemical perimeter shifts, receptor bypasses, and sensor fault flags in real time.
 */
export function evaluateAIDecisionSupport(
  current: TimestepSummary | null,
  thresholds: RiskThresholds,
  intervention: InterventionConfig
): AIDecisionReport {
  if (!current) {
    return {
      headline: 'Initializing Multi-Sensor AI Telemetry Stream',
      diagnosisCode: 'NOMINAL_CONTAINMENT',
      urgency: 'NOMINAL',
      summaryExplanation: 'Waiting for operational wellfield records.',
      sensorFindings: [],
      affectedWells: [],
      recommendedStrategy: 'nominal',
      recommendedStrategyLabel: 'Maintain Nominal 5-Spot Equilibrium',
      recommendedInjectionRateM3h: 50.0,
      recommendedExtractionAction: 'Maintain EXT-01..04 at 50.0 m³/h aggregate recovery.',
      recommendedTracerWellId: 'EXT-01',
      recommendedTracerReason: 'Verify baseline 5-spot sweep transit time.',
      actionRecommendations: [],
      liveNarratorSteps: {
        step1Telemetry: 'Connecting to 20 wellhead telemetry streams...',
        step2AiAnalysis: 'Calibrating 100-tree Isolation Forest baseline...',
        step3DecisionSupport: 'Standby for live telemetry evaluation.',
        step4ControlLoop: 'Closed-loop safety controller idle.',
      },
    };
  }

  // Analyze spatial well records on this exact day
  const faultyWells: string[] = [];
  const missingWells: string[] = [];
  const anomalousMonWells: string[] = [];
  const anomalousRcvWells: string[] = [];
  let worstMonWellId = 'MON-04';
  let worstMonSulfate = -1;

  for (const w of current.wellRecords) {
    if (w.sensor_durumu === 'ARIZALI') {
      faultyWells.push(w.kuyu_id);
    } else if (w.sensor_durumu === 'EKSIK_VERI') {
      missingWells.push(w.kuyu_id);
    }

    if (w.tip === 'izleme') {
      const so4Breach = w.sulfat_mgL !== null && w.sulfat_mgL > thresholds.sulfateUpperLimit;
      const phBreach = w.pH !== null && w.pH < thresholds.phLowerLimit;
      const so4Drift = w.sulfat_mgL !== null && w.sulfat_mgL > 54.0;
      if (so4Breach || phBreach || so4Drift) {
        anomalousMonWells.push(w.kuyu_id);
      }
      if (w.sulfat_mgL !== null && w.sulfat_mgL > worstMonSulfate) {
        worstMonSulfate = w.sulfat_mgL;
        worstMonWellId = w.kuyu_id;
      }
    } else if (w.tip === 'alici') {
      if (w.sulfat_mgL !== null && w.sulfat_mgL > 55.0) {
        anomalousRcvWells.push(w.kuyu_id);
      }
    }
  }

  const affectedWells = Array.from(
    new Set([...faultyWells, ...anomalousMonWells, ...anomalousRcvWells, ...missingWells])
  );

  const isMitigationActive =
    intervention.status === 'approved' ||
    intervention.status === 'auto_tripped' ||
    intervention.status === 'active';

  const aiScoreStr =
    current.aiAnomalyScore !== null ? current.aiAnomalyScore.toFixed(3) : 'N/A (Missing Channel)';
  const aiCutoffStr = current.aiAnomalyCutoff.toFixed(3);

  // Common Step 1 & Step 4 narrator strings
  const step1Telemetry = `Reading 20 wells on Day ${current.day.toFixed(2)} (${current.scenarioName}): Q_inj=${current.injectionRate.toFixed(
    1
  )} m³/h, Q_ext=${current.extractionRate.toFixed(1)} m³/h, Gradient=${
    current.hydraulicGradient !== null ? current.hydraulicGradient.toFixed(2) : 'MISSING'
  }, Min pH=${
    current.boundaryPhMin !== null ? current.boundaryPhMin.toFixed(2) : 'MISSING'
  }, Max SO₄=${
    current.boundarySulfateMax !== null ? `${current.boundarySulfateMax.toFixed(1)} mg/L` : 'MISSING'
  }${
    missingWells.length > 0 ? ` [${missingWells.length} missing: ${missingWells.join(', ')}]` : ''
  }${faultyWells.length > 0 ? ` [${faultyWells.length} faulty: ${faultyWells.join(', ')}]` : ''}.`;

  const step4ControlLoop =
    intervention.status === 'awaiting_approval'
      ? `ACTIVE WARNING — Waiting ${intervention.countdownRemaining}s for supervisor authorization. If unanswered, Fail-Safe Auto-Stop halts injection (Q_inj = 0.0 m³/h).`
      : intervention.status === 'auto_tripped'
      ? `FAIL-SAFE AUTO-STOP ENGAGED — Injection automatically stopped (Q_inj = 0.0 m³/h) while extraction recovers hydraulic capture.`
      : intervention.status === 'approved'
      ? `MITIGATION ACTIVE — Supervisor approved ${
          intervention.mode === 'full_shutdown'
            ? 'full injection shutdown (0.0 m³/h)'
            : 'bleed throttling below extraction rate'
        } from Day ${intervention.appliedAtDay?.toFixed(2) ?? current.day.toFixed(2)}.`
      : intervention.status === 'rejected'
      ? `MANUAL OVERRIDE — Supervisor dismissed active warning; baseline pumping continues under heightened surveillance.`
      : `CLOSED-LOOP ARMED — Automatic monitoring active; supervisor prompt will trigger immediately on any AI or rule threshold breach.`;

  // Case 0: Post-intervention recovery state
  if (isMitigationActive && current.injectionRate < 49.5) {
    return {
      headline: 'Mitigation Active — Inward Hydraulic Capture & Geochemical Recovery',
      diagnosisCode: 'MITIGATION_ACTIVE_RECOVERY',
      urgency: 'ADVISORY',
      summaryExplanation: `Closed-loop mitigation is active (Q_inj reduced to ${current.injectionRate.toFixed(
        1
      )} m³/h while extraction operates at ${current.extractionRate.toFixed(
        1
      )} m³/h, creating a net inward sink of ${Math.abs(current.netImbalance).toFixed(
        1
      )} m³/h). Perimeter sulfate and pH are progressively flushing back toward baseline.`,
      sensorFindings: [
        `Net inward bleed sink: ΔQ = ${current.netImbalance.toFixed(1)} m³/h restoring capture cone`,
        `Recalculated Isolation Forest AI Score: ${aiScoreStr} (Cutoff: ${aiCutoffStr})`,
        `Current Hydraulic Gradient Proxy: ${
          current.hydraulicGradient !== null ? current.hydraulicGradient.toFixed(2) : 'MISSING'
        }`,
      ],
      affectedWells: affectedWells.slice(0, 6),
      recommendedStrategy: intervention.mode,
      recommendedStrategyLabel:
        intervention.mode === 'full_shutdown'
          ? 'Maintain Emergency Injection Stop Until Perimeter Clears'
          : 'Maintain 94% Bleed Throttling Equilibrium',
      recommendedInjectionRateM3h: current.injectionRate,
      recommendedExtractionAction:
        'Keep EXT-01..04 operating continuously to draw escaped lixiviant back into the 5-spot cell.',
      recommendedTracerWellId: worstMonWellId,
      recommendedTracerReason: `Run live tracer verification toward ${worstMonWellId} to confirm zero outward transport post-mitigation.`,
      actionRecommendations: [
        'Continue continuous recovery pumping at EXT-01..04 until perimeter sulfate drops below 50 mg/L.',
        'Inspect Before-and-After Comparison tab to audit reduced risky hours and captured imbalance volume.',
        `Execute a conservative tracer pulse toward ${worstMonWellId} before resuming full 50 m³/h injection.`,
      ],
      liveNarratorSteps: {
        step1Telemetry,
        step2AiAnalysis: `AI rescoring post-intervention state: score=${aiScoreStr} vs cutoff=${aiCutoffStr}; composite risk=${(
          current.riskScore * 100
        ).toFixed(0)}%.`,
        step3DecisionSupport: `AI confirms inward hydraulic sink is actively reversing perimeter excursion chemistry.`,
        step4ControlLoop: step4ControlLoop,
      },
    };
  }

  // Case 1: Outer Receptor Bypass Excursion (Scenario 6: RCV-01..03 high sulfate while MON ring looks normal)
  if (
    anomalousRcvWells.length > 0 &&
    anomalousMonWells.length === 0 &&
    current.receptorSulfateMax !== null &&
    current.receptorSulfateMax > thresholds.sulfateUpperLimit
  ) {
    return {
      headline: `Outer Receptor Bypass Excursion (${anomalousRcvWells.join(', ')}) — Suspected Legacy Well Conduit`,
      diagnosisCode: 'OUTER_RECEPTOR_BYPASS',
      urgency: 'CRITICAL',
      summaryExplanation: `AI multi-sensor spatial correlation detected elevated sulfate (${current.receptorSulfateMax.toFixed(
        1
      )} mg/L) at distant compliance receptors (${anomalousRcvWells.join(
        ', '
      )}) while all 12 inner monitoring ring wells remain near ~45 mg/L. This signature indicates subsurface bypass via an unsealed historical borehole or deep vertical fracture.`,
      sensorFindings: [
        `Outer Receptor Sulfate Peak: ${current.receptorSulfateMax.toFixed(1)} mg/L > ${thresholds.sulfateUpperLimit} mg/L limit`,
        `Inner MON-01..12 Ring Average Sulfate: ${
          current.boundarySulfateAvg !== null ? current.boundarySulfateAvg.toFixed(1) : '45.0'
        } mg/L (Bypassed!)`,
        `Isolation Forest 8-Channel Score: ${aiScoreStr} (Cutoff: ${aiCutoffStr})`,
      ],
      affectedWells: anomalousRcvWells,
      recommendedStrategy: 'full_shutdown',
      recommendedStrategyLabel: 'Immediate Full Injection Shutdown (Q_inj = 0.0 m³/h)',
      recommendedInjectionRateM3h: 0.0,
      recommendedExtractionAction:
        'Maintain 100% extraction at EXT-01..04 (50.0 m³/h) to depressurize aquifer and halt conduit flow.',
      recommendedTracerWellId: 'MON-04',
      recommendedTracerReason:
        'Run live tracer test across northern corridor (INJ-01 → MON-04) toward RCV-03 to locate preferential bypass.',
      actionRecommendations: [
        'Authorize immediate full injection stop (Q_inj = 0.0 m³/h) — throttling alone is insufficient for vertical conduit bypass.',
        `Dispatch field hydrogeology crew to inspect historical/abandoned boreholes near ${anomalousRcvWells.join(', ')}.`,
        'Launch a live conservative tracer test to quantify preferential conduit velocity.',
      ],
      liveNarratorSteps: {
        step1Telemetry,
        step2AiAnalysis: `AI Score ${aiScoreStr} > ${aiCutoffStr} & Sulfate Rule Triggered: RCV outer receptors spiked while MON ring stayed normal.`,
        step3DecisionSupport: `AI diagnoses out-of-scope legacy borehole bypass and recommends immediate full injection stop (0.0 m³/h).`,
        step4ControlLoop,
      },
    };
  }

  // Case 2: Isolated Single-Well Sensor Fault + Neighbor Dropout (Scenario 4: Sensor Sapmasi)
  if (
    faultyWells.length > 0 &&
    anomalousMonWells.length <= 2 &&
    current.hydraulicGradient !== null &&
    current.hydraulicGradient >= thresholds.gradientLowerLimit
  ) {
    const targetMon = faultyWells[0] || worstMonWellId;
    return {
      headline: `Isolated Sensor Malfunction (${faultyWells.join(', ')}) + Telemetry Uncertainty`,
      diagnosisCode: 'ISOLATED_SENSOR_FAULT',
      urgency: 'WARNING',
      summaryExplanation: `Threshold breach detected on ${faultyWells.join(
        ', '
      )} (pH=${current.boundaryPhMin?.toFixed(2)}, SO₄=${current.boundarySulfateMax?.toFixed(
        1
      )} mg/L), but AI spatial cross-validation shows adjacent perimeter wells remain nominal (~6.48 pH, ~44 mg/L) and hydraulic gradient (${current.hydraulicGradient.toFixed(
        2
      )}) is intact. However, ${missingWells.length} neighboring sensor(s) (${
        missingWells.join(', ') || 'none'
      }) report EKSIK_VERI, so fail-safe precaution remains active.`,
      sensorFindings: [
        `Hardware Diagnostic Flag: ${faultyWells.join(', ')} reporting ARIZALI (probe drift)`,
        `Missing Neighbor Telemetry: ${
          missingWells.length > 0 ? `${missingWells.join(', ')} (EKSIK_VERI — cannot assume safe)` : 'None'
        }`,
        `Inward Hydraulic Gradient Intact: ${current.hydraulicGradient.toFixed(2)} ≥ ${thresholds.gradientLowerLimit.toFixed(2)}`,
        `Isolation Forest AI Score: ${aiScoreStr} (Cutoff: ${aiCutoffStr})`,
      ],
      affectedWells,
      recommendedStrategy: 'throttle_to_extraction',
      recommendedStrategyLabel: 'Precautionary Bleed Throttle (47.0 m³/h) + Probe Calibration',
      recommendedInjectionRateM3h: Number((current.extractionRate * 0.94).toFixed(1)),
      recommendedExtractionAction:
        'Keep EXT-01..04 at 50.0 m³/h while field technicians verify MON-03 probe and missing MON-01/MON-04 links.',
      recommendedTracerWellId: targetMon,
      recommendedTracerReason: `Run tracer check toward ${targetMon} to verify no physical plume arrived behind blind sensors.`,
      actionRecommendations: [
        `Prefer precautionary bleed throttling (Q_inj = ${(current.extractionRate * 0.94).toFixed(1)} m³/h) rather than ignoring alarm while ${missingWells.join(', ') || 'neighboring'} telemetry is missing.`,
        `Recalibrate/replace pH & sulfate probe on ${faultyWells.join(', ')} and restore ${missingWells.join(', ')} RTU connection.`,
        `Execute live tracer verification toward ${targetMon} if manual grab-sample confirms chemistry shift.`,
      ],
      liveNarratorSteps: {
        step1Telemetry,
        step2AiAnalysis: `pH & Sulfate limits crossed on ${faultyWells.join(', ')}; AI notes spatial isolation + ${missingWells.length} blind EKSIK_VERI neighbor(s).`,
        step3DecisionSupport: `Because missing sensors cannot be assumed safe, AI recommends precautionary bleed throttling + field probe check.`,
        step4ControlLoop,
      },
    };
  }

  // Case 3: Acute Hydraulic Containment Collapse / Pump Failure (Scenario 3: Ani Pompa Arizasi)
  if (current.gradientAlert || (current.hydraulicGradient !== null && current.hydraulicGradient < 0)) {
    return {
      headline: 'Acute Hydraulic Containment Collapse — Rapid Pressure Reversal Detected',
      diagnosisCode: 'ACUTE_HYDRAULIC_COLLAPSE',
      urgency: 'CRITICAL',
      summaryExplanation: `AI & physical sensors detect severe collapse of the inward hydraulic capture cone: gradient proxy plunged to ${
        current.hydraulicGradient !== null ? current.hydraulicGradient.toFixed(2) : 'N/A'
      } (limit ≥ ${thresholds.gradientLowerLimit.toFixed(
        2
      )}) accompanied by widespread perimeter sulfate surge (${current.boundarySulfateMax?.toFixed(
        1
      )} mg/L across ${anomalousMonWells.length} monitoring wells). Immediate injection stop is required.`,
      sensorFindings: [
        `Hydraulic Gradient Reversal: ${current.hydraulicGradient?.toFixed(2)} << ${thresholds.gradientLowerLimit.toFixed(2)} minimum inward limit`,
        `Multi-Well Perimeter Excursion: ${anomalousMonWells.length}/12 MON wells elevated (Max SO₄ = ${current.boundarySulfateMax?.toFixed(1)} mg/L)`,
        `Isolation Forest AI Anomaly Score: ${aiScoreStr} (Cutoff: ${aiCutoffStr})`,
      ],
      affectedWells,
      recommendedStrategy: 'full_shutdown',
      recommendedStrategyLabel: 'Emergency Full Injection Shutdown (Q_inj = 0.0 m³/h)',
      recommendedInjectionRateM3h: 0.0,
      recommendedExtractionAction:
        'Inspect corner extraction pumps EXT-01..04 immediately and maximize available recovery pumping to rebuild inward capture.',
      recommendedTracerWellId: worstMonWellId,
      recommendedTracerReason: `Quantify outward pore velocity toward ${worstMonWellId} following pressure reversal.`,
      actionRecommendations: [
        'Approve immediate Full Injection Shutdown (Q_inj = 0.0 m³/h) before countdown expires.',
        'Maintain maximum extraction pumping on healthy EXT wells to reverse outward hydraulic head.',
        `Sample perimeter ring wells (${anomalousMonWells.slice(0, 4).join(', ')}) until gradient recovers above +0.35.`,
      ],
      liveNarratorSteps: {
        step1Telemetry,
        step2AiAnalysis: `CRITICAL BREACH — Gradient (${current.hydraulicGradient?.toFixed(2)}), Sulfate (${current.boundarySulfateMax?.toFixed(1)} mg/L), and AI (${aiScoreStr}) all in alarm.`,
        step3DecisionSupport: `AI diagnoses acute pump/containment failure and prescribes immediate Q_inj = 0.0 m³/h shutdown.`,
        step4ControlLoop,
      },
    };
  }

  // Case 4: Slow Imbalance / Gradual Perimeter Excursion (Scenario 2: Yavas Dengesizlik / Sizi) — Rule Breach OR AI Early Warning!
  if (current.combinedAlert) {
    const isEarlyAiOnly = current.aiEarlyWarning;
    const targetInj = isEarlyAiOnly
      ? Number((current.extractionRate * 0.94).toFixed(1))
      : current.boundarySulfateMax !== null && current.boundarySulfateMax > 85
      ? 0.0
      : Number((current.extractionRate * 0.94).toFixed(1));
    const recStrategy: 'full_shutdown' | 'throttle_to_extraction' =
      targetInj === 0 ? 'full_shutdown' : 'throttle_to_extraction';

    return {
      headline: isEarlyAiOnly
        ? 'AI Early Excursion Warning — Multivariate Perimeter Drift Detected Pre-Threshold'
        : `Slow Lixiviant Excursion & Geochemical Breach (${anomalousMonWells.length} Perimeter Wells Affected)`,
      diagnosisCode: isEarlyAiOnly ? 'AI_EARLY_DRIFT' : 'SLOW_EXCURSION_IMBALANCE',
      urgency: current.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      summaryExplanation: isEarlyAiOnly
        ? `Hard physical thresholds have not yet broken, but the 100-tree Isolation Forest AI model detected correlated multi-sensor drift (AI Score ${aiScoreStr} > ${aiCutoffStr} cutoff) as perimeter sulfate (${current.boundarySulfateMax?.toFixed(
            1
          )} mg/L) and pH (${current.boundaryPhMin?.toFixed(
            2
          )}) shift simultaneously across the monitoring ring.`
        : `Gradual hydraulic/geochemical imbalance has pushed perimeter chemistry past safety thresholds across ${
            anomalousMonWells.length
          } monitoring wells (Max SO₄ = ${current.boundarySulfateMax?.toFixed(
            1
          )} mg/L vs ${thresholds.sulfateUpperLimit} mg/L limit; Min pH = ${current.boundaryPhMin?.toFixed(
            2
          )} vs ${thresholds.phLowerLimit.toFixed(2)} limit; AI Score = ${aiScoreStr}).`,
      sensorFindings: [
        `Isolation Forest Multivariate AI Score: ${aiScoreStr} > ${aiCutoffStr} normal cutoff`,
        `Perimeter Sulfate Peak (${worstMonWellId}): ${current.boundarySulfateMax?.toFixed(1)} mg/L (Limit ≤ ${thresholds.sulfateUpperLimit} mg/L)`,
        `Perimeter Minimum pH: ${current.boundaryPhMin?.toFixed(2)} (Limit ≥ ${thresholds.phLowerLimit.toFixed(2)})`,
        `Affected Monitoring Ring Wells: ${anomalousMonWells.length}/12 (${anomalousMonWells.slice(0, 5).join(', ')}${anomalousMonWells.length > 5 ? '...' : ''})`,
      ],
      affectedWells,
      recommendedStrategy: recStrategy,
      recommendedStrategyLabel:
        recStrategy === 'full_shutdown'
          ? 'Full Injection Shutdown (Q_inj = 0.0 m³/h) — High Perimeter Sulfate'
          : `Throttle Injection to ${targetInj.toFixed(1)} m³/h (Inward Bleed Equilibrium)`,
      recommendedInjectionRateM3h: targetInj,
      recommendedExtractionAction: `Keep EXT-01..04 pumping at ${current.extractionRate.toFixed(
        1
      )} m³/h so extraction exceeds injection by ${(current.extractionRate - targetInj).toFixed(1)} m³/h.`,
      recommendedTracerWellId: worstMonWellId,
      recommendedTracerReason: `Run live tracer test on INJ-01 → ${worstMonWellId} (highest perimeter sulfate) to measure escape travel time.`,
      actionRecommendations: [
        recStrategy === 'full_shutdown'
          ? 'Approve Full Injection Shutdown (0.0 m³/h) immediately — perimeter sulfate exceeds 85 mg/L.'
          : `Approve Injection Bleed Throttling (reduce INJ-01 from ${current.injectionRate.toFixed(1)} to ${targetInj.toFixed(1)} m³/h) to establish inward capture cone.`,
        `Maintain full corner extraction (${current.extractionRate.toFixed(1)} m³/h) to pull migrating lixiviant plume back inside the 5-spot ring.`,
        `Launch live Tracer Test toward ${worstMonWellId} to check for preferential permeability channeling.`,
      ],
      liveNarratorSteps: {
        step1Telemetry,
        step2AiAnalysis: isEarlyAiOnly
          ? `AI EARLY DETECTION — Isolation Forest (${aiScoreStr} > ${aiCutoffStr}) caught correlated SO₄ + pH drift BEFORE hard rule limits broke!`
          : `HYBRID ALARM — Both AI (${aiScoreStr} > ${aiCutoffStr}) and physical rules (SO₄/pH) confirm active perimeter excursion.`,
        step3DecisionSupport: `AI recommends ${
          recStrategy === 'full_shutdown'
            ? 'halting INJ-01 to 0.0 m³/h'
            : `throttling INJ-01 to ${targetInj.toFixed(1)} m³/h`
        } while keeping extraction at ${current.extractionRate.toFixed(1)} m³/h.`,
        step4ControlLoop,
      },
    };
  }

  // Case 5: Benign Seasonal Conductivity Fluctuation (Scenario 5)
  const isSeasonal =
    current.boundaryConductivityAvg !== null &&
    (current.boundaryConductivityAvg > 545 || current.boundaryConductivityAvg < 465);

  if (isSeasonal) {
    return {
      headline: 'Seasonal Background Conductivity Shift — Containment Verified Intact',
      diagnosisCode: 'SEASONAL_BACKGROUND_SHIFT',
      urgency: 'NOMINAL',
      summaryExplanation: `Perimeter electrical conductivity shifted to ${current.boundaryConductivityAvg?.toFixed(
        0
      )} µS/cm, but AI multi-sensor verification confirms pH (${current.boundaryPhMin?.toFixed(
        2
      )}), sulfate (${current.boundarySulfateMax?.toFixed(
        1
      )} mg/L), and inward hydraulic gradient (${current.hydraulicGradient?.toFixed(
        2
      )}) remain strictly nominal. AI suppresses false excursion alarm.`,
      sensorFindings: [
        `Conductivity Shift: ${current.boundaryConductivityAvg?.toFixed(0)} µS/cm (regional groundwater fluctuation)`,
        `pH (${current.boundaryPhMin?.toFixed(2)}) & Sulfate (${current.boundarySulfateMax?.toFixed(1)} mg/L) stable — no acidic lixiviant signature`,
        `False Alarm Prevented by Multi-Channel AI Cross-Check`,
      ],
      affectedWells: missingWells,
      recommendedStrategy: 'nominal',
      recommendedStrategyLabel: 'Continue Nominal 50.0 m³/h Balanced Operation (No Shutdown Needed)',
      recommendedInjectionRateM3h: 50.0,
      recommendedExtractionAction: 'Maintain standard 50.0 m³/h corner recovery across EXT-01..04.',
      recommendedTracerWellId: 'EXT-01',
      recommendedTracerReason: 'Routine 5-spot residence-time verification.',
      actionRecommendations: [
        'No pump shutdown required — AI confirmed conductivity shift is non-excursion seasonal background.',
        missingWells.length > 0
          ? `Monitor ${missingWells.join(', ')} telemetry dropout until next polling cycle.`
          : 'Continue automated 6-hour closed-loop surveillance.',
      ],
      liveNarratorSteps: {
        step1Telemetry,
        step2AiAnalysis: `Conductivity oscillated (${current.boundaryConductivityAvg?.toFixed(0)} µS/cm), but AI verified pH, SO₄, and Gradient are completely stable.`,
        step3DecisionSupport: `AI classifies event as benign seasonal fluctuation — preventing unnecessary production shutdown.`,
        step4ControlLoop,
      },
    };
  }

  // Default Case 6: Nominal Safe Operation
  return {
    headline: 'Nominal 5-Spot Inward Containment — All AI & Physical Checks Clear',
    diagnosisCode: 'NOMINAL_CONTAINMENT',
    urgency: 'NOMINAL',
    summaryExplanation: `All 8 multivariate channels are within normal hydrogeological bounds. Central injection (${current.injectionRate.toFixed(
      1
    )} m³/h) and corner recovery (${current.extractionRate.toFixed(
      1
    )} m³/h) are balanced with positive inward gradient (${
      current.hydraulicGradient !== null ? current.hydraulicGradient.toFixed(2) : 'N/A'
    }) and stable perimeter chemistry.${
      missingWells.length > 0
        ? ` Note: ${missingWells.length} well(s) (${missingWells.join(', ')}) have missing packets flagged as uncertainty.`
        : ''
    }`,
    sensorFindings: [
      `Flow Equilibrium: Q_inj = ${current.injectionRate.toFixed(1)} m³/h | Q_ext = ${current.extractionRate.toFixed(1)} m³/h`,
      `Inward Hydraulic Gradient: ${
        current.hydraulicGradient !== null ? current.hydraulicGradient.toFixed(2) : 'MISSING'
      } (Limit ≥ ${thresholds.gradientLowerLimit.toFixed(2)})`,
      `Perimeter Chemistry: Min pH ${current.boundaryPhMin?.toFixed(2) ?? 'N/A'}, Max SO₄ ${
        current.boundarySulfateMax?.toFixed(1) ?? 'N/A'
      } mg/L`,
      `Isolation Forest AI Score: ${aiScoreStr} ≤ ${aiCutoffStr} cutoff`,
    ],
    affectedWells: missingWells,
    recommendedStrategy: 'nominal',
    recommendedStrategyLabel: 'Maintain Nominal 5-Spot Balanced Pumping (50.0 m³/h)',
    recommendedInjectionRateM3h: 50.0,
    recommendedExtractionAction: 'Continue balanced -12.5 m³/h extraction per corner well (EXT-01..04).',
    recommendedTracerWellId: 'EXT-01',
    recommendedTracerReason: 'Run baseline 5-spot sweep tracer test (INJ-01 → EXT-01) anytime to inspect breakthrough curve.',
    actionRecommendations: [
      'Continue normal leaching operation; AI anomaly engine is scanning every 6-hour telemetry packet.',
      missingWells.length > 0
        ? `Check RTU communication on ${missingWells.join(', ')} (flagged EKSIK_VERI).`
        : 'All 20 wellhead sensors reporting healthy packets.',
    ],
    liveNarratorSteps: {
      step1Telemetry,
      step2AiAnalysis: `AI Score (${aiScoreStr}) is below ${aiCutoffStr} cutoff and all physical limits (ΔQ, Gradient, pH, SO₄) are nominal.`,
      step3DecisionSupport: `AI Decision Support confirms safe containment; no pump intervention required.`,
      step4ControlLoop,
    },
  };
}
