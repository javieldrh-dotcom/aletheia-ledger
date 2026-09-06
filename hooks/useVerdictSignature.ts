"use client";

import { useCallback, useState } from "react";
import {
  generateSigningKeyPair,
  signVerdictHash,
  type SigningKeyPair,
  type VerdictSignature,
} from "@/lib/audit/signature";

interface UseVerdictSignatureResult {
  keyPair: SigningKeyPair | null;
  signature: VerdictSignature | null;
  isSigning: boolean;
  error: string | null;
  generateKeys: () => Promise<void>;
  signVerdict: (finalLedgerHash: string) => Promise<void>;
}

export function useVerdictSignature(): UseVerdictSignatureResult {
  const [keyPair, setKeyPair] = useState<SigningKeyPair | null>(null);
  const [signature, setSignature] = useState<VerdictSignature | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateKeys = useCallback(async () => {
    setError(null);
    try {
      const pair = await generateSigningKeyPair();
      setKeyPair(pair);
      setSignature(null);
    } catch {
      setError("No se pudo generar el par de llaves de firma.");
    }
  }, []);

  const signVerdict = useCallback(
    async (finalLedgerHash: string) => {
      if (!keyPair) {
        setError("Genera primero un par de llaves antes de firmar.");
        return;
      }

      setIsSigning(true);
      setError(null);

      try {
        const { signatureHex, payloadHash } = await signVerdictHash(
          keyPair.privateKey,
          finalLedgerHash
        );

        setSignature({
          signatureHex,
          publicKeyFingerprint: keyPair.publicKeyFingerprint,
          signedPayloadHash: payloadHash,
          signedAt: Date.now(),
        });
      } catch {
        setError("No se pudo firmar el veredicto.");
      } finally {
        setIsSigning(false);
      }
    },
    [keyPair]
  );

  return { keyPair, signature, isSigning, error, generateKeys, signVerdict };
}