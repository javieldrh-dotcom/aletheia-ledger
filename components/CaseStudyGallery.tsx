"use client";

import { useEffect, useState, useCallback } from "react";
import type { FluxDataPoint } from "@/types/photometry";

interface CaseStudy {
  readonly id: string;
  readonly name: string;
  readonly kepid: number;
  readonly csvFile: string;
  readonly disposition: string;
  readonly periodDays: number;
  readonly epochBjd: number;
  readonly durationHours: number;
  readonly pointCount: number;
  readonly note?: string;
}

interface CaseStudyGalleryProps {
  onSelectCase: (
    points: FluxDataPoint[],
    fileName: string,
    params: { periodDays: number; epochBjd: number; durationHours: number }
  ) => void;
}

function parseCaseStudyCsv(rawCsv: string): FluxDataPoint[] {
  const lines = rawCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const points: FluxDataPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const time = Number(cells[0]);
    const flux = Number(cells[1]);
    const fluxError = Number(cells[2]);
    if (Number.isNaN(time) || Number.isNaN(flux)) continue;
    points.push({
      time,
      flux,
      fluxError: Number.isNaN(fluxError) ? 0.0001 : fluxError,
      qualityFlag: "clean",
    });
  }
  return points;
}

const DISPOSITION_COLOR: Record<string, string> = {
  CONFIRMED: "text-signal-good",
  "FALSE POSITIVE": "text-signal-bad",
};

export function CaseStudyGallery({ onSelectCase }: CaseStudyGalleryProps) {
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "confirmed" | "fp">("all");

  useEffect(() => {
    fetch("/case-studies/manifest.json")
      .then((res) => res.json())
      .then(setCases)
      .catch(() => setError("No se pudo cargar la galeria de casos de estudio."));
  }, []);

  const handleSelect = useCallback(
    async (caseStudy: CaseStudy) => {
      setLoadingId(caseStudy.id);
      setError(null);
      try {
        const res = await fetch(`/case-studies/${caseStudy.csvFile}`);
        const text = await res.text();
        const points = parseCaseStudyCsv(text);
        onSelectCase(points, caseStudy.csvFile, {
          periodDays: caseStudy.periodDays,
          epochBjd: caseStudy.epochBjd,
          durationHours: caseStudy.durationHours,
        });
      } catch {
        setError(`No se pudo cargar ${caseStudy.name}.`);
      } finally {
        setLoadingId(null);
      }
    },
    [onSelectCase]
  );

  const filtered = cases.filter((c) => {
    if (filter === "confirmed") return c.disposition.startsWith("CONFIRMED");
    if (filter === "fp") return c.disposition === "FALSE POSITIVE";
    return true;
  });

  if (cases.length === 0 && !error) {
    return <p className="text-sm text-ink-muted">Cargando casos...</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-muted">
          {filtered.length} de {cases.length} casos reales de Kepler (Fase 2.5)
        </p>
        <div className="flex gap-1 text-xs">
          {(["all", "confirmed", "fp"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-sm px-2 py-1 ${
                filter === f ? "bg-accent text-void" : "bg-void text-ink-muted hover:text-ink"
              }`}
            >
              {f === "all" ? "Todos" : f === "confirmed" ? "Confirmados" : "Falsos +"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-signal-bad">{error}</p>}

      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => void handleSelect(c)}
            disabled={loadingId !== null}
            className="flex w-full items-center justify-between rounded-sm border border-line bg-void px-3 py-2 text-left hover:border-accent disabled:opacity-50"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-ink">{c.name}</span>
              <span className="font-mono text-xs text-ink-muted">
                P={c.periodDays.toFixed(2)}d
              </span>
              {c.note && (
                <span className="text-xs italic text-ink-muted">{c.note}</span>
              )}
            </div>
            <span className={`text-xs ${DISPOSITION_COLOR[c.disposition] ?? "text-accent"}`}>
              {loadingId === c.id ? "Cargando..." : c.disposition}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}