// Helpers for calling authenticated API routes from client components.
import { getClientAuth } from "./firebase-client";

export async function getAuthToken(): Promise<string> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  return user.getIdToken();
}

async function request(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<{ data: any; token: string }> {
  const token = await getAuthToken();
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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
