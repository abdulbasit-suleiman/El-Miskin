"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

/** Wraps dashboard pages: waits for Firebase Auth, redirects to /login if signed out. */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (user) => {
      setSignedIn(!!user);
      setReady(true);
      if (!user) router.replace("/login");
    });
    return unsub;
  }, [router]);

  if (!ready || !signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
