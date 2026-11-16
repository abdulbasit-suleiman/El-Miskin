"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { getClientAuth } from "@/lib/firebase-client";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut(getClientAuth());
    router.replace("/login");
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-red-600"
    >
      Sign out
    </button>
  );
}
