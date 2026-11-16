"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase-client";
import { apiGet } from "@/lib/api-client";
import { verifyUrl } from "@/lib/code-utils";
import DownloadButtons from "@/components/DownloadButtons";
import type { CodeDoc } from "@/lib/types";

interface BatchDetail {
  batch: {
    id: string;
    name: string;
    productId: string;
    productName: string;
    quantity: number;
    createdAt: number;
  };
  product: { id: string; name: string; prefix: string } | null;
  counts: { valid: number; scanned: number; flagged: number; scans: number; total: number; truncated: boolean };
}

interface CodeRow extends CodeDoc {
  id: string;
}

const PAGE_SIZE = 50;

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const batchId = params.id;

  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [loadingCodes, setLoadingCodes] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    apiGet(`/api/batches/${batchId}`)
      .then((data) => {
        if (!cancelled) setDetail(data as BatchDetail);
      })
      .catch((err: Error) => {
        if (!cancelled) setDetailError(err?.message ?? "Could not load this batch.");
      });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const loadCodes = useCallback(
    async (after: QueryDocumentSnapshot<DocumentData> | null) => {
      if (!batchId) return;
      setLoadingCodes(true);
      try {
        let q = query(
          collection(getClientDb(), "codes"),
          where("batchId", "==", batchId),
          limit(PAGE_SIZE)
        );
        if (after) q = query(q, startAfter(after));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CodeDoc) }));
        setCodes((prev) => (after ? [...prev, ...rows] : rows));
        setCursor(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
        setHasMore(snap.docs.length === PAGE_SIZE);
        setCodesError(null);
      } catch (err) {
        setCodesError(`Could not load codes: ${(err as Error).message}`);
      } finally {
        setLoadingCodes(false);
      }
    },
    [batchId]
  );

  useEffect(() => {
    void loadCodes(null);
  }, [loadCodes]);

  if (detailError) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{detailError}</p>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          Back to products
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-slate-500">Loading batch…</p>;
  }

  const { batch, product, counts } = detail;
  const title = batch.name || batch.productName || "Batch";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/products/${batch.productId}`}
          className="text-sm text-emerald-700 underline"
        >
          Back to {product?.name ?? batch.productName}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          <DownloadButtons batchId={batch.id} />
        </div>
        <p className="text-sm text-slate-500">
          {batch.quantity} codes, created {new Date(batch.createdAt).toLocaleString()}, batch id{" "}
          <span className="font-mono">{batch.id}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Codes in batch", value: counts.total },
          { label: "Unused", value: counts.valid },
          { label: "Used", value: counts.scanned },
          { label: "Flagged", value: counts.flagged },
          { label: "Total scans", value: counts.scans },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      {counts.truncated && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This batch is very large, so the counts above cover the first {counts.total} codes.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Codes</h2>
          <p className="text-sm text-slate-500">
            {codes.length} of {counts.total} loaded
          </p>
        </div>

        {codesError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{codesError}</p>
        )}

        {codes.length === 0 && loadingCodes && (
          <p className="mt-3 text-sm text-slate-500">Loading codes…</p>
        )}

        {codes.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {codes.map((code) => (
              <div
                key={code.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/qr?code=${encodeURIComponent(code.id)}&size=128`}
                  alt={`QR code for ${code.id}`}
                  width={64}
                  height={64}
                  loading="lazy"
                  className="shrink-0 rounded"
                />
                <div className="min-w-0">
                  <code className="block truncate font-mono text-xs">{code.id}</code>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      code.status === "valid"
                        ? "bg-emerald-100 text-emerald-800"
                        : code.status === "scanned"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {code.status}
                    {code.scanCount > 0
                      ? `, ${code.scanCount} scan${code.scanCount > 1 ? "s" : ""}`
                      : ""}
                  </span>
                  <a
                    href={verifyUrl(code.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs text-emerald-700 underline"
                  >
                    Open verify page
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={() => loadCodes(cursor)}
            disabled={loadingCodes}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {loadingCodes ? "Loading…" : "Load more codes"}
          </button>
        )}
      </div>
    </div>
  );
}
