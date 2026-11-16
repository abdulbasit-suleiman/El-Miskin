import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";

export const dynamic = "force-dynamic";

/** GET /api/account — profile of the signed-in manufacturer. */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);
    return NextResponse.json(ctx);
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * PATCH /api/account — updates the caller's own profile.
 * Body: { name?: string, syncEmail?: true }
 * `syncEmail` copies the (already changed) Firebase Auth email into Firestore.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);
    const body = await req.json().catch(() => ({}));

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name || name.length > 60) {
        throw new ApiError(400, "Name must be 1-60 characters.");
      }
      patch.name = name;
    }

    if (body?.syncEmail === true) {
      if (!email) throw new ApiError(400, "No email on the current session.");
      patch.email = email;
    }

    if (Object.keys(patch).length === 1) {
      throw new ApiError(400, "Nothing to update.");
    }

    await adminDb().doc(`manufacturers/${uid}`).set(patch, { merge: true });

    return NextResponse.json({
      ...ctx,
      ...(patch.name ? { name: patch.name } : {}),
      ...(patch.email ? { email: patch.email } : {}),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
