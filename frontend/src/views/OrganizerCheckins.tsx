"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, ScanLine, CheckCircle2, AlertTriangle, XCircle, Ban } from "lucide-react";
import { Container, Button, Badge } from "@/components/ui";
import { OrganizerPageHeader, StatPills } from "@/components/organizer-header";
import { DateRangeFilter, presetRange } from "@/components/date-range-filter";
import type { DateRange } from "@/components/date-range-filter";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import { Pagination, usePaged } from "@/components/pagination";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import type { CheckinResult } from "@/lib/types";
import { cn, formatDateTime, inDateRange } from "@/lib/utils";

const ANCHOR = "2026-06-14";

const resultMeta: Record<CheckinResult, { label: string; icon: typeof CheckCircle2; badge: string; chip: string }> = {
  VALID: { label: "Hợp lệ", icon: CheckCircle2, badge: "bg-accent-soft text-accent-ink", chip: "bg-accent text-white" },
  ALREADY_CHECKED_IN: { label: "Đã check-in", icon: AlertTriangle, badge: "bg-amber-50 text-amber-700", chip: "bg-amber-500 text-white" },
  INVALID_TICKET: { label: "Không hợp lệ", icon: XCircle, badge: "bg-red-50 text-red-700", chip: "bg-red-500 text-white" },
  CANCELLED_TICKET: { label: "Vé đã huỷ", icon: Ban, badge: "bg-red-50 text-red-700", chip: "bg-red-500 text-white" },
};

const FILTERS: { key: CheckinResult | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "VALID", label: "Hợp lệ" },
  { key: "ALREADY_CHECKED_IN", label: "Đã check-in" },
  { key: "INVALID_TICKET", label: "Không hợp lệ" },
  { key: "CANCELLED_TICKET", label: "Vé đã huỷ" },
];

export default function OrganizerCheckins() {
  const [filter, setFilter] = useState<CheckinResult | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange>(() => presetRange("all", ANCHOR));

  const { data, loading, error, refetch } = useAsync(() => api.listCheckins(undefined, 500), []);
  const { data: eventsData } = useAsync(() => api.listEvents(), []);
  const checkins = useMemo(() => data ?? [], [data]);

  const eventTitle = useMemo(() => {
    const map = new Map<number, string>();
    (eventsData ?? []).forEach((e) => map.set(Number(e.id), e.title));
    return map;
  }, [eventsData]);

  const list = useMemo(() => {
    return checkins.filter((c) => {
      const matchResult = filter === "ALL" || c.result === filter;
      const q = query.trim().toLowerCase();
      const matchQuery = !q || c.ticketCode.toLowerCase().includes(q);
      const matchDate = !c.checkedInAt || inDateRange(c.checkedInAt, range.from, range.to);
      return matchResult && matchQuery && matchDate;
    });
  }, [checkins, filter, query, range]);

  const valid = checkins.filter((c) => c.result === "VALID").length;
  const issues = checkins.filter((c) => c.result !== "VALID").length;
  const validPct = checkins.length ? Math.round((valid / checkins.length) * 100) : 0;

  const { page, setPage, pageCount, pageItems, total } = usePaged(list, 12);
  useEffect(() => setPage(1), [filter, query, range, setPage]);

  return (
    <>
      <OrganizerPageHeader
        title="Check-in"
        subtitle="Nhật ký quét vé tại cửa theo thời gian thực"
        actions={
          <Button as="link" to="/check-in" size="sm">
            <ScanLine className="h-4 w-4" strokeWidth={1.75} /> Mở màn hình quét
          </Button>
        }
      />

      <Container className="py-8">
        <StatPills
          items={[
            { label: "Tổng lượt quét", value: String(checkins.length) },
            { label: "Hợp lệ", value: String(valid) },
            { label: "Cần xử lý", value: String(issues) },
            { label: "Tỉ lệ hợp lệ", value: `${validPct}%` },
          ]}
        />

        {/* Controls */}
        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer",
                  filter === f.key
                    ? "border-ink bg-ink text-canvas"
                    : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <DateRangeFilter value={range} onChange={setRange} anchor={ANCHOR} />
            <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-surface px-4 lg:w-64">
              <Search className="h-4.5 w-4.5 text-muted" strokeWidth={1.75} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo mã vé…"
                aria-label="Tìm lượt check-in"
                className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingBlock label="Đang tải nhật ký check-in…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={refetch} />
        ) : (
          <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 border-b border-line bg-elevated px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint lg:grid">
              <span>Mã vé</span>
              <span>Sự kiện</span>
              <span>Thời gian</span>
              <span className="text-right">Kết quả</span>
            </div>
            {pageItems.map((c, i) => {
              const m = resultMeta[c.result];
              return (
                <div
                  key={c.id}
                  className={cn(
                    "grid grid-cols-2 items-center gap-x-4 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)]",
                    i > 0 && "border-t border-line"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", m.chip)}>
                      <m.icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="truncate font-mono text-sm text-ink">{c.ticketCode}</span>
                  </div>
                  <span className="truncate text-sm text-muted">
                    {c.eventId != null ? eventTitle.get(c.eventId) ?? `#${c.eventId}` : "—"}
                  </span>
                  <span className="text-sm text-muted">{c.checkedInAt ? formatDateTime(c.checkedInAt) : "—"}</span>
                  <div className="flex justify-start lg:justify-end">
                    <Badge className={m.badge}>{m.label}</Badge>
                  </div>
                </div>
              );
            })}
            {list.length === 0 && (
              <p className="py-16 text-center text-muted">Chưa có lượt check-in nào khớp bộ lọc.</p>
            )}
          </div>
        )}

        {!loading && !error && (
          <Pagination className="mt-5" page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={12} />
        )}
      </Container>
    </>
  );
}
