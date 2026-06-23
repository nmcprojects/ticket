"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | null; loading: boolean; error: string | null };

/** Runs an async fn on mount (and when deps change); exposes a refetch().
 *  Pass `initialData` (e.g. from a Next.js server component) to render with content
 *  immediately — avoids the loading flash and gives SSR/SEO content. */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  initialData?: T
): State<T> & { refetch: () => void } {
  const [state, setState] = useState<State<T>>({
    data: initialData ?? null,
    loading: initialData == null,
    error: null,
  });

  const run = useCallback((silent = false) => {
    let active = true;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((e) =>
        active &&
        setState((s) =>
          // A silent background refresh that fails keeps the already-shown (seeded) data.
          silent && s.data != null
            ? s
            : { data: null, loading: false, error: e?.message ?? "Đã có lỗi xảy ra" }
        )
      );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // First run after server-seeded data is SILENT: refresh in the background without a
  // loading flash. Otherwise it's a normal load.
  const seeded = useRef(initialData != null);
  useEffect(() => {
    const silent = seeded.current;
    seeded.current = false;
    return run(silent);
  }, [run]);

  return { ...state, refetch: () => run(false) };
}
