"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { PageLoading } from "@/components/states";

/**
 * Gate for pages that require a specific role. Redirects to / if the user lacks the role.
 * Unauthenticated users are redirected to /login?redirect=…
 */
export function RequireRole({
  children,
  role,
}: {
  children: ReactNode;
  role: string;
}) {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    if (!hasRole(role)) {
      router.replace("/");
    }
  }, [loading, user, hasRole, role, pathname, router]);

  if (loading) return <PageLoading />;
  if (!user || !hasRole(role)) return null;
  return <>{children}</>;
}
