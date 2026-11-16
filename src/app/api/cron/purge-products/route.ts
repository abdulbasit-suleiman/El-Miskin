import { NextRequest, NextResponse } from "next/server";
import { handleApiError, verifyRequestToken } from "@/lib/auth";
import { purgeExpiredProducts } from "@/lib/product-delete";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET|POST /api/cron/purge-products
 * Safety net for the 48 hour grace period. Vercel Cron calls this once a day
 * and sends `Authorization: Bearer $CRON_SECRET` automatically. When no
 * secret is configured the route falls back to requiring a signed-in member,
 * so it can still be triggered by hand from the dashboard.
 */
async function purge(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const header = req.headers.get("authorization") ?? "";

    if (secret) {
      if (header !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      await verifyRequestToken(req);
    }

    const purged = await purgeExpiredProducts();
    return NextResponse.json({
      purged: purged.length,
      products: purged.map((p) => ({ id: p.id, name: p.name, deleted: p.deleted })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export const GET = purge;
export const POST = purge;
