"use client";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useParams, useNavigate } from "@/lib/router";
import {
  CalendarDays,
  Clock,
  MapPin,
  ShieldCheck,
  Share2,
  ChevronRight,
  BadgeCheck,
  Minus,
  Plus,
  Ticket,
  ArrowRight,
  CalendarRange,
  Check,
  X,
  ZoomIn,
} from "lucide-react";
import { Container, Badge, Eyebrow, Button } from "@/components/ui";
import { EventCard, DateBlock } from "@/components/event-card";
import { PageLoading, PageError } from "@/components/states";
import { richContentFor } from "@/lib/content";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { useAsync } from "@/lib/use-async";
import {
  formatDateLong,
  formatTime,
  formatVND,
  eventStatusMeta,
  soldPercent,
  cn,
} from "@/lib/utils";
import type { AppEvent, Showtime } from "@/lib/types";
import NotFound from "./NotFound";

function showtimePriceFrom(s: Showtime) {
  const selling = s.ticketTypes.filter((t) => t.status !== "DISABLED");
  return selling.length ? Math.min(...selling.map((t) => t.price)) : 0;
}

export default function EventDetail({
  initialEvent,
}: { initialEvent?: AppEvent } = {}) {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const {
    data: ev,
    loading,
    error,
    refetch,
  } = useAsync(() => api.getEvent(id ?? ""), [id], initialEvent);
  const { data: allEvents } = useAsync(() => api.listEvents(), []);
  const [activeShowId, setActiveShowId] = useState<string | undefined>(
    undefined,
  );

  const share = async () => {
    const url = window.location.href;
    const title = ev?.title ?? "TicketHub";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép liên kết sự kiện.");
    } catch {
      // user cancelled the share sheet, or clipboard blocked — stay silent on cancel
    }
  };

  if (loading && !ev) return <PageLoading />;
  if (error && !ev) return <PageError message={error} onRetry={refetch} />;
  if (!ev) return <NotFound />;

  const firstSelling =
    ev.showtimes?.find((s) => s.status === "SELLING") ?? ev.showtimes?.[0];
  const effectiveShowId = activeShowId ?? firstSelling?.id;
  const activeShow = ev.showtimes?.find((s) => s.id === effectiveShowId);
  const all = allEvents ?? [];
  const related = all
    .filter((e) => e.id !== ev.id && e.category === ev.category)
    .slice(0, 3);
  const fallback = all.filter((e) => e.id !== ev.id).slice(0, 3);
  const moreEvents = related.length ? related : fallback;
  const statusMeta = eventStatusMeta[ev.status];
  const content = richContentFor(ev);

  // Lowest sellable price across the event's ticket types (for the mobile booking bar).
  const sellingPrices = (ev.ticketTypes ?? [])
    .filter((t) => t.status !== "DISABLED")
    .map((t) => t.price);
  const lowestPrice = sellingPrices.length ? Math.min(...sellingPrices) : null;

  return (
    <>
      {/* ── Banner ───────────────────────────────────────── */}
      <section className="relative">
        {/* min-height floor + flex justify-end: banner grows to fit any-length title,
            title stays pinned to the bottom and always over the dark gradient. */}
        <div className="relative flex min-h-[max(42vh,360px)] w-full flex-col justify-end overflow-hidden bg-ink pb-10 sm:pb-14">
          <motion.img
            src={ev.bannerUrl}
            alt={ev.title}
            className="absolute inset-0 h-full w-full object-cover opacity-90"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/10" />
          {/* Top scrim: guarantees breadcrumb contrast even over bright banner images */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/70 to-transparent" />
          <Container className="absolute inset-x-0 top-5">
            <nav className="flex items-center gap-1.5 text-sm text-canvas/90 [text-shadow:0_1px_3px_rgb(0_0_0/0.5)]">
              <Link to="/" className="transition-colors hover:text-canvas">
                Trang chủ
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-canvas/70" />
              <Link
                to="/events"
                className="transition-colors hover:text-canvas"
              >
                Sự kiện
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-canvas/70" />
              <span className="text-canvas/75">{ev.category}</span>
            </nav>
          </Container>
          {/* Title lives inside the banner (always on dark) + text-shadow → readable at any length */}
          <Container className="relative pt-28">
            <motion.div
              className="flex flex-col gap-2"
              initial={{ y: 18 }}
              animate={{ y: 0 }}
              transition={{
                duration: 0.55,
                delay: 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-surface text-ink shadow-soft ring-1 ring-ink/5">
                  {ev.category}
                </Badge>
                <Badge className={statusMeta.tone}>{statusMeta.label}</Badge>
              </div>
              <h1 className="display line-clamp-3 max-w-3xl text-balance text-3xl font-medium leading-tight text-canvas [text-shadow:0_2px_8px_rgb(0_0_0/0.35)] sm:text-4xl lg:text-5xl">
                {ev.title}
              </h1>
            </motion.div>
          </Container>
        </div>
      </section>

      {/* ── Body (details first) ─────────────────────────── */}
      <section className="pb-10 pt-10 lg:pb-14">
        <Container className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: details */}
          <div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: ev.showtimes ? CalendarRange : CalendarDays,
                  label: ev.showtimes ? "Lịch diễn" : "Ngày",
                  value: ev.showtimes
                    ? `${ev.showtimes.length} suất diễn`
                    : formatDateLong(ev.startTime),
                },
                {
                  icon: Clock,
                  label: "Giờ",
                  value: `${formatTime(ev.startTime)} – ${formatTime(ev.endTime)}`,
                },
                { icon: MapPin, label: "Địa điểm", value: ev.venue },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <f.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </span>
                  <p className="mt-3 text-xs uppercase tracking-wide text-faint">
                    {f.label}
                  </p>
                  <p className="mt-0.5 font-medium leading-snug text-ink">
                    {f.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#ticket-box"
                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-accent-ink cursor-pointer"
              >
                <Ticket className="h-4 w-4" strokeWidth={2} /> Đặt vé ngay
              </a>
              <button
                onClick={share}
                className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 cursor-pointer"
              >
                <Share2 className="h-4 w-4" strokeWidth={1.75} /> Chia sẻ
              </button>
            </div>

            {/* Giới thiệu (rich editor content) */}
            <div className="mt-10">
              <Eyebrow>Giới thiệu</Eyebrow>
              <h2 className="display mt-3 text-2xl font-medium">Về sự kiện</h2>
              <div
                className="mt-5 rich"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>

            {/* Lịch diễn */}
            {ev.showtimes && ev.showtimes.length > 0 && (
              <div className="mt-12">
                <Eyebrow>Lịch diễn</Eyebrow>
                <h2 className="display mt-3 text-2xl font-medium">
                  Chọn suất diễn
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Chọn một suất để xem và đặt vé tương ứng.
                </p>
                <div className="mt-5 space-y-3">
                  {ev.showtimes.map((s) => {
                    const active = s.id === effectiveShowId;
                    const soldOut = s.status === "SOLD_OUT";
                    const ended = s.status === "ENDED";
                    const disabled = soldOut || ended;
                    const price = showtimePriceFrom(s);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          if (!disabled) setActiveShowId(s.id);
                        }}
                        disabled={disabled}
                        className={cn(
                          "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
                          active
                            ? "border-accent bg-accent-soft/50 ring-1 ring-accent"
                            : "border-line bg-surface hover:border-ink/30",
                          disabled
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer",
                        )}
                      >
                        <DateBlock iso={s.startTime} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">
                            {formatDateLong(s.startTime)}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                            {formatTime(s.startTime)} – {formatTime(s.endTime)}
                          </p>
                        </div>
                        <div className="text-right">
                          {disabled ? (
                            <Badge className="bg-faint/15 text-muted">
                              {soldOut ? "Hết vé" : "Đã diễn"}
                            </Badge>
                          ) : (
                            <>
                              <p className="text-xs text-faint">Từ</p>
                              <p className="font-display font-semibold text-ink">
                                {formatVND(price)}
                              </p>
                            </>
                          )}
                        </div>
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                            active
                              ? "border-accent bg-accent text-white"
                              : "border-line",
                          )}
                        >
                          {active && (
                            <Check className="h-3.5 w-3.5" strokeWidth={3} />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location */}
            <div className="mt-12">
              <Eyebrow>Địa điểm</Eyebrow>
              <h2 className="display mt-3 text-2xl font-medium">
                Đến nơi tổ chức
              </h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                {ev.latitude != null && ev.longitude != null ? (
                  <iframe
                    title={`Bản đồ — ${ev.venue}`}
                    className="h-56 w-full"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${ev.longitude - 0.006}%2C${ev.latitude - 0.004}%2C${ev.longitude + 0.006}%2C${ev.latitude + 0.004}&layer=mapnik&marker=${ev.latitude}%2C${ev.longitude}`}
                  />
                ) : (
                  <div className="relative flex h-44 items-center justify-center bg-elevated">
                    <div
                      className="absolute inset-0 opacity-[0.5]"
                      style={{
                        backgroundImage:
                          "radial-gradient(rgb(var(--line)) 1px, transparent 1px)",
                        backgroundSize: "18px 18px",
                      }}
                    />
                    <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lift">
                      <MapPin className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 border-t border-line bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <MapPin
                      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                      strokeWidth={1.75}
                    />
                    <div>
                      <p className="font-medium text-ink">{ev.venue}</p>
                      <p className="text-sm text-muted">
                        {ev.location}, {ev.city}
                      </p>
                    </div>
                  </div>
                  {ev.latitude != null && ev.longitude != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${ev.latitude}&mlon=${ev.longitude}#map=16/${ev.latitude}/${ev.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-sm font-medium text-accent transition-colors hover:text-accent-ink cursor-pointer"
                    >
                      Bản đồ lớn ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Organizer */}
            <div className="mt-10">
              <Eyebrow>Nhà tổ chức</Eyebrow>
              <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-center gap-4">
                  <img
                    src={ev.organizer.avatarUrl}
                    alt={ev.organizer.organizationName}
                    className="h-14 w-14 rounded-full border border-line object-cover"
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold text-ink">
                      {ev.organizer.organizationName}
                      {ev.organizer.verified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-accent" />
                      )}
                    </p>
                    {ev.organizer.contactEmail && (
                      <p className="truncate text-sm text-muted">
                        {ev.organizer.contactEmail}
                      </p>
                    )}
                  </div>
                </div>
                {ev.organizer.description && (
                  <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-muted">
                    {ev.organizer.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: trust / summary rail (sticky) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-faint">
                Đặt vé
              </p>
              {lowestPrice != null && (
                <p className="mt-1 font-display text-xl font-semibold text-ink">
                  Từ {formatVND(lowestPrice)}
                </p>
              )}
              <p className="mt-1 font-medium leading-snug text-ink">
                Chọn vé và sơ đồ chỗ ngồi ở khu vực đặt vé bên dưới.
              </p>
              <a
                href="#ticket-box"
                className="mt-4 flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-accent-ink cursor-pointer"
              >
                <Ticket className="h-4 w-4" strokeWidth={2} /> Đặt vé ngay
              </a>
              <div className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm text-muted">
                <p className="flex items-center gap-2">
                  <ShieldCheck
                    className="h-4 w-4 shrink-0 text-accent"
                    strokeWidth={1.75}
                  />{" "}
                  Thanh toán an toàn
                </p>
                <p className="flex items-center gap-2">
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 text-accent"
                    strokeWidth={1.75}
                  />{" "}
                  Vé điện tử có mã QR
                </p>
              </div>
            </div>
          </aside>
        </Container>
      </section>

      {/* ── Purchase area: seat map + ticket selector ────── */}
      <section className="border-t border-line py-10 lg:py-12">
        <Container>
          <div id="ticket-box" className="scroll-mt-24">
            <PurchaseArea event={ev} showtime={activeShow} />
          </div>
        </Container>
      </section>

      {/* ── Related ──────────────────────────────────────── */}
      <section className="border-t border-line py-14">
        <Container>
          <h2 className="display text-2xl font-medium sm:text-3xl">
            Có thể bạn quan tâm
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {moreEvents.map((e) => (
              <EventCard key={e.id} ev={e} />
            ))}
          </div>
        </Container>
      </section>

      {/* ── Mobile sticky booking bar ────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 py-3 shadow-lift backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-faint">
              {lowestPrice != null ? "Giá từ" : "Đặt vé"}
            </p>
            {lowestPrice != null && (
              <p className="font-display text-lg font-semibold leading-tight text-ink">
                {formatVND(lowestPrice)}
              </p>
            )}
          </div>
          <a
            href="#ticket-box"
            className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-accent-ink cursor-pointer"
          >
            <Ticket className="h-4 w-4" strokeWidth={2} /> Đặt vé
          </a>
        </div>
      </div>
    </>
  );
}

// ── Purchase area: seat map + ticket selector ─────────────────
// Responsive 2-column composition on large screens (seat map | tickets).
// On mobile it stacks: seat map on top, ticket list below.
function PurchaseArea({
  event,
  showtime,
}: {
  event: AppEvent;
  showtime?: Showtime;
}) {
  // Two distinct layouts: with a seat map → seat chart beside the selector;
  // without one (e.g. workshops) → a general-admission info panel beside it.
  return event.seatMapUrl ? (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <SeatMapPanel event={event} />
      <TicketSelector event={event} showtime={showtime} />
    </div>
  ) : (
    <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1fr]">
      <GeneralAdmissionPanel event={event} showtime={showtime} />
      <TicketSelector event={event} showtime={showtime} />
    </div>
  );
}

// ── General-admission panel (shown when there is no seat map) ──
function GeneralAdmissionPanel({
  event,
  showtime,
}: {
  event: AppEvent;
  showtime?: Showtime;
}) {
  const start = showtime?.startTime ?? event.startTime;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft lg:sticky lg:top-20">
      <div className="flex items-center gap-2 border-b border-line bg-elevated px-5 py-4">
        <Ticket className="h-5 w-5 text-accent" strokeWidth={1.75} />
        <h3 className="font-semibold">Vào cửa tự do</h3>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-muted">
          Sự kiện không xếp chỗ trước — vé tính theo lượt tham gia. Vui lòng đến
          sớm để có vị trí tốt nhất.
        </p>
        <div className="space-y-3 border-t border-line pt-4">
          <Fact
            icon={CalendarDays}
            label="Thời gian"
            value={`${formatDateLong(start)} · ${formatTime(start)}`}
          />
          <Fact
            icon={MapPin}
            label="Địa điểm"
            value={`${event.venue}, ${event.city}`}
          />
          <Fact
            icon={ShieldCheck}
            label="Quyền lợi"
            value="Vé điện tử có mã QR, check-in nhanh tại cửa."
          />
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
        <p className="text-sm font-medium leading-snug text-ink">{value}</p>
      </div>
    </div>
  );
}

// ── Seat map panel (image with click-to-zoom) ─────────────────
function SeatMapPanel({ event }: { event: AppEvent }) {
  const [zoomed, setZoomed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hasImage = Boolean(event.seatMapUrl) && !imgError;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft lg:sticky lg:top-20">
      <div className="flex items-center gap-2 border-b border-line bg-elevated px-5 py-4">
        <MapPin className="h-5 w-5 text-accent" strokeWidth={1.75} />
        <h3 className="font-semibold">Sơ đồ chỗ ngồi</h3>
      </div>

      {hasImage ? (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          aria-label="Phóng to sơ đồ chỗ ngồi"
          className="group relative block w-full cursor-zoom-in bg-elevated"
        >
          <img
            src={event.seatMapUrl}
            alt={`Sơ đồ chỗ ngồi của ${event.venue}`}
            onError={() => setImgError(true)}
            className="aspect-[3/2] w-full object-cover"
          />
          <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-canvas opacity-0 transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
        </button>
      ) : (
        <div className="flex aspect-[3/2] items-center justify-center bg-elevated px-4 text-center text-sm text-faint">
          Sơ đồ chỗ ngồi đang được cập nhật.
        </div>
      )}

      <p className="border-t border-line bg-surface px-5 py-3 text-xs text-muted">
        {event.venue}
        {hasImage && <span className="text-faint"> · Nhấn để phóng to</span>}
      </p>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {hasImage && zoomed && (
              <motion.div
                className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-label="Sơ đồ chỗ ngồi (phóng to)"
                onClick={() => setZoomed(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  type="button"
                  onClick={() => setZoomed(false)}
                  aria-label="Đóng"
                  className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-lift transition-colors hover:bg-elevated cursor-pointer"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <motion.img
                  src={event.seatMapUrl}
                  alt={`Sơ đồ chỗ ngồi của ${event.venue}`}
                  className="max-h-[90vh] max-w-[92vw] rounded-xl object-contain shadow-lift"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

// ── Ticket selector (showtime-aware) ──────────────────────────
function TicketSelector({
  event,
  showtime,
}: {
  event: AppEvent;
  showtime?: Showtime;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [qty, setQty] = useState<Record<string, number>>({});

  // Reset quantities when the active showtime changes
  const ticketTypes = showtime ? showtime.ticketTypes : event.ticketTypes;
  const keyScope = showtime?.id ?? "base";

  const setQuantity = (ttId: string, next: number, max: number) => {
    const clamped = Math.max(0, Math.min(next, max));
    setQty((prev) => ({ ...prev, [`${keyScope}:${ttId}`]: clamped }));
  };
  const getQ = (ttId: string) => qty[`${keyScope}:${ttId}`] ?? 0;

  const { totalQty, totalAmount, selectedItems } = useMemo(() => {
    let totalQty = 0;
    let totalAmount = 0;
    const selectedItems: { id: string; qty: number }[] = [];
    for (const ttype of ticketTypes) {
      const q = qty[`${keyScope}:${ttype.id}`] ?? 0;
      if (q > 0) {
        totalQty += q;
        totalAmount += q * ttype.price;
        selectedItems.push({ id: ttype.id, qty: q });
      }
    }
    return { totalQty, totalAmount, selectedItems };
  }, [qty, ticketTypes, keyScope]);

  const goToCheckout = () => {
    if (totalQty === 0) return;
    const items = selectedItems.map((s) => `${s.id}:${s.qty}`).join(",");
    const showParam = showtime ? `&show=${showtime.id}` : "";
    const target = `/checkout?event=${event.id}${showParam}&items=${encodeURIComponent(items)}`;
    if (!user) {
      // Yêu cầu đăng nhập trước khi đặt vé
      navigate(`/login?redirect=${encodeURIComponent(target)}`);
      return;
    }
    navigate(target);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-elevated px-5 py-4">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <h3 className="font-semibold">Chọn vé</h3>
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-line">
            {ticketTypes.length} hạng
          </span>
        </div>
        {showtime && (
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted ring-1 ring-line">
            {formatDateLong(showtime.startTime)} ·{" "}
            {formatTime(showtime.startTime)}
          </span>
        )}
      </div>

      {/* Scrolls internally when the list is long, so the total + CTA below stay visible */}
      <div className="max-h-[58vh] divide-y divide-line overflow-y-auto">
        {ticketTypes.map((ttype) => {
          const q = getQ(ttype.id);
          const soldOut =
            ttype.status === "SOLD_OUT" || ttype.availableQuantity <= 0;
          const max = Math.min(ttype.maxPerOrder, ttype.availableQuantity);
          const pct = soldPercent(ttype);
          const almostGone =
            !soldOut && ttype.availableQuantity <= ttype.totalQuantity * 0.15;

          return (
            <div
              key={ttype.id}
              className={cn(
                "p-5 transition-colors",
                q > 0 && "bg-accent-soft/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-ink">{ttype.name}</p>
                    {almostGone && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">
                        Sắp hết
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm leading-snug text-muted">
                    {ttype.description}
                  </p>
                  <p className="mt-2 font-display text-lg font-semibold text-ink">
                    {formatVND(ttype.price)}
                  </p>
                </div>

                {soldOut ? (
                  <span className="shrink-0 rounded-full bg-faint/15 px-3 py-1.5 text-xs font-semibold text-muted">
                    Hết vé
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface p-1">
                    <button
                      onClick={() => setQuantity(ttype.id, q - 1, max)}
                      disabled={q === 0}
                      aria-label={`Giảm vé ${ttype.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.06] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer sm:h-8 sm:w-8"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold tabular-nums">
                      {q}
                    </span>
                    <button
                      onClick={() => setQuantity(ttype.id, q + 1, max)}
                      disabled={q >= max}
                      aria-label={`Tăng vé ${ttype.name}`}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/[0.06] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer sm:h-8 sm:w-8"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      soldOut ? "bg-faint" : "bg-accent",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-faint">
                  {soldOut
                    ? "Đã bán hết"
                    : `Còn ${ttype.availableQuantity}/${ttype.totalQuantity} vé`}
                  {!soldOut && ` · Tối đa ${ttype.maxPerOrder}/đơn`}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line bg-elevated p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted">{totalQty} vé đã chọn</p>
            <p className="font-display text-2xl font-semibold text-ink">
              {formatVND(totalAmount)}
            </p>
          </div>
        </div>
        <Button
          as="button"
          onClick={goToCheckout}
          disabled={totalQty === 0}
          size="lg"
          className="mt-4 w-full"
        >
          {totalQty === 0 ? "Chọn vé để tiếp tục" : "Tiếp tục đặt vé"}
          {totalQty > 0 && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
        </Button>
      </div>
    </div>
  );
}
