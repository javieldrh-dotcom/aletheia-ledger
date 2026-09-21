/**
 * Periodograma de Lomb-Scargle (forma clasica, Lomb 1976 / Scargle 1982),
 * implementacion pura en TypeScript sin dependencias externas.
 *
 * Se usa para el Criterio 4 de Auditoria Estelar: separar la modulacion
 * PERIODICA de brillo causada por manchas estelares rotando dentro y
 * fuera de la vista (senal predecible, repetitiva) de los eventos
 * ESTOCASTICOS de llamaradas (impredecibles, unicos). Un pico de brillo
 * podria en realidad ser solo la fase mas brillante de la rotacion de la
 * estrella, no una llamarada real -- este modulo lo distingue ajustando
 * la modulacion periodica dominante y verificando si queda un exceso de
 * brillo significativo DESPUES de restarla.
 */

export interface PeriodogramResult {
  bestPeriodDays: number;
  bestPower: number;
  /** Amplitud y fase del mejor ajuste sinusoidal en el periodo dominante. */
  amplitude: number;
  phase: number;
  mean: number;
}

function lombScarglePower(
  times: readonly number[],
  fluxCentered: readonly number[],
  variance: number,
  angularFreq: number
): number {
  let sumSin2wt = 0;
  let sumCos2wt = 0;
  for (const t of times) {
    sumSin2wt += Math.sin(2 * angularFreq * t);
    sumCos2wt += Math.cos(2 * angularFreq * t);
  }
  const tau = Math.atan2(sumSin2wt, sumCos2wt) / (2 * angularFreq);

  let sumYCos = 0;
  let sumYSin = 0;
  let sumCos2 = 0;
  let sumSin2 = 0;
  for (let i = 0; i < times.length; i++) {
    const arg = angularFreq * (times[i] - tau);
    const c = Math.cos(arg);
    const s = Math.sin(arg);
    sumYCos += fluxCentered[i] * c;
    sumYSin += fluxCentered[i] * s;
    sumCos2 += c * c;
    sumSin2 += s * s;
  }

  const termCos = sumCos2 > 0 ? (sumYCos * sumYCos) / sumCos2 : 0;
  const termSin = sumSin2 > 0 ? (sumYSin * sumYSin) / sumSin2 : 0;
  return variance > 0 ? 0.5 * (termCos + termSin) / variance : 0;
}

/**
 * Busca el periodo dominante en un rango [minPeriodDays, maxPeriodDays]
 * mediante una grilla de frecuencias. nSamples controla la resolucion
 * (mas muestras = mas preciso pero mas lento).
 */
export function findDominantPeriod(
  times: readonly number[],
  flux: readonly number[],
  minPeriodDays: number,
  maxPeriodDays: number,
  nSamples = 500
): PeriodogramResult {
  const n = times.length;
  const mean = flux.reduce((s, v) => s + v, 0) / n;
  const fluxCentered = flux.map((v) => v - mean);
  const variance =
    fluxCentered.reduce((s, v) => s + v * v, 0) / n;

  if (variance <= 0 || n < 10) {
    return { bestPeriodDays: 0, bestPower: 0, amplitude: 0, phase: 0, mean };
  }

  const minFreq = (2 * Math.PI) / maxPeriodDays;
  const maxFreq = (2 * Math.PI) / minPeriodDays;

  let bestPower = -Infinity;
  let bestFreq = minFreq;

  for (let i = 0; i < nSamples; i++) {
    const freq = minFreq + ((maxFreq - minFreq) * i) / (nSamples - 1);
    const power = lombScarglePower(times, fluxCentered, variance, freq);
    if (power > bestPower) {
      bestPower = power;
      bestFreq = freq;
    }
  }

  const bestPeriodDays = (2 * Math.PI) / bestFreq;

  // Ajuste final de amplitud/fase por minimos cuadrados lineales en el
  // mejor periodo encontrado: y = mean + A*cos(wt) + B*sin(wt)
  let sumCos = 0;
  let sumSin = 0;
  let sumCos2 = 0;
  let sumSin2 = 0;
  let sumCosSin = 0;
  let sumYCos = 0;
  let sumYSin = 0;
  for (let i = 0; i < n; i++) {
    const c = Math.cos(bestFreq * times[i]);
    const s = Math.sin(bestFreq * times[i]);
    sumCos += c;
    sumSin += s;
    sumCos2 += c * c;
    sumSin2 += s * s;
    sumCosSin += c * s;
    sumYCos += fluxCentered[i] * c;
    sumYSin += fluxCentered[i] * s;
  }
  // Resolver sistema 2x2 [sumCos2, sumCosSin; sumCosSin, sumSin2] * [A;B] = [sumYCos; sumYSin]
  const det = sumCos2 * sumSin2 - sumCosSin * sumCosSin;
  let ampCos = 0;
  let ampSin = 0;
  if (Math.abs(det) > 1e-12) {
    ampCos = (sumYCos * sumSin2 - sumYSin * sumCosSin) / det;
    ampSin = (sumYSin * sumCos2 - sumYCos * sumCosSin) / det;
  }
  const amplitude = Math.sqrt(ampCos * ampCos + ampSin * ampSin);
  const phase = Math.atan2(ampSin, ampCos);

  return { bestPeriodDays, bestPower, amplitude, phase, mean };
}

/** Evalua el modelo sinusoidal ajustado en un tiempo dado. */
export function evaluatePeriodicModel(
  result: PeriodogramResult,
  time: number
): number {
  if (result.bestPeriodDays <= 0) return result.mean;
  const angularFreq = (2 * Math.PI) / result.bestPeriodDays;
  return (
    result.mean +
    result.amplitude * Math.cos(angularFreq * time - result.phase)
  );
}
