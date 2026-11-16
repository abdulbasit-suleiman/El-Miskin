import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { parseProductInput } from "@/lib/product-input";
import type { ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/products — creates a product for the caller's manufacturer
 * account. Requires a signed-in, active manufacturer (owner or sub-admin).
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const body = await req.json().catch(() => ({}));
    const { name, prefix } = parseProductInput(body);

    const db = adminDb();

    // Prefix must be unique within the manufacturer account.
    const existing = await db
      .collection("products")
      .where("manufacturerId", "==", ctx.ownerId)
      .get();
    if (existing.docs.some((d) => d.data().prefix === prefix)) {
      throw new ApiError(409, `A product with prefix "${prefix}" already exists.`);
    }

    const product = {
      manufacturerId: ctx.ownerId,
      createdBy: ctx.uid,
      name,
      prefix,
      createdAt: Date.now(),
      stats: { totalCodes: 0, genuineScans: 0, repeatScans: 0, invalidAttempts: 0 },
      weeklyScans: {},
    } satisfies ProductDoc;

    const ref = db.collection("products").doc();
    await ref.set(product);

    return NextResponse.json({ id: ref.id, ...product });
  } catch (e) {
    return handleApiError(e);
  }
}
