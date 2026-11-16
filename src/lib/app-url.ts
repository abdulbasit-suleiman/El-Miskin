// Resolves the public base URL that goes inside QR codes, verify links and
// CSV exports. Shared by server and client code, so nothing Node-specific here.

const LOCAL_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

/** Trims a configured value down to "scheme://host", or null when unusable. */
export function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** True for http://localhost:1234 style values, which must never reach users. */
export function isLocalBaseUrl(value: string): boolean {
  return LOCAL_PATTERN.test(value);
}

/**
 * NEXT_PUBLIC_APP_URL when it holds a real public URL. A localhost value is
 * ignored on purpose: printed codes must never point at a developer machine.
 */
export function configuredBaseUrl(): string | null {
  const normalized = normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (!normalized || isLocalBaseUrl(normalized)) return null;
  return normalized;
}

/** Base URL for browser code: the configured one, else the current origin. */
export function clientBaseUrl(): string {
  const configured = configuredBaseUrl();
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** Base URL for route handlers: the configured one, else the request host. */
export function requestBaseUrl(req: Request): string {
  const configured = configuredBaseUrl();
  if (configured) return configured;

  const headers = req.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (host) {
    const proto =
      headers.get("x-forwarded-proto") ??
      (isLocalBaseUrl(`http://${host}`) ? "http" : "https");
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}
