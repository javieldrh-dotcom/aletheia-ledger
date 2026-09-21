"use client";

import { useVerdictSignature } from "@/hooks/useVerdictSignature";
import {
  buildAuditReport,
  downloadAuditReport,
  type TransitParametersReport,
} from "@/lib/audit/exportReport";
import { generateAuditReportPdf } from "@/lib/audit/exportReportPdf";
import type { ProvenanceLedgerEntry, VettingVerdict } from "@/types/photometry";

interface SignaturePanelProps {
  finalLedgerHash: string | null;
  verdict: VettingVerdict | null;
  provenanceLedger: readonly ProvenanceLedgerEntry[];
  sourceFileName: string | null;
  transitParameters: TransitParametersReport;
}

function truncate(value: string): string {
  return `${value.slice(0, 16)}...${value.slice(-8)}`;
}

export function SignaturePanel({
  finalLedgerHash,
  verdict,
  provenanceLedger,
  sourceFileName,
  transitParameters,
}: SignaturePanelProps) {
  const { keyPair, signature, isSigning, error, generateKeys, signVerdict } =
    useVerdictSignature();

  if (!finalLedgerHash) {
    return (
      <p className="text-sm text-ink-muted">
        Aparecera aqui despues de ejecutar el escrutinio.
      </p>
    );
  }

  const handleDownload = () => {
    if (!verdict || !sourceFileName) return;
    const report = buildAuditReport(
      sourceFileName,
      transitParameters,
      verdict,
      provenanceLedger,
      signature
    );
    downloadAuditReport(report);
  };

  const handleDownloadPdf = () => {
    if (!verdict || !sourceFileName) return;
    const report = buildAuditReport(
      sourceFileName,
      transitParameters,
      verdict,
      provenanceLedger,
      signature
    );
    generateAuditReportPdf(report);
  };

  return (
    <div className="space-y-3">
      {!keyPair && (
        <button
          onClick={() => void generateKeys()}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-void hover:opacity-90"
        >
          Generar llaves de firma
        </button>
      )}

      {keyPair && (
        <div className="space-y-3">
          <p className="font-mono text-xs text-ink-muted">
            Huella de llave publica: {truncate(keyPair.publicKeyFingerprint)}
          </p>

          {!signature && (
            <button
              onClick={() => void signVerdict(finalLedgerHash)}
              disabled={isSigning}
              className="rounded-sm bg-signal-good px-4 py-2 text-sm font-medium text-void hover:opacity-90 disabled:opacity-50"
            >
              {isSigning ? "Firmando..." : "Firmar veredicto"}
            </button>
          )}

          {signature && (
            <div className="rounded-sm border border-signal-good/40 bg-surface-raised p-3">
              <p className="mb-1 text-sm font-medium text-signal-good">
                Veredicto firmado
              </p>
              <p className="font-mono text-xs text-ink-muted">
                Firma: {truncate(signature.signatureHex)}
              </p>
              <p className="font-mono text-xs text-ink-muted">
                Firmado: {new Date(signature.signedAt).toISOString()}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={!verdict}
        className="block w-full rounded-sm border border-line bg-void px-4 py-2 text-left text-sm font-medium text-ink hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
      >
        Descargar reporte de auditoria (JSON)
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={!verdict}
        className="block w-full rounded-sm border border-line bg-void px-4 py-2 text-left text-sm font-medium text-ink hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
      >
        Descargar reporte de auditoria (PDF)
      </button>

      {error && <p className="text-sm text-signal-bad">{error}</p>}
    </div>
  );
}
