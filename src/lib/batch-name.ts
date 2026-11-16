/**
 * Display name for a batch, e.g. "Milo 2026-11-16 03:12".
 *
 * Kept in its own module with no Firebase imports so client components can
 * use it too. Search matches on a lower-cased copy of this string.
 */
export function batchDisplayName(productName: string, createdAt: number): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
  return `${productName} ${stamp}`;
}
