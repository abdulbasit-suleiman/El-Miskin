"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api-client";
import DownloadButtons from "./DownloadButtons";

interface GenerateResponse {
  batchId: string;
  quantity: number;
  saved: number;
  codes: string[];
}

/** Form to generate a new batch of codes for a product. */
export default function GenerateCodesForm({ productId }: { productId: string }) {
  const [quantity, setQuantity] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await apiPost("/api/generate-codes", {
        productId,
        quantity: parseInt(quantity, 10),
      });
      setResult(data as GenerateResponse);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to generate codes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Generate codes</h2>
      <p className="mt-1 text-sm text-slate-600">
        Creates a new batch of unique codes, saved to your database, with downloadable QR images.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">
            Quantity (1-1000)
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={1000}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Generating and saving…" : "Generate codes"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Codes were not generated: {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-4">
          <p className="text-sm font-medium text-emerald-900">
            Saved {result.saved} codes to the database (batch {result.batchId.slice(0, 8)}…).
          </p>
          <div className="mt-3">
            <DownloadButtons batchId={result.batchId} />
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-emerald-800 underline">
              Show the first 10 codes
            </summary>
            <ul className="mt-2 space-y-1">
              {result.codes.slice(0, 10).map((code) => (
                <li key={code} className="text-sm">
                  <code className="rounded bg-white px-2 py-0.5 font-mono text-xs">{code}</code>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
