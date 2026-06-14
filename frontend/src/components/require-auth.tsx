"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageLoading } from "@/components/states";

/**
 * Gate for auth-required pages. Children are NOT mounted until the user is known to be
 * logged in — so their data fetches never fire (and never 401) for guests. While the
 * session is resolving we show a loader; guests are redirected to /login?redirect=…
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
    }
  }, [loading, user, pathname, router]);

  if (loading) return <PageLoading />;
  if (!user) return null; // redirecting to login
  return <>{children}</>;
}
