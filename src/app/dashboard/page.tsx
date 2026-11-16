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

export default function OverviewPage() {
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

  // Products scheduled for deletion drop out of the overview right away.
  const activeProducts = (products ?? []).filter((p) => !p.purgeAt);

  const totals = activeProducts.reduce(
    (acc, p) => ({
      totalCodes: acc.totalCodes + (p.stats?.totalCodes ?? 0),
      genuineScans: acc.genuineScans + (p.stats?.genuineScans ?? 0),
      repeatScans: acc.repeatScans + (p.stats?.repeatScans ?? 0),
      invalidAttempts: acc.invalidAttempts + (p.stats?.invalidAttempts ?? 0),
    }),
    { totalCodes: 0, genuineScans: 0, repeatScans: 0, invalidAttempts: 0 }
  );

  if (accountError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {accountError}
      </div>
    );
  }

  const loading = accountLoading || products === null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-slate-500">
          {account ? `Signed in as ${account.name} (${account.role}).` : "Your products and scan activity."}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Products", value: totals ? activeProducts.length : "…" },
          { label: "Codes generated", value: totals.totalCodes },
          { label: "Genuine scans", value: totals.genuineScans },
          { label: "Repeat scans", value: totals.repeatScans },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{loading ? "…" : s.value}</p>
          </div>
        ))}
      </div>

      {!loading && products && activeProducts.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
          <h2 className="font-semibold text-emerald-900">Create your first product</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-emerald-800">
            Choose a product name and the code prefix that will appear on every QR code
            generated for it.
          </p>
          <Link
            href="/dashboard/products/new"
            className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Create product
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Products</h2>
            <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
              View all
            </Link>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">Loading products…</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {activeProducts.slice(0, 5).map((p) => (
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
                        {p.stats?.genuineScans ?? 0} genuine · {p.stats?.repeatScans ?? 0} repeat ·{" "}
                        {p.stats?.invalidAttempts ?? 0} invalid
                      </p>
                    </div>
                    <span className="text-sm text-emerald-600">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
