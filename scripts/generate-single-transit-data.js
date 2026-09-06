const fs = require("fs");
const path = require("path");

function gaussianNoise(stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev;
}

function writeCsv(fileName, rows) {
  const header = "time,flux,flux_err,quality\n";
  const body = rows
    .map((r) => `${r.time.toFixed(6)},${r.flux.toFixed(6)},${r.fluxErr.toFixed(6)},${r.quality}`)
    .join("\n");
  fs.writeFileSync(path.join("test-data", fileName), header + body);
  console.log(`Generado: test-data/${fileName} (${rows.length} puntos)`);
}

const CADENCE_DAYS = 0.0208;
const TOTAL_DAYS = 90; // observacion larga, coherente con busqueda de periodos > 225 dias
const NOISE_STD = 0.0005;
const START_BJD = 2454970;

function generateBaseTimeline() {
  const points = [];
  for (let t = 0; t < TOTAL_DAYS; t += CADENCE_DAYS) {
    points.push(START_BJD + t);
  }
  return points;
}

// --- Caso A: evento unico limpio, ingreso/egreso simetrico (deberia APROBAR) ---
function generateCleanSingleTransit() {
  const midTransit = START_BJD + 45;
  const durationDays = 6 / 24;
  const depth = 0.01;

  const rows = generateBaseTimeline().map((time) => {
    const offset = time - midTransit;
    const inTransit = Math.abs(offset) < durationDays / 2;

    let flux = 1.0;
    if (inTransit) {
      const x = offset / (durationDays / 2);
      flux = 1.0 - depth * (1 - x * x * 0.3); // forma U simetrica
    }

    flux += gaussianNoise(NOISE_STD);
    return { time, flux, fluxErr: NOISE_STD, quality: 0 };
  });

  writeCsv("single-transit-clean.csv", rows);
}

// --- Caso B: asimetria instrumental, no un transito real (deberia FALLAR) ---
function generateAsymmetricInstrumentalEvent() {
  const midTransit = START_BJD + 45;
  const durationDays = 6 / 24;
  const depth = 0.01;

  const rows = generateBaseTimeline().map((time) => {
    const offset = time - midTransit;
    const inTransit = Math.abs(offset) < durationDays / 2;

    let flux = 1.0;
    if (inTransit) {
      // Asimetria deliberada: el egreso (offset > 0) cae mucho mas
      // lento que el ingreso -- tipico de un artefacto sistematico
      // (ej. deriva termica del instrumento), no de una geometria
      // de transito real.
      const x = offset / (durationDays / 2);
      const asymmetricFactor = x < 0 ? 1.0 : 2.2;
      flux = 1.0 - depth * asymmetricFactor * (1 - x * x * 0.3);
    }

    flux += gaussianNoise(NOISE_STD);
    return { time, flux, fluxErr: NOISE_STD, quality: 0 };
  });

  writeCsv("single-transit-asymmetric-instrumental.csv", rows);
}

generateCleanSingleTransit();
generateAsymmetricInstrumentalEvent();

console.log("\nListo. Prueba estos en el Dashboard, modo Transito unico.");