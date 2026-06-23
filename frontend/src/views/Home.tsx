"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import {
  Search, MapPin, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight,
  Ticket, Music, Theater, Hammer, Trophy, Presentation, Palette,
} from "lucide-react";
import { Container, Eyebrow, Button } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { cn, formatVND, parseDate } from "@/lib/utils";
import type { AppEvent } from "@/lib/types";

const categoryIcons: Record<string, typeof Music> = {
  "Âm nhạc": Music, "Sân khấu": Theater, Workshop: Hammer,
  "Thể thao": Trophy, "Hội thảo": Presentation, "Nghệ thuật": Palette,
};

const CATEGORY_NAMES = ["Âm nhạc", "Sân khấu", "Workshop", "Thể thao", "Hội thảo", "Nghệ thuật"];

// Mỗi thể loại là một section riêng (theo bố cục ticketbox.vn).
const HOME_SECTIONS: { title: string; eyebrow: string; cats: string[] }[] = [
  { title: "Âm nhạc", eyebrow: "Nhạc sống", cats: ["Âm nhạc"] },
  { title: "Sân khấu", eyebrow: "Trình diễn", cats: ["Sân khấu"] },
  { title: "Nghệ thuật", eyebrow: "Triển lãm", cats: ["Nghệ thuật"] },
  { title: "Thể thao", eyebrow: "Trên sân", cats: ["Thể thao"] },
  { title: "Workshop", eyebrow: "Trải nghiệm", cats: ["Workshop"] },
  { title: "Hội thảo", eyebrow: "Kết nối", cats: ["Hội thảo"] },
];

function lowestPrice(ev: AppEvent): number {
  const selling = ev.ticketTypes.filter((t) => t.status !== "DISABLED");
  return selling.length ? Math.min(...selling.map((t) => t.price)) : 0;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// ── Poster card (streaming-row style) ──────────────────────────
function PosterCard({ ev }: { ev: AppEvent }) {
  const d = parseDate(ev.startTime);
  return (
    <Link
      to={`/events/${ev.id}`}
      className="group relative block w-[230px] shrink-0 overflow-hidden rounded-xl ring-1 ring-canvas/10 transition-transform duration-300 hover:-translate-y-1 sm:w-[250px]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-ink">
        <img
          src={ev.bannerUrl}
          alt={ev.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/35 to-transparent" />
        <div className="absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/20" />
        <span className="absolute left-3 top-3 rounded-full border border-canvas/20 bg-ink/40 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.15em] text-canvas/85 backdrop-blur-sm">
          {ev.category}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gold">
            {pad2(d.day)} {d.month} · {d.hours}:{d.minutes}
          </p>
          <h3 className="display mt-1.5 line-clamp-2 text-lg font-medium leading-tight text-canvas">
            {ev.title}
          </h3>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-canvas/55">
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span className="truncate">{ev.venue}, {ev.city}</span>
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-canvas/10 pt-3">
            <span className="text-sm font-semibold text-canvas">
              <span className="text-[0.65rem] font-normal uppercase tracking-wide text-canvas/45">Từ </span>
              {formatVND(lowestPrice(ev))}
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas/10 text-canvas transition-colors group-hover:bg-gold group-hover:text-ink">
              <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Horizontal rail with desktop arrows ────────────────────────
function Rail({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 540, behavior: "smooth" });
  return (
    <div className="relative">
      <div
        ref={ref}
        className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0"
      >
        {children}
      </div>
      <button
        onClick={() => scroll(-1)}
        aria-label="Cuộn trái"
        className="absolute -left-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-canvas/15 bg-ink/80 text-canvas backdrop-blur transition-colors hover:border-gold/60 hover:text-gold lg:flex cursor-pointer"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scroll(1)}
        aria-label="Cuộn phải"
        className="absolute -right-5 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-canvas/15 bg-ink/80 text-canvas backdrop-blur transition-colors hover:border-gold/60 hover:text-gold lg:flex cursor-pointer"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function Home({ initialEvents }: { initialEvents?: AppEvent[] } = {}) {
  const { data, loading, error, refetch } = useAsync(
    () => api.listEvents({ status: "PUBLISHED" }),
    [],
    initialEvents
  );
  const events = data ?? [];
  const categories = useMemo(
    () => CATEGORY_NAMES
      .map((name) => ({ name, count: events.filter((e) => e.category === name).length }))
      .filter((c) => c.count > 0),
    [events]
  );
  const sections = useMemo(
    () =>
      HOME_SECTIONS.map((s) => ({ ...s, items: events.filter((e) => s.cats.includes(e.category)) }))
        .filter((s) => s.items.length > 0),
    [events]
  );
  const featuredSrc = events.filter((e) => e.featured);
  const featured = (featuredSrc.length ? featuredSrc : events).slice(0, 5);
  const nowShowing = events.slice(0, 10);

  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance the billboard like a cinema marquee (pauses on hover, respects reduced motion).
  useEffect(() => {
    if (featured.length <= 1 || paused) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % featured.length), 7000);
    return () => clearInterval(id);
  }, [featured.length, paused]);

  const current = featured[active] ?? featured[0];

  return (
    <>
      {/* ════ CINEMATIC BLOCK (dark) ════════════════════════════ */}
      <div className="relative bg-ink text-canvas">
        {/* film grain over the whole dark block */}
        <div className="grain pointer-events-none absolute inset-0" />

        {/* ── Billboard hero ──────────────────────────────────── */}
        <section
          className="relative isolate flex min-h-[88vh] flex-col justify-end overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Backdrops (crossfade) */}
          <div className="absolute inset-0">
            {loading && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-ink via-ink/80 to-ink" />}
            {featured.map((ev, i) => (
              <img
                key={ev.id}
                src={ev.bannerUrl}
                alt=""
                aria-hidden
                className={cn(
                  "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000",
                  i === active ? "opacity-100 kenburns" : "opacity-0"
                )}
              />
            ))}
            {/* Cinematic scrims: bottom + left for legibility, plus a soft vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/25 to-transparent" />
            <div className="absolute inset-0 shadow-[inset_0_0_180px_60px_rgb(var(--ink))]" />
          </div>

          {/* Top marquee strip */}
          <Container className="pointer-events-none relative pt-8">
            <div className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.25em] text-gold">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-gold" />
              Đang chiếu — Mùa sự kiện 2026
              <span className="hidden h-px flex-1 bg-canvas/15 sm:block" />
            </div>
          </Container>

          {/* Hero content */}
          <Container className="relative pb-10 pt-10 lg:pb-16">
            {error ? (
              <div className="flex flex-col items-start gap-4 py-16">
                <p className="text-canvas/70">Không tải được chương trình.</p>
                <button onClick={refetch} className="rounded-full bg-canvas px-5 py-2.5 text-sm font-medium text-ink cursor-pointer">
                  Thử lại
                </button>
              </div>
            ) : current ? (
              <div className="max-w-2xl">
                <div className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.2em] text-canvas/60">
                  <span className="rounded border border-gold/40 px-2 py-0.5 text-gold">{current.category}</span>
                  <span>{parseDate(current.startTime).weekday}, {pad2(parseDate(current.startTime).day)} {parseDate(current.startTime).month}</span>
                </div>
                <h1 className="display mt-4 text-5xl font-medium leading-[0.98] tracking-tight text-balance sm:text-6xl lg:text-[5rem]">
                  {current.title}
                </h1>
                <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-canvas/65">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" strokeWidth={1.75} /> {current.venue}, {current.city}
                  </span>
                  <span className="hidden h-3 w-px bg-canvas/25 sm:block" />
                  <span>Từ <span className="font-semibold text-canvas">{formatVND(lowestPrice(current))}</span></span>
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Button as="link" to={`/events/${current.id}`} variant="light" size="lg" className="shadow-lift">
                    <Ticket className="h-4 w-4" strokeWidth={2} /> Đặt vé ngay
                  </Button>
                  <Button as="link" to="/events" variant="outlineLight" size="lg">
                    Tất cả sự kiện <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Button>
                </div>

                {/* Glass search */}
                <form
                  action="/events"
                  className="mt-8 flex max-w-md items-center gap-2 rounded-full border border-canvas/20 bg-ink/40 p-1.5 pl-4 backdrop-blur-md transition-colors focus-within:border-gold/50"
                >
                  <Search className="h-4 w-4 shrink-0 text-canvas/50" strokeWidth={1.75} />
                  <input
                    name="q"
                    placeholder="Tìm sự kiện, nghệ sĩ, địa điểm…"
                    aria-label="Tìm kiếm sự kiện"
                    className="h-9 flex-1 bg-transparent text-sm text-canvas outline-none placeholder:text-canvas/40"
                  />
                  <button className="flex h-9 items-center rounded-full bg-canvas px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas/90 cursor-pointer">
                    Tìm
                  </button>
                </form>
              </div>
            ) : (
              <div className="py-24" />
            )}
          </Container>

          {/* Featured selector (bottom-right billboard reel) */}
          {featured.length > 1 && (
            <Container className="relative pb-9">
              <div className="flex items-end justify-between gap-4">
                <span className="font-mono text-xs tracking-[0.2em] text-canvas/45">
                  {pad2(active + 1)} <span className="text-canvas/25">/ {pad2(featured.length)}</span>
                </span>
                <div className="flex gap-2.5">
                  {featured.map((ev, i) => (
                    <button
                      key={ev.id}
                      onClick={() => setActive(i)}
                      aria-label={`Xem ${ev.title}`}
                      className={cn(
                        "relative h-16 w-12 shrink-0 overflow-hidden rounded-md ring-1 transition-all duration-300",
                        i === active
                          ? "scale-105 ring-2 ring-gold"
                          : "opacity-50 ring-canvas/20 hover:opacity-90"
                      )}
                    >
                      <img src={ev.bannerUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </Container>
          )}
        </section>

        {/* ── Now showing rail ────────────────────────────────── */}
        <section className="relative border-t border-canvas/10 py-14">
          <Container>
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-gold">Suất chiếu mới</span>
                <h2 className="display mt-2 text-3xl font-medium sm:text-4xl">Đang mở bán</h2>
              </div>
              <Link to="/events" className="group hidden items-center gap-1.5 text-sm font-medium text-canvas/70 transition-colors hover:text-canvas sm:flex">
                Xem tất cả
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
              </Link>
            </div>

            <div className="mt-8">
              {loading ? (
                <div className="flex gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-[330px] w-[230px] shrink-0 animate-pulse rounded-xl bg-canvas/[0.06] sm:w-[250px]" />
                  ))}
                </div>
              ) : (
                <Rail>
                  {nowShowing.map((ev) => <PosterCard key={ev.id} ev={ev} />)}
                </Rail>
              )}
            </div>
          </Container>
        </section>

        {/* ── Genres ──────────────────────────────────────────── */}
        <section className="relative border-t border-canvas/10 py-14">
          <Container>
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-gold">Thể loại</span>
            <h2 className="display mt-2 text-3xl font-medium sm:text-4xl">Chọn gu của bạn</h2>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {categories.map((cat) => {
                const Icon = categoryIcons[cat.name] ?? Music;
                return (
                  <Link
                    key={cat.name}
                    to="/events"
                    className="group inline-flex items-center gap-2.5 rounded-full border border-canvas/15 bg-canvas/[0.03] py-2.5 pl-3 pr-4 text-sm text-canvas/80 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/50 hover:bg-canvas/[0.06] hover:text-canvas"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas/10 text-gold transition-colors group-hover:bg-gold group-hover:text-ink">
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="font-medium">{cat.name}</span>
                    <span className="font-mono text-xs text-canvas/35">{pad2(cat.count)}</span>
                  </Link>
                );
              })}
            </div>
          </Container>
        </section>

        {/* ── Category sections (mỗi thể loại 1 section, kiểu ticketbox) ── */}
        {!loading && sections.map((sec) => (
          <section key={sec.title} className="relative border-t border-canvas/10 py-14">
            <Container>
              <Reveal>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-gold">{sec.eyebrow}</span>
                    <h2 className="display mt-2 text-3xl font-medium sm:text-4xl">{sec.title}</h2>
                  </div>
                  <Link
                    to={sec.cats.length === 1 ? `/events?category=${encodeURIComponent(sec.cats[0])}` : "/events"}
                    className="group hidden items-center gap-1.5 text-sm font-medium text-canvas/70 transition-colors hover:text-canvas sm:flex"
                  >
                    Xem tất cả
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
                  </Link>
                </div>
                <div className="mt-8">
                  <Rail>
                    {sec.items.map((ev) => <PosterCard key={ev.id} ev={ev} />)}
                  </Rail>
                </div>
              </Reveal>
            </Container>
          </section>
        ))}
      </div>

      {/* ════ LOBBY BLOCK (light) ═══════════════════════════════ */}
      {/* ── Organizer CTA ───────────────────────────────────── */}
      <section className="py-20">
        <Container>
          <div className="relative overflow-hidden rounded-2xl bg-ink px-8 py-14 text-canvas grain sm:px-14">
            <div className="relative max-w-xl">
              <Eyebrow className="text-gold">Dành cho nhà tổ chức</Eyebrow>
              <h2 className="display mt-4 text-3xl font-medium leading-tight sm:text-4xl">
                Tổ chức sự kiện của riêng bạn và bán vé trong vài phút.
              </h2>
              <p className="mt-4 text-canvas/65">
                Tạo sự kiện, thiết lập loại vé, theo dõi doanh thu và check-in khách —
                tất cả trong một bảng điều khiển.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button as="link" to="/organizer" variant="light">
                  Mở trang tổ chức <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Button>
                <Button as="link" to="/check-in" variant="outlineLight">
                  Thử check-in
                </Button>
              </div>
            </div>
            <div className="pointer-events-none absolute -right-10 -top-10 hidden h-72 w-72 rounded-full border border-canvas/10 sm:block" />
            <div className="pointer-events-none absolute -bottom-20 right-20 hidden h-72 w-72 rounded-full border border-canvas/10 sm:block" />
          </div>
        </Container>
      </section>
    </>
  );
}
