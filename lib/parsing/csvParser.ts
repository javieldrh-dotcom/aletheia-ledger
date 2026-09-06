import type { DataQualityFlag, FluxDataPoint } from "@/types/photometry";

export interface CsvParseResult {
  readonly points: readonly FluxDataPoint[];
  readonly errors: readonly CsvParseError[];
  readonly totalRows: number;
}

export interface CsvParseError {
  readonly rowNumber: number;
  readonly rawLine: string;
  readonly reason: string;
}

const COLUMN_ALIASES: Record<string, readonly string[]> = {
  time: ["time", "bjd", "time_bjd"],
  flux: ["flux", "pdcsap_flux", "sap_flux", "normalized_flux"],
  fluxError: ["flux_err", "fluxerror", "pdcsap_flux_err", "sap_flux_err"],
  quality: ["quality", "quality_flag", "sap_quality"],
};

function mapQualityCode(code: number): DataQualityFlag {
  if (code === 0) return "clean";
  if (code % 2 === 1) return "attitude_tweak";
  if (Math.floor(code / 4) % 2 === 1) return "reaction_wheel_desat";
  if (Math.floor(code / 32) % 2 === 1) return "cosmic_ray";
  if (Math.floor(code / 8192) % 2 === 1) return "safe_mode";
  return "argabrightening";
}

function findColumnIndex(
  headers: readonly string[],
  field: keyof typeof COLUMN_ALIASES
): number {
  const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
  const aliases = COLUMN_ALIASES[field];
  for (const alias of aliases) {
    const index = normalizedHeaders.indexOf(alias);
    if (index !== -1) return index;
  }
  return -1;
}

export function parseLightCurveCsv(rawCsv: string): CsvParseResult {
  const lines = rawCsv.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return {
      points: [],
      errors: [
        {
          rowNumber: 0,
          rawLine: "",
          reason: "El archivo no contiene datos suficientes.",
        },
      ],
      totalRows: 0,
    };
  }

  const headers = lines[0].split(",");
  const timeIdx = findColumnIndex(headers, "time");
  const fluxIdx = findColumnIndex(headers, "flux");
  const fluxErrorIdx = findColumnIndex(headers, "fluxError");
  const qualityIdx = findColumnIndex(headers, "quality");

  if (timeIdx === -1 || fluxIdx === -1) {
    return {
      points: [],
      errors: [
        {
          rowNumber: 0,
          rawLine: lines[0],
          reason: "No se encontraron las columnas obligatorias time y/o flux.",
        },
      ],
      totalRows: lines.length - 1,
    };
  }

  const points: FluxDataPoint[] = [];
  const errors: CsvParseError[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNumber = i + 1;
    const rawLine = lines[i];
    const cells = rawLine.split(",");

    const timeValue = Number(cells[timeIdx]);
    const fluxValue = Number(cells[fluxIdx]);
    const fluxErrorValue =
      fluxErrorIdx !== -1 ? Number(cells[fluxErrorIdx]) : 0.001;
    const qualityCode =
      qualityIdx !== -1 ? Number(cells[qualityIdx]) : 0;

    if (Number.isNaN(timeValue) || Number.isNaN(fluxValue)) {
      errors.push({
        rowNumber,
        rawLine,
        reason: "Valor no numerico en time o flux.",
      });
      continue;
    }

    if (fluxValue <= 0) {
      errors.push({
        rowNumber,
        rawLine,
        reason: "Flujo normalizado invalido (debe ser mayor que cero).",
      });
      continue;
    }

    points.push({
      time: timeValue,
      flux: fluxValue,
      fluxError: Number.isNaN(fluxErrorValue) ? 0.001 : fluxErrorValue,
      qualityFlag: mapQualityCode(Number.isNaN(qualityCode) ? 0 : qualityCode),
    });
  }

  return { points, errors, totalRows: lines.length - 1 };
}

