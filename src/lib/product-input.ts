import { ApiError } from "./auth";

/** Validates and normalizes a product payload (used by POST and PATCH routes). */
export function parseProductInput(body: any): { name: string; prefix: string } {
  const name = String(body?.name ?? "").trim();
  const prefix = String(body?.prefix ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!name || name.length > 60) {
    throw new ApiError(400, "Product name is required (max 60 characters).");
  }
  if (!/^[A-Z0-9]{2,12}$/.test(prefix)) {
    throw new ApiError(400, "Prefix must be 2-12 letters or numbers.");
  }
  return { name, prefix };
}
