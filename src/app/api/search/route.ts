import { NextRequest, NextResponse } from "next/server";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { handleApiError, verifyRequestToken } from "@/lib/auth";
import { getAccountContext } from "@/lib/account";
import { CODE_PATTERN, normalizeCode } from "@/lib/code-utils";
import type { BatchDoc, CodeDoc, ProductDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface CodeHit {
  code: string;
  status: string;
  scanCount: number;
  firstScannedAt: number | null;
  productId: string;
  productName: string;
  batchId: string;
}

export interface BatchHit {
  id: string;
  name: string;
  productId: string;
  productName: string;
  quantity: number;
  createdAt: number;
}

export interface ProductHit {
  id: string;
  name: string;
  prefix: string;
  totalCodes: number;
}

/**
 * GET /api/search?q=...
 *
 * Looks up one manufacturer's own data with index-free Firestore queries.
 * Every filter is a single equality or a single range, which Firestore
 * indexes automatically, so no composite index has to be deployed:
 *  - `codes/{code}` by document id (exact code)
 *  - a document id range for a partial code such as "ML-7X9K"
 *  - `batches/{id}` by document id (exact batch reference)
 *  - a `nameLower` range for a batch name or product name
 *  - `products` of the account, matched by name or prefix in the server
 *  - `batches` of the matched products by productId
 */
export async function GET(req: NextRequest) {
  try {
    const { uid, email } = await verifyRequestToken(req);
    const ctx = await getAccountContext(uid, email);

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    const empty = { query: q, codes: [], batches: [], products: [], tooShort: q.length < 2 };
    if (q.length < 2) return NextResponse.json(empty);

    const db = adminDb();
    const lower = q.toLowerCase();

    const productsSnap = await db
      .collection("products")
      .where("manufacturerId", "==", ctx.ownerId)
      .limit(100)
      .get();

    const owned = new Map<string, ProductDoc & { id: string }>();
    for (const d of productsSnap.docs) {
      owned.set(d.id, { id: d.id, ...(d.data() as ProductDoc) });
    }

    const codes: CodeHit[] = [];
    const batches = new Map<string, BatchHit>();
    const products: ProductHit[] = [];

    const codeHit = (codeId: string, data: CodeDoc): CodeHit => ({
      code: codeId,
      status: data.status ?? "valid",
      scanCount: data.scanCount ?? 0,
      firstScannedAt: data.firstScannedAt ?? null,
      productId: data.productId,
      productName: data.productName ?? owned.get(data.productId)?.name ?? "",
      batchId: data.batchId ?? "",
    });

    const addBatch = (id: string, data: BatchDoc) => {
      if (batches.has(id)) return;
      const product = owned.get(data.productId);
      if (!product && data.manufacturerId !== ctx.ownerId) return;
      batches.set(id, {
        id,
        name: data.name ?? "",
        productId: data.productId,
        productName: data.productName ?? product?.name ?? "",
        quantity: data.quantity ?? 0,
        createdAt: data.createdAt ?? 0,
      });
    };

    // 1. Exact code lookup. Only the prefix is upper-cased, the suffix is
    // case-sensitive by design.
    const candidate = normalizeCode(q);
    if (CODE_PATTERN.test(candidate)) {
      const snap = await db.doc(`codes/${candidate}`).get();
      if (snap.exists) {
        const data = snap.data() as CodeDoc;
        if (owned.has(data.productId)) codes.push(codeHit(snap.id, data));
      }
    }

    // 1b. Partial code. A range over the document id is a single-field
    // index scan, so Firestore does the matching instead of us.
    if (codes.length === 0 && q.includes("-")) {
      const idx = q.indexOf("-");
      const head = q.slice(0, idx).trim().toUpperCase();
      const tail = q.slice(idx + 1).trim();
      if (tail.length >= 3) {
        const snap = await db
          .collection("codes")
          .orderBy(FieldPath.documentId())
          .startAt(`${head}-${tail}`)
          .endAt(`${head}-${tail}\uf8ff`)
          .limit(50)
          .get();
        for (const d of snap.docs) {
          const data = d.data() as CodeDoc;
          if (owned.has(data.productId)) codes.push(codeHit(d.id, data));
        }
      }
    }

    // 2. Exact batch reference by document id.
    if (/^[A-Za-z0-9]{15,40}$/.test(q)) {
      const snap = await db.doc(`batches/${q}`).get();
      if (snap.exists) addBatch(snap.id, snap.data() as BatchDoc);
    }

    // 3. Batch names and product names that start with the query. The range
    // over `nameLower` is indexed automatically; rows from other accounts are
    // dropped by the ownership check inside addBatch.
    const nameSnap = await db
      .collection("batches")
      .orderBy("nameLower")
      .startAt(lower)
      .endAt(`${lower}\uf8ff`)
      .limit(50)
      .get();
    for (const d of nameSnap.docs) addBatch(d.id, d.data() as BatchDoc);

    // 4. Products matching the query (the account has a bounded set).
    for (const product of Array.from(owned.values())) {
      if (products.length >= 10) break;
      if (
        product.name.toLowerCase().includes(lower) ||
        product.prefix.toLowerCase() === lower ||
        product.id === q
      ) {
        products.push({
          id: product.id,
          name: product.name,
          prefix: product.prefix,
          totalCodes: product.stats?.totalCodes ?? 0,
        });
      }
    }

    // 5. Batches of the matched products.
    for (const product of products.slice(0, 5)) {
      const snap = await db
        .collection("batches")
        .where("productId", "==", product.id)
        .limit(50)
        .get();
      for (const d of snap.docs) addBatch(d.id, d.data() as BatchDoc);
    }

    const batchList = Array.from(batches.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);

    return NextResponse.json({
      query: q,
      tooShort: false,
      codes: codes.slice(0, 10),
      batches: batchList,
      products,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
