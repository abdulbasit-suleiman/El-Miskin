import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { purgeExpiredProducts } from "@/lib/product-delete";
import type { ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/products/pending
 * Runs any purge whose 48 hours have passed, then lists the products of the
 * caller's account that are still inside their grace period.
 */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const purged = await purgeExpiredProducts();

    const db = adminDb();
    const snap = await db
      .collection("products")
      .where("manufacturerId", "==", ctx.ownerId)
      .limit(100)
      .get();

    const now = Date.now();
    const pending = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as ProductDoc) }))
      .filter((p) => typeof p.purgeAt === "number" && p.purgeAt > now)
      .map((p) => ({
        id: p.id,
        name: p.name,
        prefix: p.prefix,
        totalCodes: p.stats?.totalCodes ?? 0,
        deletionScheduledAt: p.deletionScheduledAt ?? null,
        purgeAt: p.purgeAt as number,
      }))
      .sort((a, b) => a.purgeAt - b.purgeAt);

    return NextResponse.json({ pending, purged: purged.length });
  } catch (e) {
    return handleApiError(e);
  }
}
