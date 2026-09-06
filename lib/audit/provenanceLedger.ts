import type {
  FluxDataPoint,
  ProvenanceLedgerEntry,
  VettingVerdict,
} from "@/types/photometry";

async function sha256Hex(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(payload);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Calcula el hash de una etapa incorporando el hash de la etapa
 * anterior dentro del propio calculo. Esto es lo que crea la cadena:
 * el hash de "quality_filtered" depende del hash de "raw_ingested",
 * y el de "evaluated" depende de ambos. Alterar cualquier eslabon
 * intermedio invalida todos los hashes posteriores en la cadena.
 *
 * NOTA DE ATRIBUCION: esta tecnica (cadena de hashes / hashed
 * linked list para deteccion de alteracion) no es original de este
 * proyecto -- es la base del campo academico de "data provenance",
 * con implementaciones previas como Open Science Chain (NSF),
 * SciChain y ProvChain, ya aplicadas en genomica y ciencia climatica.
 * El aporte de Aletheia Space es aplicar este principio ya validado
 * a un nicho sin precedente documentado (vetting de curvas de luz
 * fotometricas), sin requerir infraestructura blockchain distribuida.
 */
async function computeChainedHash(
  stageData: unknown,
  previousHash: string | null
): Promise<string> {
  const payload = JSON.stringify({ previousHash, stageData });
  return sha256Hex(payload);
}

export async function buildProvenanceLedger(
  rawPoints: readonly FluxDataPoint[],
  filteredPoints: readonly FluxDataPoint[],
  verdict: VettingVerdict
): Promise<ProvenanceLedgerEntry[]> {
  const ledger: ProvenanceLedgerEntry[] = [];

  const rawHash = await computeChainedHash(rawPoints, null);
  ledger.push({
    stage: "raw_ingested",
    previousHash: null,
    outputHash: rawHash,
    pointCount: rawPoints.length,
    timestamp: Date.now(),
  });

  const filteredHash = await computeChainedHash(filteredPoints, rawHash);
  ledger.push({
    stage: "quality_filtered",
    previousHash: rawHash,
    outputHash: filteredHash,
    pointCount: filteredPoints.length,
    timestamp: Date.now(),
  });

  const evaluatedHash = await computeChainedHash(verdict, filteredHash);
  ledger.push({
    stage: "evaluated",
    previousHash: filteredHash,
    outputHash: evaluatedHash,
    pointCount: filteredPoints.length,
    timestamp: Date.now(),
  });

  return ledger;
}