import type { EclipseSearchDetail, FluxDataPoint, VettingCriterion } from "@/types/photometry";
import { fitTransitGeometry } from "./transitModel";

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

/**
 * CORREGIDO (ver docs/validacion-modelo-transito.md): en lugar de la
 * asimetria fraccional cruda entre medianas de profundidad odd/even
 * (que no distingue ruido de senal real), se evalua la SIGNIFICANCIA
 * estadistica de la diferencia usando el error fotometrico propagado por
 * punto (flux_err, reportado por el pipeline de calibracion de Kepler),
 * exactamente la misma convencion que ya usa evaluateSecondaryEclipseSearch
 * en este archivo. Esto es lo que hace el Robovetter oficial de Kepler:
 * una prueba de significancia sobre la incertidumbre del propio dato, no
 * una fraccion arbitraria de diferencia (Bryson et al. 2020).
 *
 * Nota honesta: en validacion con datos sinteticos de ruido gaussiano
 * limpio, este cambio no mostro una mejora dramatica de poder
 * discriminativo frente a la version anterior (ambas ~98-99% de acierto).
 * Es, sin embargo, la formulacion metodologicamente correcta -- y su
 * impacto real debe remedirse empiricamente contra los 252 candidatos
 * reales una vez desplegado, no se asume aqui.
 */
export function evaluateOddEvenSymmetry(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;
  const oddDepths: number[] = [];
  const oddErrors: number[] = [];
  const evenDepths: number[] = [];
  const evenErrors: number[] = [];

  for (const point of points) {
    const phase = (point.time - epochBjd) / periodDays;
    const cycleNumber = Math.floor(phase);
    const withinTransitWindow =
      Math.abs(phase - Math.round(phase)) * periodDays < durationDays / 2;

    if (!withinTransitWindow) continue;

    const depth = 1 - point.flux;
    if (cycleNumber % 2 === 0) {
      evenDepths.push(depth);
      evenErrors.push(point.fluxError);
    } else {
      oddDepths.push(depth);
      oddErrors.push(point.fluxError);
    }
  }

  if (oddDepths.length < 3 || evenDepths.length < 3) {
    return {
      name: "odd_even_depth_symmetry",
      measuredValue: 0,
      threshold: 3.0,
      weight: 0.3,
      passed: false,
    };
  }

  const meanOddDepth = oddDepths.reduce((s, v) => s + v, 0) / oddDepths.length;
  const meanEvenDepth = evenDepths.reduce((s, v) => s + v, 0) / evenDepths.length;

  const oddErrSumSq = oddErrors.reduce((s, v) => s + v * v, 0);
  const evenErrSumSq = evenErrors.reduce((s, v) => s + v * v, 0);
  const oddStdErr = Math.sqrt(oddErrSumSq) / oddDepths.length;
  const evenStdErr = Math.sqrt(evenErrSumSq) / evenDepths.length;
  const combinedErr = Math.sqrt(oddStdErr ** 2 + evenStdErr ** 2);

  const significance =
    combinedErr > 0 ? Math.abs(meanOddDepth - meanEvenDepth) / combinedErr : 0;

  const threshold = 3.0;
  return {
    name: "odd_even_depth_symmetry",
    measuredValue: Math.round(significance * 100) / 100,
    threshold,
    weight: 0.3,
    passed: significance < threshold,
  };
}

/**
 * CORREGIDO (ver docs/validacion-modelo-transito.md): en lugar del
 * heuristico anterior ("fraccion de puntos cerca del minimo de flujo",
 * poder discriminativo casi nulo: -2.4pp en n=252 candidatos reales), se
 * ajusta un modelo de transito de disco uniforme (Mandel & Agol 2002) por
 * minimos cuadrados no lineales, estimando el parametro de impacto b y la
 * razon de radios Rp/Rs. V = b + Rp/Rs > 1.05 indica transito rasante
 * ("grazing"), la misma convencion que usa el Robovetter oficial de Kepler
 * (Bryson et al. 2020).
 *
 * Validado con 160 casos sinteticos generados con limb darkening real
 * (via batman-package como referencia externa, no usada en produccion):
 * 94.4% de acierto en clasificar V>1.05, frente al 70.6% del heuristico
 * anterior. El ajuste completo (Nelder-Mead puro en TypeScript, sin
 * dependencias) corre 100% en el navegador del usuario.
 */
export function evaluateTransitShape(
  points: readonly FluxDataPoint[],
  periodDays: number,
  epochBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const fit = fitTransitGeometry(points, periodDays, epochBjd, transitDurationHours);

  if (!fit.converged || fit.nPoints < 10) {
    return {
      name: "transit_shape_v_vs_u",
      measuredValue: fit.vShapeParameter,
      threshold: 1.05,
      weight: 0.25,
      passed: false,
    };
  }

  const threshold = 1.05;
  return {
    name: "transit_shape_v_vs_u",
    measuredValue: Math.round(fit.vShapeParameter * 1000) / 1000,
    threshold,
    weight: 0.25,
    passed: fit.vShapeParameter <= threshold,
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
