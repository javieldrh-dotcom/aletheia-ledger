import type { EclipseSearchDetail, FluxDataPoint, VettingCriterion } from "@/types/photometry";

function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error("No se puede calcular la mediana de un arreglo vacio.");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function standardDeviation(values: readonly number[]): number {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function medianAbsoluteDeviation(values: readonly number[]): number {
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

/**
 * Estimador robusto de la desviacion estandar via MAD, escalado por
 * 1.4826 para ser consistente con sigma bajo una distribucion normal.
 * A diferencia de standardDeviation, no se infla por la presencia de
 * un numero pequeno de outliers (flares, transitos) -- que es
 * precisamente la senal que queremos detectar como anomalia, no
 * absorber dentro de la linea base de "ruido normal".
 */
function robustStandardDeviation(values: readonly number[]): number {
  return 1.4826 * medianAbsoluteDeviation(values);
}

export function evaluateOddEvenSymmetry(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;
  const oddDepths: number[] = [];
  const evenDepths: number[] = [];

  for (const point of points) {
    const phase = (point.time - epochBjd) / periodDays;
    const cycleNumber = Math.floor(phase);
    const withinTransitWindow =
      Math.abs(phase - Math.round(phase)) * periodDays < durationDays / 2;

    if (!withinTransitWindow) continue;

    const depth = 1 - point.flux;
    if (cycleNumber % 2 === 0) {
      evenDepths.push(depth);
    } else {
      oddDepths.push(depth);
    }
  }

  if (oddDepths.length === 0 || evenDepths.length === 0) {
    return {
      name: "odd_even_depth_symmetry",
      measuredValue: 0,
      threshold: 0.15,
      weight: 0.3,
      passed: false,
    };
  }

  const oddMean = median(oddDepths);
  const evenMean = median(evenDepths);
  const asymmetry = Math.abs(oddMean - evenMean) / Math.max(oddMean, evenMean);

  const threshold = 0.15;
  return {
    name: "odd_even_depth_symmetry",
    measuredValue: asymmetry,
    threshold,
    weight: 0.3,
    passed: asymmetry < threshold,
  };
}

export function evaluateTransitShape(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;
  const inTransit = points
    .map((p) => {
      const phase = (p.time - epochBjd) / periodDays;
      const offsetFromCenter = (phase - Math.round(phase)) * periodDays;
      return { offsetFromCenter, flux: p.flux };
    })
    .filter((p) => Math.abs(p.offsetFromCenter) < durationDays / 2)
    .sort((a, b) => a.offsetFromCenter - b.offsetFromCenter);

  if (inTransit.length < 5) {
    return {
      name: "transit_shape_v_vs_u",
      measuredValue: 0,
      threshold: 0.6,
      weight: 0.25,
      passed: false,
    };
  }

  let minFlux = Infinity;
  for (const p of inTransit) {
    if (p.flux < minFlux) minFlux = p.flux;
  }
  const depthRange = 1 - minFlux;
  const nearBottomThreshold = minFlux + depthRange * 0.1;

  const pointsNearBottom = inTransit.filter(
    (p) => p.flux <= nearBottomThreshold
  ).length;
  const flatBottomRatio = pointsNearBottom / inTransit.length;

  const threshold = 0.15;
  return {
    name: "transit_shape_v_vs_u",
    measuredValue: flatBottomRatio,
    threshold,
    weight: 0.25,
    passed: flatBottomRatio > threshold,
  };
}

export function evaluateSampleSufficiency(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;
  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const p of points) {
    if (p.time < minTime) minTime = p.time;
    if (p.time > maxTime) maxTime = p.time;
  }
  const timeSpan = maxTime - minTime;
  const completeTransitCount = Math.floor(timeSpan / periodDays);

  const pointsInAnyTransit = points.filter((p) => {
    const phase = (p.time - epochBjd) / periodDays;
    const offset = (phase - Math.round(phase)) * periodDays;
    return Math.abs(offset) < durationDays / 2;
  }).length;

  const pointsPerTransit =
    completeTransitCount > 0 ? pointsInAnyTransit / completeTransitCount : 0;

  const sufficientTransits = completeTransitCount >= 4;
  const sufficientResolution = pointsPerTransit >= 15;
  const passed = sufficientTransits && sufficientResolution;

  const transitScore = Math.min(completeTransitCount / 4, 1);
  const resolutionScore = Math.min(pointsPerTransit / 15, 1);
  const combinedScore = (transitScore + resolutionScore) / 2;

  return {
    name: "sample_sufficiency",
    measuredValue: combinedScore,
    threshold: 1.0,
    weight: 0,
    passed,
  };
}

export function evaluateSecondaryEclipseSearch(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;
  const secondaryEpoch = epochBjd + periodDays / 2;

  const phaseOffset = (time: number, referenceEpoch: number): number => {
    const phase = (time - referenceEpoch) / periodDays;
    return (phase - Math.round(phase)) * periodDays;
  };

  const inSecondaryWindow = points.filter(
    (p) => Math.abs(phaseOffset(p.time, secondaryEpoch)) < durationDays / 2
  );
  const inPrimaryWindow = points.filter(
    (p) => Math.abs(phaseOffset(p.time, epochBjd)) < durationDays / 2
  );
  const primaryWindowTimes = new Set(inPrimaryWindow.map((p) => p.time));
  const secondaryWindowTimes = new Set(inSecondaryWindow.map((p) => p.time));

  const baseline = points.filter(
    (p) => !primaryWindowTimes.has(p.time) && !secondaryWindowTimes.has(p.time)
  );

  if (inSecondaryWindow.length < 10 || baseline.length < 10) {
    return {
      name: "secondary_eclipse_search",
      measuredValue: 0,
      threshold: 3.0,
      weight: 0.2,
      passed: false,
    };
  }

  const baselineFlux = baseline.map((p) => p.flux);
  const secondaryFlux = inSecondaryWindow.map((p) => p.flux);

  const baselineMedian = median(baselineFlux);
  const secondaryMedian = median(secondaryFlux);
  const depthPpm = (baselineMedian - secondaryMedian) * 1e6;

  const baselineNoise = robustStandardDeviation(baselineFlux) / Math.sqrt(baseline.length);
  const secondaryNoise = robustStandardDeviation(secondaryFlux) / Math.sqrt(secondaryFlux.length);
  const combinedErrorPpm = Math.sqrt(baselineNoise ** 2 + secondaryNoise ** 2) * 1e6;

  const significance = combinedErrorPpm > 0 ? depthPpm / combinedErrorPpm : 0;

  const threshold = 3.0;
  const passed = significance < threshold;

  let eclipseDetail: EclipseSearchDetail | undefined;
  if (!passed && depthPpm > 0) {
    const primaryFlux = inPrimaryWindow.map((p) => p.flux);
    const primaryDepthPpm = (baselineMedian - median(primaryFlux)) * 1e6;
    const depthRatio = primaryDepthPpm > 0 ? depthPpm / primaryDepthPpm : 0;
    const estimatedTemperatureRatio = depthRatio > 0 ? Math.pow(depthRatio, 0.25) : 0;

    eclipseDetail = {
      primaryDepthPpm: Math.round(primaryDepthPpm * 10) / 10,
      secondaryDepthPpm: Math.round(depthPpm * 10) / 10,
      depthRatio: Math.round(depthRatio * 1000) / 1000,
      estimatedTemperatureRatio: Math.round(estimatedTemperatureRatio * 1000) / 1000,
    };
  }

  return {
    name: "secondary_eclipse_search",
    measuredValue: Math.round(significance * 100) / 100,
    threshold,
    weight: 0.2,
    passed,
    ...(eclipseDetail ? { eclipseDetail } : {}),
  };
}

export function evaluateResidualNoise(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;

  const outOfTransitPoints = points.filter((p) => {
    const phase = (p.time - epochBjd) / periodDays;
    const offset = (phase - Math.round(phase)) * periodDays;
    return Math.abs(offset) >= durationDays / 2;
  });

  if (outOfTransitPoints.length === 0) {
    return {
      name: "residual_noise_dispersion",
      measuredValue: 0,
      threshold: 3.0,
      weight: 0.2,
      passed: false,
    };
  }

  const outOfTransitFlux = outOfTransitPoints.map((p) => p.flux);
  const observedStdDev = standardDeviation(outOfTransitFlux);
  const meanReportedError =
    outOfTransitPoints.reduce((sum, p) => sum + p.fluxError, 0) /
    outOfTransitPoints.length;

  const noiseRatio = observedStdDev / meanReportedError;
  const threshold = 3.0;

  return {
    name: "residual_noise_dispersion",
    measuredValue: noiseRatio,
    threshold,
    weight: 0.2,
    passed: noiseRatio < threshold,
  };
}

export function evaluatePeriodicFlareSignature(
  points: readonly FluxDataPoint[]
): VettingCriterion {
  const fluxValues = points.map((p) => p.flux);
  const baseline = median(fluxValues);
  const noise = robustStandardDeviation(fluxValues);

  const flareThreshold = baseline + 4 * noise;
  const flarePoints = points.filter((p) => p.flux > flareThreshold);

  const flareRatio = flarePoints.length / points.length;
  const threshold = 0.02;

  return {
    name: "periodic_flare_signature",
    measuredValue: flareRatio,
    threshold,
    weight: 0.25,
    passed: flareRatio < threshold,
  };
}

