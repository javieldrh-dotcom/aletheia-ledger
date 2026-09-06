"use client";

import { useCallback, useState } from "react";
import { searchNasaTarget, type NasaTargetResult } from "@/lib/nasa/exoplanetArchive";

interface NasaTargetSearchProps {
  onSelectTarget: (result: NasaTargetResult) => void;
}

export function NasaTargetSearch({ onSelectTarget }: NasaTargetSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NasaTargetResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const found = await searchNasaTarget(query);
      setResults(found);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo conectar con el NASA Exoplanet Archive. Verifica tu conexion."
      );
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-1 text-base font-medium text-zinc-300">
        Buscar objetivo en el NASA Exoplanet Archive
      </h2>
      <p className="mb-4 text-xs text-zinc-600">
        Consulta en vivo al catalogo oficial (planetas confirmados y candidatos KOI). No incluye la curva de luz fotometrica -- solo los parametros orbitales.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
          placeholder="ej. KOI-1257, Kepler-1257 b"
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-600 focus:outline-none"
        />
        <button
          onClick={() => void handleSearch()}
          disabled={isSearching || query.trim() === ""}
          className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSearching ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      )}

      {hasSearched && !error && !isSearching && results.length === 0 && (
        <p className="mt-3 text-sm text-zinc-500">
          No se encontraron resultados para &quot;{query}&quot;.
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.slice(0, 8).map((result, idx) => (
            <button
              key={idx}
              onClick={() => onSelectTarget(result)}
              className="block w-full rounded-md border border-zinc-700 bg-zinc-800 p-3 text-left hover:border-cyan-600"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-zinc-200">{result.targetName}</span>
                <span
                  className={`text-xs ${
                    result.source === "confirmed_planet" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {result.source === "confirmed_planet"
                    ? "Confirmado"
                    : result.disposition ?? "Candidato KOI"}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-zinc-500">
                P={result.periodDays.toFixed(4)}d · T0={result.epochBjd.toFixed(4)} BJD · Dur={result.durationHours.toFixed(2)}h
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}