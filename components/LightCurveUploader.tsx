"use client";

import { useCallback, useState } from "react";
import type { FluxDataPoint } from "@/types/photometry";
import { parseLightCurveCsv, type CsvParseError } from "@/lib/parsing/csvParser";

interface LightCurveUploaderProps {
  onDataLoaded: (points: FluxDataPoint[], fileName: string) => void;
}

export function LightCurveUploader({ onDataLoaded }: LightCurveUploaderProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<readonly CsvParseError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isReading, setIsReading] = useState(false);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsReading(true);
      setParseErrors([]);

      try {
        const rawText = await file.text();
        const result = parseLightCurveCsv(rawText);

        setFileName(file.name);
        setParseErrors(result.errors);
        setTotalRows(result.totalRows);

        if (result.points.length > 0) {
          onDataLoaded([...result.points], file.name);
        }
      } catch {
        setParseErrors([
          {
            rowNumber: 0,
            rawLine: "",
            reason: "No se pudo leer el archivo. Verifica que sea un CSV valido.",
          },
        ]);
      } finally {
        setIsReading(false);
      }
    },
    [onDataLoaded]
  );

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
      <label
        htmlFor="light-curve-file"
        className="mb-3 block text-base font-medium text-zinc-300"
      >
        Cargar curva de luz (CSV)
      </label>

      <input
        id="light-curve-file"
        type="file"
        accept=".csv,.txt"
        onChange={handleFileChange}
        disabled={isReading}
        className="block w-full text-base text-zinc-400 file:mr-4 file:rounded-md file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-base file:font-medium file:text-white hover:file:bg-cyan-500 disabled:opacity-50"
      />

      {isReading && (
        <p className="mt-3 text-base text-zinc-500">Procesando archivo...</p>
      )}

      {fileName && !isReading && (
        <div className="mt-4 space-y-2">
          <p className="text-base text-zinc-400">
            Archivo:{" "}
            <span className="font-mono text-zinc-200">{fileName}</span>
          </p>
          <p className="text-base text-zinc-400">
            Filas procesadas:{" "}
            <span className="font-mono text-zinc-200">
              {totalRows - parseErrors.length}
            </span>{" "}
            validas de{" "}
            <span className="font-mono text-zinc-200">{totalRows}</span>{" "}
            totales
          </p>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-900 bg-amber-950/40 p-3">
          <p className="mb-2 text-base font-medium text-amber-400">
            {parseErrors.length} fila(s) con problemas:
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-sm text-amber-300/80">
            {parseErrors.slice(0, 10).map((err, idx) => (
              <li key={idx} className="font-mono">
                Fila {err.rowNumber}: {err.reason}
              </li>
            ))}
            {parseErrors.length > 10 && (
              <li className="italic">
                ...y {parseErrors.length - 10} mas.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

