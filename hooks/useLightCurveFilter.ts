"use client";

import { useCallback, useState } from "react";
import type {
  FluxDataPoint,
  ProvenanceLedgerEntry,
  VettingCriterion,
  VettingVerdict,
} from "@/types/photometry";
import {
  evaluateOddEvenSymmetry,
  evaluatePeriodicFlareSignature,
  evaluateResidualNoise,
  evaluateSampleSufficiency,
  evaluateSecondaryEclipseSearch,
  evaluateTransitShape,
} from "@/lib/vetting/criteria";
import { buildProvenanceLedger } from "@/lib/audit/provenanceLedger";

const ALGORITHM_VERSION = "aletheia-vetting-v0.1.0";

interface TransitParameters {
  periodDays: number;
  epochBjd: number;
  transitDurationHours: number;
}

interface UseLightCurveFilterResult {
  verdict: VettingVerdict | null;
  provenanceLedger: readonly ProvenanceLedgerEntry[];
  isProcessing: boolean;
  error: string | null;
  runVetting: (
    points: readonly FluxDataPoint[],
    transitParams: TransitParameters
  ) => Promise<void>;
}

export function useLightCurveFilter(): UseLightCurveFilterResult {
  const [verdict, setVerdict] = useState<VettingVerdict | null>(null);
  const [provenanceLedger, setProvenanceLedger] = useState<readonly ProvenanceLedgerEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runVetting = useCallback(
    async (
      points: readonly FluxDataPoint[],
      transitParams: TransitParameters
    ) => {
      setIsProcessing(true);
      setError(null);

      try {
        if (points.length < 10) {
          throw new Error(
            "Se requieren al menos 10 puntos de datos para un vetting confiable."
          );
        }

        // Etapa de filtrado por calidad: se excluyen del analisis los
        // puntos con banderas distintas a "clean" (rayos cosmicos,
        // safe mode, etc.) -- una mejora cientifica real, no solo un
        // paso decorativo para la cadena de auditoria.
        const filteredPoints = points.filter((p) => p.qualityFlag === "clean");

        if (filteredPoints.length < 10) {
          throw new Error(
            "Menos de 10 puntos limpios tras el filtrado de calidad; no se puede continuar."
          );
        }

        const sufficiency = evaluateSampleSufficiency(
          filteredPoints,
          transitParams.periodDays,
          transitParams.epochBjd,
          transitParams.transitDurationHours
        );

        const resolutionFactor = sufficiency.measuredValue;

        const oddEvenBaseWeight = 0.25;
        const shapeBaseWeight = 0.15;
        const secondaryBaseWeight = 0.2;
        const noiseBaseWeight = 0.2;
        const flareBaseWeight = 0.2;

        const oddEvenWeight = oddEvenBaseWeight * resolutionFactor;
        const shapeWeight = shapeBaseWeight * resolutionFactor;
        const secondaryWeight = secondaryBaseWeight * resolutionFactor;
        const redistributed =
          (oddEvenBaseWeight - oddEvenWeight) +
          (shapeBaseWeight - shapeWeight) +
          (secondaryBaseWeight - secondaryWeight);
        const noiseWeight = noiseBaseWeight + redistributed * 0.5;
        const flareWeight = flareBaseWeight + redistributed * 0.5;

        const oddEven = evaluateOddEvenSymmetry(
          filteredPoints,
          transitParams.periodDays,
          transitParams.epochBjd,
          transitParams.transitDurationHours
        );
        const shape = evaluateTransitShape(
          filteredPoints,
          transitParams.periodDays,
          transitParams.epochBjd,
          transitParams.transitDurationHours
        );
        const secondary = evaluateSecondaryEclipseSearch(
          filteredPoints,
          transitParams.periodDays,
          transitParams.epochBjd,
          transitParams.transitDurationHours
        );
        const noise = evaluateResidualNoise(
          filteredPoints,
          transitParams.periodDays,
          transitParams.epochBjd,
          transitParams.transitDurationHours
        );
        const flare = evaluatePeriodicFlareSignature(filteredPoints);

        const criteria: VettingCriterion[] = [
          { ...oddEven, weight: oddEvenWeight },
          { ...shape, weight: shapeWeight },
          { ...secondary, weight: secondaryWeight },
          { ...noise, weight: noiseWeight },
          { ...flare, weight: flareWeight },
          sufficiency,
        ];

        const scoringCriteria = criteria.filter((c) => c.name !== "sample_sufficiency");
        const totalWeight = scoringCriteria.reduce((sum, c) => sum + c.weight, 0);
        const confidenceScore =
          scoringCriteria.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0) /
          totalWeight;

        // Veto por evidencia extrema: la busqueda de eclipse secundario
        // es una prueba altamente especifica de sistema binario -- un
        // fallo con significancia muy por encima del umbral (>2x, es
        // decir mas de 6 sigma cuando el umbral es 3) es evidencia
        // practicamente irrefutable, y no deberia poder ser "promediada"
        // por otros criterios menos especificos. Principio de auditoria:
        // cierta evidencia extrema anula el promedio general de
        // indicadores, en vez de competir con ellos en igualdad de peso.
        const secondaryEclipseCriterion = criteria.find(
          (c) => c.name === "secondary_eclipse_search"
        );
        const vetoedBySecondaryEclipse =
          secondaryEclipseCriterion !== undefined &&
          !secondaryEclipseCriterion.passed &&
          secondaryEclipseCriterion.measuredValue > secondaryEclipseCriterion.threshold * 2;

        const isFalsePositive = vetoedBySecondaryEclipse || confidenceScore < 0.6;

        const newVerdict: VettingVerdict = {
          isFalsePositive,
          confidenceScore,
          criteria,
          algorithmVersion: ALGORITHM_VERSION,
          evaluatedAt: Date.now(),
        };

        const ledger = await buildProvenanceLedger(
          points,
          filteredPoints,
          newVerdict
        );

        setVerdict(newVerdict);
        setProvenanceLedger(ledger);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error desconocido en el vetting."
        );
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return { verdict, provenanceLedger, isProcessing, error, runVetting };
}