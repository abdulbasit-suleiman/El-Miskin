import { adminDb } from "./firebase-admin";
import type { ProductDoc } from "./types";

const CHUNK = 450; // stays under the 500 writes per commit limit

/** Deletes every document matching one equality filter, in chunks. */
async function deleteWhere(
  collection: string,
  field: string,
  value: string
): Promise<number> {
  const db = adminDb();
  let deleted = 0;

  for (;;) {
    const snap = await db.collection(collection).where(field, "==", value).limit(CHUNK).get();
    if (snap.empty) return deleted;

    const wb = db.batch();
    for (const doc of snap.docs) wb.delete(doc.ref);
    await wb.commit();
    deleted += snap.size;
  }
}

/**
 * Removes a product with everything that hangs off it: its codes, its
 * batches and the scan logs attributed to it. The product document is
 * deleted last so a failure part way through never leaves an empty shell
 * that still looks alive.
 */
export async function deleteProductTree(productId: string) {
  const db = adminDb();

  const codes = await deleteWhere("codes", "productId", productId);
  const batches = await deleteWhere("batches", "productId", productId);
  const scanLogs = await deleteWhere("scanLogs", "productId", productId);

  await db.doc(`products/${productId}`).delete();

  return { codes, batches, scanLogs };
}

/**
 * Permanently removes every product whose 48 hour grace period has elapsed.
 *
 * The query is a single range on `purgeAt`, which Firestore indexes on its
 * own, so no composite index is needed. Called by the daily cron job and
 * whenever the pending deletion screen loads.
 */
export async function purgeExpiredProducts(max = 50) {
  const db = adminDb();
  const snap = await db
    .collection("products")
    .where("purgeAt", "<=", Date.now())
    .limit(max)
    .get();

  const purged: Array<{ id: string; name: string; deleted: Awaited<ReturnType<typeof deleteProductTree>> }> = [];
  for (const doc of snap.docs) {
    const product = doc.data() as ProductDoc;
    const deleted = await deleteProductTree(doc.id);
    purged.push({ id: doc.id, name: product.name ?? "", deleted });
  }
  return purged;
}
