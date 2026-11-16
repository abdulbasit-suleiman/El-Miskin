import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./firebase-admin";

/** Error with an HTTP status, rendered as JSON by handleApiError. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Verifies the "Authorization: Bearer <idToken>" header on API routes. */
export async function verifyRequestToken(
  req: NextRequest
): Promise<{ uid: string; email?: string }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return verifyToken(token);
}

/**
 * Accepts the ID token from the Authorization header, falling back to the
 * `?token=` query param (legacy download links).
 */
export async function verifyTokenFromRequest(
  req: NextRequest
): Promise<{ uid: string; email?: string }> {
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  return verifyToken(bearer ?? req.nextUrl.searchParams.get("token"));
}

/** Verifies a Firebase ID token passed as a query param (used for download links). */
export async function verifyToken(
  token: string | null
): Promise<{ uid: string; email?: string }> {
  if (!token) throw new ApiError(401, "Missing auth token");
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new ApiError(401, "Invalid or expired auth token");
  }
}

/** Uniform error responses for API routes. */
export function handleApiError(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("Unhandled API error:", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
