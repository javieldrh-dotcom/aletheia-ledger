"use client";

import { useCallback, useState } from "react";
import { LightCurveUploader } from "@/components/LightCurveUploader";
import { NasaTargetSearch } from "@/components/NasaTargetSearch";
import type { NasaTargetResult } from "@/lib/nasa/exoplanetArchive";
import { LightCurveChart } from "@/components/LightCurveChart";
import { VettingResults } from "@/components/VettingResults";
import { ProvenanceChain } from "@/components/ProvenanceChain";
import { SignaturePanel } from "@/components/SignaturePanel";
import { useLightCurveFilter } from "@/hooks/useLightCurveFilter";
import { useSingleTransitVetting } from "@/hooks/useSingleTransitVetting";
import type { FluxDataPoint } from "@/types/photometry";
import type { TransitParametersReport } from "@/lib/audit/exportReport";

type VettingMode = "periodic" | "single_transit";

export default function Home() {
  const [mode, setMode] = useState<VettingMode>("periodic");
  const [dataPoints, setDataPoints] = useState<FluxDataPoint[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  const [periodDays, setPeriodDays] = useState("");
  const [epochBjd, setEpochBjd] = useState("");
  const [durationHours, setDurationHours] = useState("");

  const [midTransitBjd, setMidTransitBjd] = useState("");
  const [singleDurationHours, setSingleDurationHours] = useState("");

  const periodic = useLightCurveFilter();
  const single = useSingleTransitVetting();

  const active = mode === "periodic" ? periodic : single;

  const handleNasaTargetSelected = useCallback((result: NasaTargetResult) => {
    setPeriodDays(String(result.periodDays));
    setEpochBjd(String(result.epochBjd));
    setDurationHours(String(result.durationHours));
  }, []);

  const handleDataLoaded = useCallback(
    (points: FluxDataPoint[], name: string) => {
      setDataPoints(points);
      setFileName(name);
    },
    []
  );

  const handleRunVetting = useCallback(() => {
    if (mode === "periodic") {
      const period = Number(periodDays);
      const epoch = Number(epochBjd);
      const duration = Number(durationHours);
      if (Number.isNaN(period) || Number.isNaN(epoch) || Number.isNaN(duration)) return;
      void periodic.runVetting(dataPoints, {
        periodDays: period,
        epochBjd: epoch,
        transitDurationHours: duration,
      });
    } else {
      const mid = Number(midTransitBjd);
      const duration = Number(singleDurationHours);
      if (Number.isNaN(mid) || Number.isNaN(duration)) return;
      void single.runVetting(dataPoints, {
        midTransitBjd: mid,
        transitDurationHours: duration,
      });
    }
  }, [
    mode,
    dataPoints,
    periodDays,
    epochBjd,
    durationHours,
    midTransitBjd,
    singleDurationHours,
    periodic,
    single,
  ]);

  const canRunVetting =
    mode === "periodic"
      ? dataPoints.length > 0 &&
        periodDays.trim() !== "" &&
        epochBjd.trim() !== "" &&
        durationHours.trim() !== "" &&
        !periodic.isProcessing
      : dataPoints.length > 0 &&
        midTransitBjd.trim() !== "" &&
        singleDurationHours.trim() !== "" &&
        !single.isProcessing;

  const finalLedgerHash =
    active.provenanceLedger.length > 0
      ? active.provenanceLedger[active.provenanceLedger.length - 1].outputHash
      : null;

  const transitParametersReport: TransitParametersReport =
    mode === "periodic"
      ? {
          mode: "periodic",
          periodDays: Number(periodDays) || 0,
          epochBjd: Number(epochBjd) || 0,
          transitDurationHours: Number(durationHours) || 0,
        }
      : {
          mode: "single_transit",
          midTransitBjd: Number(midTransitBjd) || 0,
          transitDurationHours: Number(singleDurationHours) || 0,
        };

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-base text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-600 focus:outline-none";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-zinc-100">
            Aletheia Space
          </h1>
          <p className="mt-1 text-base text-zinc-500">
            Vetting explicable de curvas de luz fotometricas - descarte de
            falsos positivos estelares
          </p>
        </header>

        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setMode("periodic")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              mode === "periodic"
                ? "bg-cyan-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            Transito periodico
          </button>
          <button
            onClick={() => setMode("single_transit")}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              mode === "single_transit"
                ? "bg-cyan-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            Transito unico / periodo largo
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <LightCurveUploader onDataLoaded={handleDataLoaded} />

            {mode === "periodic" && (
              <NasaTargetSearch onSelectTarget={handleNasaTargetSelected} />
            )}

            <LightCurveChart points={dataPoints} />

            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-base font-medium text-zinc-300">
                {mode === "periodic"
                  ? "Parametros del transito candidato"
                  : "Parametros del evento candidato (transito unico)"}
              </h2>

              {mode === "periodic" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Periodo (dias)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={periodDays}
                      onChange={(e) => setPeriodDays(e.target.value)}
                      placeholder="ej. 3.5225"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Epoca (BJD)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={epochBjd}
                      onChange={(e) => setEpochBjd(e.target.value)}
                      placeholder="ej. 2454970.5"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Duracion (horas)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      placeholder="ej. 3.2"
                      className={inputClass}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Tiempo central del evento (BJD)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={midTransitBjd}
                      onChange={(e) => setMidTransitBjd(e.target.value)}
                      placeholder="ej. 2455015.0"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">
                      Duracion (horas)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={singleDurationHours}
                      onChange={(e) => setSingleDurationHours(e.target.value)}
                      placeholder="ej. 6.0"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleRunVetting}
                disabled={!canRunVetting}
                className="mt-4 rounded-md bg-cyan-600 px-4 py-2 text-base font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {active.isProcessing ? "Procesando..." : "Ejecutar vetting"}
              </button>

              {fileName && (
                <p className="mt-3 text-xs text-zinc-600">
                  Analizando: {fileName} ({dataPoints.length} puntos)
                </p>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <VettingResults
              verdict={active.verdict}
              sourceHash={finalLedgerHash}
              isProcessing={active.isProcessing}
              error={active.error}
            />

            <ProvenanceChain ledger={active.provenanceLedger} />

            <SignaturePanel
              finalLedgerHash={finalLedgerHash}
              verdict={active.verdict}
              provenanceLedger={active.provenanceLedger}
              sourceFileName={fileName}
              transitParameters={transitParametersReport}
            />
          </div>
        </div>
      </div>
    </main>
  );
}