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

  if (!finalLedgerHash) return null;

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
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="mb-3 text-base font-medium text-zinc-300">
        Firma digital del veredicto (no repudio)
      </h3>

      {!keyPair && (
        <button
          onClick={() => void generateKeys()}
          className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Generar llaves de firma
        </button>
      )}

      {keyPair && (
        <div className="space-y-3">
          <p className="font-mono text-xs text-zinc-500">
            Huella de llave publica: {truncate(keyPair.publicKeyFingerprint)}
          </p>

          {!signature && (
            <button
              onClick={() => void signVerdict(finalLedgerHash)}
              disabled={isSigning}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isSigning ? "Firmando..." : "Firmar veredicto"}
            </button>
          )}

          {signature && (
            <div className="rounded-md border border-emerald-900 bg-emerald-950/30 p-3">
              <p className="mb-1 text-sm font-medium text-emerald-400">
                Veredicto firmado
              </p>
              <p className="font-mono text-xs text-zinc-500">
                Firma: {truncate(signature.signatureHex)}
              </p>
              <p className="font-mono text-xs text-zinc-500">
                Firmado: {new Date(signature.signedAt).toISOString()}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={!verdict}
        className="mt-4 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Descargar reporte de auditoria (JSON)
      </button>

      <button
        onClick={handleDownloadPdf}
        disabled={!verdict}
        className="mt-2 rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Descargar reporte de auditoria (PDF)
      </button>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}