import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext, requireOwner } from "@/lib/account";
import type { ManufacturerDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/account/sub-admins/[uid] — activates or deactivates a sub-admin
 * (owner only). Deactivating also disables the Firebase Auth user and revokes
 * their refresh tokens, so existing sessions stop working.
 * Body: { active: boolean }
 */
export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);
    requireOwner(ctx);

    const targetUid = params.uid;
    if (targetUid === ctx.uid) {
      throw new ApiError(400, "You cannot change your own account status.");
    }

    const ref = adminDb().doc(`manufacturers/${targetUid}`);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(404, "Sub-admin not found.");

    const data = snap.data() as ManufacturerDoc;
    if (data.ownerId !== ctx.uid || data.role !== "admin") {
      throw new ApiError(403, "This sub-admin belongs to a different account.");
    }

    const body = await req.json().catch(() => ({}));
    if (typeof body?.active !== "boolean") {
      throw new ApiError(400, "active must be true or false.");
    }
    const active = body.active;

    await ref.set({ active, updatedAt: Date.now() }, { merge: true });

    try {
      await adminAuth().updateUser(targetUid, { disabled: !active });
      if (!active) await adminAuth().revokeRefreshTokens(targetUid);
    } catch (err) {
      // Roll the doc back if the Auth side fails, so both stay in sync.
      await ref.set({ active: !active }, { merge: true }).catch(() => {});
      throw err;
    }

    return NextResponse.json({ uid: targetUid, active });
  } catch (e) {
    return handleApiError(e);
  }
}
