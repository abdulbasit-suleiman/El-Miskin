import { Suspense } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import DashboardProvider from "@/components/DashboardProvider";
import NavLinks from "@/components/NavLinks";
import SearchBar from "@/components/SearchBar";
import SignOutButton from "@/components/SignOutButton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardProvider>
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="shrink-0 border-b border-slate-200 bg-white p-4 md:w-56 md:border-b-0 md:border-r">
            <div className="mb-4 px-2">
              <Link href="/dashboard" className="font-bold text-emerald-700">
                El-Miskin
              </Link>
              <p className="text-xs text-slate-500">Manufacturer dashboard</p>
            </div>
            <div className="flex justify-between gap-4 md:flex-col md:justify-start">
              <NavLinks />
              <div className="md:mt-6 md:border-t md:border-slate-100 md:pt-3">
                <SignOutButton />
              </div>
            </div>
          </aside>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mb-6">
              <Suspense fallback={null}>
                <SearchBar />
              </Suspense>
            </div>
            {children}
          </main>
        </div>
      </DashboardProvider>
    </AuthGuard>
  );
}
