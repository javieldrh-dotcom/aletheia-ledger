import jsPDF from "jspdf";
import type { AuditReport } from "@/lib/audit/exportReport";

const CRITERION_LABELS: Record<string, string> = {
  odd_even_depth_symmetry: "Simetria de profundidad par/impar",
  transit_shape_v_vs_u: "Forma del transito (V vs U)",
  residual_noise_dispersion: "Dispersion de ruido residual",
  periodic_flare_signature: "Firma de llamaradas periodicas",
};

const STAGE_LABELS: Record<string, string> = {
  raw_ingested: "Datos crudos ingresados",
  quality_filtered: "Filtrado por calidad",
  evaluated: "Veredicto evaluado",
};

function truncateHash(hash: string): string {
  return `${hash.slice(0, 20)}...${hash.slice(-12)}`;
}

/**
 * Genera una version legible en PDF del reporte de auditoria.
 * El PDF se construye directamente a partir del mismo AuditReport
 * ya firmado -- es una capa de presentacion, no una fuente de verdad
 * distinta. El JSON firmado sigue siendo el artefacto verificable;
 * este PDF es para lectura humana (ej. adjuntar a un paper o
 * compartir con un colega no tecnico).
 */
export function generateAuditReportPdf(report: AuditReport): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 18;
  let y = 20;

  const addLine = (text: string, size = 10, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, marginX, y);
    y += size * 0.5 + 2;
  };

  const addSpacer = (amount = 4) => {
    y += amount;
  };

  addLine("Aletheia Space", 18, true);
  addLine("Reporte de Auditoria de Vetting Fotometrico", 12);
  addSpacer();

  addLine(`Generado: ${report.generatedAt}`, 9);
  addLine(`Version del reporte: ${report.reportVersion}`, 9);
  addLine(`Archivo fuente: ${report.sourceFileName}`, 9);
  addSpacer(6);

  addLine("Parametros del transito candidato", 12, true);
  if (report.transitParameters.mode === "single_transit") {
    addLine("Modo: transito unico / periodo largo", 10);
    addLine(`Tiempo central: ${report.transitParameters.midTransitBjd} BJD`, 10);
  } else {
    addLine(`Periodo: ${report.transitParameters.periodDays} dias`, 10);
    addLine(`Epoca: ${report.transitParameters.epochBjd} BJD`, 10);
  }
  addLine(
    `Duracion: ${report.transitParameters.transitDurationHours} horas`,
    10
  );
  addSpacer(6);

  const verdictLabel = report.verdict.isFalsePositive
    ? "PROBABLE FALSO POSITIVO"
    : "CANDIDATO VIABLE";
  addLine("Veredicto", 12, true);
  addLine(verdictLabel, 11, true);
  addLine(
    `Confianza: ${(report.verdict.confidenceScore * 100).toFixed(1)}%`,
    10
  );
  addLine(`Version del algoritmo: ${report.verdict.algorithmVersion}`, 9);
  addSpacer(6);

  addLine("Desglose por criterio", 12, true);
  for (const criterion of report.verdict.criteria) {
    const label = CRITERION_LABELS[criterion.name] ?? criterion.name;
    const status = criterion.passed ? "APROBADO" : "FALLIDO";
    addLine(`${label}: ${status}`, 10, true);
    addLine(
      `  Medido: ${criterion.measuredValue.toFixed(4)}  |  Umbral: ${criterion.threshold.toFixed(4)}  |  Peso: ${(criterion.weight * 100).toFixed(0)}%`,
      9
    );
  }
  addSpacer(6);

  addLine("Cadena de trazabilidad (libro mayor)", 12, true);
  for (const entry of report.provenanceLedger) {
    const label = STAGE_LABELS[entry.stage] ?? entry.stage;
    addLine(`${label} (${entry.pointCount} puntos)`, 10, true);
    addLine(`  Hash: ${truncateHash(entry.outputHash)}`, 8);
    if (entry.previousHash) {
      addLine(`  Encadenado a: ${truncateHash(entry.previousHash)}`, 8);
    }
  }
  addSpacer(6);

  addLine("Firma digital", 12, true);
  if (report.signature) {
    addLine("Estado: FIRMADO (no repudio)", 10, true);
    addLine(
      `  Huella de llave publica: ${truncateHash(report.signature.publicKeyFingerprint)}`,
      8
    );
    addLine(`  Firma: ${truncateHash(report.signature.signatureHex)}`, 8);
    addLine(
      `  Firmado en: ${new Date(report.signature.signedAt).toISOString()}`,
      8
    );
  } else {
    addLine("Estado: NO FIRMADO", 10, true);
  }

  addSpacer(10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Este PDF es una representacion legible del reporte JSON firmado. Para verificacion criptografica, use el archivo JSON original.",
    marginX,
    y,
    { maxWidth: 175 }
  );

  const safeTargetName = report.sourceFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  doc.save(`aletheia-audit-${safeTargetName}-${Date.now()}.pdf`);
}