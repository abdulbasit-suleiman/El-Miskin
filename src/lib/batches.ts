import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { generateCode } from "./code-gen";
import { batchDisplayName } from "./batch-name";
import type { BatchDoc, CodeDoc } from "./types";

export { batchDisplayName };

const CHUNK_SIZE = 450; // under Firestore's 500-writes-per-batch limit

/**
 * Creates a new batch with `quantity` unique codes for a product.
 * Codes are crypto-random (96-bit) so collisions are practically impossible;
 * a commit failure still triggers one regeneration attempt per chunk.
 */
export async function createBatchWithCodes(
  productId: string,
  product: { name: string; prefix: string; manufacturerId: string },
  quantity: number,
  createdBy?: string
): Promise<{ batchId: string; codes: string[] }> {
  const db = adminDb();
  const now = Date.now();

  const batchRef = db.collection("batches").doc();
  const batchId = batchRef.id;
  const name = batchDisplayName(product.name, now);
  const batchDoc: BatchDoc = {
    productId,
    manufacturerId: product.manufacturerId,
    name,
    nameLower: name.toLowerCase(),
    productName: product.name,
    quantity,
    createdAt: now,
  };
  if (createdBy) batchDoc.createdBy = createdBy;
  await batchRef.set(batchDoc);

  const codes: string[] = [];

  for (let i = 0; i < quantity; i += CHUNK_SIZE) {
    const count = Math.min(CHUNK_SIZE, quantity - i);
    let committed = false;

    for (let attempt = 0; attempt < 3 && !committed; attempt++) {
      // Regenerate the whole chunk on each attempt (collisions are ~impossible).
      const chunk: string[] = [];
      while (chunk.length < count) {
        const code = generateCode(product.prefix);
        if (!chunk.includes(code)) chunk.push(code);
      }

      const wb = db.batch();
      for (const code of chunk) {
        wb.create(db.doc(`codes/${code}`), {
          batchId,
          productId,
          productName: product.name,
          prefix: product.prefix,
          status: "valid",
          scanCount: 0,
          createdAt: now,
        } satisfies CodeDoc);
      }

      try {
        await wb.commit();
        codes.push(...chunk);
        committed = true;
      } catch (err) {
        console.warn("Code batch write failed, retrying chunk:", err);
      }
    }

    if (!committed) {
      throw new Error("Failed to write codes to Firestore after 3 attempts");
    }
  }

  await db.doc(`products/${productId}`).update({
    "stats.totalCodes": FieldValue.increment(quantity),
  });

  return { batchId, codes };
}
