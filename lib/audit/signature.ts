/**
 * Firma digital de veredictos usando ECDSA P-256 via Web Crypto API.
 * Genera el par de llaves client-side -- la llave privada nunca sale
 * del navegador. Esto da "no repudio": una vez firmado, es
 * matematicamente verificable que ese veredicto especifico fue
 * aprobado por el poseedor de esa llave, sobre esos datos exactos.
 * Es el equivalente digital de la firma de un auditor sobre un
 * estado financiero.
 */

export interface SigningKeyPair {
  readonly publicKey: CryptoKey;
  readonly privateKey: CryptoKey;
  readonly publicKeyFingerprint: string;
}

export interface VerdictSignature {
  readonly signatureHex: string;
  readonly publicKeyFingerprint: string;
  readonly signedPayloadHash: string;
  readonly signedAt: number;
}

async function sha256Hex(data: ArrayBuffer | string): Promise<string> {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateSigningKeyPair(): Promise<SigningKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const exportedPublicKey = await crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  const publicKeyFingerprint = await sha256Hex(exportedPublicKey);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyFingerprint,
  };
}

export async function signVerdictHash(
  privateKey: CryptoKey,
  finalLedgerHash: string
): Promise<{ signatureHex: string; payloadHash: string }> {
  const payload = JSON.stringify({
    finalLedgerHash,
    signedAt: Date.now(),
  });
  const payloadBytes = new TextEncoder().encode(payload);
  const payloadHash = await sha256Hex(payload);

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    payloadBytes
  );

  return {
    signatureHex: bufferToHex(signatureBuffer),
    payloadHash,
  };
}