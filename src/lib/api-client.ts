// Helpers for calling authenticated API routes from client components.
import { getClientAuth } from "./firebase-client";

/** Shown instead of the browser's raw "Failed to fetch". */
export const NETWORK_ERROR = "The server did not respond. Check your connection and try again.";

const RETRY_DELAY_MS = 700;

export async function getAuthToken(): Promise<string> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGatewayError(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Runs a GET once more when the network drops the request or the platform
 * answers with a gateway error. This covers cold starts and the first request
 * after a deploy, which the browser otherwise reports as "Failed to fetch".
 */
export async function fetchWithRetry(
  path: string,
  init: RequestInit,
  retry: boolean
): Promise<Response> {
  try {
    const res = await fetch(path, { cache: "no-store", ...init });
    if (!retry || !isGatewayError(res.status)) return res;
    await sleep(RETRY_DELAY_MS);
    return fetch(path, { cache: "no-store", ...init });
  } catch {
    if (!retry) throw new Error(NETWORK_ERROR);
    await sleep(RETRY_DELAY_MS);
    try {
      return await fetch(path, { cache: "no-store", ...init });
    } catch {
      throw new Error(NETWORK_ERROR);
    }
  }
}

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<{ data: any; token: string }> {
  const token = await getAuthToken();
  const res = await fetchWithRetry(
    path,
    {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    // Only GETs are retried: a retried POST could create something twice.
    method === "GET"
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return { data, token };
}

export async function apiGet(path: string): Promise<any> {
  return (await request("GET", path)).data;
}

export function apiPost(path: string, body: unknown): Promise<{ data: any; token: string }> {
  return request("POST", path, body);
}

export async function apiPatch(path: string, body: unknown): Promise<any> {
  return (await request("PATCH", path, body)).data;
}

export async function apiDelete(path: string, body: unknown): Promise<any> {
  return (await request("DELETE", path, body)).data;
}
