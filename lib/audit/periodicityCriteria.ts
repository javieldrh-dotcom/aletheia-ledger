import type { AuditCriterion, FlareEvent } from "@/types/stellarActivity";
import type { FluxDataPoint } from "@/types/photometry";
import {
  findDominantPeriod,
  evaluatePeriodicModel,
  type PeriodogramResult,
} from "./lombScargle";

/**
 * Criterio 4 de Auditoria Estelar: Periodicidad vs. Estocasticidad.
 *
 * Fundamento fisico: las manchas estelares rotan junto con la estrella,
 * produciendo una modulacion de brillo PERIODICA y PREDECIBLE (el mismo
 * patron se repite cada periodo de rotacion). Una llamarada real, en
 * cambio, es un evento ESTOCASTICO: ocurre en un instante impredecible,
 * sin relacion con la fase de rotacion.
 *
 * Esto importa porque un pico de brillo detectado por detectFlareEvents
 * podria en realidad ser solo el momento en que la modulacion rotacional
 * (manchas saliendo de vista, cara mas brillante de la estrella) alcanza
 * su maximo -- no una llamarada real. Este criterio lo distingue:
 *
 *   1. Se ajusta la modulacion periodica dominante de la curva de luz
 *      (excluyendo TODOS los eventos candidatos detectados, para no dejar
 *      que las llamaradas contaminen el ajuste) mediante un periodograma
 *      de Lomb-Scargle.
 *   2. Se evalua ese modelo periodico en el instante del pico de cada
 *      evento.
 *   3. Se mide cuanto EXCEDE el brillo observado en el pico al brillo
 *      predicho por la modulacion periodica, en unidades de sigma del
 *      ruido residual (lo que queda despues de restar el modelo
 *      periodico de toda la curva, fuera de los eventos).
 *
 * Un exceso grande (varios sigma por encima de lo que la rotacion por si
 * sola explicaria) es evidencia de que el evento es estocastico -- algo
 * ADEMAS de la modulacion periodica normal de la estrella, consistente
 * con una llamarada real. Un exceso pequeno sugiere que el "evento" es
 * solo la fase mas brillante de la rotacion, no una llamarada.
 *
 * NOTA DE RENDIMIENTO (correccion 2026-09-19): el periodograma de
 * Lomb-Scargle es costoso -- recorre TODA la curva una vez por cada
 * frecuencia de la grilla (nSamples). La version original de este archivo
 * lo recalculaba desde cero para CADA evento, lo que en una curva real de
 * Kepler (decenas a cientos de miles de puntos) tomaba ~75 segundos para
 * apenas 8 eventos. Como el periodo de rotacion es una propiedad GLOBAL
 * de la curva (no cambia evento a evento), ahora se calcula UNA SOLA VEZ
 * por curva -- ver `computeLightCurvePeriodicity` -- y se reutiliza para
 * evaluar todos los eventos, que es O(1) cada uno. Validado: la misma
 * prueba de 8 eventos sobre 128,000 puntos paso de ~75000 ms a ~150 ms
 * (ver test_periodicity_perf.ts).
 */

const EXCESS_SIGMA_THRESHOLD = 4.0;
const MIN_POINTS_OUTSIDE_EVENTS = 30;
// Curvas reales de Kepler tienen decenas a cientos de miles de puntos --
// muchisimos mas de los necesarios para ENCONTRAR un periodo de rotacion
// (dias) via Lomb-Scargle, que es la parte costosa (recorre todos los
// puntos una vez por cada frecuencia de la grilla). Se usa una submuestra
// uniforme solo para la BUSQUEDA de frecuencia; el ruido residual (que si
// debe reflejar TODOS los puntos) se calcula aparte, en un solo recorrido
// barato sin trigonometria por frecuencia.
const MAX_POINTS_FOR_PERIOD_SEARCH = 4000;

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

/** Submuestra `points` a (aproximadamente) `targetCount` elementos, tomando uno cada N por indice (preserva el orden temporal y el espaciado relativo). */
function downsampleUniform<T>(points: readonly T[], targetCount: number): T[] {
  const stride = Math.ceil(points.length / targetCount);
  const result: T[] = [];
  for (let i = 0; i < points.length; i += stride) {
    result.push(points[i]);
  }
  return result;
}

/** Contexto de periodicidad de una curva completa, calculado una sola vez. */
export interface LightCurvePeriodicityContext {
  periodogram: PeriodogramResult;
  residualNoise: number;
}

/**
 * Calcula el periodograma dominante y el ruido residual de TODA la curva,
 * excluyendo de una sola vez los puntos de TODOS los eventos candidatos ya
 * detectados (no uno por uno). Se llama UNA VEZ por curva, no por evento.
 */
export function computeLightCurvePeriodicity(
  points: readonly FluxDataPoint[],
  events: readonly FlareEvent[]
): LightCurvePeriodicityContext | null {
  const excluded = new Uint8Array(points.length);
  for (const event of events) {
    const start = Math.max(0, event.startIndex);
    const end = Math.min(points.length - 1, event.endIndex);
    for (let idx = start; idx <= end; idx++) excluded[idx] = 1;
  }

  const outsidePoints = points.filter((_, idx) => excluded[idx] === 0);
  if (outsidePoints.length < MIN_POINTS_OUTSIDE_EVENTS) return null;

  // Submuestra uniforme (por indice, preserva el espaciado temporal
  // aproximadamente parejo de la curva original) solo para encontrar el
  // periodo dominante -- no para el ajuste final de amplitud/fase ni para
  // el ruido residual, que usan todos los puntos.
  const searchPoints =
    outsidePoints.length > MAX_POINTS_FOR_PERIOD_SEARCH
      ? downsampleUniform(outsidePoints, MAX_POINTS_FOR_PERIOD_SEARCH)
      : outsidePoints;

  const searchTimes = searchPoints.map((p) => p.time);
  const searchFlux = searchPoints.map((p) => p.flux);

  const timeSpanDays = searchTimes[searchTimes.length - 1] - searchTimes[0];

  // El periodo minimo que se puede buscar SIN alias esta limitado por el
  // espaciado real de la muestra usada (criterio de Nyquist con margen):
  // se necesitan varias muestras por periodo candidato. Si se submuestreo
  // la curva para acelerar la busqueda, el espaciado efectivo es mayor que
  // el de los datos originales -- ignorar esto (buscando igual desde un
  // piso fijo de 0.2 dias) produce resultados falsos por alias, como se
  // encontro durante la validacion de esta optimizacion (periodo
  // recuperado de 0.227 dias sobre una modulacion inyectada de 5.1 dias).
  // En vez de eso, el piso de busqueda se deriva del espaciado real de
  // `searchPoints`.
  const OVERSAMPLE_FACTOR = 5; // minimo de muestras por periodo candidato
  const effectiveCadenceDays =
    searchTimes.length > 1 ? timeSpanDays / (searchTimes.length - 1) : 0.2;
  const minPeriodDays = Math.max(0.2, effectiveCadenceDays * OVERSAMPLE_FACTOR);
  const maxPeriodDays = Math.max(minPeriodDays * 2, timeSpanDays / 2);

  const periodogram = findDominantPeriod(
    searchTimes,
    searchFlux,
    minPeriodDays,
    maxPeriodDays
  );

  // El ruido residual SI se calcula sobre TODOS los puntos (fuera de
  // eventos) -- es un solo recorrido O(n) evaluando el modelo ya ajustado,
  // sin la busqueda de frecuencia costosa, asi que es barato aunque n sea
  // grande.
  const residuals = outsidePoints.map(
    (p) => p.flux - evaluatePeriodicModel(periodogram, p.time)
  );
  const residualNoise = robustStandardDeviation(residuals);

  return { periodogram, residualNoise };
}

/**
 * Evalua UN evento contra el contexto de periodicidad ya calculado para
 * toda la curva (O(1) -- no recalcula el periodograma).
 */
export function evaluatePeriodicityVsStochasticity(
  event: FlareEvent,
  context: LightCurvePeriodicityContext | null
): AuditCriterion {
  const explanation =
    "Las manchas estelares producen brillo que sube y baja de forma periódica al rotar la estrella. Este criterio ajusta ese patrón periódico (excluyendo los eventos candidatos) y mide si el pico observado excede claramente lo que la rotación por sí sola predice — un exceso grande es propio de una llamarada real, no de la rotación normal.";

  if (context === null) {
    return {
      name: "periodicity_vs_stochasticity",
      displayName: "Periodicidad vs. Estocasticidad",
      measuredValue: 0,
      threshold: EXCESS_SIGMA_THRESHOLD,
      weight: 0,
      passed: false,
      explanation,
      interpretation:
        "No hay suficientes puntos fuera de los eventos detectados para ajustar de forma confiable la modulación periódica de la estrella — este criterio queda sin resultado concluyente.",
    };
  }

  const { periodogram, residualNoise } = context;
  const predictedAtPeak = evaluatePeriodicModel(periodogram, event.peakTime);
  const excess = event.peakFlux - predictedAtPeak;
  const excessSigma = residualNoise > 0 ? excess / residualNoise : 0;

  const passed = excessSigma >= EXCESS_SIGMA_THRESHOLD;

  const periodNote =
    periodogram.bestPeriodDays > 0
      ? `período dominante detectado: ${periodogram.bestPeriodDays.toFixed(2)} días`
      : "no se detectó una modulación periódica dominante clara";

  const interpretation = passed
    ? `El pico excede en ${excessSigma.toFixed(1)}σ lo que la modulación periódica de la estrella predice para ese instante (${periodNote}) — el evento es estocástico, consistente con una llamarada real y no con la rotación normal.`
    : `El pico excede solo ${excessSigma.toFixed(1)}σ lo esperado por la modulación periódica (${periodNote}, se esperaba ≥${EXCESS_SIGMA_THRESHOLD}σ) — es compatible con ser simplemente la fase más brillante de la rotación de la estrella, no necesariamente una llamarada distinta.`;

  return {
    name: "periodicity_vs_stochasticity",
    displayName: "Periodicidad vs. Estocasticidad",
    measuredValue: Math.round(excessSigma * 100) / 100,
    threshold: EXCESS_SIGMA_THRESHOLD,
    weight: 0, // se asigna en el hook de agregacion, no aqui
    passed,
    explanation,
    interpretation,
  };
}
