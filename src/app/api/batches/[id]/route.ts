import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import type { BatchDoc, CodeDoc, ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATS_SCAN_LIMIT = 2000;

/**
 * GET /api/batches/[id]
 * Batch details plus code counts for the batch detail page. One equality
 * query on batchId keeps this index free; the counts are computed in a
 * single pass over that batch's codes.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const db = adminDb();
    const batchSnap = await db.doc(`batches/${params.id}`).get();
    if (!batchSnap.exists) throw new ApiError(404, "Batch not found.");

    const batch = batchSnap.data() as BatchDoc;
    const productSnap = await db.doc(`products/${batch.productId}`).get();
    const product = productSnap.exists ? (productSnap.data() as ProductDoc) : null;

    const owned = batch.manufacturerId === ctx.ownerId || product?.manufacturerId === ctx.ownerId;
    if (!owned) throw new ApiError(403, "This batch belongs to a different account.");

    const codesSnap = await db
      .collection("codes")
      .where("batchId", "==", params.id)
      .select("status", "scanCount")
      .limit(STATS_SCAN_LIMIT)
      .get();

    const counts = { valid: 0, scanned: 0, flagged: 0, scans: 0 };
    for (const doc of codesSnap.docs) {
      const data = doc.data() as Pick<CodeDoc, "status" | "scanCount">;
      if (data.status === "scanned") counts.scanned += 1;
      else if (data.status === "flagged") counts.flagged += 1;
      else counts.valid += 1;
      counts.scans += data.scanCount ?? 0;
    }

    return NextResponse.json({
      batch: {
        id: batchSnap.id,
        name: batch.name ?? "",
        productId: batch.productId,
        productName: batch.productName ?? product?.name ?? "",
        quantity: batch.quantity ?? 0,
        createdAt: batch.createdAt ?? 0,
      },
      product: product
        ? {
            id: productSnap.id,
            name: product.name,
            prefix: product.prefix,
            pendingPurgeAt: product.purgeAt ?? null,
          }
        : null,
      counts: {
        ...counts,
        total: codesSnap.size,
        truncated: codesSnap.size === STATS_SCAN_LIMIT,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
