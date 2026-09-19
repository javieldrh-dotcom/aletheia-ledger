import { NextRequest, NextResponse } from "next/server";

/**
 * Descubrimiento de archivos FITS de Kepler para un KIC dado, via la
 * API Mashup de MAST (mast.stsci.edu/api/v0/invoke) -- NO requiere
 * Python/astroquery. Flujo de 2 pasos, replicando lo que lightkurve
 * hace internamente:
 *   1. Mast.Caom.Filtered -> encuentra el obsid de la observacion
 *      agregada para el KIC.
 *   2. Mast.Caom.Products -> lista los archivos FITS individuales
 *      por trimestre, con sus URIs de descarga.
 *
 * Validado en sesion de investigacion: KIC 5816811 (K01042.02) ->
 * 18 archivos _llc.fits encontrados correctamente.
 */

const MASHUP_URL = "https://mast.stsci.edu/api/v0/invoke";

async function mashupRequest(service: string, params: Record<string, unknown>) {
  const body = "request=" + encodeURIComponent(JSON.stringify({ service, params, format: "json" }));
  const response = await fetch(MASHUP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) {
    throw new Error(`MAST Mashup respondio con error ${response.status}`);
  }
  return response.json();
}

export async function GET(request: NextRequest) {
  const kic = request.nextUrl.searchParams.get("kic");
  if (!kic) {
    return NextResponse.json({ error: "Falta el parametro 'kic'." }, { status: 400 });
  }

  const targetName = `kplr${kic.padStart(9, "0")}`;

  try {
    const obsResult = await mashupRequest("Mast.Caom.Filtered", {
      columns: "obsid,target_name",
      filters: [
        { paramName: "obs_collection", values: ["Kepler"] },
        { paramName: "target_name", values: [targetName] },
      ],
    });

    if (!obsResult.data || obsResult.data.length === 0) {
      return NextResponse.json({ error: `No se encontraron observaciones para KIC ${kic}.` }, { status: 404 });
    }

    const obsid = obsResult.data[0].obsid;

    const productsResult = await mashupRequest("Mast.Caom.Products", { obsid });

    const fitsFiles = (productsResult.data ?? [])
      .filter(
        (p: { productFilename?: string; dataURI?: string }) =>
          p.productFilename?.endsWith("_llc.fits")
      )
      .map((p: { productFilename: string; dataURI: string }) => ({
        filename: p.productFilename,
        url: p.dataURI.replace("mast:KEPLER/url/", "https://archive.stsci.edu/"),
      }));

    return NextResponse.json({ kic, obsid, quarterCount: fitsFiles.length, files: fitsFiles });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido consultando MAST." },
      { status: 502 }
    );
  }
}