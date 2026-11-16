// Pure helpers shared by server AND client code.
// Do NOT import anything Node-specific here (client bundle safe).

/** Code format: PREFIX-16urlsafechars, e.g. ML-3kQxYv8mZpL2bN4a */
export const CODE_PATTERN = /^[A-Z0-9]{2,12}-[A-Za-z0-9_-]{16}$/;

/**
 * Normalizes a typed/scanned code: uppercases only the prefix, because the
 * random suffix is case-sensitive (base64url). e.g. "ml-Ab3dEf9hJk2Lm4No"
 * becomes "ML-Ab3dEf9hJk2Lm4No".
 */
export function normalizeCode(raw: string): string {
  const trimmed = raw.trim();
  const idx = trimmed.indexOf("-");
  if (idx === -1) return trimmed;
  return `${trimmed.slice(0, idx).toUpperCase()}-${trimmed.slice(idx + 1)}`;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function verifyUrl(code: string): string {
  return `${appUrl()}/verify/${code}`;
}

/** ISO-8601 week key, e.g. "2026-W46". */
export function weekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Last `count` week keys ending at `from`, oldest first. */
export function lastWeekKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(from);
    d.setDate(d.getDate() - i * 7);
    keys.push(weekKey(d));
  }
  return keys;
}

/** Short label for chart axes: "W46". */
export function weekLabel(key: string): string {
  const parts = key.split("-W");
  return parts.length === 2 ? `W${parts[1]}` : key;
}

export function codesToCsv(rows: { code: string; status: string }[]): string {
  const header = ["code", "status", "url"];
  const lines = [header, ...rows.map((r) => [r.code, r.status, verifyUrl(r.code)])];
  return lines
    .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
