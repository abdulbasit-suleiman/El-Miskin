"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/api-client";

interface CodeHit {
  code: string;
  status: string;
  scanCount: number;
  firstScannedAt: number | null;
  productId: string;
  productName: string;
  batchId: string;
}

interface BatchHit {
  id: string;
  name: string;
  productId: string;
  productName: string;
  quantity: number;
  createdAt: number;
}

interface ProductHit {
  id: string;
  name: string;
  prefix: string;
  totalCodes: number;
}

interface SearchResponse {
  query: string;
  codes: CodeHit[];
  batches: BatchHit[];
  products: ProductHit[];
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading search results…</p>}>
      <SearchResults />
    </Suspense>
  );
}

function statusLabel(status: string): string {
  if (status === "scanned") return "Already used";
  if (status === "flagged") return "Flagged";
  return "Valid and unused";
}

function statusClasses(status: string): string {
  if (status === "scanned") return "bg-amber-100 text-amber-800";
  if (status === "flagged") return "bg-red-100 text-red-800";
  return "bg-emerald-100 text-emerald-800";
}

function SearchResults() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet(`/api/search?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!cancelled) setData(res as SearchResponse);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message ?? "Search failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (query.length < 2) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="mt-2 text-sm text-slate-600">
          Type at least two characters. You can search for a full code such as
          ML-7X9K2P4Q3mR8vT1s, a batch id, or a product name.
        </p>
      </div>
    );
  }

  const codes = data?.codes ?? [];
  const batches = data?.batches ?? [];
  const products = data?.products ?? [];
  const empty = !loading && !error && codes.length === 0 && batches.length === 0 && products.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search results</h1>
        <p className="text-sm text-slate-500">
          Showing matches for <span className="font-mono">{query}</span> in your own account.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-slate-500">Searching…</p>}

      {empty && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold">No results found</h2>
          <p className="mt-2 text-sm text-slate-600">
            Nothing in your account matches this search. Check the spelling, or search
            by product name to see all of its batches.
          </p>
        </div>
      )}

      {codes.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Codes</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {codes.map((hit) => (
              <li key={hit.code} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <code className="block truncate font-mono text-sm">{hit.code}</code>
                    <p className="mt-1 text-xs text-slate-500">
                      {hit.productName || "Unknown product"}
                      {hit.firstScannedAt
                        ? `, first scanned ${new Date(hit.firstScannedAt).toLocaleString()}`
                        : ", never scanned"}
                      {`, ${hit.scanCount} scan${hit.scanCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(hit.status)}`}
                  >
                    {statusLabel(hit.status)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {hit.batchId && (
                    <Link
                      href={`/dashboard/batches/${hit.batchId}`}
                      className="text-emerald-700 underline"
                    >
                      Open batch
                    </Link>
                  )}
                  {hit.productId && (
                    <Link
                      href={`/dashboard/products/${hit.productId}`}
                      className="text-emerald-700 underline"
                    >
                      Open product
                    </Link>
                  )}
                  <a
                    href={`/verify/${encodeURIComponent(hit.code)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 underline"
                  >
                    Open verify page
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {batches.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Batches</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {batches.map((batch) => (
              <li key={batch.id}>
                <Link
                  href={`/dashboard/batches/${batch.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {batch.name || batch.productName || "Batch"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {batch.quantity} codes, created{" "}
                      {new Date(batch.createdAt).toLocaleString()}, id{" "}
                      <span className="font-mono">{batch.id.slice(0, 10)}</span>
                    </p>
                  </div>
                  <span className="text-sm text-emerald-600">Open batch</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {products.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Products</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {products.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/dashboard/products/${product.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {product.name}{" "}
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                        {product.prefix}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {product.totalCodes} codes generated
                    </p>
                  </div>
                  <span className="text-sm text-emerald-600">Open product</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
