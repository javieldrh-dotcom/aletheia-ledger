import { NextRequest, NextResponse } from "next/server";
import { FITSParser, type BinaryTableHDU } from "jsfitsio";
import { flattenFlux } from "@/lib/photometry/savitzkyGolay";

/**
 * Descarga, parsea y normaliza la fotometria real de Kepler para un
 * KIC dado, completamente sin Python. Reutiliza el descubrimiento de
 * /api/mast-discover, y aplica el mismo metodo de aplanado por
 * trimestre validado en la Fase 2 (mediana local por trimestre antes
 * de unir), aunque de forma simplificada (division por mediana, sin
 * el filtro Savitzky-Golay completo -- ver limitaciones abajo).
 *
 * LIMITACION CONOCIDA Y DOCUMENTADA: el aplanado aqui es una
 * normalizacion simple por mediana de cada trimestre, NO el filtro
 * Savitzky-Golay de ventana 401 que usa lightkurve.flatten() en
 * Python. Esto es una aproximacion de menor calidad, suficiente para
 * exploracion rapida en el navegador, pero NO reemplaza el pipeline
 * de Python para analisis publicable -- debe documentarse asi en
 * cualquier resultado que se derive de este endpoint.
 */

function medianOf(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function parseOneQuarter(url: string) {
  const fitsFile = await FITSParser.loadFITSFile(url);
  if (!fitsFile || fitsFile.hdus.length < 2) {
    throw new Error(`No se pudo parsear el FITS o falta el HDU de tabla: ${url}`);
  }

  const hdu = fitsFile.hdus[1] as BinaryTableHDU; // BinaryTableHDU "LIGHTCURVE"

  const colIndex = (name: string) => hdu.columns.findIndex((c) => c.name === name);
  const timeIdx = colIndex("TIME");
  const fluxIdx = colIndex("PDCSAP_FLUX");
  const fluxErrIdx = colIndex("PDCSAP_FLUX_ERR");
  const qualityIdx = colIndex("SAP_QUALITY");

  const asNumber = (value: unknown): number => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : NaN;
  };

  const rawPoints: { time: number; flux: number; fluxErr: number; quality: number }[] = [];
  for (let i = 0; i < hdu.rowCount; i++) {
    const row = hdu.getRow(i);
    const time = asNumber(row[timeIdx]);
    const flux = asNumber(row[fluxIdx]);
    if (Number.isNaN(time) || Number.isNaN(flux)) continue;
    rawPoints.push({
      time,
      flux,
      fluxErr: asNumber(row[fluxErrIdx]) || 0,
      quality: asNumber(row[qualityIdx]) || 0,
    });
  }

  if (rawPoints.length === 0) return [];

  // Aplanado Savitzky-Golay real por trimestre (ventana 401 cadencias,
  // igual que el metodo validado en la Fase 2 con 8.43 sigma en
  // KOI-1257 b) -- reemplaza la normalizacion simple por mediana que
  // se demostro insuficiente (KIC 5816811, sesion 2026-09-06/07).
  const fluxValues = rawPoints.map((p) => p.flux);
  const windowSize = Math.min(401, fluxValues.length % 2 === 0 ? fluxValues.length - 1 : fluxValues.length);
  const flattenedFlux = flattenFlux(fluxValues, windowSize);

  const fluxErrValues = rawPoints.map((p) => p.fluxErr);
  const quarterMedianFlux = medianOf(fluxValues);
  const normalizedErr = fluxErrValues.map((e) => e / quarterMedianFlux);

  return rawPoints.map((p, i) => ({
    time: p.time,
    flux: flattenedFlux[i],
    fluxError: normalizedErr[i],
    quality: p.quality,
  }));
}

export async function GET(request: NextRequest) {
  const kic = request.nextUrl.searchParams.get("kic");
  const maxQuarters = Number(request.nextUrl.searchParams.get("maxQuarters") ?? "4");

  if (!kic) {
    return NextResponse.json({ error: "Falta el parametro 'kic'." }, { status: 400 });
  }

  try {
    const discoverUrl = new URL("/api/mast-discover", request.url);
    discoverUrl.searchParams.set("kic", kic);
    const discoverRes = await fetch(discoverUrl.toString());
    const discoverData = await discoverRes.json();

    if (!discoverRes.ok) {
      return NextResponse.json(discoverData, { status: discoverRes.status });
    }

    const filesToFetch = discoverData.files.slice(0, maxQuarters);
    const allPoints: { time: number; flux: number; fluxError: number; quality: number }[] = [];

    for (const file of filesToFetch) {
      try {
        const quarterPoints = await parseOneQuarter(file.url);
        allPoints.push(...quarterPoints);
      } catch (err) {
        console.error(`Error procesando ${file.filename}:`, err);
      }
    }

    allPoints.sort((a, b) => a.time - b.time);

    return NextResponse.json({
      kic,
      quartersRequested: filesToFetch.length,
      quartersAvailable: discoverData.quarterCount,
      pointCount: allPoints.length,
      points: allPoints,
      limitation: "Aplanado Savitzky-Golay real (TypeScript puro, sin dependencias) por trimestre, ventana 401 cadencias -- metodo equivalente al validado en la Fase 2.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido." },
      { status: 502 }
    );
  }
}