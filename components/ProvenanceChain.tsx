"use client";

import type { ProvenanceLedgerEntry } from "@/types/photometry";

interface ProvenanceChainProps {
  ledger: readonly ProvenanceLedgerEntry[];
}

const STAGE_LABELS: Record<ProvenanceLedgerEntry["stage"], string> = {
  raw_ingested: "Datos crudos ingresados",
  quality_filtered: "Filtrado por calidad",
  evaluated: "Veredicto evaluado",
};

function truncateHash(hash: string): string {
  return `${hash.slice(0, 12)}...${hash.slice(-8)}`;
}

export function ProvenanceChain({ ledger }: ProvenanceChainProps) {
  if (ledger.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 text-base font-medium text-zinc-300">
        Cadena de trazabilidad (libro mayor de procesamiento)
      </h3>

      <div className="space-y-3">
        {ledger.map((entry, idx) => (
          <div key={entry.stage} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              {idx < ledger.length - 1 && (
                <div className="h-full w-px bg-zinc-700" />
              )}
            </div>

            <div className="pb-3">
              <p className="text-sm font-medium text-zinc-200">
                {STAGE_LABELS[entry.stage]}
              </p>
              <p className="font-mono text-xs text-zinc-500">
                {entry.pointCount} puntos
              </p>
              <p className="font-mono text-xs text-zinc-500">
                Hash: {truncateHash(entry.outputHash)}
              </p>
              {entry.previousHash && (
                <p className="font-mono text-xs text-zinc-600">
                  Encadenado a: {truncateHash(entry.previousHash)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}