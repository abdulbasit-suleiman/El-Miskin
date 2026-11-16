"use client";

import { useState } from "react";
import { getAuthToken, NETWORK_ERROR } from "@/lib/api-client";
import { codesToCsv } from "@/lib/code-utils";
import { clientBaseUrl } from "@/lib/app-url";
import { base64ToBytes, buildZip, textBytes } from "@/lib/zip-builder";

type Kind = "csv" | "zip";

const RETRY_DELAY_MS = 700;
/** QR images per request. Keeps every call far below the serverless limit. */
const CHUNK_LIMIT = 25;

/** A message from the server, which must not be retried. */
class ExportError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads one export request. Cold functions and dropped connections are common
 * enough on serverless hosting that a single retry with a fresh token is worth
 * it before an error is shown.
 */
async function authorizedFetch(path: string): Promise<Response> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const token = await getAuthToken();
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.ok) return res;

      const retryable = res.status === 502 || res.status === 503 || res.status === 504;
      if (retryable && attempt === 1) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new ExportError(data?.error ?? `Download failed (${res.status})`);
    } catch (err) {
      if (err instanceof ExportError) throw err;
      if (attempt === 2) throw new ExportError(NETWORK_ERROR);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw new ExportError(NETWORK_ERROR);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function filenameFrom(res: Response, fallback: string): string {
  const match = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

/**
 * Downloads a batch export with a visible loading state.
 *
 * The QR archive is assembled in this browser from pages of images, because
 * generating all of them in one serverless request takes longer than the
 * function is allowed to live on large batches, and the download then dies
 * with "Failed to fetch".
 */
export default function DownloadButtons({ batchId }: { batchId: string }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function downloadCsv() {
    const res = await authorizedFetch(
      `/api/download/csv?batchId=${encodeURIComponent(batchId)}`
    );
    const blob = await res.blob();
    saveBlob(blob, filenameFrom(res, `codes-${batchId}.csv`));
  }

  async function downloadZip() {
    const files: { name: string; data: Uint8Array }[] = [];
    const rows: { code: string; status: string }[] = [];
    let cursor = "";
    let total = 0;

    for (let page = 0; page < 1000; page++) {
      const params = new URLSearchParams({ batchId, limit: String(CHUNK_LIMIT) });
      if (cursor) params.set("cursor", cursor);

      const res = await authorizedFetch(`/api/download/qr-chunk?${params.toString()}`);
      const data = (await res.json()) as {
        codes: { code: string; status: string; png: string }[];
        total: number;
        nextCursor: string | null;
      };

      total = data.total ?? total;
      for (const row of data.codes) {
        files.push({ name: `QR-${row.code}.png`, data: base64ToBytes(row.png) });
        rows.push({ code: row.code, status: row.status });
      }
      setProgress({ done: rows.length, total });

      if (data.codes.length === 0) break;
      if (!data.nextCursor) break;
      // Stop on the exact last code instead of asking for an empty page.
      if (total > 0 && rows.length >= total) break;
      cursor = data.nextCursor;
    }

    // The CSV inside the archive uses the same public URL the browser is on.
    files.push({
      name: `codes-${batchId}.csv`,
      data: textBytes(codesToCsv(rows, clientBaseUrl())),
    });

    const zip = buildZip(files);
    saveBlob(new Blob([zip], { type: "application/zip" }), `QR-codes-${batchId}.zip`);
  }

  async function download(kind: Kind) {
    setBusy(kind);
    setError(null);
    setProgress(null);
    try {
      if (kind === "csv") await downloadCsv();
      else await downloadZip();
    } catch (e) {
      setError((e as Error)?.message ?? "Download failed.");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  const base =
    "rounded-lg px-3 py-1.5 text-sm font-medium shadow-sm ring-1 transition disabled:opacity-60";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => download("csv")}
          disabled={busy !== null}
          className={`${base} bg-white text-slate-700 ring-slate-200 hover:bg-slate-50`}
        >
          {busy === "csv" ? "Preparing…" : "CSV"}
        </button>
        <button
          type="button"
          onClick={() => download("zip")}
          disabled={busy !== null}
          className={`${base} bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50`}
        >
          {busy === "zip" ? "Building ZIP…" : "QR images (ZIP)"}
        </button>
      </div>
      {busy === "zip" && (
        <p className="mt-1 text-xs text-slate-500">
          {progress && progress.total > 0
            ? `Generating QR images: ${progress.done} of ${progress.total}`
            : "Preparing QR images. This can take a few seconds for large batches."}
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
