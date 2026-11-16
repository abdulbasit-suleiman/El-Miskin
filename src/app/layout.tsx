import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "El-Miskin QR Product Verification",
  description:
    "Scan a QR code on any El-Miskin product to check whether it is genuine.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
