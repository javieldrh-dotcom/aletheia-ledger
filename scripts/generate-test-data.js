// Generador de datos sinteticos de curvas de luz para pruebas.
// NO es parte de la aplicacion (no corre en el navegador) -- es
// una herramienta de desarrollo, se ejecuta con Node directamente.

const fs = require("fs");
const path = require("path");

// Generador pseudoaleatorio con semilla fija (mulberry32) -- reemplaza
// Math.random() para que los datasets sinteticos sean 100%
// reproducibles entre ejecuciones. Sin esto, "validar un caso de
// prueba" no tiene sentido: el ruido gaussiano cambiaria cada vez que
// se regenera el archivo, y un criterio marginal (medido muy cerca
// del umbral) podria pasar o fallar por pura casualidad, no por un
// cambio real de codigo. Principio de auditoria: los datos de prueba
// deben ser tan reproducibles como el propio motor de vetting.
const SEED = 42;
let seedState = SEED;
function seededRandom() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function gaussianNoise(stdDev) {
  const u1 = seededRandom();
  const u2 = seededRandom();
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

const CADENCE_DAYS = 0.0208; // ~30 minutos, long cadence Kepler
const TOTAL_DAYS = 27; // ~1 quarter de Kepler
const NOISE_STD = 0.0005;
const START_BJD = 2454970;

function generateBaseTimeline() {
  const points = [];
  for (let t = 0; t < TOTAL_DAYS; t += CADENCE_DAYS) {
    points.push(START_BJD + t);
  }
  return points;
}

// --- Caso 1: Transito planetario limpio (deberia APROBAR el vetting) ---
function generateCleanTransit() {
  const period = 3.5;
  const epoch = START_BJD + 1.2;
  const durationDays = 3.2 / 24;
  const depth = 0.012; // 1.2% -- tipico de un hot Jupiter

  const rows = generateBaseTimeline().map((time) => {
    const phase = (time - epoch) / period;
    const offset = (phase - Math.round(phase)) * period;
    const inTransit = Math.abs(offset) < durationDays / 2;

    // Forma U suave: perfil parabolico dentro del transito, no un
    // corte abrupto en V, para simular geometria planetaria realista.
    let flux = 1.0;
    if (inTransit) {
      const x = offset / (durationDays / 2);
      flux = 1.0 - depth * (1 - x * x * 0.3);
    }

    flux += gaussianNoise(NOISE_STD);
    return { time, flux, fluxErr: NOISE_STD, quality: 0 };
  });

  writeCsv("koi-confirmed-clean-transit.csv", rows);
}

// --- Caso 2: Binaria eclipsante (fisica real: eclipse primario en
// fase 0 Y eclipse secundario genuino en fase 0.5, geometria correcta
// de dos estrellas orbitandose mutuamente -- corregido tras descubrir
// que la version anterior alternaba profundidad por PARIDAD de ciclo
// en la misma fase, lo cual nunca ejercitaba una busqueda real de
// eclipse secundario a medio periodo) ---
function generateEclipsingBinary() {
  const period = 4.1;
  const primaryEpoch = START_BJD + 0.8;
  const secondaryEpoch = primaryEpoch + period / 2; // fase 0.5 real
  const durationDays = 4.0 / 24;
  const primaryDepth = 0.035; // eclipse de la estrella mas fria pasando
                               // frente a la mas caliente (mas profundo)
  const secondaryDepth = 0.012; // eclipse de la estrella mas caliente
                                 // pasando frente a la mas fria (menos
                                 // profundo) -- proporcion ~2.9:1,
                                 // consistente con T2/T1 ~ (0.012/0.035)^0.25

  const rows = generateBaseTimeline().map((time) => {
    const phaseFromPrimary = (time - primaryEpoch) / period;
    const offsetFromPrimary = (phaseFromPrimary - Math.round(phaseFromPrimary)) * period;
    const inPrimaryEclipse = Math.abs(offsetFromPrimary) < durationDays / 2;

    const phaseFromSecondary = (time - secondaryEpoch) / period;
    const offsetFromSecondary = (phaseFromSecondary - Math.round(phaseFromSecondary)) * period;
    const inSecondaryEclipse = Math.abs(offsetFromSecondary) < durationDays / 2;

    let flux = 1.0;
    if (inPrimaryEclipse) {
      const x = Math.abs(offsetFromPrimary) / (durationDays / 2);
      flux = 1.0 - primaryDepth * (1 - x); // forma en V, eclipse rasante
    } else if (inSecondaryEclipse) {
      const x = Math.abs(offsetFromSecondary) / (durationDays / 2);
      flux = 1.0 - secondaryDepth * (1 - x);
    }

    flux += gaussianNoise(NOISE_STD);
    return { time, flux, fluxErr: NOISE_STD, quality: 0 };
  });

  writeCsv("false-positive-eclipsing-binary.csv", rows);
}

// --- Caso 3: Estrella con llamaradas periodicas (deberia FALLAR flare) ---
function generateFlareStar() {
  const period = 2.8;
  const epoch = START_BJD + 0.5;
  const durationDays = 2.5 / 24;
  const depth = 0.008;

  const timeline = generateBaseTimeline();
  const flarePeriod = period; // las llamaradas coinciden con el periodo candidato

  const rows = timeline.map((time) => {
    const phase = (time - epoch) / period;
    const offset = (phase - Math.round(phase)) * period;
    const inTransit = Math.abs(offset) < durationDays / 2;

    let flux = 1.0;
    if (inTransit) {
      const x = offset / (durationDays / 2);
      flux = 1.0 - depth * (1 - x * x * 0.3);
    }

    // Llamarada: pico agudo de brillo cerca de cada ciclo, con
    // decaimiento exponencial tipico de actividad estelar real.
    const flarePhase = (time - epoch) / flarePeriod;
    const flareOffset = (flarePhase - Math.round(flarePhase)) * flarePeriod;
    if (flareOffset > 0.3 && flareOffset < 0.4) {
      const decay = Math.exp(-(flareOffset - 0.3) * 40);
      flux += 0.02 * decay;
    }

    flux += gaussianNoise(NOISE_STD);
    return { time, flux, fluxErr: NOISE_STD, quality: 0 };
  });

  writeCsv("false-positive-flare-star.csv", rows);
}

generateCleanTransit();
generateEclipsingBinary();
generateFlareStar();

// Manifiesto de verdad conocida: la pieza que convierte estos archivos
// en un banco de pruebas real, no solo "datos de ejemplo". Cualquier
// herramienta de vetting (no solo Aletheia Space) puede correr sus
// propios criterios contra estos mismos CSV y comparar su veredicto
// contra la respuesta correcta documentada aqui -- exactamente el tipo
// de recurso reproducible que la comunidad de ML astronomica ha
// identificado como un hueco activo (ver referencia en whitepaper).
const manifest = {
  benchmarkName: "aletheia-space-synthetic-vetting-benchmark",
  version: "1.0.0",
  seed: SEED,
  generatedAt: new Date().toISOString(),
  description: "Curvas de luz sinteticas con verdad conocida (ground truth) para validar algoritmos de vetting de falsos positivos en transitos de exoplanetas. Generadas de forma determinista (semilla fija) para reproducibilidad total entre ejecuciones.",
  scenarios: [
    {
      file: "koi-confirmed-clean-transit.csv",
      groundTruth: "confirmed_candidate",
      expectedVerdict: "not_false_positive",
      transitParameters: { periodDays: 3.5, epochBjd: 2454971.2, transitDurationHours: 3.2 },
      injectedCharacteristics: "Transito planetario limpio, forma U simetrica, profundidad 1.2%, sin ruido anomalo ni flares.",
      designedToTest: "Verdadero positivo -- el motor no debe descartar un candidato limpio."
    },
    {
      file: "false-positive-eclipsing-binary.csv",
      groundTruth: "eclipsing_binary",
      expectedVerdict: "false_positive",
      transitParameters: { periodDays: 4.1, epochBjd: 2454970.8, transitDurationHours: 4.0 },
      injectedCharacteristics: "Eclipse primario (3.5% profundidad) y eclipse secundario real en fase 0.5 (1.2% profundidad, cociente de temperatura estimado incluido), forma en V pronunciada.",
      designedToTest: "Deteccion de binaria via eclipse secundario -- prueba mas especifica que la forma V/U ambigua."
    },
    {
      file: "false-positive-flare-star.csv",
      groundTruth: "stellar_flares",
      expectedVerdict: "false_positive",
      transitParameters: { periodDays: 2.8, epochBjd: 2454970.5, transitDurationHours: 2.5 },
      injectedCharacteristics: "Transito subyacente limpio (0.8% profundidad) contaminado por llamaradas estelares periodicas sincronizadas con el periodo candidato.",
      designedToTest: "Deteccion de contaminacion por actividad estelar, no de la geometria del transito en si."
    }
  ]
};

fs.writeFileSync(
  path.join("test-data", "benchmark-manifest.json"),
  JSON.stringify(manifest, null, 2)
);

console.log("\nManifiesto de verdad conocida guardado: test-data/benchmark-manifest.json");
console.log("Listo. Sube estos archivos al Dashboard desde test-data/");