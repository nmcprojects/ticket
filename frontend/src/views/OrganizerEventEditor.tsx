"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@/lib/router";
import {
  ChevronLeft, Save, Check, Eye, FileText, CalendarRange, Plus, Trash2, ExternalLink,
  BarChart3, Ticket, Banknote, ScanLine, Settings2, Loader2, ShoppingBag, Search, Mail, Ban,
} from "lucide-react";
import { Container, Eyebrow, Button, Badge } from "@/components/ui";
import { RichEditor } from "@/components/rich-editor";
import { ImageUpload } from "@/components/image-upload";
import { LocationPicker } from "@/components/location-picker";
import { useToast } from "@/components/toast";
import { LoadingBlock, PageLoading, PageError, ErrorBlock } from "@/components/states";
import { Pagination, usePaged } from "@/components/pagination";
import { richContentFor } from "@/lib/content";
import { api } from "@/lib/api";
import type { BookingDetail } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { cn, formatVND, formatDateLong, formatTime, formatDateTime, soldPercent, bookingStatusMeta } from "@/lib/utils";
import type { BookingStatus, EventCategory, EventStatus, Showtime, TicketType } from "@/lib/types";
import NotFound from "./NotFound";

type Tab = "overview" | "orders" | "tickets" | "checkins" | "content" | "detail" | "schedule" | "preview";

type EditableTT = TicketType & { _new?: boolean };
const blankTicket = (id: string): EditableTT => ({
  id, eventId: "", name: "", description: "", price: 0, currency: "VND",
  totalQuantity: 100, availableQuantity: 100, reservedQuantity: 0, soldQuantity: 0,
  maxPerOrder: 10, status: "SELLING", _new: true,
});

const CATEGORIES: EventCategory[] = ["Âm nhạc", "Sân khấu", "Workshop", "Thể thao", "Hội thảo", "Nghệ thuật"];

function isoOf(date: string, time: string) {
  return `${date}T${time || "00:00"}:00`;
}
function isoToLocal(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function localToIso(local: string) {
  return local ? new Date(local).toISOString() : undefined;
}

type Form = {
  title: string; category: EventCategory; city: string; venue: string; location: string;
  bannerUrl: string; seatMapUrl: string; latitude?: number; longitude?: number;
  start: string; end: string; status: EventStatus; description: string;
};

export default function OrganizerEventEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: ev, loading, error, refetch } = useAsync(() => api.getEvent(id ?? ""), [id]);
  const stats = useAsync(() => api.getEventStats(id ?? ""), [id]);
  const tstats = useAsync(() => api.getTicketStats(id ?? ""), [id]);
  const checkins = useAsync(() => api.listCheckins(id ?? "", 200), [id]);
  const counter = useRef(0);

  const [tab, setTab] = useState<Tab>("overview");
  const [content, setContent] = useState<string | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<EditableTT[] | null>(null);
  const [ttBusy, setTtBusy] = useState<string | null>(null);
  const [ttError, setTtError] = useState<string | null>(null);

  useEffect(() => {
    if (ev && content === null) {
      setContent(ev.content ?? richContentFor(ev));
      setShowtimes(ev.showtimes ?? []);
      setTickets(ev.ticketTypes.map((t) => ({ ...t })));
      setForm({
        title: ev.title, category: ev.category, city: ev.city, venue: ev.venue,
        location: ev.location, bannerUrl: ev.bannerUrl, seatMapUrl: ev.seatMapUrl ?? "",
        latitude: ev.latitude, longitude: ev.longitude,
        start: isoToLocal(ev.startTime),
        end: isoToLocal(ev.endTime), status: ev.status, description: ev.description,
      });
    }
  }, [ev, content]);

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={refetch} />;
  if (!ev) return <NotFound />;

  const setF = (patch: Partial<Form>) => setForm((p) => (p ? { ...p, ...patch } : p));

  const cloneTickets = (base: TicketType[]): TicketType[] =>
    base.map((t) => ({ ...t, id: `${t.id}-n${counter.current++}`, soldQuantity: 0, reservedQuantity: 0, availableQuantity: t.totalQuantity, status: "SELLING" }));
  const updateShow = (sid: string, patch: Partial<Showtime>) => setShowtimes((prev) => prev.map((s) => (s.id === sid ? { ...s, ...patch } : s)));
  const addShow = () => {
    const base = showtimes[0]?.ticketTypes ?? ev.ticketTypes;
    setShowtimes((prev) => [...prev, { id: `st-new-${counter.current++}`, startTime: isoOf(ev.startTime.slice(0, 10), "19:00"), endTime: isoOf(ev.startTime.slice(0, 10), "21:00"), status: "SELLING", ticketTypes: cloneTickets(base) }]);
  };
  const removeShow = (sid: string) => setShowtimes((prev) => prev.filter((s) => s.id !== sid));

  const save = async () => {
    if (!form) return;
    setSavingError(null);
    setBusy(true);
    try {
      const toInstant = (s: string) => (s.endsWith("Z") || /[+-]\d\d:\d\d$/.test(s) ? s : s.slice(0, 19) + "Z");
      await api.updateEvent(ev.id, {
        organizerId: ev.organizer?.id ? Number(ev.organizer.id) : undefined,
        title: form.title, description: form.description, content: content ?? "",
        location: form.location, city: form.city, venue: form.venue, category: form.category,
        startTime: localToIso(form.start), endTime: localToIso(form.end),
        bannerUrl: form.bannerUrl, seatMapUrl: form.seatMapUrl,
        latitude: form.latitude, longitude: form.longitude, status: form.status,
        showtimes: showtimes.map((s) => ({
          startTime: toInstant(s.startTime), endTime: toInstant(s.endTime), status: s.status,
        })),
      });
      setSaved(true);
      toast.success("Đã lưu thay đổi sự kiện.");
      window.setTimeout(() => setSaved(false), 2200);
    } catch (e) {
      const msg = (e as Error)?.message ?? "Lưu thất bại";
      setSavingError(msg);
      toast.error(`Lưu thất bại: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Xoá vĩnh viễn sự kiện "${ev.title}"? Hành động này không thể hoàn tác.`)) return;
    setBusy(true);
    try {
      await api.deleteEvent(ev.id);
      navigate("/organizer/events", { replace: true });
    } catch (e) {
      setSavingError((e as Error)?.message ?? "Xoá thất bại");
      setBusy(false);
    }
  };

  // ── Ticket type CRUD ──────────────────────────────────────
  const setTT = (tid: string, patch: Partial<EditableTT>) =>
    setTickets((prev) => prev?.map((t) => (t.id === tid ? { ...t, ...patch } : t)) ?? prev);
  const addTicketRow = () =>
    setTickets((prev) => [...(prev ?? []), blankTicket(`new-${counter.current++}`)]);
  const reloadTickets = async () => {
    const fresh = await api.getEvent(ev.id);
    setTickets(fresh.ticketTypes.map((t) => ({ ...t })));
    stats.refetch();
    tstats.refetch();
  };
  const ticketInvalid = (t: EditableTT) =>
    !t.name.trim() || t.price < 0 || t.totalQuantity < 0 || (t.maxPerOrder ?? 1) < 1;
  const saveTicket = async (t: EditableTT) => {
    if (ticketInvalid(t)) return;
    setTtError(null);
    setTtBusy(t.id);
    const body = {
      name: t.name.trim(), description: t.description ?? "", price: t.price,
      currency: t.currency || "VND", totalQuantity: t.totalQuantity,
      maxPerOrder: t.maxPerOrder ?? 10, status: t.status,
    };
    try {
      if (t._new) await api.addTicketType(ev.id, body);
      else await api.updateTicketType(t.id, body);
      await reloadTickets();
      toast.success(t._new ? `Đã thêm loại vé "${body.name}".` : `Đã lưu loại vé "${body.name}".`);
    } catch (e) {
      const msg = (e as Error)?.message ?? "Lưu loại vé thất bại";
      setTtError(msg);
      toast.error(`Lưu loại vé thất bại: ${msg}`);
    } finally {
      setTtBusy(null);
    }
  };
  const deleteTicket = async (t: EditableTT) => {
    if (t._new) { setTickets((prev) => prev?.filter((x) => x.id !== t.id) ?? prev); return; }
    if (t.soldQuantity > 0) { setTtError(`Không thể xoá "${t.name}" vì đã bán ${t.soldQuantity} vé.`); return; }
    if (!window.confirm(`Xoá loại vé "${t.name}"?`)) return;
    setTtError(null);
    setTtBusy(t.id);
    try {
      await api.deleteTicketType(t.id);
      await reloadTickets();
      toast.success(`Đã xoá loại vé "${t.name}".`);
    } catch (e) {
      const msg = (e as Error)?.message ?? "Xoá loại vé thất bại";
      setTtError(msg);
      toast.error(msg);
    } finally {
      setTtBusy(null);
    }
  };

  const inputCls = "mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

  const TABS: [Tab, string, typeof Eye][] = [
    ["overview", "Tổng quan", BarChart3],
    ["orders", "Đơn hàng", ShoppingBag],
    ["tickets", "Loại vé", Ticket],
    ["checkins", "Check-in", ScanLine],
    ["content", "Giới thiệu", FileText],
    ["detail", "Chi tiết", Settings2],
    ["schedule", "Lịch diễn", CalendarRange],
    ["preview", "Xem trước", Eye],
  ];

  return (
    <>
      <section className="sticky top-16 z-30 border-b border-line bg-elevated/95 backdrop-blur py-5">
        <Container>
          <Link to="/organizer/events" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink">
            <ChevronLeft className="h-4 w-4" /> Sự kiện của tôi
          </Link>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Eyebrow>Quản lý sự kiện</Eyebrow>
              <h1 className="display mt-1.5 text-2xl font-medium sm:text-3xl">{ev.title}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button as="link" to={`/events/${ev.id}`} variant="outline" size="sm">
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} /> Xem trang
              </Button>
              <Button as="button" size="sm" onClick={save} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <><Check className="h-4 w-4" strokeWidth={2.5} /> Đã lưu</> : <><Save className="h-4 w-4" strokeWidth={1.75} /> Lưu thay đổi</>}
              </Button>
            </div>
          </div>

          <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
            {TABS.map(([key, label, Icon]) => (
              <button key={key} onClick={() => setTab(key)}
                className={cn("flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer", tab === key ? "bg-ink text-canvas" : "text-muted hover:text-ink")}>
                <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
        </Container>
      </section>

      <Container className="py-8">
        {savingError && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{savingError}</p>}

        {/* ── Overview / stats ───────────────────────────── */}
        {tab === "overview" && (
          <div>
            {stats.loading ? <LoadingBlock /> : stats.data && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={Ticket} label="Vé đã bán" value={`${stats.data.sold}/${stats.data.capacity}`} foot={`${stats.data.soldPercent}% sức chứa`} />
                  <StatCard icon={Banknote} label="Doanh thu" value={formatVND(stats.data.grossRevenue)} foot="Từ vé đã bán" />
                  <StatCard icon={CalendarRange} label="Còn lại" value={String(stats.data.available)} foot={`Đang giữ: ${stats.data.reserved}`} />
                  <StatCard icon={ScanLine} label="Đã check-in" value={`${tstats.data?.checkinPercent ?? 0}%`} foot={`${tstats.data?.checkedIn ?? 0}/${tstats.data?.total ?? 0} vé`} />
                </div>

                <h2 className="display mt-8 text-xl font-medium">Theo loại vé</h2>
                <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
                  <div className="hidden grid-cols-[2fr_1fr_1.6fr_1fr] gap-4 border-b border-line bg-elevated px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint sm:grid">
                    <span>Loại vé</span><span>Giá</span><span>Đã bán</span><span className="text-right">Doanh thu</span>
                  </div>
                  {stats.data.ticketTypes.map((t, i) => {
                    const pct = soldPercent({ soldQuantity: t.soldQuantity, totalQuantity: t.totalQuantity });
                    return (
                      <div key={t.id} className={cn("grid grid-cols-2 items-center gap-4 px-5 py-4 sm:grid-cols-[2fr_1fr_1.6fr_1fr]", i > 0 && "border-t border-line")}>
                        <span className="font-medium text-ink">{t.name}</span>
                        <span className="text-sm text-muted">{formatVND(t.price)}</span>
                        <div>
                          <div className="flex items-center justify-between text-xs"><span className="font-medium text-ink">{t.soldQuantity}/{t.totalQuantity}</span><span className="text-faint">{pct}%</span></div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                        </div>
                        <span className="text-right font-display font-semibold text-ink">{formatVND(t.price * t.soldQuantity)}</span>
                      </div>
                    );
                  })}
                </div>

                <h2 className="display mt-8 text-xl font-medium">Tình trạng vé</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <MiniStat label="Đã phát hành" value={tstats.data?.issued ?? 0} tone="bg-accent-soft text-accent-ink" />
                  <MiniStat label="Đã check-in" value={tstats.data?.checkedIn ?? 0} tone="bg-blue-50 text-blue-700" />
                  <MiniStat label="Đã huỷ" value={tstats.data?.cancelled ?? 0} tone="bg-red-50 text-red-700" />
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Orders (per-event order management) ────────── */}
        {tab === "orders" && <OrdersTab eventId={ev.id} />}

        {/* ── Ticket types (full CRUD) ───────────────────── */}
        {tab === "tickets" && (
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="display text-xl font-medium">Loại vé</h2>
                <p className="text-sm text-muted">Thêm, sửa giá &amp; số lượng, hoặc xoá loại vé. Thay đổi áp dụng ngay.</p>
              </div>
              <Button as="button" size="sm" variant="outline" onClick={addTicketRow}>
                <Plus className="h-4 w-4" strokeWidth={2} /> Thêm loại vé
              </Button>
            </div>

            {ttError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{ttError}</p>}

            {tickets && tickets.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface py-14 text-center">
                <Ticket className="mx-auto h-8 w-8 text-faint" strokeWidth={1.5} />
                <p className="mt-3 font-medium text-ink">Chưa có loại vé nào</p>
                <p className="mt-1 text-sm text-muted">Bấm “Thêm loại vé” để tạo hạng vé đầu tiên.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {tickets?.map((t) => {
                  const rowBusy = ttBusy === t.id;
                  return (
                    <div key={t.id} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                          {t._new ? (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent-ink">Mới</span>
                          ) : (
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                              t.status === "SOLD_OUT" ? "bg-faint/15 text-muted" : t.status === "DISABLED" ? "bg-red-50 text-red-700" : "bg-accent-soft text-accent-ink")}>
                              {t.status === "SOLD_OUT" ? "Hết vé" : t.status === "DISABLED" ? "Ẩn" : "Đang bán"}
                            </span>
                          )}
                          {!t._new && <span className="text-xs font-normal text-faint">Đã bán {t.soldQuantity} · Giữ {t.reservedQuantity} · Còn {t.availableQuantity}</span>}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                        <label className="block"><span className="text-xs text-muted">Tên hạng vé</span>
                          <input value={t.name} onChange={(e) => setTT(t.id, { name: e.target.value })} placeholder="VD: VIP" className={inputCls} /></label>
                        <label className="block"><span className="text-xs text-muted">Giá (đ)</span>
                          <input type="number" min={0} value={t.price} onChange={(e) => setTT(t.id, { price: Math.max(0, Number(e.target.value)) })} className={inputCls} /></label>
                        <label className="block"><span className="text-xs text-muted">Tổng số</span>
                          <input type="number" min={0} value={t.totalQuantity} onChange={(e) => setTT(t.id, { totalQuantity: Math.max(0, Number(e.target.value)) })} className={inputCls} /></label>
                        <label className="block"><span className="text-xs text-muted">Tối đa/đơn</span>
                          <input type="number" min={1} value={t.maxPerOrder} onChange={(e) => setTT(t.id, { maxPerOrder: Math.max(1, Number(e.target.value)) })} className={inputCls} /></label>
                      </div>

                      <label className="mt-3 block"><span className="text-xs text-muted">Mô tả</span>
                        <input value={t.description ?? ""} onChange={(e) => setTT(t.id, { description: e.target.value })} placeholder="Quyền lợi của hạng vé này…" className={inputCls} /></label>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm"><span className="text-muted">Trạng thái</span>
                          <select value={t.status} onChange={(e) => setTT(t.id, { status: e.target.value as TicketType["status"] })}
                            className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent">
                            <option value="SELLING">Đang bán</option>
                            <option value="SOLD_OUT">Hết vé</option>
                            <option value="DISABLED">Ẩn</option>
                          </select></label>
                        <div className="flex items-center gap-2">
                          <button onClick={() => deleteTicket(t)} disabled={rowBusy}
                            className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 cursor-pointer">
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Xoá
                          </button>
                          <button onClick={() => saveTicket(t)} disabled={rowBusy || ticketInvalid(t)}
                            className="flex items-center gap-1.5 rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50 cursor-pointer">
                            {rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" strokeWidth={1.75} /> {t._new ? "Tạo" : "Lưu"}</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Check-in list (per event) ──────────────────── */}
        {tab === "checkins" && (
          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="display text-xl font-medium">Lịch sử check-in</h2>
                <p className="text-sm text-muted">Các lượt quét vé tại cửa cho sự kiện này.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button as="link" to="/check-in" variant="outline" size="sm">
                  <ScanLine className="h-4 w-4" strokeWidth={1.75} /> Mở máy quét
                </Button>
                <button onClick={() => checkins.refetch()} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink cursor-pointer">
                  Làm mới
                </button>
              </div>
            </div>

            {tstats.data && (
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <MiniStat label="Đã check-in" value={tstats.data.checkedIn} tone="bg-accent-soft text-accent-ink" />
                <MiniStat label="Đã phát hành" value={tstats.data.issued} tone="bg-blue-50 text-blue-700" />
                <MiniStat label="Tỉ lệ vào cửa" value={tstats.data.checkinPercent} tone="bg-amber-50 text-amber-700" />
              </div>
            )}

            {checkins.loading ? <LoadingBlock /> : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
                <div className="hidden grid-cols-[1.5fr_1fr_1.5fr_0.8fr] gap-4 border-b border-line bg-elevated px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint sm:grid">
                  <span>Mã vé</span><span>Kết quả</span><span>Thời gian</span><span className="text-right">Nhân viên</span>
                </div>
                {(checkins.data ?? []).length === 0 ? (
                  <div className="py-14 text-center">
                    <ScanLine className="mx-auto h-8 w-8 text-faint" strokeWidth={1.5} />
                    <p className="mt-3 font-medium text-ink">Chưa có lượt check-in nào</p>
                    <p className="mt-1 text-sm text-muted">Quét vé tại cửa để ghi nhận lượt vào.</p>
                  </div>
                ) : (
                  (checkins.data ?? []).map((c, i) => {
                    const ok = c.result === "VALID";
                    return (
                      <div key={c.id} className={cn("grid grid-cols-2 items-center gap-3 px-5 py-3.5 sm:grid-cols-[1.5fr_1fr_1.5fr_0.8fr]", i > 0 && "border-t border-line")}>
                        <span className="font-mono text-sm font-medium text-ink">{c.ticketCode}</span>
                        <span>
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", ok ? "bg-accent-soft text-accent-ink" : "bg-amber-50 text-amber-700")}>
                            {ok ? "Hợp lệ" : c.result === "ALREADY_CHECKED_IN" ? "Đã quét" : "Lỗi"}
                          </span>
                        </span>
                        <span className="text-sm text-muted">{c.checkedInAt ? formatDateTime(c.checkedInAt) : "—"}</span>
                        <span className="text-right text-sm text-faint">{c.staffId ? `#${c.staffId}` : "—"}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Content editor ─────────────────────────────── */}
        {tab === "content" && (
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              Nội dung hiển thị ở mục <strong className="mx-1">Giới thiệu</strong> trang công khai. Dùng nút <strong className="mx-1">Ảnh</strong> để chèn hình.
            </div>
            {content === null ? <LoadingBlock label="Đang tải nội dung…" /> : <RichEditor key={ev.id} value={content} onChange={setContent} />}
          </div>
        )}

        {/* ── Detail (full CRUD fields) ──────────────────── */}
        {tab === "detail" && form && (
          <div className="mx-auto max-w-3xl space-y-4">
            <h2 className="display text-xl font-medium">Thông tin sự kiện</h2>
            <label className="block"><span className="text-sm font-medium text-ink">Tên sự kiện</span>
              <input value={form.title} onChange={(e) => setF({ title: e.target.value })} className={inputCls} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-ink">Danh mục</span>
                <select value={form.category} onChange={(e) => setF({ category: e.target.value as EventCategory })} className={cn(inputCls, "cursor-pointer")}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></label>
              <label className="block"><span className="text-sm font-medium text-ink">Trạng thái</span>
                <select value={form.status} onChange={(e) => setF({ status: e.target.value as EventStatus })} className={cn(inputCls, "cursor-pointer")}>
                  <option value="PUBLISHED">Đang mở bán</option><option value="DRAFT">Bản nháp</option>
                  <option value="ENDED">Đã kết thúc</option><option value="CANCELLED">Đã huỷ</option>
                </select></label>
              <label className="block"><span className="text-sm font-medium text-ink">Thành phố</span>
                <input value={form.city} onChange={(e) => setF({ city: e.target.value })} className={inputCls} /></label>
              <label className="block"><span className="text-sm font-medium text-ink">Địa điểm</span>
                <input value={form.venue} onChange={(e) => setF({ venue: e.target.value })} className={inputCls} /></label>
            </div>
            <label className="block"><span className="text-sm font-medium text-ink">Địa chỉ</span>
              <input value={form.location} onChange={(e) => setF({ location: e.target.value })} className={inputCls} /></label>
            <div>
              <span className="text-sm font-medium text-ink">Vị trí trên bản đồ</span>
              <LocationPicker
                lat={form.latitude} lng={form.longitude}
                onChange={(la, ln) => setF({ latitude: la, longitude: ln })}
                onAddress={(a) => { if (!form.location.trim()) setF({ location: a }); }}
                className="mt-1.5"
              />
            </div>
            <ImageUpload label="Ảnh bìa" value={form.bannerUrl} onChange={(url) => setF({ bannerUrl: url })} aspect="16 / 9" className="max-w-sm" />
            <ImageUpload label="Sơ đồ chỗ ngồi (tuỳ chọn)" value={form.seatMapUrl} onChange={(url) => setF({ seatMapUrl: url })} aspect="4 / 3" hint="Ảnh sơ đồ ghế hiển thị ở trang đặt vé — PNG, JPG tối đa 8MB" className="max-w-sm" />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-sm font-medium text-ink">Bắt đầu</span>
                <input type="datetime-local" value={form.start} onChange={(e) => setF({ start: e.target.value })} className={inputCls} /></label>
              <label className="block"><span className="text-sm font-medium text-ink">Kết thúc</span>
                <input type="datetime-local" value={form.end} onChange={(e) => setF({ end: e.target.value })} className={inputCls} /></label>
            </div>
            <label className="block"><span className="text-sm font-medium text-ink">Mô tả ngắn</span>
              <textarea rows={3} value={form.description} onChange={(e) => setF({ description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" /></label>

            <div className="mt-6 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <div>
                <p className="font-medium text-red-700">Xoá sự kiện</p>
                <p className="text-sm text-red-600/80">Xoá vĩnh viễn sự kiện và các loại vé.</p>
              </div>
              <button onClick={remove} disabled={busy} className="flex items-center gap-2 rounded-full border border-red-300 bg-surface px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 cursor-pointer">
                <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Xoá
              </button>
            </div>
          </div>
        )}

        {/* ── Schedule editor ────────────────────────────── */}
        {tab === "schedule" && (
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display text-xl font-medium">Lịch diễn</h2>
                <p className="text-sm text-muted">Quản lý các suất diễn. Để trống nếu sự kiện chỉ có một suất.</p>
              </div>
              <Button as="button" size="sm" variant="outline" onClick={addShow}>
                <Plus className="h-4 w-4" strokeWidth={2} /> Thêm suất
              </Button>
            </div>
            {showtimes.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface py-14 text-center">
                <CalendarRange className="mx-auto h-8 w-8 text-faint" strokeWidth={1.5} />
                <p className="mt-3 font-medium text-ink">Chưa có suất diễn nào</p>
                <p className="mt-1 text-sm text-muted">Sự kiện sẽ dùng ngày giờ mặc định. Bấm “Thêm suất” để tạo lịch diễn.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {showtimes.map((s, i) => {
                  const date = s.startTime.slice(0, 10); const start = s.startTime.slice(11, 16); const end = s.endTime.slice(11, 16);
                  return (
                    <div key={s.id} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs text-accent-ink">{i + 1}</span> Suất {i + 1}
                        </span>
                        <button onClick={() => removeShow(s.id)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Xoá
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-4">
                        <label className="block sm:col-span-2"><span className="text-xs text-muted">Ngày</span>
                          <input type="date" value={date} onChange={(e) => updateShow(s.id, { startTime: isoOf(e.target.value, start), endTime: isoOf(e.target.value, end) })} className={inputCls} /></label>
                        <label className="block"><span className="text-xs text-muted">Bắt đầu</span>
                          <input type="time" value={start} onChange={(e) => updateShow(s.id, { startTime: isoOf(date, e.target.value) })} className={inputCls} /></label>
                        <label className="block"><span className="text-xs text-muted">Kết thúc</span>
                          <input type="time" value={end} onChange={(e) => updateShow(s.id, { endTime: isoOf(date, e.target.value) })} className={inputCls} /></label>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm"><span className="text-muted">Trạng thái</span>
                          <select value={s.status} onChange={(e) => updateShow(s.id, { status: e.target.value as Showtime["status"] })} className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent">
                            <option value="SELLING">Đang bán</option><option value="SOLD_OUT">Hết vé</option><option value="ENDED">Đã diễn</option>
                          </select></label>
                        <span className="text-xs text-faint">{s.ticketTypes.length} loại vé</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Preview ────────────────────────────────────── */}
        {tab === "preview" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="display text-xl font-medium">Giới thiệu</h2>
            <div className="mt-4 rich rounded-2xl border border-line bg-surface p-6 shadow-soft" dangerouslySetInnerHTML={{ __html: content ?? "" }} />
            {showtimes.length > 0 && (
              <>
                <h2 className="display mt-10 text-xl font-medium">Lịch diễn</h2>
                <div className="mt-4 space-y-2">
                  {showtimes.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3">
                      <div><p className="font-medium text-ink">{formatDateLong(s.startTime)}</p><p className="text-sm text-muted">{formatTime(s.startTime)} – {formatTime(s.endTime)}</p></div>
                      <Badge className={s.status === "SELLING" ? "bg-accent-soft text-accent-ink" : "bg-faint/15 text-muted"}>
                        {s.status === "SELLING" ? "Đang bán" : s.status === "SOLD_OUT" ? "Hết vé" : "Đã diễn"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </Container>
    </>
  );
}

// ── Orders tab: manage this event's bookings (cancel / refund) ──
const ORDER_FILTERS: { key: BookingStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PAID", label: "Đã thanh toán" },
  { key: "PENDING_PAYMENT", label: "Chờ thanh toán" },
  { key: "CANCELLED", label: "Đã huỷ" },
  { key: "PAYMENT_FAILED", label: "Thất bại" },
];

function orderDate(b: BookingDetail): string {
  return b.createdAt ?? b.paidAt ?? "";
}
function orderItems(b: BookingDetail): string {
  if (!b.items?.length) return "—";
  return b.items.map((it) => `${it.quantity}× ${it.ticketTypeName}`).join(", ");
}
function orderStatusMeta(status: string) {
  return bookingStatusMeta[status as BookingStatus] ?? { label: status, tone: "bg-faint/15 text-muted border-line" };
}

function OrdersTab({ eventId }: { eventId: string }) {
  const toast = useToast();
  const { data, loading, error, refetch } = useAsync(() => api.listBookingsByEvent(eventId), [eventId]);
  const [filter, setFilter] = useState<BookingStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [overrides, setOverrides] = useState<Record<number, BookingDetail>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<Record<number, string>>({});

  const all = useMemo<BookingDetail[]>(() => {
    const base = [...(data ?? [])].sort((a, b) => {
      const da = orderDate(a), db = orderDate(b);
      if (da && db && da !== db) return da < db ? 1 : -1;
      return b.id - a.id;
    });
    return base.map((o) => overrides[o.id] ?? o);
  }, [data, overrides]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((o) => {
      const matchStatus = filter === "ALL" || o.status === filter;
      const matchQuery = !q || o.code.toLowerCase().includes(q) || (o.customerEmail ?? "").toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [all, filter, query]);

  const paid = all.filter((o) => o.status === "PAID");
  const revenue = paid.reduce((s, o) => s + o.totalAmount, 0);
  const cancelled = all.filter((o) => o.status === "CANCELLED").length;

  const { page, setPage, pageCount, pageItems, total } = usePaged(list, 10);
  useEffect(() => setPage(1), [filter, query, setPage]);

  async function handleCancel(o: BookingDetail) {
    if (!window.confirm(`Huỷ và hoàn vé cho đơn ${o.code}?\nHành động này không thể hoàn tác.`)) return;
    setBusyId(o.id);
    setRowError((m) => { const n = { ...m }; delete n[o.id]; return n; });
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

  if (loading) return <LoadingBlock label="Đang tải đơn hàng…" />;
  if (error) return <ErrorBlock message={error} onRetry={refetch} />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-xl font-medium">Đơn hàng</h2>
          <p className="text-sm text-muted">Đơn đặt vé của sự kiện này. Huỷ đơn sẽ hoàn vé về kho.</p>
        </div>
        <button onClick={() => refetch()} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink cursor-pointer">
          Làm mới
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-4">
        <MiniStat label="Tổng đơn" value={all.length} tone="bg-accent-soft text-accent-ink" />
        <MiniStat label="Đã thanh toán" value={paid.length} tone="bg-blue-50 text-blue-700" />
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
          <span className="inline-block rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Doanh thu đã thu</span>
          <p className="mt-3 font-display text-2xl font-semibold text-ink">{formatVND(revenue)}</p>
        </div>
        <MiniStat label="Đã huỷ" value={cancelled} tone="bg-red-50 text-red-700" />
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {ORDER_FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
                filter === f.key ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-muted hover:border-ink/30 hover:text-ink")}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 lg:w-72">
          <Search className="h-4.5 w-4.5 text-muted" strokeWidth={1.75} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã đơn, email khách…"
            aria-label="Tìm đơn hàng" className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-faint" />
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_10rem] gap-4 border-b border-line bg-elevated px-5 py-3 text-xs font-semibold uppercase tracking-wide text-faint lg:grid">
          <span>Mã đơn</span><span>Khách hàng</span><span>Vé</span><span className="text-right">Số tiền</span><span>Thời gian</span><span className="text-right">Hành động</span>
        </div>

        {pageItems.map((o, i) => {
          const meta = orderStatusMeta(o.status);
          const date = orderDate(o);
          const canCancel = o.status === "PAID" || o.status === "PENDING_PAYMENT";
          const isBusy = busyId === o.id;
          const err = rowError[o.id];
          return (
            <div key={o.id} className={cn("grid grid-cols-2 items-center gap-x-4 gap-y-2 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.1fr)_10rem]", i > 0 && "border-t border-line")}>
              <div className="min-w-0">
                <span className="font-mono text-sm font-medium text-ink">{o.code}</span>
                <div className="mt-1 lg:hidden"><Badge className={cn("border", meta.tone)}>{meta.label}</Badge></div>
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-sm text-ink">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.75} />
                  <span className="truncate">{o.customerEmail ?? "—"}</span>
                </p>
              </div>
              <div className="col-span-2 min-w-0 lg:col-span-1"><p className="truncate text-sm text-muted">{orderItems(o)}</p></div>
              <div className="flex items-center justify-between gap-2 lg:block lg:text-right">
                <span className="font-display font-semibold text-ink">{formatVND(o.totalAmount)}</span>
                <span className="hidden lg:block"><Badge className={cn("mt-1 border", meta.tone)}>{meta.label}</Badge></span>
              </div>
              <span className="text-sm text-muted">{date ? formatDateTime(date) : "—"}</span>
              <div className="col-span-2 flex flex-col items-start gap-1 lg:col-span-1 lg:items-end">
                {canCancel ? (
                  <Button as="button" variant="outline" size="sm" onClick={() => handleCancel(o)} disabled={isBusy} className="min-h-10">
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Ban className="h-4 w-4" strokeWidth={1.75} />}
                    {isBusy ? "Đang huỷ…" : "Huỷ / Hoàn vé"}
                  </Button>
                ) : <span className="text-xs text-faint">—</span>}
                {err && <span className="text-xs text-red-600">{err}</span>}
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="py-16 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-faint" strokeWidth={1.5} />
            <p className="mt-3 font-medium text-ink">{all.length === 0 ? "Chưa có đơn hàng nào" : "Không có đơn khớp bộ lọc"}</p>
            <p className="mt-1 text-sm text-muted">{all.length === 0 ? "Đơn đặt vé sẽ xuất hiện ở đây." : "Thử đổi bộ lọc hoặc từ khoá."}</p>
          </div>
        )}
      </div>

      <Pagination className="mt-5" page={page} pageCount={pageCount} onChange={setPage} total={total} pageSize={10} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, foot }: { icon: typeof Ticket; label: string; value: string; foot: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-4 font-display text-2xl font-semibold text-ink">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-0.5 text-xs text-faint">{foot}</p>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
      <span className={cn("inline-block rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{label}</span>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}
