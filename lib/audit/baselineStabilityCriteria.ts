import type { AuditCriterion, FlareEvent } from "@/types/stellarActivity";
import type { FluxDataPoint } from "@/types/photometry";

/**
 * Criterio 5 de Auditoria Estelar: Estabilidad de Linea Base.
 *
 * Fundamento fisico: una llamarada real es un evento LOCAL -- la estrella
 * libera energia, el brillo sube y baja, y la curva de luz REGRESA al
 * mismo nivel de brillo que tenia antes del evento. La fisica del proceso
 * (enfriamiento del plasma calentado) no deja una cicatriz permanente en
 * el nivel de brillo "de fondo" de la estrella.
 *
 * Un artefacto instrumental, en cambio, frecuentemente coincide con un
 * cambio real en el nivel de linea base: una transicion a modo seguro,
 * un reajuste termico tras una bajada de datos a Tierra, un salto de
 * puntero (pointing jitter) que cambia cuanta luz de la estrella cae
 * dentro de la apertura fotometrica, o una transicion entre cuartos de
 * observacion. En estos casos, el nivel de brillo DESPUES del "evento"
 * puede quedar sistematicamente distinto al de ANTES, aunque la forma
 * del pico en si parezca razonable.
 *
 * Este criterio compara la linea base local ANTES del evento contra la
 * linea base local DESPUES del evento (ambas ventanas fuera del propio
 * evento, para no mezclar la llamarada con el calculo), y mide si la
 * diferencia es significativa frente al ruido local. Una diferencia
 * pequena (linea base recuperada) apoya un evento real; una diferencia
 * grande (salto persistente) sugiere un artefacto instrumental.
 */

const STEP_SIGMA_THRESHOLD = 3.0;
const WINDOW_SIZE = 15;
const MIN_WINDOW_POINTS = 8;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function robustStandardDeviation(values: readonly number[]): number {
  const med = median(values);
  const deviations = values.map((v) => Math.abs(v - med));
  return 1.4826 * median(deviations);
}

export function evaluateBaselineStability(
  event: FlareEvent,
  points: readonly FluxDataPoint[]
): AuditCriterion {
  const explanation =
    "Una llamarada real es un evento pasajero: la estrella libera energía y el brillo vuelve al mismo nivel de antes. Este criterio compara el brillo de fondo justo antes del evento contra el de justo después — un salto persistente en ese nivel de fondo es más propio de un problema instrumental (cambio de apertura, transición de modo, reajuste térmico) que de una llamarada real.";

  const preWindowStart = Math.max(0, event.startIndex - WINDOW_SIZE);
  const preWindow = points.slice(preWindowStart, event.startIndex);

  const postWindowEnd = Math.min(points.length, event.endIndex + 1 + WINDOW_SIZE);
  const postWindow = points.slice(event.endIndex + 1, postWindowEnd);

  if (preWindow.length < MIN_WINDOW_POINTS || postWindow.length < MIN_WINDOW_POINTS) {
    return {
      name: "baseline_stability",
      displayName: "Estabilidad de Línea Base",
      measuredValue: 0,
      threshold: STEP_SIGMA_THRESHOLD,
      weight: 0,
      passed: false,
      explanation,
      interpretation:
        "No hay suficientes puntos antes y después del evento (cerca del borde de los datos disponibles) para comparar la línea base de forma confiable — este criterio queda sin resultado concluyente para este evento.",
    };
  }

  const preFlux = preWindow.map((p) => p.flux);
  const postFlux = postWindow.map((p) => p.flux);

  const preMedian = median(preFlux);
  const postMedian = median(postFlux);
  const preNoise = robustStandardDeviation(preFlux);
  const postNoise = robustStandardDeviation(postFlux);

  // Ruido combinado (cuadratura de los errores estandar de la mediana en
  // cada ventana), usado para juzgar si la diferencia de niveles es
  // significativa o solo dispersion estadistica normal.
  const preSem = preNoise / Math.sqrt(preWindow.length);
  const postSem = postNoise / Math.sqrt(postWindow.length);
  const pooledNoise = Math.sqrt(preSem * preSem + postSem * postSem);

  const step = postMedian - preMedian;
  const stepSigma = pooledNoise > 0 ? Math.abs(step) / pooledNoise : 0;

  const passed = stepSigma < STEP_SIGMA_THRESHOLD;

  const direction = step >= 0 ? "subió" : "bajó";
  const interpretation = passed
    ? `La línea base antes y después del evento es consistente (diferencia de ${stepSigma.toFixed(1)}σ, por debajo de ${STEP_SIGMA_THRESHOLD}σ) — el brillo de fondo se recuperó, como se espera de una llamarada real.`
    : `El brillo de fondo ${direction} de forma persistente tras el evento (diferencia de ${stepSigma.toFixed(1)}σ, se esperaba <${STEP_SIGMA_THRESHOLD}σ) — este salto en la línea base no es típico de una llamarada real y sugiere un posible artefacto instrumental (cambio de apertura, transición de modo, reajuste térmico).`;

  return {
    name: "baseline_stability",
    displayName: "Estabilidad de Línea Base",
    measuredValue: Math.round(stepSigma * 100) / 100,
    threshold: STEP_SIGMA_THRESHOLD,
    weight: 0, // se asigna en el hook de agregacion, no aqui
    passed,
    explanation,
    interpretation,
  };
}
