"use client";
import { useMemo, useState } from "react";
import { Link } from "@/lib/router";
import {
  TrendingUp, TrendingDown, Ticket, ShoppingBag, ScanLine, Plus,
  ArrowUpRight, BadgeCheck, Banknote, CalendarRange, Settings2,
} from "lucide-react";
import { Container, Eyebrow, Button, Badge } from "@/components/ui";
import { Sparkline, Donut, BarChart } from "@/components/charts";
import { DateRangeFilter, presetRange } from "@/components/date-range-filter";
import type { DateRange } from "@/components/date-range-filter";
import { Pagination, usePaged } from "@/components/pagination";
import { api } from "@/lib/api";
import type { BookingDetail, EventStats, OrganizerFull, TicketStats } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import {
  cn, formatVND, formatDateLong, soldPercent, bookingStatusMeta, eventStatusMeta, inDateRange,
} from "@/lib/utils";
import type { AppEvent, BookingStatus } from "@/lib/types";

const ANCHOR = "2026-06-14";


// Palette for the ticket-breakdown donut, applied by segment order.
const DONUT_COLORS = ["#16704f", "#4f9e7f", "#b08544", "#8a8175", "#cdc6ba", "#7d9bb5"];

const BOOKING_STATUS_KEYS: BookingStatus[] = [
  "PENDING_PAYMENT", "PAID", "PAYMENT_FAILED", "CANCELLED", "EXPIRED",
];
const asBookingStatus = (s: string): BookingStatus =>
  (BOOKING_STATUS_KEYS as string[]).includes(s) ? (s as BookingStatus) : "PENDING_PAYMENT";

const dayKey = (iso: string) => iso.slice(0, 10);

type EventBundle = {
  events: AppEvent[];
  stats: Map<string, EventStats>;
  tstats: Map<string, TicketStats>;
  bookings: BookingDetail[];
  org: OrganizerFull;
};

// Resolve the logged-in organizer, then load ONLY their own events and fan out
// stats / ticket-stats / bookings for each. Scoping by organizerId keeps one org
// from seeing another's events or business figures.
async function loadOrganizerData(): Promise<EventBundle> {
  const org = await api.getMyOrganizer();
  const events = await api.listEvents({ organizerId: Number(org.id) });
  const [statsArr, tstatsArr, bookingArr] = await Promise.all([
    Promise.all(events.map((e) => api.getEventStats(e.id).catch(() => null))),
    Promise.all(events.map((e) => api.getTicketStats(e.id).catch(() => null))),
    Promise.all(events.map((e) => api.listBookingsByEvent(e.id).catch(() => [] as BookingDetail[]))),
  ]);
  const stats = new Map<string, EventStats>();
  const tstats = new Map<string, TicketStats>();
  events.forEach((e, i) => {
    if (statsArr[i]) stats.set(e.id, statsArr[i]!);
    if (tstatsArr[i]) tstats.set(e.id, tstatsArr[i]!);
  });
  const bookings = bookingArr.flat();
  return { events, stats, tstats, bookings, org };
}

export default function Organizer() {
  const [range, setRange] = useState<DateRange>(() => presetRange("30", ANCHOR));
  const { data, loading, error, refetch } = useAsync(loadOrganizerData, []);


  const view = useMemo(() => {
    if (!data) return null;
    const { events, stats, tstats, bookings, org } = data;

    // ── Aggregate KPIs across all events ──────────────────────────
    let grossRevenue = 0, sold = 0, checkedIn = 0, issued = 0;
    for (const e of events) {
      const s = stats.get(e.id);
      if (s) { grossRevenue += s.grossRevenue; sold += s.sold; }
      const t = tstats.get(e.id);
      if (t) { checkedIn += t.checkedIn; issued += t.issued; }
    }
    const checkinRate = issued ? checkedIn / issued : 0;
    const openEvents = events.filter((e) => e.status === "PUBLISHED").length;

    // ── Bookings filtered to the selected range ───────────────────
    const dateOf = (b: BookingDetail) => b.createdAt ?? b.paidAt ?? "";
    const inRange = bookings.filter((b) => {
      const d = dateOf(b);
      return d && inDateRange(d, range.from, range.to);
    });

    // Recent orders: newest first, top 6.
    const recentOrders = [...inRange]
      .sort((a, b) => +new Date(dateOf(b)) - +new Date(dateOf(a)))
      .slice(0, 6);

    // ── Revenue-over-time: bucket PAID bookings by day in range ───
    const dayBuckets = new Map<string, number>();
    for (const b of bookings) {
      if (b.status !== "PAID") continue;
      const iso = b.paidAt ?? b.createdAt;
      if (!iso || !inDateRange(iso, range.from, range.to)) continue;
      const k = dayKey(iso);
      dayBuckets.set(k, (dayBuckets.get(k) ?? 0) + b.totalAmount);
    }
    // Build a continuous day axis across the range (or fall back to keys present).
    const days: string[] = [];
    if (range.from && range.to) {
      const cur = new Date(range.from + "T00:00:00");
      const end = new Date(range.to + "T00:00:00");
      while (cur <= end) {
        days.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      days.push(...[...dayBuckets.keys()].sort());
    }
    const revSeries = days.map((d) => dayBuckets.get(d) ?? 0);
    const rangeRevenue = revSeries.reduce((a, v) => a + v, 0);

    let bars: { l: string; v: number }[];
    if (days.length <= 31) {
      bars = days.map((d) => ({ l: d.slice(8, 10), v: Math.round((dayBuckets.get(d) ?? 0) / 1e6) }));
    } else {
      bars = [];
      for (let i = 0; i < days.length; i += 7) {
        const chunk = days.slice(i, i + 7);
        const v = chunk.reduce((a, d) => a + (dayBuckets.get(d) ?? 0), 0);
        bars.push({ l: `T${bars.length + 1}`, v: Math.round(v / 1e6) });
      }
    }

    // Delta: second half vs first half of the revenue series.
    const half = Math.floor(revSeries.length / 2);
    let revDelta = 0;
    if (half) {
      const a = revSeries.slice(0, half).reduce((x, y) => x + y, 0);
      const b = revSeries.slice(half).reduce((x, y) => x + y, 0);
      revDelta = a ? Math.round(((b - a) / a) * 1000) / 10 : 0;
    }

    // Orders/day series for the orders sparkline.
    const orderBuckets = new Map<string, number>();
    for (const b of bookings) {
      const iso = b.createdAt ?? b.paidAt;
      if (!iso || !inDateRange(iso, range.from, range.to)) continue;
      const k = dayKey(iso);
      orderBuckets.set(k, (orderBuckets.get(k) ?? 0) + 1);
    }
    const orderSeries = days.map((d) => orderBuckets.get(d) ?? 0);
    const rangeOrders = orderSeries.reduce((a, v) => a + v, 0);

    // ── Ticket breakdown donut: group aggregated ticketTypes by name ─
    const byName = new Map<string, number>();
    for (const e of events) {
      const s = stats.get(e.id);
      if (!s) continue;
      for (const tt of s.ticketTypes) {
        if (tt.soldQuantity <= 0) continue;
        byName.set(tt.name, (byName.get(tt.name) ?? 0) + tt.soldQuantity);
      }
    }
    const totalSold = [...byName.values()].reduce((a, v) => a + v, 0) || 1;
    const segments = [...byName.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, DONUT_COLORS.length)
      .map(([name, qty], i) => ({
        name,
        value: Math.round((qty / totalSold) * 100),
        qty,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      }));

    const kpis = [
      { label: "Doanh thu", value: formatVND(grossRevenue), delta: revDelta, icon: Banknote, spark: revSeries.map((v) => Math.round(v / 1e6)) },
      { label: "Vé đã bán", value: sold.toLocaleString("vi-VN"), delta: null, foot: `${events.length} sự kiện`, icon: Ticket, spark: revSeries.map((v) => Math.round(v / 1e6)) },
      { label: "Đơn hàng", value: rangeOrders.toLocaleString("vi-VN"), delta: null, foot: range.label, icon: ShoppingBag, spark: orderSeries },
      { label: "Tỉ lệ check-in", value: `${Math.round(checkinRate * 100)}%`, delta: null, foot: `${checkedIn}/${issued} vé`, icon: ScanLine, spark: revSeries.map((v) => Math.round(v / 1e6)) },
    ];

    return {
      events, stats, tstats, org,
      grossRevenue, sold, openEvents,
      bars, rangeRevenue, revDelta, recentOrders, kpis, segments,
    };
  }, [data, range]);

  // Hooks must run before any early return — page over the (possibly empty) event list.
  const eventsPaged = usePaged(view?.events ?? [], 6);

  if (loading) return <Container className="py-9"><LoadingBlock /></Container>;
  if (error || !view) return <Container className="py-9"><ErrorBlock message={error ?? "Không tải được dữ liệu"} onRetry={refetch} /></Container>;

  const { events, stats, org, bars, rangeRevenue, revDelta, recentOrders, kpis, segments } = view;
  const leadSegment = segments[0];

  return (
    <>
      {/* ── Header ───────────────────────────────────────── */}
      <section className="border-b border-line bg-elevated py-9">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {org?.avatarUrl && (
                <img src={org.avatarUrl} alt={org.organizationName} className="h-14 w-14 rounded-2xl object-cover" />
              )}
              <div>
                <Eyebrow>Bảng điều khiển nhà tổ chức</Eyebrow>
                <h1 className="display mt-1.5 flex items-center gap-2 text-3xl font-medium">
                  {org?.organizationName ?? "Nhà tổ chức"}
                  {org?.verified && <BadgeCheck className="h-5 w-5 text-accent" />}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter value={range} onChange={setRange} anchor={ANCHOR} />
              <Button as="link" to="/organizer/events/new" size="sm">
                <Plus className="h-4 w-4" strokeWidth={2} /> Tạo sự kiện
              </Button>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-9">
        {/* ── Quick navigation (primary shortcuts, near the top) ─ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/organizer/events", icon: CalendarRange, label: "Sự kiện", sub: "Quản lý & chỉnh sửa" },
            { to: "/organizer/orders", icon: ShoppingBag, label: "Đơn hàng", sub: "Theo dõi thanh toán" },
            { to: "/organizer/check-ins", icon: ScanLine, label: "Check-in", sub: "Lịch sử ra vào" },
            { to: "/organizer/profile", icon: Settings2, label: "Hồ sơ tổ chức", sub: "Cài đặt & thông tin" },
          ].map((q) => (
            <Link key={q.to} to={q.to} className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft transition-colors hover:border-accent/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <q.icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-ink">{q.label}</p>
                <p className="truncate text-xs text-faint">{q.sub}</p>
              </div>
              <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
            </Link>
          ))}
        </div>

        <p className="mt-9 text-sm text-muted">
          Số liệu <span className="font-medium text-ink">{range.label}</span> · {events.length} sự kiện
        </p>

        {/* ── KPI cards ──────────────────────────────────── */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <k.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                {k.delta !== null ? (
                  <span className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                    k.delta >= 0 ? "bg-accent-soft text-accent-ink" : "bg-red-50 text-red-600"
                  )}>
                    {k.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {Math.abs(k.delta)}%
                  </span>
                ) : (
                  <span className="text-xs font-medium text-faint">{k.foot}</span>
                )}
              </div>
              <p className="mt-4 font-display text-2xl font-semibold text-ink">{k.value}</p>
              <div className="mt-1 flex items-end justify-between">
                <p className="text-sm text-muted">{k.label}</p>
                <Sparkline values={k.spark} width={84} height={28} />
              </div>
            </div>
          ))}
        </div>

        {/* ── Events table (moved up: organizer's main job) ─ */}
        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="display text-2xl font-medium">Sự kiện của bạn</h2>
            <div className="flex items-center gap-3">
              <Button as="link" to="/organizer/events/new" size="sm">
                <Plus className="h-4 w-4" strokeWidth={2} /> Tạo sự kiện
              </Button>
              <Link to="/organizer/events" className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-ink cursor-pointer">
                Xem tất cả <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-4 border-b border-line bg-elevated px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint lg:grid">
              <span>Sự kiện</span>
              <span>Trạng thái</span>
              <span>Đã bán</span>
              <span>Check-in</span>
              <span>Doanh thu</span>
              <span></span>
            </div>
            {events.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted">Chưa có sự kiện nào.</p>
            )}
            {eventsPaged.pageItems.map((ev, i) => {
              const s = stats.get(ev.id);
              const sold = s ? s.sold : ev.ticketTypes.reduce((acc, t) => acc + t.soldQuantity, 0);
              const total = s ? s.capacity : ev.ticketTypes.reduce((acc, t) => acc + t.totalQuantity, 0);
              const rev = s ? s.grossRevenue : ev.ticketTypes.reduce((acc, t) => acc + t.soldQuantity * t.price, 0);
              const pct = s ? s.soldPercent : soldPercent({ soldQuantity: sold, totalQuantity: total });
              const t = view.tstats.get(ev.id);
              const sMeta = eventStatusMeta[ev.status];
              return (
                <Link
                  key={ev.id}
                  to={`/organizer/events/${ev.id}`}
                  className={cn(
                    "group grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-ink/[0.025] cursor-pointer lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]",
                    i > 0 && "border-t border-line"
                  )}
                  aria-label={`Quản lý sự kiện ${ev.title}`}
                >
                  <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
                    <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-lg bg-elevated">
                      <img src={ev.bannerUrl} alt={ev.title} className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{ev.title}</p>
                      <p className="text-xs text-faint">{formatDateLong(ev.startTime)} · {ev.city}</p>
                    </div>
                  </div>
                  <div><Badge className={sMeta.tone}>{sMeta.label}</Badge></div>
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">{sold}/{total}</span>
                      <span className="text-faint">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <ScanLine className="h-3.5 w-3.5 text-faint" strokeWidth={1.75} /> {t ? `${t.checkinPercent}%` : "—"}
                  </p>
                  <p className="font-display font-semibold text-ink">{formatVND(rev)}</p>
                  <span className="col-span-2 flex items-center justify-center gap-1.5 rounded-full border border-line bg-elevated px-3 py-1.5 text-xs font-semibold text-ink transition-colors group-hover:border-accent/40 group-hover:bg-accent-soft group-hover:text-accent-ink lg:col-span-1 lg:justify-self-end lg:border-transparent lg:bg-transparent">
                    Quản lý <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>

          <Pagination
            className="mt-5"
            page={eventsPaged.page}
            pageCount={eventsPaged.pageCount}
            onChange={eventsPaged.setPage}
            total={eventsPaged.total}
            pageSize={6}
          />
        </div>

        {/* ── Revenue chart + donut ──────────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-ink">Doanh thu theo thời gian</h2>
                <p className="text-sm text-muted">{range.label} · đơn vị: triệu VND</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-semibold text-ink">{formatVND(rangeRevenue)}</p>
                <span className={cn("flex items-center justify-end gap-1 text-sm font-semibold", revDelta >= 0 ? "text-accent" : "text-red-600")}>
                  {revDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {revDelta >= 0 ? "+" : ""}{revDelta}%
                </span>
              </div>
            </div>
            <div className="mt-6">
              {bars.some((b) => b.v > 0) ? (
                <BarChart bars={bars} height={210} formatValue={(v) => `${Math.round(v)}`} />
              ) : (
                <p className="py-20 text-center text-sm text-muted">Chưa có doanh thu đã thanh toán trong khoảng đã chọn.</p>
              )}
            </div>
          </div>

          {/* Donut */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
            <h2 className="font-semibold text-ink">Cơ cấu vé đã bán</h2>
            <p className="text-sm text-muted">Theo loại vé</p>
            {segments.length > 0 ? (
              <>
                <div className="mt-4 flex justify-center">
                  <div className="relative">
                    <Donut segments={segments} size={172} thickness={24} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-semibold text-ink">{leadSegment.value}%</span>
                      <span className="text-xs text-faint">nhóm dẫn đầu</span>
                    </div>
                  </div>
                </div>
                <ul className="mt-5 space-y-2.5">
                  {segments.map((seg) => (
                    <li key={seg.name} className="flex items-center gap-2.5 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
                      <span className="flex-1 truncate text-muted">{seg.name}</span>
                      <span className="font-semibold tabular-nums text-ink">{seg.value}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-20 text-center text-sm text-muted">Chưa có vé nào được bán.</p>
            )}
          </div>
        </div>

        {/* ── Recent orders (real bookings) ──────────────── */}
        <div className="mt-8">
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink">Đơn hàng gần đây</h2>
              <Link to="/organizer/orders" className="flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-ink cursor-pointer">
                Xem tất cả <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            {recentOrders.length > 0 ? (
              <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {recentOrders.map((o) => {
                  const meta = bookingStatusMeta[asBookingStatus(o.status)];
                  const who = o.customerEmail ?? "Khách";
                  const initial = who.trim()[0]?.toUpperCase() ?? "K";
                  return (
                    <li key={o.id} className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{who}</p>
                        <p className="truncate text-xs text-faint"><span className="font-mono">{o.code}</span> · {o.eventTitle}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-ink">{formatVND(o.totalAmount)}</p>
                        <span className={cn("inline-block rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold", meta.tone)}>
                          {meta.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-10 text-center text-sm text-muted">Không có đơn hàng trong khoảng này.</p>
            )}
          </div>
        </div>

      </Container>
    </>
  );
}
