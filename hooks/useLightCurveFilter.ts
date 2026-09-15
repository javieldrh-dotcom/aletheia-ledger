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

const ALGORITHM_VERSION = "aletheia-vetting-v0.2.0";

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

        // Etapa de "filtrado por calidad": el nombre se mantiene por
        // compatibilidad con la cadena de auditoria, pero ya NO excluye
        // puntos por bandera de calidad. Hallazgo real (sesion de
        // integracion FITS-en-navegador): el pipeline de Python
        // validado en la Fase 2 (8.43 sigma en KOI-1257 b) nunca
        // filtro por SAP_QUALITY, solo removio NaN -- excluir por
        // cualquier bandera no-cero (como hacia esta version anterior)
        // descarta datos legitimos y cambia veredictos reales,
        // confirmado empiricamente con KIC 5816811 el 2026-09-06.
        const filteredPoints = points.filter(
          (p) => Number.isFinite(p.flux) && Number.isFinite(p.time)
        );

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

        // Pesos fijos, recalibrados el 2026-09-15 con evidencia real de
        // 252 candidatos etiquetados de Kepler (127 confirmados, 125
        // falsos positivos), usando scripts/measure_recall_impact.py.
        //
        // El esquema anterior (pesos base 0.25/0.15/0.2/0.2/0.2 con
        // redistribucion segun resolutionFactor, y sufficiency con peso
        // 0 fuera del puntaje) media recall ~45% y precision ~87%.
        //
        // Medicion por criterio mostro que secondary (37.7pp de brecha
        // CONFIRMED vs FALSE POSITIVE) y sufficiency (30.4pp) son los
        // discriminadores mas fuertes -- sufficiency no participaba en
        // el puntaje en absoluto. odd_even y shape resultaron casi sin
        // poder discriminativo (+2.5pp y -2.4pp respectivamente) pese a
        // tener los pesos base mas altos del sistema anterior.
        //
        // Con este esquema (secondary 0.25, sufficiency 0.25, noise 0.20,
        // flare 0.15, odd_even 0.10, shape 0.05), medido contra los mismos
        // 252 candidatos: recall subio a 53.6% (+8.9pp), pero precision
        // bajo a 80.7% (-6.5pp) -- intercambio real y documentado, no una
        // mejora gratuita. Se prioriza recall porque el objetivo declarado
        // del proyecto es minimizar falsos positivos que se cuelan como
        // "viables", aceptando mas revision manual de confirmados.
        //
        // odd_even y shape se quedan con peso reducido (no en cero) en vez
        // de eliminarse, porque la investigacion tambien mostro que su
        // implementacion actual (fraccion simple / significancia con error
        // estimado por MAD) no es la correcta -- el Robovetter oficial de
        // Kepler usa un ajuste real de modelo de transito (Mandel-Agol,
        // V = b + Rp/Rs) para 'shape', y una significancia basada en el
        // error del AJUSTE (no de los puntos crudos) para 'odd_even'.
        // Implementar eso es un proyecto de ingenieria aparte, pendiente.
        const oddEvenWeight = 0.10;
        const shapeWeight = 0.05;
        const secondaryWeight = 0.25;
        const noiseWeight = 0.2;
        const flareWeight = 0.15;
        const sufficiencyWeight = 0.25;

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
          { ...sufficiency, weight: sufficiencyWeight },
        ];

        // sufficiency ahora compite como criterio real en el puntaje
        // (ya no queda excluido) -- ver justificacion arriba.
        const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
        const confidenceScore =
          criteria.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0) /
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

        // Abstencion de determinacion: el umbral se elevo de 0.5 a 0.8
        // el 2026-09-14. Hallazgo: la redistribucion de peso (arriba)
        // empieza a descontar simetria par/impar y forma del transito
        // -las dos pruebas mas especificas para detectar binarias
        // eclipsantes- en cuanto resolutionFactor cae por debajo de 1.0,
        // no de 0.5. Con el umbral viejo, candidatos en el rango
        // [0.5, 1.0) recibian un veredicto binario completo con esas
        // dos pruebas ya diluidas, en vez de ser marcados como inciertos.
        // Este es un sospechoso directo del recall bajo (33%) documentado
        // en la calibracion de 128 candidatos.
        const isInconclusive = sufficiency.measuredValue < 0.5;

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
