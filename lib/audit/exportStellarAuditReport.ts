import { jsPDF } from "jspdf";
import type { StellarAuditVerdict } from "@/types/stellarActivity";

const PAGE_MARGIN = 15;
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

/**
 * Genera y descarga un reporte en PDF de los resultados de la Auditoria
 * Estelar, usando jsPDF (ya presente en el proyecto para el reporte del
 * motor de vetting de transitos -- ver lib/audit/exportReport.ts). Todo
 * ocurre en el navegador, sin llamadas a servidor, siguiendo la regla de
 * oro de arquitectura del proyecto (costo de servidor $0).
 *
 * Incluye, por cada evento: su veredicto agregado y el detalle completo
 * de cada criterio (explicacion + interpretacion), no solo un resumen --
 * mismo principio pedagogico que la interfaz.
 */
export function exportStellarAuditReportPdf(
  verdicts: readonly StellarAuditVerdict[],
  sourceFileName: string | null
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = PAGE_MARGIN;

  function ensureSpace(neededMm: number) {
    if (y + neededMm > PAGE_HEIGHT - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
    }
  }

  function writeWrapped(
    text: string,
    fontSize: number,
    options?: { bold?: boolean; color?: [number, number, number] }
  ) {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", options?.bold ? "bold" : "normal");
    if (options?.color) doc.setTextColor(...options.color);
    else doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH) as string[];
    const lineHeight = fontSize * 0.42;
    ensureSpace(lines.length * lineHeight + 1);
    doc.text(lines, PAGE_MARGIN, y);
    y += lines.length * lineHeight + 1.5;
  }

  // --- Encabezado ---
  writeWrapped("Aletheia Ledger", 18, { bold: true });
  writeWrapped("Reporte de Auditoría Estelar", 13, { bold: true });
  writeWrapped(
    `Fuente: ${sourceFileName ?? "(sin nombre)"}    Generado: ${new Date().toLocaleString(
      "es-VE"
    )}`,
    9,
    { color: [110, 110, 110] }
  );
  const algorithmVersion = verdicts[0]?.algorithmVersion ?? "(desconocida)";
  writeWrapped(`Versión del algoritmo: ${algorithmVersion}`, 9, {
    color: [110, 110, 110],
  });
  y += 2;

  const realCount = verdicts.filter(
    (v) => !v.isLikelyArtifact && !v.isInconclusive
  ).length;
  const artifactCount = verdicts.filter((v) => v.isLikelyArtifact).length;
  const inconclusiveCount = verdicts.length - realCount - artifactCount;

  writeWrapped(
    `${verdicts.length} eventos candidatos — ${realCount} probable(s) llamarada real, ${inconclusiveCount} no concluyente(s), ${artifactCount} artefacto(s)`,
    10
  );
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
  y += 4;

  // --- Eventos (ordenados igual que la interfaz: candidatos reales primero) ---
  const rank = (v: StellarAuditVerdict) =>
    v.isInconclusive ? 1 : v.isLikelyArtifact ? 2 : 0;
  const sorted = [...verdicts].sort((a, b) => {
    const r = rank(a) - rank(b);
    return r !== 0 ? r : b.confidenceScore - a.confidenceScore;
  });

  sorted.forEach((verdict, idx) => {
    ensureSpace(12);
    const statusLabel = verdict.isInconclusive
      ? "No concluyente"
      : verdict.isLikelyArtifact
      ? "Probable artefacto"
      : "Llamarada real probable";
    const statusColor: [number, number, number] = verdict.isInconclusive
      ? [110, 110, 110]
      : verdict.isLikelyArtifact
      ? [180, 40, 40]
      : [30, 140, 90];

    writeWrapped(
      `Evento ${idx + 1} · t = ${verdict.event.peakTime.toFixed(4)}`,
      11,
      { bold: true }
    );
    writeWrapped(
      `${statusLabel} — ${(verdict.confidenceScore * 100).toFixed(0)}% de confianza`,
      10,
      { bold: true, color: statusColor }
    );
    writeWrapped(
      `Amplitud: ${(verdict.event.amplitude * 100).toFixed(2)}%    Duración: ${verdict.event.durationDays.toFixed(
        3
      )} días    Significancia: ${verdict.event.peakSignificance.toFixed(1)}σ`,
      8.5,
      { color: [110, 110, 110] }
    );

    verdict.criteria.forEach((criterion) => {
      ensureSpace(6);
      writeWrapped(
        `${criterion.displayName} — ${criterion.passed ? "PASA" : "NO PASA"} (medido=${criterion.measuredValue}, umbral=${criterion.threshold}, peso=${(
          criterion.weight * 100
        ).toFixed(0)}%)`,
        9,
        { bold: true }
      );
      writeWrapped(criterion.interpretation, 8.5);
    });

    y += 3;
    ensureSpace(2);
    doc.setDrawColor(230, 230, 230);
    doc.line(PAGE_MARGIN, y, PAGE_WIDTH - PAGE_MARGIN, y);
    y += 4;
  });

  const safeName = (sourceFileName ?? "auditoria-estelar").replace(
    /[^a-zA-Z0-9._-]/g,
    "_"
  );
  doc.save(`auditoria-estelar-${safeName}.pdf`);
}
