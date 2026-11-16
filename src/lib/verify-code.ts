import { FieldValue, type DocumentData, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";
import { CODE_PATTERN, normalizeCode, weekKey } from "./code-utils";
import type { ScanResult } from "./types";

export type VerifyOutcome = "genuine" | "already_used" | "invalid";

export interface VerifyPageResult {
  outcome: VerifyOutcome;
  productName: string | null;
}

function scanLogData(
  code: string,
  scannedAt: number,
  result: ScanResult,
  ipAddress: string,
  userAgent: string | null,
  productId?: string | null,
  batchId?: string | null
): DocumentData {
  const log: DocumentData = { code, scannedAt, result, ipAddress };
  if (productId) log.productId = productId;
  if (batchId) log.batchId = batchId;
  if (userAgent) log.userAgent = userAgent;
  return log;
}

/**
 * Verifies a scanned code in a Firestore transaction so two simultaneous
 * first-scans cannot both report "genuine":
 *  - valid   -> mark scanned, first scan => genuine
 *  - scanned -> already used (increment scanCount)
 *  - missing -> invalid (attribute to a product by prefix when possible)
 * Every attempt is written to scanLogs, and per-product counters
 * (genuine / repeat / invalid + weekly bucket) are updated atomically.
 */
export async function verifyCodeAndLog(
  rawCode: string,
  ipAddress: string,
  userAgent: string | null
): Promise<VerifyPageResult> {
  const db = adminDb();
  const code = normalizeCode(rawCode);

  // Malformed code -> invalid, logged, no product attribution.
  if (!CODE_PATTERN.test(code)) {
    await db
      .collection("scanLogs")
      .add(scanLogData(code, Date.now(), "invalid", ipAddress, userAgent));
    return { outcome: "invalid", productName: null };
  }

  const codeRef = db.doc(`codes/${code}`);
  const scanLogRef = db.collection("scanLogs").doc();
  const now = Date.now();
  const week = weekKey(new Date(now));

  return db.runTransaction(async (t) => {
    // --- All reads must happen before any writes in a transaction ---
    const codeSnap = await t.get(codeRef);

    if (!codeSnap.exists) {
      // Unknown code: try to attribute the invalid attempt to the product
      // whose prefix matches, so its stats page shows the attempt.
      const prefix = code.split("-")[0];
      let productRef: DocumentReference | null = null;
      let productSnap = null;

      const matches = await db.collection("products").where("prefix", "==", prefix).limit(1).get();
      if (!matches.empty) {
        productRef = matches.docs[0].ref;
        productSnap = await t.get(productRef);
      }

      t.create(scanLogRef, scanLogData(code, now, "invalid", ipAddress, userAgent, productRef?.id));
      if (productRef && productSnap?.exists) {
        t.update(productRef, {
          "stats.invalidAttempts": FieldValue.increment(1),
          [`weeklyScans.${week}`]: FieldValue.increment(1),
        });
      }
      return { outcome: "invalid" as const, productName: null };
    }

    const data = codeSnap.data()!;
    const productId: string = data.productId;
    const productName: string | null = data.productName ?? null;
    const productRef = db.doc(`products/${productId}`);
    const productSnap = await t.get(productRef);

    if (data.status === "valid") {
      // First successful scan.
      t.update(codeRef, { status: "scanned", firstScannedAt: now, scanCount: 1 });
      t.create(
        scanLogRef,
        scanLogData(code, now, "genuine", ipAddress, userAgent, productId, data.batchId)
      );
      if (productSnap.exists) {
        t.update(productRef, {
          "stats.genuineScans": FieldValue.increment(1),
          [`weeklyScans.${week}`]: FieldValue.increment(1),
        });
      }
      return { outcome: "genuine" as const, productName };
    }

    // Already scanned (or flagged): count as a repeat.
    t.update(codeRef, { scanCount: FieldValue.increment(1) });
    t.create(
      scanLogRef,
      scanLogData(code, now, "already_used", ipAddress, userAgent, productId, data.batchId)
    );
    if (productSnap.exists) {
      t.update(productRef, {
        "stats.repeatScans": FieldValue.increment(1),
        [`weeklyScans.${week}`]: FieldValue.increment(1),
      });
    }
    return { outcome: "already_used" as const, productName };
  });
}
