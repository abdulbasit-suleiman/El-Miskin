import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-600">
        El-Miskin
      </p>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        QR Product Verification
      </h1>
      <p className="mt-4 max-w-xl text-lg text-slate-600">
        Every product ships with a unique, single-use QR code. Scan it with any
        phone camera to check whether the product is genuine.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Manufacturer Login
        </Link>
      </div>

      <p className="mt-6 max-w-md text-sm text-slate-500">
        Have a product in hand? Scan the QR code on its label with your phone camera.
      </p>

      <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
        {[
          {
            title: "Generate codes",
            body: "Create batches of unique crypto-random codes and download QR images and CSVs.",
          },
          {
            title: "Verify by scanning",
            body: "Anyone can scan a code, and no login is needed. The first scan confirms the product is genuine.",
          },
          {
            title: "Track scans",
            body: "Watch genuine, repeat and invalid scans per product, with weekly charts.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm">
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
