"use client";

import { useState } from "react";
import { getAuthToken, NETWORK_ERROR } from "@/lib/api-client";

type Kind = "csv" | "zip";

const RETRY_DELAY_MS = 700;

/** A message from the server, which must not be retried. */
class ExportError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads one export. The first request after a deploy can land on a cold
 * function or be dropped by the network, so it is retried once with a fresh
 * token before an error is shown.
 */
async function fetchExport(batchId: string, kind: Kind): Promise<Response> {
  const url = `/api/download/${kind}?batchId=${encodeURIComponent(batchId)}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const token = await getAuthToken();
      const res = await fetch(url, {
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

/**
 * Downloads a batch export with a visible loading state. The file is fetched
 * with the fresh ID token in the Authorization header (no expiring links),
 * then saved as a blob. That is the same flow browsers use for large downloads.
 */
export default function DownloadButtons({ batchId }: { batchId: string }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: Kind) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetchExport(batchId, kind);
      const blob = await res.blob();
      const match = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `batch-${batchId}.${kind}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError((e as Error)?.message ?? "Download failed.");
    } finally {
      setBusy(null);
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
          Generating QR images. This can take a few seconds for large batches.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
