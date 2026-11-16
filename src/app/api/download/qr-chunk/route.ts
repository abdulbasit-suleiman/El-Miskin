import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyTokenFromRequest } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { verifyUrl } from "@/lib/code-utils";
import { requestBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 60;

/**
 * GET /api/download/qr-chunk?batchId=...&cursor=...&limit=40
 *
 * One page of QR PNGs (base64) for a batch, so the browser can assemble the
 * ZIP itself. Generating every image in a single request runs past the
 * serverless time limit on large batches and the download dies half way.
 * `cursor` is the last code id of the previous page.
 */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verifyTokenFromRequest(req);
    const ctx = await getAccountContext(uid, email);

    const batchId = req.nextUrl.searchParams.get("batchId") ?? "";
    if (!batchId) throw new ApiError(400, "batchId is required.");

    const cursor = req.nextUrl.searchParams.get("cursor") ?? "";
    const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "", 10);
    const limit = Math.min(
      Math.max(Number.isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, 1),
      MAX_LIMIT
    );

    const db = adminDb();
    const batchSnap = await db.doc(`batches/${batchId}`).get();
    if (!batchSnap.exists) throw new ApiError(404, "Batch not found.");

    const productSnap = await db.doc(`products/${batchSnap.data()!.productId as string}`).get();
    if (!productSnap.exists || productSnap.data()!.manufacturerId !== ctx.ownerId) {
      throw new ApiError(403, "This batch belongs to a different account.");
    }

    let q = db.collection("codes").where("batchId", "==", batchId).limit(limit);
    if (cursor) {
      const after = await db.doc(`codes/${cursor}`).get();
      if (!after.exists) throw new ApiError(400, "That page of codes no longer exists.");
      q = q.startAfter(after);
    }

    const chunk = await q.get();
    const base = requestBaseUrl(req);

    const codes: { code: string; status: string; png: string }[] = [];
    for (const doc of chunk.docs) {
      const png = await QRCode.toBuffer(verifyUrl(doc.id, base), {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      codes.push({
        code: doc.id,
        status: (doc.data().status as string) ?? "valid",
        png: png.toString("base64"),
      });
    }

    const totalSnap = await db.collection("codes").where("batchId", "==", batchId).count().get();

    return NextResponse.json({
      codes,
      total: totalSnap.data().count,
      nextCursor: chunk.docs.length === limit ? chunk.docs[chunk.docs.length - 1].id : null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
