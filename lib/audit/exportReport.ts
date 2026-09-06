import type { ProvenanceLedgerEntry, VettingVerdict } from "@/types/photometry";
import type { VerdictSignature } from "@/lib/audit/signature";

export interface TransitParametersReport {
  readonly mode: "periodic" | "single_transit";
  readonly periodDays?: number;
  readonly epochBjd?: number;
  readonly midTransitBjd?: number;
  readonly transitDurationHours: number;
}

export interface AuditReport {
  readonly reportVersion: string;
  readonly generatedAt: string;
  readonly sourceFileName: string;
  readonly transitParameters: TransitParametersReport;
  readonly verdict: VettingVerdict;
  readonly provenanceLedger: readonly ProvenanceLedgerEntry[];
  readonly signature: {
    readonly signatureHex: string;
    readonly publicKeyFingerprint: string;
    readonly signedPayloadHash: string;
    readonly signedAt: number;
  } | null;
}

export function buildAuditReport(
  sourceFileName: string,
  transitParameters: TransitParametersReport,
  verdict: VettingVerdict,
  provenanceLedger: readonly ProvenanceLedgerEntry[],
  signature: VerdictSignature | null
): AuditReport {
  return {
    reportVersion: "aletheia-audit-report-v1",
    generatedAt: new Date().toISOString(),
    sourceFileName,
    transitParameters,
    verdict,
    provenanceLedger,
    signature: signature
      ? {
          signatureHex: signature.signatureHex,
          publicKeyFingerprint: signature.publicKeyFingerprint,
          signedPayloadHash: signature.signedPayloadHash,
          signedAt: signature.signedAt,
        }
      : null,
  };
}

export function downloadAuditReport(report: AuditReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const safeTargetName = report.sourceFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `aletheia-audit-${safeTargetName}-${Date.now()}.json`;

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}