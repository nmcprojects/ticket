"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Mail, Ban, Loader2, X, ChevronDown, Ticket, RotateCcw, Inbox } from "lucide-react";
import { Container, Button, Badge } from "@/components/ui";
import { OrganizerPageHeader, StatPills } from "@/components/organizer-header";
import { DateRangeFilter, presetRange } from "@/components/date-range-filter";
import type { DateRange } from "@/components/date-range-filter";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import { useToast } from "@/components/toast";
import { Pagination, usePaged } from "@/components/pagination";
import { api } from "@/lib/api";
import type { BookingDetail } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import type { BookingStatus } from "@/lib/types";
import { cn, formatVND, formatDateTime, bookingStatusMeta, inDateRange } from "@/lib/utils";

const ANCHOR = "2026-06-14";

const FILTERS: { key: BookingStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PAID", label: "Đã thanh toán" },
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { key: "CANCELLED", label: "Đã huỷ" },
  { key: "PAYMENT_FAILED", label: "Thất bại" },
];

/** A booking row with the originating event title attached for display. */
type OrderRow = BookingDetail;

function bookingDate(b: BookingDetail): string {
  return b.createdAt ?? b.paidAt ?? "";
}

function itemsSummary(b: BookingDetail): string {
  if (!b.items?.length) return "—";
  return b.items.map((it) => `${it.quantity}× ${it.ticketTypeName}`).join(", ");
}

function statusMeta(status: string) {
  return (
    bookingStatusMeta[status as BookingStatus] ?? {
      label: status,
      tone: "bg-faint/15 text-muted border-line",
    }
  );
}

export default function OrganizerOrders() {
  const toast = useToast();
  const [filter, setFilter] = useState<BookingStatus | "ALL">("ALL");
  const [eventFilter, setEventFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange>(() => presetRange("all", ANCHOR));

  // Per-row local overrides (after a cancel) + busy/error tracking.
  const [overrides, setOverrides] = useState<Record<number, BookingDetail>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  // Load ONLY the logged-in organizer's own events, then their bookings in parallel.
  // (Fetching every event would 403 on other orgs' events under per-event ownership.)
  const { data, loading, error, refetch } = useAsync<{
    orders: OrderRow[];
    events: { id: string; title: string }[];
  }>(async () => {
    const org = await api.getMyOrganizer();
    const events = await api.listEvents({ organizerId: Number(org.id) });
    const perEvent = await Promise.all(
      events.map((ev) => api.listBookingsByEvent(ev.id).catch(() => [] as BookingDetail[]))
    );
    const orders = perEvent
      .flat()
      .sort((a, b) => {
        const da = bookingDate(a);
        const db = bookingDate(b);
        if (da && db && da !== db) return da < db ? 1 : -1;
        return b.id - a.id;
      });
    return {
      orders,
      events: events.map((ev) => ({ id: ev.id, title: ev.title })),
    };
  }, []);

  const allOrders: OrderRow[] = useMemo(() => {
    const base = data?.orders ?? [];
    return base.map((o) => overrides[o.id] ?? o);
  }, [data, overrides]);

  const events = data?.events ?? [];

  const list = useMemo(() => {
    return allOrders.filter((o) => {
      const matchStatus = filter === "ALL" || o.status === filter;
      const matchEvent = eventFilter === "ALL" || String(o.eventId) === eventFilter;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        o.code.toLowerCase().includes(q) ||
        (o.customerEmail ?? "").toLowerCase().includes(q) ||
        (o.eventTitle ?? "").toLowerCase().includes(q);
      const d = bookingDate(o);
      const matchDate = !d || inDateRange(d, range.from, range.to);
      return matchStatus && matchEvent && matchQuery && matchDate;
    });
  }, [allOrders, filter, eventFilter, query, range]);

  const paidOrders = allOrders.filter((o) => o.status === "PAID");
  const revenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
  const cancelledCount = allOrders.filter((o) => o.status === "CANCELLED").length;

  // Per-status counts shown inline on the filter chips.
  const countByStatus = useMemo(() => {
    const c: Record<string, number> = {};
    for (const o of allOrders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [allOrders]);

  const anyFilter = filter !== "ALL" || eventFilter !== "ALL" || !!query.trim() || !!range.from;
  const clearFilters = () => {
    setFilter("ALL");
    setEventFilter("ALL");
    setQuery("");
    setRange(presetRange("all", ANCHOR));
  };

  const { page, setPage, pageCount, pageItems, total } = usePaged(list, 12);
  useEffect(() => setPage(1), [filter, eventFilter, query, range, setPage]);

  async function handleCancel(o: OrderRow) {
    if (!window.confirm(`Huỷ và hoàn vé cho đơn ${o.code}?\nHành động này không thể hoàn tác.`)) {
      return;
    }
    setBusyId(o.id);
    setRowError((m) => {
      const next = { ...m };
      delete next[o.id];
      return next;
    });
    try {
      const updated = await api.cancelBooking(o.id);
      setOverrides((m) => ({ ...m, [o.id]: updated }));
      toast.success(`Đã huỷ và hoàn vé cho đơn ${o.code}.`);
    } catch (e) {
      const msg = (e as Error)?.message ?? "Huỷ đơn thất bại";
      setRowError((m) => ({ ...m, [o.id]: msg }));
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <OrganizerPageHeader
        title="Đơn hàng"
        subtitle="Tất cả đơn đặt vé từ các sự kiện của bạn"
      />

      <Container className="py-8">
        {loading && <LoadingBlock label="Đang tải đơn hàng…" />}
        {!loading && error && <ErrorBlock message={error} onRetry={refetch} />}

        {!loading && !error && (
          <>
            <StatPills
              items={[
                { label: "Tổng đơn", value: String(allOrders.length) },
                { label: "Đã thanh toán", value: String(paidOrders.length) },
                { label: "Doanh thu đã thu", value: formatVND(revenue) },
                { label: "Đã huỷ", value: String(cancelledCount) },
              ]}
            />

            {/* ── Filter toolbar ─────────────────────────── */}
            <div className="mt-8 space-y-3">
              {/* Search + dropdowns, grouped in one bar */}
              <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-2.5 shadow-soft sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-elevated px-4 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                  <Search className="h-4.5 w-4.5 shrink-0 text-muted" strokeWidth={1.75} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm mã đơn, email khách, sự kiện…"
                    aria-label="Tìm đơn hàng"
                    className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Xoá tìm kiếm"
                      className="shrink-0 rounded-full p-0.5 text-faint transition-colors hover:bg-ink/10 hover:text-ink cursor-pointer"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex-1 sm:flex-none">
                    <Ticket className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      aria-label="Lọc theo sự kiện"
                      className="h-10 w-full appearance-none rounded-full border border-line bg-surface pl-9 pr-9 text-sm font-medium text-ink outline-none transition-colors hover:border-ink/30 focus:border-accent focus:ring-2 focus:ring-accent/15 cursor-pointer sm:w-52"
                    >
                      <option value="ALL">Tất cả sự kiện</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                  </div>
                  <DateRangeFilter value={range} onChange={setRange} anchor={ANCHOR} />
                </div>
              </div>

              {/* Status segmented control + result count + clear */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
                  {FILTERS.map((f) => {
                    const n = f.key === "ALL" ? allOrders.length : countByStatus[f.key] ?? 0;
                    const active = filter === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        aria-pressed={active}
                        className={cn(
                          "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer",
                          active ? "bg-ink text-canvas" : "text-muted hover:text-ink"
                        )}
                      >
                        {f.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-xs tabular-nums",
                            active ? "bg-canvas/20 text-canvas" : "bg-ink/[0.06] text-faint"
                          )}
                        >
                          {n}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">
                    <span className="font-medium text-ink">{list.length}</span> / {allOrders.length} đơn
                  </span>
                  {anyFilter && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:border-ink/30 hover:text-ink cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} /> Xoá lọc
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
              <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_10rem] gap-4 border-b border-line bg-elevated px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint lg:grid">
                <span>Mã đơn</span>
                <span>Sự kiện</span>
                <span>Khách hàng</span>
                <span>Vé</span>
                <span className="text-right">Số tiền</span>
                <span>Thời gian</span>
                <span className="text-right">Hành động</span>
              </div>

              {pageItems.map((o, i) => {
                const meta = statusMeta(o.status);
                const date = bookingDate(o);
                const canCancel = o.status === "PAID" || o.status === "PENDING_PAYMENT";
                const isBusy = busyId === o.id;
                const err = rowError[o.id];
                return (
                  <div
                    key={o.id}
                    className={cn(
                      "grid grid-cols-2 items-center gap-x-4 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_10rem]",
                      i > 0 && "border-t border-line"
                    )}
                  >
                    {/* Code + status (status badge shows inline on mobile) */}
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-medium text-ink">{o.code}</span>
                      <div className="mt-1 lg:hidden">
                        <Badge className={cn("border", meta.tone)}>{meta.label}</Badge>
                      </div>
                    </div>

                    <span className="truncate text-sm text-muted">{o.eventTitle}</span>

                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm text-ink">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                        <span className="truncate">{o.customerEmail ?? "—"}</span>
                      </p>
                    </div>

                    <div className="col-span-2 min-w-0 lg:col-span-1">
                      <p className="truncate text-sm text-muted">{itemsSummary(o)}</p>
                    </div>

                    <div className="flex items-center justify-between gap-2 lg:block lg:text-right">
                      <span className="font-display font-semibold text-ink">{formatVND(o.totalAmount)}</span>
                      <span className="hidden lg:block">
                        <Badge className={cn("mt-1 border", meta.tone)}>{meta.label}</Badge>
                      </span>
                    </div>

                    <span className="text-sm text-muted">{date ? formatDateTime(date) : "—"}</span>

                    {/* Action */}
                    <div className="col-span-2 flex flex-col items-start gap-1 lg:col-span-1 lg:items-end">
                      {canCancel ? (
                        <Button
                          as="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(o)}
                          disabled={isBusy}
                          className="min-h-10"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                          ) : (
                            <Ban className="h-4 w-4" strokeWidth={1.75} />
                          )}
                          {isBusy ? "Đang huỷ…" : "Huỷ / Hoàn vé"}
                        </Button>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                      {err && <span className="text-xs text-red-600">{err}</span>}
                    </div>
                  </div>
                );
              })}

              {list.length === 0 && (
                <div className="py-16 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-faint" strokeWidth={1.5} />
                  <p className="mt-3 font-medium text-ink">
                    {allOrders.length === 0 ? "Chưa có đơn hàng nào" : "Không có đơn khớp bộ lọc"}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {allOrders.length === 0
                      ? "Đơn đặt vé từ các sự kiện của bạn sẽ hiện ở đây."
                      : "Thử đổi bộ lọc hoặc xoá để xem tất cả đơn."}
                  </p>
                  {allOrders.length > 0 && anyFilter && (
                    <button
                      onClick={clearFilters}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" strokeWidth={1.75} /> Xoá bộ lọc
                    </button>
                  )}
                </div>
              )}
            </div>

            <Pagination className="mt-5" page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={12} />
          </>
        )}
      </Container>
    </>
  );
}
