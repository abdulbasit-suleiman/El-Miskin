"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase-client";
import { verifyUrl } from "@/lib/code-utils";
import { batchDisplayName } from "@/lib/batch-name";
import DownloadButtons from "./DownloadButtons";
import type { BatchDoc, CodeDoc } from "@/lib/types";

interface Batch extends BatchDoc {
  id: string;
}

interface CodeRow extends CodeDoc {
  id: string;
}

const CODES_PAGE = 24;
const BATCH_LIMIT = 100;

/**
 * Live list of batches for a product. Queries use equality filters only
 * (no composite index required) and sort client-side; codes are paginated.
 */
export default function BatchList({ productId }: { productId: string }) {
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);

  useEffect(() => {
    const q = query(
      collection(getClientDb(), "batches"),
      where("productId", "==", productId),
      limit(BATCH_LIMIT)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as BatchDoc) }));
        list.sort((a, b) => b.createdAt - a.createdAt);
        setBatches(list);
        setError(null);
      },
      (err) => setError(`Could not load batches: ${err.message}`)
    );
    return unsub;
  }, [productId]);

  async function loadCodes(batchId: string, after: QueryDocumentSnapshot<DocumentData> | null) {
    setLoadingCodes(true);
    try {
      let q = query(
        collection(getClientDb(), "codes"),
        where("batchId", "==", batchId),
        limit(CODES_PAGE)
      );
      if (after) q = query(q, startAfter(after));
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CodeDoc) }));
      setCodes((prev) => (after ? [...prev, ...rows] : rows));
      setCursor(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length === CODES_PAGE);
      setError(null);
    } catch (err) {
      setError(`Could not load codes: ${(err as Error).message}`);
    } finally {
      setLoadingCodes(false);
    }
  }

  function toggleBatch(batchId: string) {
    if (expanded === batchId) {
      setExpanded(null);
      setCodes([]);
      return;
    }
    setExpanded(batchId);
    setCodes([]);
    setCursor(null);
    setHasMore(false);
    void loadCodes(batchId, null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Batches</h2>
      <p className="mt-1 text-sm text-slate-600">
        Every generation run creates one batch of codes.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {batches === null ? (
        <p className="mt-4 text-sm text-slate-500">Loading batches…</p>
      ) : batches.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No batches yet. Generate codes above to create the first one.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {batches.map((batch) => (
            <li key={batch.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => toggleBatch(batch.id)}
                  className="flex items-center gap-2 text-left"
                >
                  <span className="text-sm text-slate-400">
                    {expanded === batch.id ? "▾" : "▸"}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {batch.name || batchDisplayName(batch.productName ?? "", batch.createdAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {batch.quantity} codes, {new Date(batch.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400">
                      Batch id <code className="font-mono">{batch.id.slice(0, 10)}…</code>
                    </p>
                  </div>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/batches/${batch.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Open batch
                  </Link>
                  <DownloadButtons batchId={batch.id} />
                </div>
              </div>

              {expanded === batch.id && (
                <div className="mt-3">
                  {loadingCodes && codes.length === 0 ? (
                    <p className="text-sm text-slate-500">Loading codes…</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {codes.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/qr?code=${encodeURIComponent(c.id)}&size=128`}
                            alt={`QR code for ${c.id}`}
                            width={64}
                            height={64}
                            loading="lazy"
                            className="shrink-0 rounded"
                          />
                          <div className="min-w-0">
                            <code className="block truncate font-mono text-xs">{c.id}</code>
                            <span
                              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.status === "valid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.status === "scanned"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                              }`}
                            >
                              {c.status}
                              {c.scanCount > 0
                                ? `, ${c.scanCount} scan${c.scanCount > 1 ? "s" : ""}`
                                : ""}
                            </span>
                            <Link
                              href={verifyUrl(c.id)}
                              target="_blank"
                              className="block text-xs text-emerald-700 underline"
                            >
                              Open verify page
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => loadCodes(batch.id, cursor)}
                      disabled={loadingCodes}
                      className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {loadingCodes ? "Loading…" : "Load more codes"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
