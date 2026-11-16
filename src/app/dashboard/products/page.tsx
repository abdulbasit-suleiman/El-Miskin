"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase-client";
import { useDashboard } from "@/components/DashboardProvider";
import type { ProductDoc } from "@/lib/types";

interface Product extends ProductDoc {
  id: string;
}

export default function ProductsPage() {
  const { account, loading: accountLoading, error: accountError } = useDashboard();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    const q = query(
      collection(getClientDb(), "products"),
      where("manufacturerId", "==", account.ownerId),
      limit(100)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }));
        list.sort((a, b) => b.createdAt - a.createdAt);
        setProducts(list);
        setError(null);
      },
      (err) => setError(`Could not load products: ${err.message}`)
    );
    return unsub;
  }, [account]);

  const all = products ?? [];
  const active = all.filter((p) => !p.purgeAt);
  const pendingCount = all.length - active.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">Create products and manage their QR codes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/products/pending"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Pending deletion{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Link>
          <Link
            href="/dashboard/products/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            New product
          </Link>
        </div>
      </div>

      {accountError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{accountError}</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Your products</h2>
        {accountLoading || products === null ? (
          <p className="mt-3 text-sm text-slate-500">Loading products…</p>
        ) : active.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">
            {pendingCount > 0
              ? "Every product is waiting to be deleted. Open Pending deletion to restore one."
              : "No products yet."}{" "}
            {pendingCount === 0 && (
              <>
                <Link href="/dashboard/products/new" className="text-emerald-700 underline">
                  Create your first product
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {active.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/products/${p.id}`}
                  className="flex items-center justify-between gap-3 py-3 transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium">
                      {p.name}{" "}
                      <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">
                        {p.prefix}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.stats?.totalCodes ?? 0} codes, created{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm text-emerald-600">Stats and codes</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
