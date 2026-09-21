import type { AuditCriterion, FlareEvent } from "@/types/stellarActivity";
import type { FluxDataPoint } from "@/types/photometry";

/**
 * Criterio 1 de Auditoria Estelar: Morfologia FRED (Fast Rise, Exponential
 * Decay) -- la firma fisica caracteristica de una llamarada estelar real.
 *
 * Fundamento fisico: una llamarada libera energia magnetica de forma
 * impulsiva (reconexion magnetica), lo que produce una subida de brillo
 * MUY rapida (segundos a minutos), seguida de un enfriamiento gradual del
 * plasma calentado que decae de forma aproximadamente EXPONENCIAL, mucho
 * mas lento que la subida (minutos a horas). Esta asimetria marcada entre
 * subida y bajada es la firma mas basica y mas citada en la literatura de
 * deteccion de llamaradas (Davenport et al. 2014, entre otros).
 *
 * Un artefacto instrumental (un salto de puntero, un rayo cosmico, una
 * transicion de modo seguro) tipicamente NO tiene esta asimetria: sube y
 * baja en tiempos similares, o cae de forma abrupta en vez de exponencial.
 *
 * Confirmado textualmente en Yang & Liu (2019, ApJS 241, 29): "the decay
 * phase should be longer than the rise phase" como criterio de deteccion
 * de llamaradas -- verificado contra el PDF completo del paper, no solo
 * el resumen (ver docs/validacion-modelo-transito.md para la disciplina
 * de verificacion de fuentes de este proyecto).
 *
 * Se miden dos cosas:
 *   1. La razon de asimetria (duracion de bajada / duracion de subida).
 *      Real: tipicamente > 2 (la bajada dura al menos el doble que la
 *      subida). Umbral usado aqui: 2.0.
 *   2. La bondad de ajuste (R^2) de un decaimiento exponencial puro sobre
 *      los puntos posteriores al pico, via regresion log-lineal:
 *      ln(flujo - linea_base) = ln(amplitud) - (t - t_pico) / tau
 *      Un R^2 alto confirma que la forma de la caida es realmente
 *      exponencial, no solo "mas lenta que la subida" por casualidad.
 */
export function evaluateFlareMorphology(
  event: FlareEvent,
  points: readonly FluxDataPoint[]
): AuditCriterion {
  const riseDurationDays = event.peakTime - event.startTime;
  const decayDurationDays = event.endTime - event.peakTime;

  // Puntos posteriores al pico, con flujo por encima de la linea base
  // (necesarios para el ajuste exponencial; log(negativo) no esta definido).
  const decayPoints = points
    .slice(event.peakIndex, event.endIndex + 1)
    .filter((p) => p.flux > event.baselineFlux);

  let rSquared = 0;
  let tauDays = 0;

  if (decayPoints.length >= 3 && riseDurationDays > 0) {
    const t0 = event.peakTime;
    const xs = decayPoints.map((p) => p.time - t0);
    const ys = decayPoints.map((p) => Math.log(p.flux - event.baselineFlux));

    // Regresion lineal simple: y = a + b*x, donde b = -1/tau
    const n = xs.length;
    const meanX = xs.reduce((s, v) => s + v, 0) / n;
    const meanY = ys.reduce((s, v) => s + v, 0) / n;
    let ssXY = 0;
    let ssXX = 0;
    let ssYY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      ssXY += dx * dy;
      ssXX += dx * dx;
      ssYY += dy * dy;
    }
    const slope = ssXX !== 0 ? ssXY / ssXX : 0;
    const intercept = meanY - slope * meanX;
    tauDays = slope < 0 ? -1 / slope : 0;

    // R^2 del ajuste log-lineal
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * xs[i];
      ssRes += (ys[i] - predicted) ** 2;
    }
    rSquared = ssYY !== 0 ? 1 - ssRes / ssYY : 0;
  }

  const asymmetryRatio =
    riseDurationDays > 0 ? decayDurationDays / riseDurationDays : 0;

  const threshold = 2.0;
  const minRSquared = 0.6;
  const passed = asymmetryRatio >= threshold && rSquared >= minRSquared;

  const interpretation = passed
    ? `La bajada duró ${asymmetryRatio.toFixed(1)}x más que la subida, y el decaimiento se ajusta bien a una curva exponencial (R²=${rSquared.toFixed(2)}) — consistente con una llamarada real.`
    : asymmetryRatio < threshold
    ? `La subida y la bajada duraron tiempos similares (razón ${asymmetryRatio.toFixed(1)}x, se esperaba ≥${threshold}x) — no es la asimetría típica de una llamarada real, podría ser un artefacto instrumental.`
    : `La bajada fue más lenta que la subida (razón ${asymmetryRatio.toFixed(1)}x), pero su forma no se ajusta bien a una exponencial (R²=${rSquared.toFixed(2)}, se esperaba ≥${minRSquared}) — la caída no tiene la forma física esperada de un enfriamiento de plasma.`;

  return {
    name: "flare_morphology_fred",
    displayName: "Morfología FRED (subida rápida, bajada exponencial)",
    measuredValue: Math.round(asymmetryRatio * 100) / 100,
    threshold,
    weight: 0, // se asigna en el hook de agregacion, no aqui
    passed,
    explanation:
      "Una llamarada real libera energía de forma súbita (subida muy rápida) y luego el plasma se enfría gradualmente (bajada lenta, con forma exponencial). Este criterio compara cuánto duró la subida contra cuánto duró la bajada, y qué tan bien esa bajada se parece a una curva exponencial real.",
    interpretation,
  };
}
