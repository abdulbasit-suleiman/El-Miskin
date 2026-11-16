"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";

export interface DashboardAccount {
  uid: string;
  name: string;
  email: string;
  role: "owner" | "admin";
  ownerId: string;
}

interface DashboardContextValue {
  account: DashboardAccount | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const DashboardContext = createContext<DashboardContextValue>({
  account: null,
  loading: true,
  error: null,
  reload: () => {},
});

export function useDashboard(): DashboardContextValue {
  return useContext(DashboardContext);
}

/**
 * Loads the signed-in manufacturer's account (role + ownerId) once and shares
 * it with the dashboard. All data queries are scoped to `account.ownerId`,
 * so sub-admins see the same products as the account owner.
 */
export default function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<DashboardAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiGet("/api/account")
      .then((data) => {
        if (!cancelled) setAccount(data as DashboardAccount);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e?.message ?? "Could not load your account.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <DashboardContext.Provider value={{ account, loading, error, reload }}>
      {children}
    </DashboardContext.Provider>
  );
}
