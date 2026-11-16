"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api-client";

const PREFIX_PATTERN = /^[A-Z0-9]{2,12}$/;

/**
 * Two-step product creation: enter the details, then confirm them on a
 * summary screen before anything is written to the database.
 */
export default function NewProductPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "confirm">("details");
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length > 0 && name.trim().length <= 60;
  const prefixOk = PREFIX_PATTERN.test(prefix);

  function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (nameOk && prefixOk) setStep("confirm");
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiPost("/api/products", { name: name.trim(), prefix });
      router.replace(`/dashboard/products/${data.id}`);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to create product.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/dashboard/products" className="text-sm text-emerald-700 underline">
          ← All products
        </Link>
        <h1 className="mt-1 text-2xl font-bold">New product</h1>
        <p className="text-sm text-slate-500">
          Step {step === "details" ? "1" : "2"} of 2:{" "}
          {step === "details" ? "product details" : "confirm before creating"}
        </p>
      </div>

      {step === "details" && (
        <form
          onSubmit={handleContinue}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
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
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Milo"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="mt-4">
            <label htmlFor="prefix" className="block text-sm font-medium text-slate-700">
              Code prefix (2-12 letters or numbers)
            </label>
            <input
              id="prefix"
              type="text"
              required
              maxLength={12}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="e.g. ML"
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Every code for this product starts with{" "}
              <code className="font-mono">{prefix || "XX"}-</code>. The prefix must be unique
              within your account.
            </p>
          </div>

          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={!nameOk || !prefixOk}
            className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      )}

      {step === "confirm" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold">Confirm product name and prefix</h2>
          <p className="mt-1 text-sm text-slate-600">
            This will be used on every code generated for this product:
          </p>

          <dl className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Product name</dt>
              <dd className="font-medium">{name.trim()}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Code prefix</dt>
              <dd className="rounded bg-white px-2 py-0.5 font-mono font-medium">{prefix}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-slate-500">Codes will look like</dt>
              <dd className="font-mono text-sm text-slate-600">{prefix}-7Kx2pQ9mL4Tz8Rb</dd>
            </div>
          </dl>

          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Check the spelling carefully. The name and prefix appear on every generated QR code.
            You can edit them later in product settings, but codes you have already printed keep
            their old prefix.
          </p>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={loading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Creating…" : "Confirm & create product"}
            </button>
            <button
              type="button"
              onClick={() => setStep("details")}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Back and edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
