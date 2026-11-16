import Link from "next/link";
import { headers } from "next/headers";
import { verifyCodeAndLog, type VerifyOutcome } from "@/lib/verify-code";
import { isRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Props = { params: { code: string } };

/**
 * Public verification page, opened from a phone camera after scanning a QR.
 * Server-rendered with zero client JavaScript so it loads fast on weak data.
 */
export default async function VerifyPage({ params }: Props) {
  const rawCode = decodeURIComponent(params.code);

  const h = headers();
  const ip =
    (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  const userAgent = h.get("user-agent");

  let outcome: VerifyOutcome | "rate_limited" = "invalid";
  let productName: string | null = null;

  if (isRateLimited(`verify:${ip}`)) {
    outcome = "rate_limited";
  } else {
    const result = await verifyCodeAndLog(rawCode, ip, userAgent);
    outcome = result.outcome;
    productName = result.productName;
  }

  return <VerifyView code={rawCode} outcome={outcome} productName={productName} />;
}

function VerifyView({
  code,
  outcome,
  productName,
}: {
  code: string;
  outcome: VerifyOutcome | "rate_limited";
  productName: string | null;
}) {
  let icon: string;
  let title: string;
  let message: string;
  let tone: string; // tailwind color classes

  if (outcome === "genuine") {
    icon = "✅";
    title = "Genuine Product";
    message = `This is an authentic ${productName ?? "product"}. The code was verified for the first time just now.`;
    tone = "border-emerald-300 bg-emerald-50";
  } else if (outcome === "already_used") {
    icon = "⚠️";
    title = "Already verified";
    message = "This code was already used. If you did not verify this product before, it may be a counterfeit.";
    tone = "border-amber-300 bg-amber-50";
  } else if (outcome === "rate_limited") {
    icon = "⏳";
    title = "Too many requests";
    message = "You are scanning too quickly. Please wait a few seconds and try again.";
    tone = "border-slate-300 bg-slate-100";
  } else {
    icon = "⚠️";
    title = "Invalid code";
    message = "We could not find this code in our database. The product may be fake, or the code was mistyped.";
    tone = "border-red-300 bg-red-50";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className={`w-full max-w-md rounded-2xl border ${tone} p-8 text-center shadow-sm`}
      >
        <div className="text-6xl">{icon}</div>
        <h1 className="mt-4 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-slate-700">{message}</p>

        <div className="mt-6 rounded-lg bg-white/70 px-3 py-2 font-mono text-sm text-slate-600">
          {code}
        </div>

        <p className="mt-6 text-xs text-slate-500">This check has been recorded.</p>
      </div>

      <Link href="/" className="mt-8 text-sm text-slate-500 underline hover:text-slate-700">
        Powered by El-Miskin QR Verification
      </Link>
    </main>
  );
}
