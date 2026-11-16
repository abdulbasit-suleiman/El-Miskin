import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import archiver from "archiver";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyTokenFromRequest } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { codesToCsv, verifyUrl } from "@/lib/code-utils";
import { requestBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// ZIPs with hundreds of QR PNGs can take a while — give the function room.
export const maxDuration = 60;

/** Reads all codes of a batch (paginated). */
async function getBatchCodes(batchId: string) {
  const db = adminDb();
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
  return rows;
}

/**
 * GET /api/download/zip?batchId=... — ZIP of QR PNGs + codes CSV.
 * Auth via Authorization header or ?token= query param.
 *
 * The archive is built fully in memory (no temp files) so it works on
 * serverless platforms such as Vercel that have no persistent disk.
 */
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

    const rows = await getBatchCodes(batchId);
    // The printed URL must be the public one, resolved from this request.
    const base = requestBaseUrl(req);

    // Build the archive in memory instead of piping a stream — this behaves
    // identically locally and in serverless functions.
    const archive = archiver("zip", { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on("data", (c: Buffer) => chunks.push(c));
    const finished = new Promise<void>((resolve, reject) => {
      archive.on("end", () => resolve());
      archive.on("warning", (err) => {
        // Non-fatal warnings (e.g. ENOENT) must not kill the download.
        console.warn("ZIP warning:", err.message);
      });
      archive.on("error", (err) => reject(err));
    });

    archive.append(codesToCsv(rows, base), { name: `codes-${batchId}.csv` });
    for (const row of rows) {
      const png = await QRCode.toBuffer(verifyUrl(row.code, base), {
        width: 512,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      archive.append(png, { name: `QR-${row.code}.png` });
    }

    await archive.finalize();
    await finished;

    const zip = Buffer.concat(chunks);

    return new NextResponse(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="QR-codes-${batchId}.zip"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
