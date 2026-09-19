"use client";

import { useCallback, useState } from "react";
import type { DataQualityFlag, FluxDataPoint } from "@/types/photometry";

function mapQualityCode(code: number): DataQualityFlag {
  if (code === 0) return "clean";
  if (code % 2 === 1) return "attitude_tweak";
  if (Math.floor(code / 4) % 2 === 1) return "reaction_wheel_desat";
  if (Math.floor(code / 32) % 2 === 1) return "cosmic_ray";
  if (Math.floor(code / 8192) % 2 === 1) return "safe_mode";
  return "argabrightening";
}

interface FetchByKicProps {
  onDataFetched: (points: FluxDataPoint[], fileName: string) => void;
}

interface FetchPhotometryResponse {
  kic: string;
  quartersRequested: number;
  quartersAvailable: number;
  pointCount: number;
  points: { time: number; flux: number; fluxError: number; quality: number }[];
  limitation: string;
  error?: string;
}

export function FetchByKic({ onDataFetched }: FetchByKicProps) {
  const [kic, setKic] = useState("");
  const [maxQuarters, setMaxQuarters] = useState("4");
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<FetchPhotometryResponse | null>(null);

  const handleFetch = useCallback(async () => {
    setIsFetching(true);
    setError(null);
    setLastResult(null);

    try {
      const url = `/api/fetch-photometry?kic=${encodeURIComponent(kic)}&maxQuarters=${maxQuarters}`;
      const res = await fetch(url);
      const data: FetchPhotometryResponse = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? "No se pudo obtener la fotometria.");
        return;
      }

      const points: FluxDataPoint[] = data.points.map((p) => ({
        time: p.time,
        flux: p.flux,
        fluxError: p.fluxError,
        qualityFlag: mapQualityCode(p.quality),
      }));

      setLastResult(data);
      onDataFetched(points, `KIC-${kic}-directo-navegador.csv`);
    } catch {
      setError("Error de conexion al obtener la fotometria.");
    } finally {
      setIsFetching(false);
    }
  }, [kic, maxQuarters, onDataFetched]);

  return (
    <div>
      <p className="mb-3 text-xs text-ink-muted">
        Descarga fotometria real de Kepler directamente desde MAST, sin Python. Aplanado por trimestre con filtro Savitzky-Golay real (TypeScript puro), validado con correlacion de 0.992 contra el pipeline de Python de la Fase 2. Aun asi, para resultados destinados a publicacion, se recomienda verificacion cruzada con el flujo de Python documentado.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">KIC (numero)</label>
          <input
            type="text"
            value={kic}
            onChange={(e) => setKic(e.target.value)}
            placeholder="ej. 5816811"
            className="w-40 rounded-sm border border-line bg-void px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-muted/50 focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Max. trimestres</label>
          <input
            type="number"
            min={1}
            max={18}
            value={maxQuarters}
            onChange={(e) => setMaxQuarters(e.target.value)}
            className="w-24 rounded-sm border border-line bg-void px-3 py-2 font-mono text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
        <button
          onClick={() => void handleFetch()}
          disabled={isFetching || kic.trim() === ""}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-void hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isFetching ? "Descargando..." : "Obtener fotometria"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-signal-bad">{error}</p>}

      {lastResult && (
        <p className="mt-3 font-mono text-xs text-ink-muted">
          {lastResult.pointCount.toLocaleString()} puntos de {lastResult.quartersRequested} de {lastResult.quartersAvailable} trimestres disponibles
        </p>
      )}
    </div>
  );
}