import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { ApiError, handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext, requireOwner } from "@/lib/account";
import type { ManufacturerDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SubAdminSummary {
  uid: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: number;
}

/** GET /api/account/sub-admins — lists the sub-admins of the caller's account (owner only). */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);
    requireOwner(ctx);

    const snap = await adminDb()
      .collection("manufacturers")
      .where("ownerId", "==", ctx.uid)
      .limit(100)
      .get();

    const subAdmins: SubAdminSummary[] = snap.docs
      .filter((d) => d.data().role === "admin")
      .map((d) => {
        const data = d.data() as ManufacturerDoc;
        return {
          uid: d.id,
          name: data.name ?? "",
          email: data.email ?? "",
          active: data.active !== false,
          createdAt: data.createdAt ?? 0,
        };
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    return NextResponse.json({ subAdmins });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * POST /api/account/sub-admins — creates a sub-admin under the caller's
 * account (owner only). Sub-admins can create products/batches and view
 * analytics, but cannot manage members or the owner account.
 * Body: { name, email, password }
 */
export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);
    requireOwner(ctx);

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const subEmail = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!name || name.length > 60) throw new ApiError(400, "Name must be 1-60 characters.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(subEmail)) {
      throw new ApiError(400, "A valid email address is required.");
    }
    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters.");
    }

    let created;
    try {
      created = await adminAuth().createUser({
        email: subEmail,
        password,
        displayName: name,
        emailVerified: false,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-exists") {
        throw new ApiError(409, "An account with this email already exists.");
      }
      throw err;
    }

    const now = Date.now();
    const doc: ManufacturerDoc = {
      name,
      email: subEmail,
      role: "admin",
      ownerId: ctx.uid,
      active: true,
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.uid,
    };

    try {
      await adminDb().doc(`manufacturers/${created.uid}`).set(doc);
    } catch (err) {
      // Roll back the Auth user so a half-created sub-admin can't exist.
      await adminAuth().deleteUser(created.uid).catch(() => {});
      throw err;
    }

    return NextResponse.json({
      uid: created.uid,
      name,
      email: subEmail,
      active: true,
      createdAt: now,
    } satisfies SubAdminSummary);
  } catch (e) {
    return handleApiError(e);
  }
}
