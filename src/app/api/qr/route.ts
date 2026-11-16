import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { CODE_PATTERN, normalizeCode, verifyUrl } from "@/lib/code-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/qr?code=...&size=256
 * Renders a QR PNG for a code (encodes {appUrl}/verify/{code}).
 * Public on purpose — the URL inside the QR is public anyway.
 */
export async function GET(req: NextRequest) {
  const code = normalizeCode(req.nextUrl.searchParams.get("code") ?? "");
  const sizeParam = parseInt(req.nextUrl.searchParams.get("size") ?? "256", 10);
  const size = Math.min(Math.max(Number.isNaN(sizeParam) ? 256 : sizeParam, 128), 1024);

  if (!CODE_PATTERN.test(code)) {
    return new NextResponse("Invalid code format", { status: 400 });
  }

  const png = await QRCode.toBuffer(verifyUrl(code), {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
