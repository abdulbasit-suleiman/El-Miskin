import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyTokenFromRequest } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { codesToCsv } from "@/lib/code-utils";

export const dynamic = "force-dynamic";

/** GET /api/download/csv?batchId=... — CSV of the batch's codes (account members only). */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verifyTokenFromRequest(req);
    const ctx = await getAccountContext(uid, email);

    const batchId = req.nextUrl.searchParams.get("batchId") ?? "";
    if (!batchId) throw new ApiError(400, "batchId is required.");

    const db = adminDb();
    const batchSnap = await db.doc(`batches/${batchId}`).get();
    if (!batchSnap.exists) throw new ApiError(404, "Batch not found.");

    const productId = batchSnap.data()!.productId as string;
    const productSnap = await db.doc(`products/${productId}`).get();
    if (!productSnap.exists || productSnap.data()!.manufacturerId !== ctx.ownerId) {
      throw new ApiError(403, "This batch belongs to a different account.");
    }

    const rows: { code: string; status: string }[] = [];
    let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (true) {
      let q = db.collection("codes").where("batchId", "==", batchId).limit(1000);
      if (last) q = q.startAfter(last);
      const chunk = await q.get();
      chunk.docs.forEach((d) => rows.push({ code: d.id, status: d.data().status }));
      if (chunk.docs.length < 1000) break;
      last = chunk.docs[chunk.docs.length - 1];
    }

    return new NextResponse(codesToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="codes-${batchId}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
