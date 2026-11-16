"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiDelete } from "@/lib/api-client";
import { PRODUCT_GRACE_HOURS, purgeDeadlineLabel } from "@/lib/deletion";

interface Props {
  productId: string;
  productName: string;
  totalCodes: number;
}

function randomToken(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Three progressive confirmation gates before a product can be deleted.
 * Each gate unlocks only after the previous one is satisfied exactly.
 */
export default function DeleteProductZone({ productId, productName, totalCodes }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");

  const [nameEntry, setNameEntry] = useState("");
  const [phraseEntry, setPhraseEntry] = useState("");
  const [tokenEntry, setTokenEntry] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<{ purgeAt: number; codes: number } | null>(null);

  useEffect(() => {
    setToken(randomToken());
  }, []);

  const phrase = `DELETE ${productName}`;

  const nameOk = nameEntry.trim() === productName;
  const phraseOk = phraseEntry.trim() === phrase;
  const tokenOk = token.length > 0 && tokenEntry.trim().toUpperCase() === token;
  const ready = nameOk && phraseOk && tokenOk;

  async function handleDelete() {
    if (!ready) return;
    const finalCheck = window.confirm(
      `Last check. Delete "${productName}"? It stays recoverable for ${PRODUCT_GRACE_HOURS} hours and is then removed permanently.`
    );
    if (!finalCheck) return;

    setDeleting(true);
    setError(null);
    try {
      const result = await apiDelete(`/api/products/${productId}`, { confirmName: productName });
      setScheduled({
        purgeAt: result.purgeAt as number,
        codes: result.codes as number,
      });
    } catch (err) {
      setError((err as Error)?.message ?? "Could not delete this product.");
    } finally {
      setDeleting(false);
    }
  }

  function reset() {
    setOpen(false);
    setNameEntry("");
    setPhraseEntry("");
    setTokenEntry("");
    setError(null);
    setScheduled(null);
    setToken(randomToken());
  }

  if (scheduled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h2 className="font-semibold text-amber-900">Deletion scheduled</h2>
        <p className="mt-2 text-sm text-amber-900">
          {`"${productName}" and its ${scheduled.codes} codes will be permanently deleted on `}
          <span className="font-semibold">{purgeDeadlineLabel(scheduled.purgeAt)}</span>
          {`, which is ${PRODUCT_GRACE_HOURS} hours from now.`}
        </p>
        <p className="mt-2 text-sm text-amber-900">
          Until then the product is hidden from your product list and from search, but nothing has
          been erased yet. Open Pending deletion to restore it, or to delete it right away.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/products/pending")}
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            Open pending deletion
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/products")}
            className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-red-700">Delete this product</h2>
      <p className="mt-1 text-sm text-slate-600">
        Deleting hides the product right away and keeps it recoverable for {PRODUCT_GRACE_HOURS}{" "}
        hours. When that window ends the product, its batches, its codes and their scan records are
        removed for good.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          Start the delete checks
        </button>
      ) : (
        <div className="mt-4 space-y-5">
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {totalCodes} codes belong to this product. You need to pass three checks before the
            delete request can be sent.
          </p>

          <div>
            <label htmlFor="confirm-name" className="block text-sm font-medium text-slate-700">
              Check 1 of 3. Type the product name exactly
            </label>
            <p className="text-xs text-slate-500">
              Copy it character for character: <span className="font-mono">{productName}</span>
            </p>
            <input
              id="confirm-name"
              type="text"
              value={nameEntry}
              onChange={(e) => setNameEntry(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            {nameEntry.length > 0 && (
              <p className={`mt-1 text-xs ${nameOk ? "text-emerald-700" : "text-red-700"}`}>
                {nameOk ? "The name matches." : "The name does not match yet."}
              </p>
            )}
          </div>

          <div className={nameOk ? "" : "opacity-50"}>
            <label htmlFor="confirm-phrase" className="block text-sm font-medium text-slate-700">
              Check 2 of 3. Type DELETE followed by the product name
            </label>
            <p className="text-xs text-slate-500">
              The exact text is <span className="font-mono">{phrase}</span>
            </p>
            <input
              id="confirm-phrase"
              type="text"
              value={phraseEntry}
              onChange={(e) => setPhraseEntry(e.target.value)}
              disabled={!nameOk}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-slate-100"
            />
            {nameOk && phraseEntry.length > 0 && (
              <p className={`mt-1 text-xs ${phraseOk ? "text-emerald-700" : "text-red-700"}`}>
                {phraseOk ? "The phrase matches." : "The phrase does not match yet."}
              </p>
            )}
          </div>

          <div className={phraseOk ? "" : "opacity-50"}>
            <label htmlFor="confirm-token" className="block text-sm font-medium text-slate-700">
              Check 3 of 3. Type the confirmation code shown here
            </label>
            <p className="text-xs text-slate-500">
              Confirmation code: <span className="font-mono text-base tracking-widest">{token}</span>
            </p>
            <input
              id="confirm-token"
              type="text"
              value={tokenEntry}
              onChange={(e) => setTokenEntry(e.target.value.toUpperCase())}
              disabled={!phraseOk}
              autoComplete="off"
              maxLength={6}
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase tracking-widest focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:bg-slate-100"
            />
            {phraseOk && tokenEntry.length > 0 && (
              <p className={`mt-1 text-xs ${tokenOk ? "text-emerald-700" : "text-red-700"}`}>
                {tokenOk ? "The code matches." : "The code does not match yet."}
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!ready || deleting}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Permanently delete product"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={deleting}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {!ready && (
              <span className="text-xs text-slate-500">
                The delete button turns on after all three checks pass.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
