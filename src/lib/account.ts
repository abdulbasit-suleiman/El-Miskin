import { adminAuth, adminDb } from "./firebase-admin";
import { ApiError } from "./auth";
import type { ManufacturerDoc, ManufacturerRole } from "./types";

/** Resolved account for the signed-in user. */
export interface AccountContext {
  uid: string;
  email: string;
  name: string;
  role: ManufacturerRole;
  /** uid of the owner account — all data is scoped to this id. */
  ownerId: string;
}

/**
 * Loads the caller's manufacturer account. The first login of a fresh
 * Firebase user bootstraps an "owner" account automatically.
 * Throws 403 when the account has been deactivated.
 */
export async function getAccountContext(
  uid: string,
  tokenEmail?: string
): Promise<AccountContext> {
  const ref = adminDb().doc(`manufacturers/${uid}`);
  const snap = await ref.get();

  if (!snap.exists) {
    const email =
      tokenEmail ??
      (await adminAuth()
        .getUser(uid)
        .catch(() => null))?.email ??
      "";
    const now = Date.now();
    const doc: ManufacturerDoc = {
      name: email.split("@")[0] || "Manufacturer",
      email,
      role: "owner",
      ownerId: uid,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);
    return { uid, email, name: doc.name, role: "owner", ownerId: uid };
  }

  // Partial: older docs may predate the role/active fields.
  const data = snap.data() as Partial<ManufacturerDoc>;
  if (data.active === false) {
    throw new ApiError(403, "This account has been deactivated. Contact the account owner.");
  }

  // Backfill docs created before roles existed: the account holder is owner.
  let role = data.role;
  let ownerId = data.ownerId;
  if (role !== "owner" && role !== "admin") role = "owner";
  if (!ownerId) ownerId = uid;
  if (data.role === undefined || data.ownerId === undefined || data.active === undefined) {
    await ref
      .set(
        {
          role,
          ownerId,
          active: true,
          createdAt: data.createdAt ?? Date.now(),
        },
        { merge: true }
      )
      .catch(() => {});
  }

  return {
    uid,
    email: data.email ?? tokenEmail ?? "",
    name: data.name ?? "",
    role,
    ownerId,
  };
}

/** Throws 403 unless the caller owns the manufacturer account. */
export function requireOwner(ctx: AccountContext): void {
  if (ctx.role !== "owner") {
    throw new ApiError(403, "Only the account owner can do this.");
  }
}
