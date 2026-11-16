import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { createBatchWithCodes } from "@/lib/batches";
import type { ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_QUANTITY = 1000;

/**
 * POST /api/generate-codes  { productId, quantity }
 * Creates a new batch with `quantity` unique crypto-random codes and saves
 * them to Firestore (server-side only). The response includes a read-back
 * verification (`saved`) so the UI can confirm the codes actually persisted.
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const body = await req.json().catch(() => ({}));
    const productId = String(body?.productId ?? "");
    const quantity = Number(body?.quantity);

    if (!productId) throw new ApiError(400, "productId is required.");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new ApiError(400, `Quantity must be an integer between 1 and ${MAX_QUANTITY}.`);
    }

    const db = adminDb();
    const productSnap = await db.doc(`products/${productId}`).get();
    if (!productSnap.exists) throw new ApiError(404, "Product not found.");

    const product = productSnap.data() as ProductDoc;
    if (product.manufacturerId !== ctx.ownerId) {
      throw new ApiError(403, "This product belongs to a different account.");
    }
    if (product.purgeAt) {
      throw new ApiError(
        409,
        "This product is scheduled for deletion. Restore it before generating more codes."
      );
    }

    const { batchId, codes } = await createBatchWithCodes(
      productId,
      {
        name: product.name,
        prefix: product.prefix,
        manufacturerId: product.manufacturerId,
      },
      quantity,
      ctx.uid
    );

    // Read-back check: confirm every code document really exists.
    const countSnap = await db
      .collection("codes")
      .where("batchId", "==", batchId)
      .count()
      .get();
    const saved = countSnap.data().count;
    if (saved !== quantity) {
      throw new ApiError(
        500,
        `Only ${saved} of ${quantity} codes were saved. Please try again.`
      );
    }

    return NextResponse.json({
      batchId,
      quantity,
      saved,
      codes,
      csvUrl: `/api/download/csv?batchId=${batchId}`,
      zipUrl: `/api/download/zip?batchId=${batchId}`,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
