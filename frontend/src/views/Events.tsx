"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "@/lib/router";
import { Search, SlidersHorizontal, X, Loader2 } from "lucide-react";
import { Container, Eyebrow } from "@/components/ui";
import { EventCard } from "@/components/event-card";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";
import type { EventCategory, AppEvent } from "@/lib/types";

const ALL_CATEGORIES: (EventCategory | "Tất cả")[] = [
  "Tất cả", "Âm nhạc", "Sân khấu", "Workshop", "Thể thao", "Hội thảo", "Nghệ thuật",
];

const SORTS = [
  { value: "soon", label: "Sắp diễn ra" },
  { value: "price-asc", label: "Giá thấp → cao" },
  { value: "price-desc", label: "Giá cao → thấp" },
] as const;

function lowestPrice(ticketTypes: { price: number }[]) {
  return Math.min(...ticketTypes.map((t) => t.price));
}

export default function Events({ initialEvents }: { initialEvents?: AppEvent[] } = {}) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const categoryParam = searchParams.get("category");
  const [category, setCategory] = useState<(typeof ALL_CATEGORIES)[number]>(
    categoryParam && (ALL_CATEGORIES as string[]).includes(categoryParam)
      ? (categoryParam as (typeof ALL_CATEGORIES)[number])
      : "Tất cả"
  );
  const [city, setCity] = useState<string>("Tất cả");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("soon");

  const { data, loading, error, refetch } = useAsync(() => api.listEvents(), [], initialEvents);
  const events = useMemo(() => data ?? [], [data]);

  const cities = useMemo(
    () => ["Tất cả", ...Array.from(new Set(events.map((e) => e.city)))],
    [events]
  );

  const filtered = useMemo(() => {
    let list = events.filter((e) => {
      const matchQuery =
        !query.trim() ||
        e.title.toLowerCase().includes(query.toLowerCase()) ||
        e.venue.toLowerCase().includes(query.toLowerCase()) ||
        e.organizer.organizationName.toLowerCase().includes(query.toLowerCase());
      const matchCat = category === "Tất cả" || e.category === category;
      const matchCity = city === "Tất cả" || e.city === city;
      return matchQuery && matchCat && matchCity;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price-asc") return lowestPrice(a.ticketTypes) - lowestPrice(b.ticketTypes);
      if (sort === "price-desc") return lowestPrice(b.ticketTypes) - lowestPrice(a.ticketTypes);
      return +new Date(a.startTime) - +new Date(b.startTime);
    });
    return list;
  }, [events, query, category, city, sort]);

  const hasFilters = category !== "Tất cả" || city !== "Tất cả" || query.trim() !== "";

  // ── Lazy pagination: reveal more as the user scrolls (or via the fallback button) ──
  const STEP = 9;
  const [visible, setVisible] = useState(STEP);
  // Reset back to the first batch whenever the result set changes.
  useEffect(() => setVisible(STEP), [query, category, city, sort]);
  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const hasMore = visible < filtered.length;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisible((v) => v + STEP);
      },
      { rootMargin: "300px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visible]);

  return (
    <>
      <section className="border-b border-line bg-elevated py-12">
        <Container>
          <Eyebrow>Khám phá</Eyebrow>
          <h1 className="display mt-4 text-4xl font-medium sm:text-5xl">Tất cả sự kiện</h1>
          <p className="mt-3 max-w-lg text-muted">
            {events.length} sự kiện đang mở bán trên khắp các thành phố. Lọc theo danh mục,
            địa điểm hoặc tìm theo tên.
          </p>
        </Container>
      </section>

      <section className="py-10">
        <Container>
          {/* Controls */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 shadow-soft focus-within:border-accent/60">
                <Search className="h-5 w-5 text-muted" strokeWidth={1.75} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo tên, địa điểm, nhà tổ chức…"
                  aria-label="Tìm kiếm sự kiện"
                  className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
                />
                {query && (
                  <button onClick={() => setQuery("")} aria-label="Xoá tìm kiếm" className="text-faint hover:text-ink cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <label className="sr-only" htmlFor="city">Thành phố</label>
                <select
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-12 min-w-0 flex-1 cursor-pointer rounded-full border border-line bg-surface px-4 text-sm font-medium outline-none focus:border-accent/60 sm:flex-none"
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface pl-4 pr-2 sm:flex-none">
                  <SlidersHorizontal className="h-4 w-4 text-muted" strokeWidth={1.75} />
                  <label className="sr-only" htmlFor="sort">Sắp xếp</label>
                  <select
                    id="sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as typeof sort)}
                    className="h-full cursor-pointer bg-transparent pr-2 text-sm font-medium outline-none"
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Category chips */}
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-200 cursor-pointer sm:h-9",
                    category === cat
                      ? "border-ink bg-ink text-canvas"
                      : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={refetch} /> : (
          <>
          {/* Result meta */}
          <div className="mt-8 flex items-center justify-between">
            <p className="text-sm text-muted">
              <span className="font-semibold text-ink">{filtered.length}</span> kết quả
            </p>
            {hasFilters && (
              <button
                onClick={() => { setCategory("Tất cả"); setCity("Tất cả"); setQuery(""); }}
                className="text-sm font-medium text-accent hover:text-accent-ink cursor-pointer"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>

          {/* Grid */}
          {filtered.length > 0 ? (
            <>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((ev) => (
                  <EventCard key={ev.id} ev={ev} />
                ))}
              </div>

              {hasMore ? (
                <div ref={sentinelRef} className="mt-10 flex flex-col items-center gap-2">
                  <button
                    onClick={() => setVisible((v) => v + STEP)}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink shadow-soft transition-colors hover:border-ink/30 cursor-pointer"
                  >
                    <Loader2 className="h-4 w-4 animate-spin text-muted" strokeWidth={1.75} />
                    Xem thêm sự kiện
                  </button>
                  <p className="text-xs text-faint">
                    Đang hiển thị {shown.length} / {filtered.length}
                  </p>
                </div>
              ) : (
                filtered.length > STEP && (
                  <p className="mt-10 text-center text-xs text-faint">
                    Đã hiển thị tất cả {filtered.length} sự kiện
                  </p>
                )
              )}
            </>
          ) : (
            <div className="mt-16 flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-faint">
                <Search className="h-6 w-6" />
              </span>
              <p className="font-semibold text-ink">Không tìm thấy sự kiện phù hợp</p>
              <p className="max-w-sm text-sm text-muted">
                Thử từ khoá khác hoặc xoá bớt bộ lọc để xem nhiều sự kiện hơn.
              </p>
            </div>
          )}
          </>
          )}
        </Container>
      </section>
    </>
  );
}
