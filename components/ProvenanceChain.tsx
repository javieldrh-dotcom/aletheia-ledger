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
  if (ledger.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Aparecera aqui despues de ejecutar el escrutinio.
      </p>
    );
  }

  return (
    <div>
      <div className="space-y-3">
        {ledger.map((entry, idx) => (
          <div key={entry.stage} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className="h-2.5 w-2.5 rounded-full bg-accent" />
              {idx < ledger.length - 1 && (
                <div className="h-full w-px bg-line" />
              )}
            </div>

            <div className="pb-3">
              <p className="text-sm font-medium text-ink">
                {STAGE_LABELS[entry.stage]}
              </p>
              <p className="font-mono text-xs text-ink-muted">
                {entry.pointCount} puntos
              </p>
              <p className="font-mono text-xs text-ink-muted">
                Hash: {truncateHash(entry.outputHash)}
              </p>
              {entry.previousHash && (
                <p className="font-mono text-xs text-ink-muted">
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
