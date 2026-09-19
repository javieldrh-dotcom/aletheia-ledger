"use client";

import { useCallback, useState } from "react";
import type {
  FluxDataPoint,
  ProvenanceLedgerEntry,
  SingleTransitParameters,
  VettingCriterion,
  VettingVerdict,
} from "@/types/photometry";
import {
  evaluateIngressEgressSymmetry,
  evaluateLocalNoise,
  evaluateSingleTransitShape,
} from "@/lib/vetting/singleTransitCriteria";
import { buildProvenanceLedger } from "@/lib/audit/provenanceLedger";

const ALGORITHM_VERSION = "aletheia-single-transit-vetting-v0.1.0";

interface UseSingleTransitVettingResult {
  verdict: VettingVerdict | null;
  provenanceLedger: readonly ProvenanceLedgerEntry[];
  isProcessing: boolean;
  error: string | null;
  runVetting: (
    points: readonly FluxDataPoint[],
    params: SingleTransitParameters
  ) => Promise<void>;
}

export function useSingleTransitVetting(): UseSingleTransitVettingResult {
  const [verdict, setVerdict] = useState<VettingVerdict | null>(null);
  const [provenanceLedger, setProvenanceLedger] = useState<readonly ProvenanceLedgerEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runVetting = useCallback(
    async (points: readonly FluxDataPoint[], params: SingleTransitParameters) => {
      setIsProcessing(true);
      setError(null);

      try {
        if (points.length < 20) {
          throw new Error(
            "Se requieren al menos 20 puntos de datos para vetting de transito unico."
          );
        }

        const filteredPoints = points.filter((p) => p.qualityFlag === "clean");

        if (filteredPoints.length < 20) {
          throw new Error(
            "Menos de 20 puntos limpios tras el filtrado de calidad; no se puede continuar."
          );
        }

        const criteria: VettingCriterion[] = [
          evaluateIngressEgressSymmetry(
            filteredPoints,
            params.midTransitBjd,
            params.transitDurationHours
          ),
          evaluateSingleTransitShape(
            filteredPoints,
            params.midTransitBjd,
            params.transitDurationHours
          ),
          evaluateLocalNoise(
            filteredPoints,
            params.midTransitBjd,
            params.transitDurationHours
          ),
        ];

        const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
        const confidenceScore =
          criteria.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0) /
          totalWeight;

        // Decision distinta a la del modo periodico, de forma deliberada:
        // un transito unico no tiene periodicidad que sirva de respaldo
        // cruzado (a diferencia del test odd-even), asi que con solo 3
        // criterios independientes, un promedio ponderado simple puede
        // aprobar un candidato pese a fallar la unica defensa real contra
        // artefactos instrumentales (simetria ingreso/egreso). Por eso
        // aqui CUALQUIER criterio fallido descalifica el candidato,
        // en vez de usar el umbral ponderado del modo periodico.
        const isFalsePositive = criteria.some((c) => !c.passed);

        // Abstencion de determinacion: un evento unico con muy pocos
        // puntos dentro de la ventana de transito no ofrece evidencia
        // suficiente para una conclusion binaria confiable, sin
        // importar el resultado de los criterios individuales.
        const isInconclusive = filteredPoints.length < 20;

        const newVerdict: VettingVerdict = {
          isFalsePositive,
          isInconclusive,
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