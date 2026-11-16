import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import type { ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/products/[id]/restore
 * Cancels a scheduled deletion while the 48 hour grace period is running.
 * Calling it on a product that is not scheduled is a harmless no-op.
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

    if (!product.purgeAt) {
      return NextResponse.json({
        id: params.id,
        name: product.name,
        restored: false,
        message: "This product is not scheduled for deletion.",
      });
    }

    await ref.set(
      {
        purgeAt: FieldValue.delete(),
        deletionScheduledAt: FieldValue.delete(),
        deletedBy: FieldValue.delete(),
      },
      { merge: true }
    );

    return NextResponse.json({
      id: params.id,
      name: product.name,
      restored: true,
      message: "Deletion cancelled. The product is active again.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
