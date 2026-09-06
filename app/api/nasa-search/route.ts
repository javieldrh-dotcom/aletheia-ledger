import { NextRequest, NextResponse } from "next/server";

/**
 * Intermediario servidor-a-servidor para el TAP del NASA Exoplanet
 * Archive. Excepcion minima y justificada a la Regla de Oro #1: el
 * navegador no puede consultar NASA directamente porque su servidor
 * no incluye el header Access-Control-Allow-Origin (confirmado con
 * el error real: 200 OK del lado de NASA, bloqueado por el navegador
 * del lado del cliente). Esta ruta NO procesa datos ni hace calculo
 * alguno -- solo reenvia la consulta y la respuesta, evitando CORS.
 * El motor de vetting completo sigue siendo 100% client-side.
 */

const TAP_BASE_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json(
      { error: "Falta el parametro 'query'." },
      { status: 400 }
    );
  }

  try {
    const url = `${TAP_BASE_URL}?query=${encodeURIComponent(query)}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { error: `El servicio TAP de NASA respondio con error ${response.status}.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el NASA Exoplanet Archive." },
      { status: 502 }
    );
  }
}