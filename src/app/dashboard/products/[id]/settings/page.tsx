"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase-client";
import { apiPatch } from "@/lib/api-client";
import DeleteProductZone from "@/components/DeleteProductZone";
import type { ProductDoc } from "@/lib/types";

const PREFIX_PATTERN = /^[A-Z0-9]{2,12}$/;

/** Product settings: rename the product or change its code prefix. */
export default function ProductSettingsPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [original, setOriginal] = useState<(ProductDoc & { id: string }) | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!productId) return;
    getDoc(doc(getClientDb(), "products", productId))
      .then((snap) => {
        if (!snap.exists()) {
          setLoadError("Product not found.");
          return;
        }
        const data = { id: snap.id, ...(snap.data() as ProductDoc) };
        setOriginal(data);
        setName(data.name);
        setPrefix(data.prefix);
      })
      .catch((err) => setLoadError(`Could not load product: ${err.message}`));
  }, [productId]);

  const prefixChanged = original !== null && prefix !== original.prefix;
  const nameChanged = original !== null && name.trim() !== original.name;
  const valid = name.trim().length > 0 && name.trim().length <= 60 && PREFIX_PATTERN.test(prefix);
  const dirty = prefixChanged || nameChanged;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await apiPatch(`/api/products/${productId}`, {
        name: name.trim(),
        prefix,
      });
      setOriginal((prev) => (prev ? { ...prev, name: updated.name, prefix: updated.prefix } : prev));
      setSaved(true);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-2">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          Back to products
        </Link>
      </div>
    );
  }

  if (!original) {
    return <p className="text-slate-500">Loading product…</p>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href={`/dashboard/products/${productId}`}
          className="text-sm text-emerald-700 underline"
        >
          ← Back to {original.name}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Product settings</h1>
        <p className="text-sm text-slate-500">
          {original.stats?.totalCodes ?? 0} codes already generated for this product.
        </p>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700">
            Product name
          </label>
          <input
            id="name"
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="prefix" className="block text-sm font-medium text-slate-700">
            Code prefix
          </label>
          <input
            id="prefix"
            type="text"
            required
            maxLength={12}
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setSaved(false);
            }}
            className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {prefixChanged && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Changing the prefix from <code className="font-mono">{original.prefix}</code> to{" "}
            <code className="font-mono">{prefix}</code> only affects codes generated from now on.
            Codes that were already generated and printed keep their old prefix.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {saved && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Settings saved.
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !dirty || !valid}
          className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <DeleteProductZone
        productId={productId}
        productName={original.name}
        totalCodes={original.stats?.totalCodes ?? 0}
      />
    </div>
  );
}
