import type { EventStatus, BookingStatus, TicketStatus } from "./types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatVND(amount: number): string {
  if (amount === 0) return "Miễn phí";
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

const MONTHS = [
  "Th01", "Th02", "Th03", "Th04", "Th05", "Th06",
  "Th07", "Th08", "Th09", "Th10", "Th11", "Th12",
];

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function parseDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
    monthNum: d.getMonth() + 1,
    year: d.getFullYear(),
    weekday: WEEKDAYS[d.getDay()],
    hours: String(d.getHours()).padStart(2, "0"),
    minutes: String(d.getMinutes()).padStart(2, "0"),
  };
}

export function formatDateLong(iso: string): string {
  const p = parseDate(iso);
  return `${p.weekday}, ${p.day} ${p.month} ${p.year}`;
}

export function formatTime(iso: string): string {
  const p = parseDate(iso);
  return `${p.hours}:${p.minutes}`;
}

export function formatDateRange(start: string, end: string): string {
  const s = parseDate(start);
  return `${s.weekday}, ${s.day} ${s.month} • ${s.hours}:${s.minutes} – ${formatTime(end)}`;
}

export function formatDateTime(iso: string): string {
  const p = parseDate(iso);
  return `${p.day} ${p.month} ${p.year} · ${p.hours}:${p.minutes}`;
}

export function inDateRange(iso: string, from: string | null, to: string | null): boolean {
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export const eventStatusMeta: Record<EventStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Bản nháp", tone: "bg-faint/15 text-muted" },
  PUBLISHED: { label: "Đang mở bán", tone: "bg-accent-soft text-accent-ink" },
  CANCELLED: { label: "Đã huỷ", tone: "bg-red-50 text-red-700" },
  ENDED: { label: "Đã kết thúc", tone: "bg-faint/15 text-muted" },
};

export const bookingStatusMeta: Record<BookingStatus, { label: string; tone: string }> = {
  PENDING_PAYMENT: { label: "Chờ thanh toán", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  PAID: { label: "Đã thanh toán", tone: "bg-accent-soft text-accent-ink border-accent/20" },
  PAYMENT_FAILED: { label: "Thanh toán thất bại", tone: "bg-red-50 text-red-700 border-red-200" },
  CANCELLED: { label: "Đã huỷ", tone: "bg-faint/15 text-muted border-line" },
  EXPIRED: { label: "Hết hạn giữ vé", tone: "bg-faint/15 text-muted border-line" },
};

export const ticketStatusMeta: Record<TicketStatus, { label: string; tone: string }> = {
  ISSUED: { label: "Hợp lệ", tone: "bg-accent-soft text-accent-ink" },
  CHECKED_IN: { label: "Đã check-in", tone: "bg-faint/15 text-muted" },
  CANCELLED: { label: "Đã huỷ", tone: "bg-red-50 text-red-700" },
};

export function soldPercent(tt: { soldQuantity: number; totalQuantity: number }): number {
  if (tt.totalQuantity === 0) return 0;
  return Math.round((tt.soldQuantity / tt.totalQuantity) * 100);
}
