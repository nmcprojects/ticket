"use client";

// Compatibility shim: lets the existing react-router-style code run on Next.js
// App Router with minimal changes. Maps `to=`/useNavigate/useParams/useSearchParams/
// useLocation onto next/navigation + next/link.

import NextLink from "next/link";
import {
  useRouter,
  usePathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/navigation";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  replace?: boolean;
  prefetch?: boolean;
  children?: ReactNode;
  // react-router-only props we silently accept/ignore:
  state?: unknown;
  end?: boolean;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, replace, prefetch, state: _state, end: _end, ...rest },
  ref
) {
  return <NextLink ref={ref} href={to} replace={replace} prefetch={prefetch} {...rest} />;
});

type NavigateOptions = { replace?: boolean; state?: unknown };

export function useNavigate() {
  const router = useRouter();
  return (to: string | number, opts?: NavigateOptions) => {
    if (typeof to === "number") {
      if (to < 0) router.back();
      else router.forward();
      return;
    }
    if (opts?.replace) router.replace(to);
    else router.push(to);
  };
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return (useNextParams() ?? {}) as unknown as T;
}

/** react-router returns [searchParams, setSearchParams]; we expose a read-only tuple. */
export function useSearchParams() {
  const sp = useNextSearchParams();
  const params = sp ?? new URLSearchParams();
  const noop = () => {};
  return [params, noop] as const;
}

export function useLocation() {
  // pathname only — calling useSearchParams here would force every page (navbar is
  // global) to need a Suspense boundary. Pages that need the query use useSearchParams.
  const pathname = usePathname() ?? "/";
  return { pathname, search: "", hash: "", state: null as unknown };
}
