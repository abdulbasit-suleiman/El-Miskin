import { randomBytes } from "crypto";

/**
 * Generates a product code: "{PREFIX}-{16 random url-safe characters}".
 * Uses Node's crypto (96 bits of entropy via randomBytes(12) -> base64url),
 * NOT Math.random — so codes cannot be guessed or brute-forced.
 */
export function generateCode(prefix: string): string {
  return `${prefix}-${randomBytes(12).toString("base64url")}`;
}
