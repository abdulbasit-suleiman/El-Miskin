"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api-client";
import { hoursUntilPurge, purgeDeadlineLabel } from "@/lib/deletion";

interface PendingProduct {
  id: string;
  name: string;
  prefix: string;
  totalCodes: number;
  deletionScheduledAt: number | null;
  purgeAt: number;
}

const emptyPurge = { openId: null as string | null, typed: "" };

export default function PendingDeletionsPage() {
  const [items, setItems] = useState<PendingProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [purgeForm, setPurgeForm] = useState(emptyPurge);

  const load = useCallback(async () => {
    try {
      const data = await apiGet("/api/products/pending");
      setItems(data.pending as PendingProduct[]);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message ?? "Could not load pending deletions.");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function restore(item: PendingProduct) {
    setBusy(item.id);
    setNotice(null);
    try {
      const { data } = await apiPost(`/api/products/${item.id}/restore`, {});
      setNotice(data.message ?? `"${item.name}" is active again.`);
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? "Could not restore this product.");
    } finally {
      setBusy(null);
    }
  }

  async function purgeNow(item: PendingProduct) {
    setBusy(item.id);
    setNotice(null);
    try {
      await apiPost(`/api/products/${item.id}/purge`, { confirmName: purgeForm.typed.trim() });
      setNotice(`"${item.name}" was deleted permanently.`);
      setPurgeForm(emptyPurge);
      await load();
    } catch (err) {
      setError((err as Error)?.message ?? "Could not delete this product.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          Back to products
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Pending deletion</h1>
        <p className="mx-auto mt-1 max-w-2xl text-sm text-slate-600">
          A deleted product waits here for 48 hours. During that time you can restore it, codes,
          batches and scan records included. When the 48 hours are over the product is removed
          permanently and cannot be recovered.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Products waiting to be deleted</h2>

        {items === null ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Nothing is waiting for deletion. Products you delete show up here for 48 hours.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {items.map((item) => {
              const hoursLeft = hoursUntilPurge(item.purgeAt);
              const confirming = purgeForm.openId === item.id;
              return (
                <li key={item.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {item.name}{" "}
                        <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                          {item.prefix}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {item.totalCodes} codes, deleted{" "}
                        {item.deletionScheduledAt
                          ? new Date(item.deletionScheduledAt).toLocaleString()
                          : "recently"}
                      </p>
                      <p className="text-xs font-medium text-red-700">
                        Permanently deletes on {purgeDeadlineLabel(item.purgeAt)}, about{" "}
                        {hoursLeft} hour{hoursLeft === 1 ? "" : "s"} from now
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => restore(item)}
                        disabled={busy === item.id}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy === item.id && !confirming ? "Restoring…" : "Restore"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPurgeForm(
                            confirming ? emptyPurge : { openId: item.id, typed: "" }
                          );
                          setNotice(null);
                        }}
                        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
                      >
                        {confirming ? "Cancel" : "Delete now"}
                      </button>
                    </div>
                  </div>

                  {confirming && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                      <label
                        htmlFor={`confirm-${item.id}`}
                        className="block text-sm font-medium text-red-900"
                      >
                        This skips the remaining {hoursLeft} hour
                        {hoursLeft === 1 ? "" : "s"} and cannot be undone. Type{" "}
                        <span className="font-mono">{item.name}</span> to confirm.
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          id={`confirm-${item.id}`}
                          type="text"
                          value={purgeForm.typed}
                          onChange={(e) =>
                            setPurgeForm({ openId: item.id, typed: e.target.value })
                          }
                          autoComplete="off"
                          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                        />
                        <button
                          type="button"
                          onClick={() => purgeNow(item)}
                          disabled={busy === item.id || purgeForm.typed.trim() !== item.name}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy === item.id ? "Deleting…" : "Delete permanently"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        A daily background job removes anything whose 48 hours have passed, so a product cannot
        stay in this list by accident.
      </p>
    </div>
  );
}
