"use client";

import type { VettingCriterion, VettingVerdict } from "@/types/photometry";

interface VettingResultsProps {
  verdict: VettingVerdict | null;
  sourceHash: string | null;
  isProcessing: boolean;
  error: string | null;
}

const CRITERION_LABELS: Record<VettingCriterion["name"], string> = {
  odd_even_depth_symmetry: "Simetria de profundidad par/impar",
  transit_shape_v_vs_u: "Forma del transito (V vs U)",
  residual_noise_dispersion: "Dispersion de ruido residual",
  periodic_flare_signature: "Firma de llamaradas periodicas",
  ingress_egress_symmetry: "Simetria ingreso/egreso (transito unico)",
  single_transit_shape_v_vs_u: "Forma del evento (transito unico)",
  local_noise_dispersion: "Dispersion de ruido local (transito unico)",
  sample_sufficiency: "Suficiencia de muestra (transitos y resolucion)",
  secondary_eclipse_search: "Busqueda de eclipse secundario",
};

function CriterionRow({ criterion }: { criterion: VettingCriterion }) {
  const statusColor = criterion.passed ? "text-emerald-400" : "text-red-400";
  const statusLabel = criterion.passed ? "Aprobado" : "Fallido";
  const barWidth = Math.min(
    (criterion.measuredValue / (criterion.threshold * 2)) * 100,
    100
  );

  return (
    <div className="border-b border-zinc-800 py-3 last:border-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-base text-zinc-300">
          {CRITERION_LABELS[criterion.name]}
        </span>
        <span className={`text-sm font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full ${criterion.passed ? "bg-emerald-500" : "bg-red-500"}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      <div className="flex justify-between font-mono text-xs text-zinc-500">
        <span>Medido: {criterion.measuredValue.toFixed(4)}</span>
        <span>Umbral: {criterion.threshold.toFixed(4)}</span>
        <span>Peso: {(criterion.weight * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function VettingResults({
  verdict,
  sourceHash,
  isProcessing,
  error,
}: VettingResultsProps) {
  if (isProcessing) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-base text-zinc-500">
        Ejecutando vetting...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-base text-red-400">
        {error}
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-base text-zinc-500">
        Los resultados del vetting apareceran aqui.
      </div>
    );
  }

  const verdictColor = verdict.isFalsePositive
    ? "border-red-800 bg-red-950/30"
    : "border-emerald-800 bg-emerald-950/30";
  const verdictLabel = verdict.isFalsePositive
    ? "Probable falso positivo"
    : "Candidato viable";
  const verdictTextColor = verdict.isFalsePositive
    ? "text-red-400"
    : "text-emerald-400";

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 ${verdictColor}`}>
        <div className="flex items-center justify-between">
          <span className={`text-lg font-semibold ${verdictTextColor}`}>
            {verdictLabel}
          </span>
          <span className="font-mono text-base text-zinc-400">
            Confianza: {(verdict.confidenceScore * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-2 text-base font-medium text-zinc-300">
          Desglose por criterio
        </h3>
        {verdict.criteria.map((criterion) => (
          <CriterionRow key={criterion.name} criterion={criterion} />
        ))}
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 font-mono text-xs text-zinc-500">
        <p>Version del algoritmo: {verdict.algorithmVersion}</p>
        <p>Evaluado: {new Date(verdict.evaluatedAt).toISOString()}</p>
        {sourceHash && (
          <p className="truncate">Hash de datos (SHA-256): {sourceHash}</p>
        )}
      </div>
    </div>
  );
}

