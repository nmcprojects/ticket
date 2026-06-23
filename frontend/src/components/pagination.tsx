"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Client-side pagination over an in-memory list. Clamps the page when the list shrinks. */
export function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return { page: safePage, setPage, pageCount, pageItems, start, total: items.length };
}

function pageList(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

export function Pagination({
  page,
  pageCount,
  onChange,
  total,
  pageSize,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const btn = "flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      {total != null && pageSize != null ? (
        <p className="text-xs text-faint">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} trên {total}
        </p>
      ) : (
        <span />
      )}
      <nav className="flex items-center gap-1.5" aria-label="Phân trang">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Trang trước"
          className={cn(btn, "border-line bg-surface text-ink hover:border-ink/30")}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-faint">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                btn,
                p === page
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Trang sau"
          className={cn(btn, "border-line bg-surface text-ink hover:border-ink/30")}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
