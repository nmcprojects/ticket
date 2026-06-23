"use client";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/router";
import { Search, Plus, ArrowUpRight, Eye, CalendarDays, MapPin, Pencil } from "lucide-react";
import { Container, Button, Badge } from "@/components/ui";
import { OrganizerPageHeader, StatPills } from "@/components/organizer-header";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import { Pagination, usePaged } from "@/components/pagination";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import type { EventStatus } from "@/lib/types";
import { cn, formatVND, formatDateLong, soldPercent, eventStatusMeta } from "@/lib/utils";

const FILTERS: { key: EventStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PUBLISHED", label: "Đang mở bán" },
  { key: "DRAFT", label: "Bản nháp" },
  { key: "ENDED", label: "Đã kết thúc" },
];

export default function OrganizerEvents() {
  const [filter, setFilter] = useState<EventStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  // Only the logged-in organizer's own events (not every org's).
  const { data, loading, error, refetch } = useAsync(async () => {
    const org = await api.getMyOrganizer();
    return api.listEvents({ organizerId: Number(org.id) });
  }, []);
  const organizerAllEvents = useMemo(() => data ?? [], [data]);

  const list = useMemo(() => {
    return organizerAllEvents.filter((e) => {
      const matchStatus = filter === "ALL" || e.status === filter;
      const matchQuery = !query.trim() || e.title.toLowerCase().includes(query.toLowerCase());
      return matchStatus && matchQuery;
    });
  }, [organizerAllEvents, filter, query]);

  const totalRevenue = organizerAllEvents.reduce(
    (sum, e) => sum + e.ticketTypes.reduce((a, t) => a + t.soldQuantity * t.price, 0),
    0
  );
  const totalSold = organizerAllEvents.reduce(
    (sum, e) => sum + e.ticketTypes.reduce((a, t) => a + t.soldQuantity, 0),
    0
  );
  const publishedCount = organizerAllEvents.filter((e) => e.status === "PUBLISHED").length;

  const { page, setPage, pageCount, pageItems, total } = usePaged(list, 8);
  useEffect(() => setPage(1), [filter, query, setPage]);

  return (
    <>
      <OrganizerPageHeader
        title="Sự kiện của tôi"
        subtitle={`${organizerAllEvents.length} sự kiện · quản lý, theo dõi và chỉnh sửa`}
        actions={
          <Button as="link" to="/organizer/events/new" size="sm">
            <Plus className="h-4 w-4" strokeWidth={2} /> Tạo sự kiện
          </Button>
        }
      />

      <Container className="py-8">
        <StatPills
          items={[
            { label: "Tổng sự kiện", value: String(organizerAllEvents.length) },
            { label: "Đang mở bán", value: String(publishedCount) },
            { label: "Vé đã bán", value: totalSold.toLocaleString("vi-VN") },
            { label: "Tổng doanh thu", value: formatVND(totalRevenue) },
          ]}
        />

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer",
                  filter === f.key
                    ? "border-ink bg-ink text-canvas"
                    : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 sm:w-72">
            <Search className="h-4.5 w-4.5 text-muted" strokeWidth={1.75} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sự kiện…"
              aria-label="Tìm sự kiện"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
            />
          </div>
        </div>

        {/* Cards */}
        {loading && <LoadingBlock />}
        {error && <ErrorBlock message={error} onRetry={refetch} />}
        {!loading && !error && (
        <>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {pageItems.map((ev) => {
            const sold = ev.ticketTypes.reduce((a, t) => a + t.soldQuantity, 0);
            const total = ev.ticketTypes.reduce((a, t) => a + t.totalQuantity, 0);
            const revenue = ev.ticketTypes.reduce((a, t) => a + t.soldQuantity * t.price, 0);
            const pct = soldPercent({ soldQuantity: sold, totalQuantity: total });
            const sMeta = eventStatusMeta[ev.status];
            return (
              <div key={ev.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
                <div className="flex gap-4 p-4">
                  <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-elevated">
                    <img src={ev.bannerUrl} alt={ev.title} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Badge className={sMeta.tone}>{sMeta.label}</Badge>
                      <Link to={`/events/${ev.id}`} aria-label="Xem" className="flex h-7 w-7 items-center justify-center rounded-full text-faint transition-colors hover:bg-ink/[0.05] hover:text-ink cursor-pointer">
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <h3 className="mt-1.5 line-clamp-1 font-semibold text-ink">{ev.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} /> {formatDateLong(ev.startTime)}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} /> {ev.venue}, {ev.city}
                    </p>
                  </div>
                </div>

                <div className="border-t border-line px-4 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink">Đã bán {sold}/{total}</span>
                    <span className="text-faint">{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted">Doanh thu</span>
                    <span className="font-display font-semibold text-ink">{formatVND(revenue)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
                    <Link to={`/organizer/events/${ev.id}`} className="flex items-center justify-center gap-1.5 rounded-full bg-ink py-2 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 cursor-pointer">
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} /> Quản lý nội dung
                    </Link>
                    <Link to={`/events/${ev.id}`} className="flex items-center justify-center gap-1.5 rounded-full border border-line py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 cursor-pointer">
                      <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> Xem trang
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {list.length === 0 && (
          <p className="py-16 text-center text-muted">Không có sự kiện nào khớp bộ lọc.</p>
        )}

        <Pagination className="mt-6" page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={8} />
        </>
        )}
      </Container>
    </>
  );
}
