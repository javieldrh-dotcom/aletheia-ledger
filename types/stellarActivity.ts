/**
 * Tipos para el modulo de Auditoria Estelar (segunda coleccion de Aletheia
 * Ledger): deteccion y validacion explicable de llamaradas estelares
 * (flares) y actividad periodica (manchas), sobre la misma filosofia del
 * motor de vetting de transitos -- explicabilidad primero, veredictos
 * acompanados siempre de una explicacion en lenguaje llano de que se midio
 * y por que importa fisicamente, no solo un numero y un pass/fail.
 */

/** Un evento candidato a llamarada detectado en la curva de luz cruda. */
export interface FlareEvent {
  /** Indice del primer punto del evento en el arreglo original de datos. */
  startIndex: number;
  /** Indice del punto de pico (flujo maximo) del evento. */
  peakIndex: number;
  /** Indice del ultimo punto del evento (retorno a la linea base). */
  endIndex: number;
  /** Tiempo del inicio del evento (mismas unidades que los datos, ej. BJD). */
  startTime: number;
  /** Tiempo del pico. */
  peakTime: number;
  /** Tiempo del fin del evento. */
  endTime: number;
  /** Flujo de linea base local (mediana robusta antes del evento). */
  baselineFlux: number;
  /** Flujo en el pico. */
  peakFlux: number;
  /** Amplitud relativa: (peakFlux - baselineFlux) / baselineFlux. */
  amplitude: number;
  /** Duracion total del evento, en dias. */
  durationDays: number;
  /** Significancia del pico en unidades de sigma (MAD robusto) sobre el ruido local. */
  peakSignificance: number;
}

/**
 * Resultado de un criterio de auditoria: igual estructura conceptual que
 * VettingCriterion del motor de transitos (measuredValue/threshold/weight/
 * passed), mas dos campos pedagogicos nuevos para que la interfaz pueda
 * explicarle al lector que significa el numero, no solo mostrarlo.
 */
export interface AuditCriterion {
  /** Identificador estable del criterio (ej. "flare_morphology_fred"). */
  name: string;
  /** Nombre legible para mostrar en la interfaz (ej. "Morfologia FRED"). */
  displayName: string;
  measuredValue: number;
  threshold: number;
  weight: number;
  passed: boolean;
  /**
   * Explicacion breve (1-2 frases) de que mide este criterio, en lenguaje
   * accesible para un lector sin formacion en astrofisica -- se muestra
   * siempre, independientemente del resultado.
   */
  explanation: string;
  /**
   * Interpretacion especifica del RESULTADO obtenido para este evento
   * (ej. "La subida fue 3.2x mas rapida que el decaimiento, consistente
   * con una llamarada real" vs "La subida y el decaimiento tienen
   * duraciones similares, lo cual no es tipico de una llamarada").
   * Se genera dinamicamente segun measuredValue, no es texto fijo.
   */
  interpretation: string;
}

/** Veredicto agregado de auditoria estelar para un evento candidato. */
export interface StellarAuditVerdict {
  event: FlareEvent;
  criteria: readonly AuditCriterion[];
  confidenceScore: number;
  isLikelyArtifact: boolean;
  isInconclusive: boolean;
  algorithmVersion: string;
  evaluatedAt: number;
}
