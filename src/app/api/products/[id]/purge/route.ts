import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { deleteProductTree } from "@/lib/product-delete";
import type { ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/[id]/purge
 * Skips the rest of the 48 hour grace period and deletes the product now,
 * with its batches, codes and scan logs. Still requires the exact product
 * name so the request cannot be sent by accident.
 * Body: { confirmName: string }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (confirmName !== product.name) {
      throw new ApiError(400, "The product name you typed does not match this product.");
    }

    const deleted = await deleteProductTree(params.id);

    return NextResponse.json({ id: params.id, name: product.name, deleted });
  } catch (e) {
    return handleApiError(e);
  }
}
