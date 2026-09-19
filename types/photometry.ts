export type BarycentricJulianDate = number;
export type NormalizedFlux = number;

export type DataQualityFlag =
  | "clean"
  | "cosmic_ray"
  | "safe_mode"
  | "attitude_tweak"
  | "argabrightening"
  | "reaction_wheel_desat";

export interface FluxDataPoint {
  readonly time: BarycentricJulianDate;
  readonly flux: NormalizedFlux;
  readonly fluxError: NormalizedFlux;
  readonly qualityFlag: DataQualityFlag;
}

export type PhotometricMission = "Kepler" | "K2" | "TESS";

export interface LightCurveMetadata {
  readonly targetId: string;
  readonly mission: PhotometricMission;
  readonly cadenceSeconds: number;
  readonly sourceHash: string;
  readonly ingestedAt: BarycentricJulianDate;
}

export interface LightCurve {
  readonly metadata: LightCurveMetadata;
  readonly dataPoints: readonly FluxDataPoint[];
}

export interface EclipseSearchDetail {
  readonly primaryDepthPpm: number;
  readonly secondaryDepthPpm: number;
  readonly depthRatio: number;
  readonly estimatedTemperatureRatio: number;
}

export interface VettingCriterion {
  readonly eclipseDetail?: EclipseSearchDetail;
  readonly name:
    | "odd_even_depth_symmetry"
    | "transit_shape_v_vs_u"
    | "residual_noise_dispersion"
    | "periodic_flare_signature"
    | "single_transit_shape_v_vs_u"
    | "ingress_egress_symmetry"
    | "local_noise_dispersion"
    | "sample_sufficiency"
    | "secondary_eclipse_search";
  readonly measuredValue: number;
  readonly threshold: number;
  readonly weight: number;
  readonly passed: boolean;
}

/**
 * Parametros para vetting de transito unico / periodo largo (>225 dias),
 * en linea con el objetivo cientifico del programa PLATO-Venus-Test
 * (confirmar planetas con periodos mas alla de Venus). A diferencia de
 * TransitParameters, no incluye periodDays -- por definicion, un
 * transito unico no tiene periodo confirmado, solo un evento aislado.
 */
export interface SingleTransitParameters {
  readonly midTransitBjd: BarycentricJulianDate;
  readonly transitDurationHours: number;
}

export interface VettingVerdict {
  readonly isFalsePositive: boolean;
  readonly isInconclusive: boolean;
  readonly confidenceScore: number;
  readonly criteria: readonly VettingCriterion[];
  readonly algorithmVersion: string;
  readonly evaluatedAt: BarycentricJulianDate;
}

/**
 * Etapa del pipeline de procesamiento, en el orden en que ocurren.
 * Cada etapa produce un hash encadenado al hash de la etapa anterior
 * -- el equivalente de auditoria financiera de un libro mayor, donde
 * cada asiento referencia el saldo previo para garantizar integridad.
 */
export type ProcessingStage = "raw_ingested" | "quality_filtered" | "evaluated";

export interface ProvenanceLedgerEntry {
  readonly stage: ProcessingStage;
  readonly previousHash: string | null;
  readonly outputHash: string;
  readonly pointCount: number;
  readonly timestamp: number;
}