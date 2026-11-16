import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { parseProductInput } from "@/lib/product-input";
import { PRODUCT_GRACE_MS } from "@/lib/deletion";
import type { ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/products/[id] — renames a product or changes its prefix.
 * Changing the prefix only affects codes generated from now on; codes that
 * were already generated/printed keep their old prefix.
 * Body: { name?, prefix? }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const db = adminDb();
    const ref = db.doc(`products/${params.id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(404, "Product not found.");

    const product = snap.data() as ProductDoc;
    if (product.manufacturerId !== ctx.ownerId) {
      throw new ApiError(403, "This product belongs to a different account.");
    }
    if (product.purgeAt) {
      throw new ApiError(
        409,
        "This product is scheduled for deletion. Restore it before making changes."
      );
    }

    const body = await req.json().catch(() => ({}));
    const next = parseProductInput({
      name: typeof body?.name === "string" ? body.name : product.name,
      prefix: typeof body?.prefix === "string" ? body.prefix : product.prefix,
    });

    if (next.prefix !== product.prefix) {
      const siblings = await db
        .collection("products")
        .where("manufacturerId", "==", ctx.ownerId)
        .get();
      const clash = siblings.docs.some(
        (d) => d.id !== params.id && d.data().prefix === next.prefix
      );
      if (clash) {
        throw new ApiError(409, `A product with prefix "${next.prefix}" already exists.`);
      }
    }

    await ref.set({ name: next.name, prefix: next.prefix }, { merge: true });

    return NextResponse.json({ id: params.id, ...product, ...next });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * DELETE /api/products/[id]
 * Schedules the product for deletion instead of removing it at once. The
 * product stays in a 48 hour grace period, during which the owner can
 * restore it, and the scheduled purge then removes the product with its
 * batches, codes and scan logs.
 * The caller must retype the exact product name, so a stray request cannot
 * schedule a deletion by accident.
 * Body: { confirmName: string }
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const db = adminDb();
    const ref = db.doc(`products/${params.id}`);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(404, "Product not found.");

    const product = snap.data() as ProductDoc;
    if (product.manufacturerId !== ctx.ownerId) {
      throw new ApiError(403, "This product belongs to a different account.");
    }

    const body = await req.json().catch(() => ({}));
    const confirmName = String(body?.confirmName ?? "").trim();
    if (!confirmName) {
      throw new ApiError(400, "Type the product name to confirm the deletion.");
    }
    if (confirmName !== product.name) {
      throw new ApiError(400, "The product name you typed does not match this product.");
    }

    if (product.purgeAt) {
      return NextResponse.json({
        id: params.id,
        name: product.name,
        scheduled: true,
        alreadyScheduled: true,
        deletionScheduledAt: product.deletionScheduledAt ?? null,
        purgeAt: product.purgeAt,
        codes: product.stats?.totalCodes ?? 0,
      });
    }

    const now = Date.now();
    const purgeAt = now + PRODUCT_GRACE_MS;
    await ref.set({ deletionScheduledAt: now, purgeAt, deletedBy: ctx.uid }, { merge: true });

    return NextResponse.json({
      id: params.id,
      name: product.name,
      scheduled: true,
      alreadyScheduled: false,
      deletionScheduledAt: now,
      purgeAt,
      codes: product.stats?.totalCodes ?? 0,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
