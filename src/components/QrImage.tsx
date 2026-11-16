"use client";

import { useState } from "react";

const DISPLAY = 64;

/**
 * QR thumbnail for a code. A single dropped request (cold start, flaky mobile
 * connection) would otherwise leave a broken image until the page is reloaded,
 * so a failed load is retried once with a fresh URL.
 */
export default function QrImage({ code, size = 128 }: { code: string; size?: number }) {
  const [attempt, setAttempt] = useState(0);
  const src = `/api/qr?code=${encodeURIComponent(code)}&size=${size}${
    attempt > 0 ? `&retry=${attempt}` : ""
  }`;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={`QR code for ${code}`}
      width={DISPLAY}
      height={DISPLAY}
      loading="lazy"
      onError={() => setAttempt((n) => (n < 2 ? n + 1 : n))}
      className="shrink-0 rounded"
    />
  );
}
