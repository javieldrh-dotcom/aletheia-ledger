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

const ALGORITHM_VERSION = "aletheia-vetting-v0.3.0";

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

        // Pesos recalibrados el 2026-09-19 (Fase 3), tras reemplazar la
        // logica de 'shape' (heuristico -> ajuste real de modelo de
        // transito Mandel & Agol 2002) y 'odd_even' (asimetria fraccional
        // con MAD cruda -> significancia con error fotometrico propagado
        // por punto), y remedir el poder discriminativo de los 6
        // criterios sobre los mismos 252 candidatos reales de Kepler
        // (127 confirmados, 125 falsos positivos) con
        // scripts/recalibrate_v3.py.
        //
        // Resultado honesto, no sobrevendido:
        //   - odd_even: +2.5pp -> +20.9pp de brecha discriminativa
        //     (CONFIRMED vs FALSE POSITIVE). Mejora real de ~8x. Confirma
        //     el diagnostico de causa raiz: la incertidumbre del AJUSTE/
        //     instrumento (flux_err propagado) es sustancialmente mas
        //     informativa que la dispersion cruda (MAD) de los puntos en
        //     datos reales de Kepler.
        //   - shape: -2.4pp -> apenas +3.2pp. El ajuste Mandel-Agol en si
        //     esta validado independientemente (94.4% de acierto
        //     clasificando transitos rasantes en 160 casos sinteticos con
        //     limb darkening real, ver docs/validacion-modelo-transito.md)
        //     pero en ESTE conjunto de 252 candidatos, casi ninguno de los
        //     falsos positivos es del tipo "rasante" -- la mayoria son
        //     binarias eclipsantes que ya atrapa el criterio de eclipse
        //     secundario. Por eso su poder discriminativo agregado sigue
        //     siendo bajo, sin que eso invalide el criterio en si.
        //
        // Se ajusta el presupuesto de peso de odd_even/shape (que suma
        // 0.15, sin tocar secondary/sufficiency/noise/flare, ya validados
        // en la Fase 2.5) de 0.10/0.05 a 0.13/0.02 -- cerca del optimo
        // matematico medido (que favorecia casi todo el peso a odd_even),
        // pero sin llevar 'shape' a cero: se conserva un peso simbolico
        // porque el criterio sigue siendo geometricamente correcto y
        // explicable para revision humana, y para evitar sobreajustar los
        // pesos a las particularidades de esta muestra de 252 casos.
        const oddEvenWeight = 0.13;
        const shapeWeight = 0.02;
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

        // sufficiency compite como criterio real en el puntaje (no queda
        // excluido) -- ver justificacion en la Fase 2.5.
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

        // Abstencion de determinacion: umbral en 0.5 (ver justificacion
        // historica de la Fase 2.5 -- el umbral de 0.8 fue probado y
        // descartado por empeorar recall y precision simultaneamente).
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
