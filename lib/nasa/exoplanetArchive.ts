/**
 * Cliente client-side para el servicio TAP (Table Access Protocol) del
 * NASA Exoplanet Archive. Es un servicio HTTP publico estandar --
 * no requiere API key ni backend, coherente con la Regla de Oro #1.
 * Documentacion: https://exoplanetarchive.ipac.caltech.edu/docs/TAP/usingTAP.html
 *
 * LIMITACION CONOCIDA: solo trae parametros orbitales del catalogo
 * (periodo, epoca, duracion) -- NO trae la curva de luz fotometrica en
 * si (esos datos viven en MAST como archivos FITS y requieren Python/
 * astropy, segun documentamos en la Fase 2). Esta es la "Parte 1" del
 * plan: catalogo en vivo, no fotometria en vivo.
 */

const TAP_PROXY_URL = "/api/nasa-search";

export interface NasaTargetResult {
  readonly targetName: string;
  readonly periodDays: number;
  readonly epochBjd: number;
  readonly durationHours: number;
  readonly source: "confirmed_planet" | "koi_candidate";
  readonly disposition?: string;
}

async function runTapQuery(adqlQuery: string): Promise<Record<string, unknown>[]> {
  const url = `${TAP_PROXY_URL}?query=${encodeURIComponent(adqlQuery)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? `Error al consultar el catalogo (${response.status}).`);
  }

  return data;
}

/**
 * Busca primero en planetas CONFIRMADOS (tabla pscomppars). Si no hay
 * resultados, busca en candidatos KOI sin confirmar (tabla cumulative),
 * convirtiendo su epoca de BKJD (Kepler-specific) a BJD completo.
 */
export async function searchNasaTarget(targetQuery: string): Promise<NasaTargetResult[]> {
  const sanitized = targetQuery.trim().replace(/'/g, "");
  if (sanitized.length === 0) {
    throw new Error("Ingresa un nombre de objetivo para buscar.");
  }

  const confirmedQuery = `SELECT pl_name, pl_orbper, pl_tranmid, pl_trandur FROM pscomppars WHERE pl_name LIKE '%${sanitized}%'`;
  const confirmedRows = await runTapQuery(confirmedQuery);

  if (confirmedRows.length > 0) {
    return confirmedRows
      .filter(
        (row) =>
          typeof row.pl_orbper === "number" &&
          typeof row.pl_tranmid === "number" &&
          typeof row.pl_trandur === "number"
      )
      .map((row) => ({
        targetName: String(row.pl_name),
        periodDays: row.pl_orbper as number,
        epochBjd: row.pl_tranmid as number,
        durationHours: row.pl_trandur as number,
        source: "confirmed_planet" as const,
      }));
  }

  const koiQuery = `SELECT kepoi_name, koi_period, koi_time0bk, koi_duration, koi_disposition FROM cumulative WHERE kepoi_name LIKE '%${sanitized}%'`;
  const koiRows = await runTapQuery(koiQuery);

  const BKJD_TO_BJD_OFFSET = 2454833; // offset estandar Kepler (Barycentric Kepler Julian Date)

  return koiRows
    .filter(
      (row) =>
        typeof row.koi_period === "number" &&
        typeof row.koi_time0bk === "number" &&
        typeof row.koi_duration === "number"
    )
    .map((row) => ({
      targetName: String(row.kepoi_name),
      periodDays: row.koi_period as number,
      epochBjd: (row.koi_time0bk as number) + BKJD_TO_BJD_OFFSET,
      durationHours: row.koi_duration as number,
      source: "koi_candidate" as const,
      disposition: row.koi_disposition ? String(row.koi_disposition) : undefined,
    }));
}