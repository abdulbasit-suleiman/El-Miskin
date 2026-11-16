// Developer-only helpers used by `npm run seed:dev` and `npm run create-owner`.
// Never imported by the running app.
import { adminAuth, adminDb } from "./firebase-admin";
import { createBatchWithCodes } from "./batches";
import type { ManufacturerDoc, ProductDoc } from "./types";

export const DEV_EMAIL = "dev@elmiskin.local";
export const DEV_PASSWORD = "dev-password-123";
export const DEV_PRODUCT_NAME = "Milo";
export const DEV_PREFIX = "ML";
export const DEV_QUANTITY = 10;

const ZERO_STATS = { totalCodes: 0, genuineScans: 0, repeatScans: 0, invalidAttempts: 0 };

/** Creates (or reuses) the local development owner account. */
export async function ensureDevOwner(): Promise<{ uid: string; created: boolean }> {
  let uid: string;
  let created = false;
  try {
    uid = (await adminAuth().getUserByEmail(DEV_EMAIL)).uid;
  } catch {
    const user = await adminAuth().createUser({
      email: DEV_EMAIL,
      password: DEV_PASSWORD,
      displayName: "Dev Owner",
      emailVerified: true,
    });
    uid = user.uid;
    created = true;
  }

  const now = Date.now();
  const doc: ManufacturerDoc = {
    name: "Dev Owner",
    email: DEV_EMAIL,
    role: "owner",
    ownerId: uid,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await adminDb().doc(`manufacturers/${uid}`).set(doc, { merge: true });
  return { uid, created };
}

/**
 * Creates a local product + one batch of unused codes for the dev owner.
 * Safe to run repeatedly: the product is reused, each run adds a new batch.
 */
export async function seedDevData(uid: string) {
  const db = adminDb();
  const now = Date.now();

  const existing = await db.collection("products").where("manufacturerId", "==", uid).get();
  const milo = existing.docs.find((d) => d.data().prefix === DEV_PREFIX);

  let productId: string;
  if (milo) {
    productId = milo.id;
  } else {
    const ref = db.collection("products").doc();
    productId = ref.id;
    await ref.set({
      manufacturerId: uid,
      createdBy: uid,
      name: DEV_PRODUCT_NAME,
      prefix: DEV_PREFIX,
      createdAt: now,
      stats: ZERO_STATS,
      weeklyScans: {},
    } satisfies ProductDoc);
  }

  const { batchId, codes } = await createBatchWithCodes(
    productId,
    { name: DEV_PRODUCT_NAME, prefix: DEV_PREFIX, manufacturerId: uid },
    DEV_QUANTITY,
    uid
  );

  return { productId, productName: DEV_PRODUCT_NAME, batchId, codes };
}
