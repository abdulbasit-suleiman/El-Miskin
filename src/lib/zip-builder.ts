// Client-safe helpers for assembling the QR ZIP in the browser.
// Building it on the server meant one long request per batch: a 600 code batch
// needs about 30 seconds of QR encoding, which outlives the serverless limit
// and the browser reports a dropped connection ("Failed to fetch").
import { strToU8, zipSync } from "fflate";

/** Decodes the base64 PNG returned by /api/download/qr-chunk. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Zips the files in memory. QR PNGs are already compressed, so the archive is
 * stored without deflating: it is much faster and barely larger. Returns a
 * plain ArrayBuffer, which is what Blob accepts.
 */
export function buildZip(files: { name: string; data: Uint8Array }[]): ArrayBuffer {
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) entries[file.name] = file.data;
  const zipped = zipSync(entries, { level: 0 });
  const out = new ArrayBuffer(zipped.byteLength);
  new Uint8Array(out).set(zipped);
  return out;
}

export function textBytes(text: string): Uint8Array {
  return strToU8(text);
}
