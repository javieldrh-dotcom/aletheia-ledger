/**
 * Filtro Savitzky-Golay implementado en TypeScript puro, sin
 * dependencias externas. Calcula los coeficientes de convolucion
 * exactos via minimos cuadrados (ajuste polinomial local de orden 2,
 * igual que el valor por defecto de scipy.signal.savgol_filter que
 * usa lightkurve internamente), luego aplica la convolucion para
 * obtener la linea base de tendencia, y normaliza dividiendo el
 * flujo crudo entre esa linea base -- replicando el efecto de
 * lightkurve.flatten(window_length=N) sin depender de Python.
 *
 * Este es el cierre de la brecha de fidelidad identificada en la
 * sesion de integracion FITS-en-navegador: la normalizacion simple
 * por mediana (division global) no preserva ni remueve tendencias
 * correctamente: este filtro si lo hace.
 */

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivotRow][col])) pivotRow = row;
    }
    [M[col], M[pivotRow]] = [M[pivotRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;
    for (let k = col; k <= n; k++) M[col][k] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Calcula los coeficientes de Savitzky-Golay para el punto central
 * de una ventana de tamano `windowSize` (debe ser impar), ajustando
 * un polinomio de grado `polyOrder` (2 = cuadratico, igual que
 * scipy por defecto).
 */
function savitzkyGolayCoefficients(windowSize: number, polyOrder: number): number[] {
  const half = Math.floor(windowSize / 2);
  const A: number[][] = [];
  for (let i = -half; i <= half; i++) {
    const row: number[] = [];
    for (let p = 0; p <= polyOrder; p++) row.push(Math.pow(i, p));
    A.push(row);
  }

  // Resolver (A^T A) c = A^T e0, donde e0 selecciona el termino
  // constante del polinomio (valor en el centro de la ventana).
  const AtA: number[][] = Array.from({ length: polyOrder + 1 }, () =>
    new Array(polyOrder + 1).fill(0)
  );
  for (let r = 0; r <= polyOrder; r++) {
    for (let c = 0; c <= polyOrder; c++) {
      let sum = 0;
      for (let i = 0; i < windowSize; i++) sum += A[i][r] * A[i][c];
      AtA[r][c] = sum;
    }
  }

  const e0 = new Array(polyOrder + 1).fill(0);
  e0[0] = 1;
  const coeffsPoly = solveLinearSystem(AtA, e0);

  // Coeficientes de convolucion finales: para cada punto i de la
  // ventana, su peso es A[i] . coeffsPoly
  const weights: number[] = [];
  for (let i = 0; i < windowSize; i++) {
    let w = 0;
    for (let p = 0; p <= polyOrder; p++) w += A[i][p] * coeffsPoly[p];
    weights.push(w);
  }
  return weights;
}

/**
 * Aplica el filtro a un arreglo de flujo, devolviendo la linea base
 * suavizada (misma longitud que la entrada, con extension por borde
 * en los extremos donde la ventana completa no cabe).
 */
export function savitzkyGolayTrend(
  values: readonly number[],
  windowSize: number,
  polyOrder = 2
): number[] {
  const safeWindow = windowSize % 2 === 0 ? windowSize + 1 : windowSize;
  const half = Math.floor(safeWindow / 2);
  if (values.length < safeWindow) return [...values];

  const weights = savitzkyGolayCoefficients(safeWindow, polyOrder);
  const trend = new Array(values.length).fill(0);

  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    for (let j = -half; j <= half; j++) {
      let idx = i + j;
      // Extension por reflejo en los bordes (igual que scipy 'mirror')
      if (idx < 0) idx = -idx;
      if (idx >= values.length) idx = 2 * (values.length - 1) - idx;
      sum += weights[j + half] * values[idx];
    }
    trend[i] = sum;
  }

  return trend;
}

/**
 * Aplana (normaliza) una serie de flujo: divide el flujo crudo entre
 * su tendencia local Savitzky-Golay, y reescala por la mediana global
 * para mantener el flujo centrado en ~1.0 -- exactamente el
 * comportamiento de lightkurve.flatten().
 */
export function flattenFlux(
  values: readonly number[],
  windowSize: number
): number[] {
  const trend = savitzkyGolayTrend(values, windowSize, 2);
  const flattened = values.map((v, i) => (trend[i] !== 0 ? v / trend[i] : 1));

  const sorted = [...flattened].sort((a, b) => a - b);
  const median =
    sorted.length % 2 !== 0
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;

  return flattened.map((v) => v / median);
}