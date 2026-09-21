"use client";

import type { VettingCriterion, VettingVerdict } from "@/types/photometry";

interface VettingResultsProps {
  verdict: VettingVerdict | null;
  sourceHash: string | null;
  isProcessing: boolean;
  error: string | null;
}

const CRITERION_LABELS: Record<VettingCriterion["name"], string> = {
  odd_even_depth_symmetry: "Simetria par/impar",
  transit_shape_v_vs_u: "Forma del transito",
  residual_noise_dispersion: "Dispersion de ruido",
  periodic_flare_signature: "Llamaradas periodicas",
  ingress_egress_symmetry: "Simetria ingreso/egreso",
  single_transit_shape_v_vs_u: "Forma del evento",
  local_noise_dispersion: "Ruido local",
  sample_sufficiency: "Suficiencia de muestra",
  secondary_eclipse_search: "Eclipse secundario",
};

// Fase 2.6 / auditoria continua: umbral de confianza intermedio que,
// incluso en un veredicto "viable", amerita una segunda mirada humana.
// Ver whitepaper Seccion 6 y hoja de ruta ("auditoria continua de
// candidatos ya confirmados") -- inspirado en Robnik & Seljak (2025,
// PNAS) y Armstrong, Gamper & Damoulas (2021, MNRAS).
const REVIEW_BAND_MIN = 0.6;
const REVIEW_BAND_MAX = 0.75;

function CriterionLedgerRow({ criterion }: { criterion: VettingCriterion }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-line px-1 py-2.5 last:border-0">
      <span className="text-base text-ink">{CRITERION_LABELS[criterion.name]}</span>
      <span className="font-mono text-xs text-ink-muted tabular-nums">
        {criterion.measuredValue.toFixed(4)}
      </span>
      <span className="font-mono text-xs text-ink-muted tabular-nums">
        {criterion.threshold.toFixed(4)}
      </span>
      <span
        className={`text-xs font-medium tabular-nums ${
          criterion.passed ? "text-signal-good" : "text-signal-bad"
        }`}
      >
        {criterion.passed ? "Aprobado" : "Fallido"}
      </span>
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
      <div className="flex h-48 items-center justify-center rounded-sm border border-line bg-surface text-sm text-ink-muted">
        Ejecutando vetting...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-signal-bad/40 bg-signal-bad/10 p-4 text-sm text-signal-bad">
        {error}
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="flex h-48 items-center justify-center rounded-sm border border-line bg-surface text-sm text-ink-muted">
        Los resultados apareceran aqui.
      </div>
    );
  }

  const verdictLabel = verdict.isInconclusive
    ? "No concluyente -- evidencia insuficiente"
    : verdict.isFalsePositive
      ? "Probable falso positivo"
      : "Candidato viable";
  const verdictColor = verdict.isInconclusive
    ? "text-accent"
    : verdict.isFalsePositive
      ? "text-signal-bad"
      : "text-signal-good";

  // Auditoria continua: un veredicto "viable" que, ademas, tiene
  // confianza en la banda intermedia o algun criterio individual
  // fallido, se marca para revision -- no se reclasifica, solo se
  // senala como candidato a una segunda mirada humana.
  const hasFailedCriterion = verdict.criteria.some((c) => !c.passed);
  const confidenceInReviewBand =
    verdict.confidenceScore >= REVIEW_BAND_MIN &&
    verdict.confidenceScore <= REVIEW_BAND_MAX;
  const isFlaggedForReview =
    !verdict.isInconclusive &&
    !verdict.isFalsePositive &&
    (hasFailedCriterion || confidenceInReviewBand);

  return (
    <div className="rounded-sm border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <span className={`font-serif text-xl ${verdictColor}`}>{verdictLabel}</span>
        <span className="font-mono text-sm text-ink-muted tabular-nums">
          {(verdict.confidenceScore * 100).toFixed(1)}%
        </span>
      </div>

      {isFlaggedForReview && (
        <div className="border-b border-accent/40 bg-accent/10 px-4 py-3">
          <p className="text-sm font-medium text-accent">
            &#9873; Candidato senalado para auditoria continua
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Este candidato fue clasificado como viable, pero{" "}
            {hasFailedCriterion
              ? "al menos un criterio individual no aprobo"
              : "la confianza cae en una banda intermedia"}
            . No se trata de una reclasificacion -- es una senal de que
            podria merecer una segunda revision humana, siguiendo el
            mismo principio de auditoria continua documentado en el
            whitepaper del proyecto.
          </p>
        </div>
      )}

      <div className="px-4 py-2">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-line px-1 pb-2 text-[11px] uppercase tracking-wide text-ink-muted">
          <span>Criterio</span>
          <span>Medido</span>
          <span>Umbral</span>
          <span>Resultado</span>
        </div>
        {verdict.criteria.map((criterion) => (
          <CriterionLedgerRow key={criterion.name} criterion={criterion} />
        ))}
      </div>

      <div className="space-y-0.5 border-t border-line px-4 py-3 font-mono text-xs text-ink-muted">
        <p>Algoritmo: {verdict.algorithmVersion}</p>
        <p>Evaluado: {new Date(verdict.evaluatedAt).toISOString()}</p>
        {sourceHash && <p className="truncate">Hash: {sourceHash}</p>}
      </div>
    </div>
  );
}