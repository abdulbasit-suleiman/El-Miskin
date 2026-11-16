"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase-client";
import StatsChart from "@/components/StatsChart";
import GenerateCodesForm from "@/components/GenerateCodesForm";
import BatchList from "@/components/BatchList";
import { purgeDeadlineLabel } from "@/lib/deletion";
import type { ProductDoc } from "@/lib/types";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [product, setProduct] = useState<(ProductDoc & { id: string }) | null | "loading">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    // Live subscription. Stats update in real time as codes are scanned.
    const unsub = onSnapshot(
      doc(getClientDb(), "products", productId),
      (snap) => {
        if (!snap.exists()) {
          setProduct(null);
          return;
        }
        setProduct({ id: snap.id, ...(snap.data() as ProductDoc) });
      },
      (err) => setError(`Could not load product: ${err.message}`)
    );
    return unsub;
  }, [productId]);

  if (error) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          Back to products
        </Link>
      </div>
    );
  }

  if (product === "loading") {
    return <p className="text-slate-500">Loading product…</p>;
  }
  if (product === null) {
    return (
      <div>
        <p className="text-slate-600">Product not found.</p>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          Back to products
        </Link>
      </div>
    );
  }

  const stats = product.stats ?? {
    totalCodes: 0,
    genuineScans: 0,
    repeatScans: 0,
    invalidAttempts: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          ← All products
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">
            {product.name}{" "}
            <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-600">
              {product.prefix}
            </span>
          </h1>
          <Link
            href={`/dashboard/products/${product.id}/settings`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Product settings
          </Link>
        </div>
        <p className="text-sm text-slate-500">
          Stats update live as codes are scanned. Try it in another tab.
        </p>
      </div>

      {product.purgeAt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-900">Scheduled for deletion</h2>
          <p className="mt-1 text-sm text-amber-900">
            This product and its codes are removed permanently on{" "}
            {purgeDeadlineLabel(product.purgeAt)}. Until then it stays out of your product list and
            out of search, and nothing has been erased yet.
          </p>
          <Link
            href="/dashboard/products/pending"
            className="mt-3 inline-block rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            Open pending deletion
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total codes generated", value: stats.totalCodes },
          { label: "First-time genuine scans", value: stats.genuineScans },
          { label: "Repeated scans", value: stats.repeatScans },
          { label: "Invalid attempts", value: stats.invalidAttempts },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Scans per week (last 8 weeks)</h2>
        <div className="mt-4">
          <StatsChart weeklyScans={product.weeklyScans ?? {}} />
        </div>
      </div>

      <GenerateCodesForm productId={product.id} />
      <BatchList productId={product.id} />
    </div>
  );
}
