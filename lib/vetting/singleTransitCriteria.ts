import type { FluxDataPoint, VettingCriterion } from "@/types/photometry";

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

function medianAbsoluteDeviation(values: readonly number[]): number {
  const med = median(values);
  return median(values.map((v) => Math.abs(v - med)));
}

function robustStandardDeviation(values: readonly number[]): number {
  return 1.4826 * medianAbsoluteDeviation(values);
}

/**
 * Simetria ingreso/egreso: divide los puntos dentro de la ventana del
 * evento en dos mitades (antes y despues del punto medio) y compara
 * su profundidad promedio. Sin periodicidad que comparar (a
 * diferencia del test odd-even), esta es la version de un solo
 * evento del mismo principio: un transito real debe verse
 * aproximadamente igual entrando que saliendo.
 */
export function evaluateIngressEgressSymmetry(
  points: readonly FluxDataPoint[],
  midTransitBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;

  const ingress = points.filter(
    (p) =>
      p.time >= midTransitBjd - durationDays / 2 && p.time < midTransitBjd
  );
  const egress = points.filter(
    (p) =>
      p.time > midTransitBjd && p.time <= midTransitBjd + durationDays / 2
  );

  if (ingress.length < 3 || egress.length < 3) {
    return {
      name: "ingress_egress_symmetry",
      measuredValue: 0,
      threshold: 0.15,
      weight: 0.35,
      passed: false,
    };
  }

  const ingressDepth = 1 - median(ingress.map((p) => p.flux));
  const egressDepth = 1 - median(egress.map((p) => p.flux));
  const maxDepth = Math.max(ingressDepth, egressDepth, 1e-9);
  const asymmetry = Math.abs(ingressDepth - egressDepth) / maxDepth;

  const threshold = 0.15;
  return {
    name: "ingress_egress_symmetry",
    measuredValue: asymmetry,
    threshold,
    weight: 0.35,
    passed: asymmetry < threshold,
  };
}

/**
 * Forma del evento unico (V vs U), sin folding de fase -- centrado
 * directamente en midTransitBjd.
 */
export function evaluateSingleTransitShape(
  points: readonly FluxDataPoint[],
  midTransitBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;

  const inTransit = points
    .filter(
      (p) => Math.abs(p.time - midTransitBjd) < durationDays / 2
    )
    .sort((a, b) => a.time - b.time);

  if (inTransit.length < 5) {
    return {
      name: "single_transit_shape_v_vs_u",
      measuredValue: 0,
      threshold: 0.15,
      weight: 0.3,
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
    name: "single_transit_shape_v_vs_u",
    measuredValue: flatBottomRatio,
    threshold,
    weight: 0.3,
    passed: flatBottomRatio > threshold,
  };
}

/**
 * Ruido local: medido solo en ventanas inmediatas antes/despues del
 * evento (2x la duracion del transito a cada lado), no en toda la
 * curva -- en observaciones largas (necesarias para periodos >225
 * dias) la variabilidad estelar de fondo puede cambiar demasiado a
 * lo largo de toda la serie como para usarla como linea base unica.
 */
export function evaluateLocalNoise(
  points: readonly FluxDataPoint[],
  midTransitBjd: number,
  transitDurationHours: number
): VettingCriterion {
  const durationDays = transitDurationHours / 24;
  const localWindow = durationDays * 3;

  const localPoints = points.filter((p) => {
    const distance = Math.abs(p.time - midTransitBjd);
    return distance > durationDays / 2 && distance < localWindow;
  });

  if (localPoints.length < 10) {
    return {
      name: "local_noise_dispersion",
      measuredValue: 0,
      threshold: 3.0,
      weight: 0.35,
      passed: false,
    };
  }

  const fluxValues = localPoints.map((p) => p.flux);
  const observedStdDev = robustStandardDeviation(fluxValues);
  const meanReportedError =
    localPoints.reduce((sum, p) => sum + p.fluxError, 0) / localPoints.length;

  const noiseRatio = observedStdDev / meanReportedError;
  const threshold = 3.0;

  return {
    name: "local_noise_dispersion",
    measuredValue: noiseRatio,
    threshold,
    weight: 0.35,
    passed: noiseRatio < threshold,
  };
}