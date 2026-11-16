"use client";

import { useState } from "react";
import { getAuthToken } from "@/lib/api-client";

type Kind = "csv" | "zip";

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
      const token = await getAuthToken();
      const res = await fetch(`/api/download/${kind}?batchId=${encodeURIComponent(batchId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Download failed (${res.status})`);
      }
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
