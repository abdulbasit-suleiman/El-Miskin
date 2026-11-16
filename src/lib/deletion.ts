/**
 * Product deletion is delayed: the owner schedules the delete, the product
 * stays recoverable for 48 hours and is then removed for good.
 *
 * No Firebase imports here, so client components and server routes can both
 * use these helpers.
 */
export const PRODUCT_GRACE_HOURS = 48;
export const PRODUCT_GRACE_MS = PRODUCT_GRACE_HOURS * 60 * 60 * 1000;

/** True while the product has a scheduled purge. */
export function isPendingDeletion(product: { purgeAt?: number | null } | null | undefined): boolean {
  return typeof product?.purgeAt === "number";
}

/** Whole hours left before the purge, never below zero. */
export function hoursUntilPurge(purgeAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((purgeAt - now) / (60 * 60 * 1000)));
}

/** Human readable deadline, e.g. "18 November 2026 at 04:20". */
export function purgeDeadlineLabel(purgeAt: number): string {
  return new Date(purgeAt).toLocaleString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
