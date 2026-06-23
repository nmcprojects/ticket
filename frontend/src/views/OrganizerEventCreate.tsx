"use client";
import { useState } from "react";
import { useNavigate } from "@/lib/router";
import { Plus, Trash2, Save, Loader2, CalendarRange } from "lucide-react";
import { Container, Button } from "@/components/ui";
import { OrganizerPageHeader } from "@/components/organizer-header";
import { ImageUpload } from "@/components/image-upload";
import { RichEditor } from "@/components/rich-editor";
import { LocationPicker } from "@/components/location-picker";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EventCategory, EventStatus, TicketTypeStatus } from "@/lib/types";

const CATEGORIES: EventCategory[] = ["Âm nhạc", "Sân khấu", "Workshop", "Thể thao", "Hội thảo", "Nghệ thuật"];

type TicketDraft = { name: string; description: string; price: string; totalQuantity: string; maxPerOrder: string; status: TicketTypeStatus };

function emptyTicket(): TicketDraft {
  return { name: "", description: "", price: "", totalQuantity: "", maxPerOrder: "6", status: "SELLING" };
}

type ShowtimeDraft = { date: string; start: string; end: string; status: string };

function emptyShowtime(): ShowtimeDraft {
  return { date: "", start: "19:00", end: "21:00", status: "SELLING" };
}

function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function showtimeIso(date: string, time: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T${time || "00:00"}:00`);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function OrganizerEventCreate() {
  const navigate = useNavigate();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("Âm nhạc");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [bannerUrl, setBannerUrl] = useState("");
  const [seatMapUrl, setSeatMapUrl] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<EventStatus>("PUBLISHED");
  const [tickets, setTickets] = useState<TicketDraft[]>([emptyTicket()]);
  const [showtimes, setShowtimes] = useState<ShowtimeDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTicket = (i: number, patch: Partial<TicketDraft>) =>
    setTickets((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const setShowtime = (i: number, patch: Partial<ShowtimeDraft>) =>
    setShowtimes((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const canSubmit = title.trim().length > 0 && !saving;

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Vui lòng nhập tên sự kiện."); return; }
    setSaving(true);
    try {
      const ev = await api.createEvent({
        title: title.trim(),
        description: description || undefined,
        content: content || undefined,
        location: location || undefined,
        city: city || undefined,
        venue: venue || undefined,
        category,
        startTime: toIso(startTime),
        endTime: toIso(endTime),
        bannerUrl: bannerUrl || undefined,
        seatMapUrl: seatMapUrl || undefined,
        latitude,
        longitude,
        status,
        ticketTypes: tickets
          .filter((t) => t.name.trim() && t.totalQuantity)
          .map((t) => ({
            name: t.name.trim(),
            description: t.description.trim() || undefined,
            price: Number(t.price) || 0,
            totalQuantity: Number(t.totalQuantity) || 0,
            maxPerOrder: Number(t.maxPerOrder) || 10,
            status: t.status,
          })),
        showtimes: showtimes
          .filter((s) => s.date)
          .map((s) => ({
            startTime: showtimeIso(s.date, s.start),
            endTime: showtimeIso(s.date, s.end),
            status: s.status,
          })),
      });
      toast.success(`Đã tạo sự kiện "${ev.title}".`);
      navigate(`/organizer/events/${ev.id}`);
    } catch (e) {
      setSaving(false);
      const msg = (e as Error)?.message ?? "Tạo sự kiện thất bại";
      setError(msg);
      toast.error(`Tạo sự kiện thất bại: ${msg}`);
    }
  };

  const inputCls =
    "mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

  return (
    <>
      <OrganizerPageHeader title="Tạo sự kiện" subtitle="Điền thông tin sự kiện và loại vé, sau đó đăng tải." />

      <Container className="max-w-3xl py-8">
        <div className="space-y-8">
          {/* Thông tin chính */}
          <section className="space-y-4">
            <h2 className="display text-xl font-medium">Thông tin sự kiện</h2>
            <label className="block">
              <span className="text-sm font-medium text-ink">Tên sự kiện *</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="VD: Music Night 2026" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Danh mục</span>
                <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} className={cn(inputCls, "cursor-pointer")}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Thành phố</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Hà Nội" />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Địa điểm (venue)</span>
                <input value={venue} onChange={(e) => setVenue(e.target.value)} className={inputCls} placeholder="Sân khấu chính" />
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-ink">Địa chỉ chi tiết</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="11 Ngô Thì Nhậm" />
            </label>
            <div>
              <span className="text-sm font-medium text-ink">Vị trí trên bản đồ</span>
              <LocationPicker
                lat={latitude} lng={longitude}
                onChange={(la, ln) => { setLatitude(la); setLongitude(ln); }}
                onAddress={(a) => { if (!location.trim()) setLocation(a); }}
                className="mt-1.5"
              />
            </div>
            <ImageUpload label="Ảnh bìa" value={bannerUrl} onChange={setBannerUrl} aspect="16 / 9" className="max-w-sm" />
            <p className="-mt-2 text-xs text-faint">Khuyến nghị tỉ lệ 16:9, tối thiểu 1280×720.</p>
            <ImageUpload label="Sơ đồ chỗ ngồi (tuỳ chọn)" value={seatMapUrl} onChange={setSeatMapUrl} aspect="4 / 3" hint="Hiển thị ở trang đặt vé giúp khách hình dung chỗ ngồi" className="max-w-sm" />
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-ink">Bắt đầu</span>
                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Kết thúc</span>
                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">Trạng thái</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as EventStatus)} className={cn(inputCls, "cursor-pointer")}>
                  <option value="PUBLISHED">Đang mở bán</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="ENDED">Đã kết thúc</option>
                  <option value="CANCELLED">Đã huỷ</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-ink">Mô tả ngắn</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15" />
            </label>
          </section>

          {/* Giới thiệu (rich content) */}
          <section className="space-y-3">
            <div>
              <h2 className="display text-xl font-medium">Giới thiệu</h2>
              <p className="text-sm text-muted">Nội dung chi tiết hiển thị ở trang sự kiện. Có thể chèn ảnh bằng nút Ảnh hoặc kéo thả.</p>
            </div>
            <RichEditor value={content} onChange={setContent} />
          </section>

          {/* Loại vé */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="display text-xl font-medium">Loại vé</h2>
              <Button as="button" size="sm" variant="outline" onClick={() => setTickets((p) => [...p, emptyTicket()])}>
                <Plus className="h-4 w-4" strokeWidth={2} /> Thêm loại vé
              </Button>
            </div>
            {tickets.map((t, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                  <label className="block">
                    <span className="text-xs text-muted">Tên hạng vé</span>
                    <input value={t.name} onChange={(e) => setTicket(i, { name: e.target.value })} className={inputCls} placeholder="Standard" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Giá (đ)</span>
                    <input type="number" value={t.price} onChange={(e) => setTicket(i, { price: e.target.value })} className={inputCls} placeholder="300000" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Số lượng</span>
                    <input type="number" value={t.totalQuantity} onChange={(e) => setTicket(i, { totalQuantity: e.target.value })} className={inputCls} placeholder="100" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted">Tối đa/đơn</span>
                    <input type="number" value={t.maxPerOrder} onChange={(e) => setTicket(i, { maxPerOrder: e.target.value })} className={inputCls} />
                  </label>
                </div>
                <label className="mt-3 block">
                  <span className="text-xs text-muted">Mô tả</span>
                  <input value={t.description} onChange={(e) => setTicket(i, { description: e.target.value })} className={inputCls} placeholder="Quyền lợi của hạng vé này…" />
                </label>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted">Trạng thái</span>
                    <select value={t.status} onChange={(e) => setTicket(i, { status: e.target.value as TicketTypeStatus })}
                      className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent">
                      <option value="SELLING">Đang bán</option>
                      <option value="SOLD_OUT">Hết vé</option>
                      <option value="DISABLED">Ẩn</option>
                    </select>
                  </label>
                  <button
                    onClick={() => setTickets((p) => p.filter((_, idx) => idx !== i))}
                    disabled={tickets.length === 1}
                    className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-30 cursor-pointer"
                    aria-label="Xoá loại vé"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Xoá
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* Lịch diễn (tuỳ chọn) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="display text-xl font-medium">Lịch diễn</h2>
                <p className="text-sm text-muted">Thêm các suất diễn nếu sự kiện có nhiều suất. Để trống nếu chỉ một suất.</p>
              </div>
              <Button as="button" size="sm" variant="outline" onClick={() => setShowtimes((p) => [...p, emptyShowtime()])}>
                <Plus className="h-4 w-4" strokeWidth={2} /> Thêm suất
              </Button>
            </div>
            {showtimes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface py-10 text-center">
                <CalendarRange className="mx-auto h-7 w-7 text-faint" strokeWidth={1.5} />
                <p className="mt-2 text-sm text-muted">Chưa có suất diễn — sự kiện sẽ dùng ngày giờ ở trên.</p>
              </div>
            ) : (
              showtimes.map((s, i) => (
                <div key={i} className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-xs text-accent-ink">{i + 1}</span> Suất {i + 1}
                    </span>
                    <button onClick={() => setShowtimes((p) => p.filter((_, idx) => idx !== i))}
                      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Xoá
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <label className="block sm:col-span-2"><span className="text-xs text-muted">Ngày</span>
                      <input type="date" value={s.date} onChange={(e) => setShowtime(i, { date: e.target.value })} className={inputCls} /></label>
                    <label className="block"><span className="text-xs text-muted">Bắt đầu</span>
                      <input type="time" value={s.start} onChange={(e) => setShowtime(i, { start: e.target.value })} className={inputCls} /></label>
                    <label className="block"><span className="text-xs text-muted">Kết thúc</span>
                      <input type="time" value={s.end} onChange={(e) => setShowtime(i, { end: e.target.value })} className={inputCls} /></label>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm"><span className="text-muted">Trạng thái</span>
                    <select value={s.status} onChange={(e) => setShowtime(i, { status: e.target.value })}
                      className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-accent">
                      <option value="SELLING">Đang bán</option>
                      <option value="SOLD_OUT">Hết vé</option>
                      <option value="ENDED">Đã diễn</option>
                    </select>
                  </label>
                </div>
              ))
            )}
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <Button as="button" size="lg" onClick={submit} disabled={!canSubmit}>
              {saving ? <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Đang lưu…</> : <><Save className="h-4.5 w-4.5" strokeWidth={1.75} /> Tạo sự kiện</>}
            </Button>
            <Button as="link" to="/organizer/events" variant="ghost" size="lg">Huỷ</Button>
          </div>
        </div>
      </Container>
    </>
  );
}
