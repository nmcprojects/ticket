"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "@/lib/router";
import {
  X, MapPin, CalendarDays, QrCode as QrIcon, Download, Loader2, Ticket as TicketIcon, ChevronRight,
} from "lucide-react";
import { Container, Eyebrow, Badge } from "@/components/ui";
import { QrCode } from "@/components/qr";
import { useToast } from "@/components/toast";
import { downloadTicketPdf } from "@/lib/ticket-pdf";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import { Pagination, usePaged } from "@/components/pagination";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAsync } from "@/lib/use-async";
import type { Ticket } from "@/lib/types";
import type { BookingStatus } from "@/lib/types";
import {
  cn, formatVND, formatDateLong, formatTime, ticketStatusMeta, bookingStatusMeta,
} from "@/lib/utils";

type Tab = "tickets" | "orders";

export default function MyTickets() {
  const [tab, setTab] = useState<Tab>("tickets");
  const [active, setActive] = useState<Ticket | null>(null);
  const { user } = useAuth();
  const userId = user?.id;
  const { data, loading, error, refetch } = useAsync(() => api.listMyTickets(), [userId]);
  const tickets = data ?? [];

  const ordersAsync = useAsync(() => api.listMyBookings(), [userId]);
  const bookings = ordersAsync.data ?? [];

  const ticketsPaged = usePaged(tickets, 8);
  const ordersPaged = usePaged(bookings, 8);

  return (
    <>
      <section className="border-b border-line bg-elevated py-12">
        <Container>
          <Eyebrow>Tài khoản</Eyebrow>
          <h1 className="display mt-4 text-4xl font-medium sm:text-5xl">Vé của tôi</h1>
          <p className="mt-3 text-muted">
            Vé điện tử và lịch sử đơn hàng của bạn. Nhấn vào vé để xem mã QR check-in.
          </p>
        </Container>
      </section>

      <section className="py-10">
        <Container>
          {/* Tabs */}
          <div className="inline-flex rounded-full border border-line bg-surface p-1">
            {([["tickets", "Vé điện tử", tickets.length], ["orders", "Đơn hàng", bookings.length]] as const).map(
              ([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 cursor-pointer",
                    tab === key ? "bg-ink text-canvas" : "text-muted hover:text-ink"
                  )}
                >
                  {label}
                  <span className={cn("rounded-full px-1.5 text-xs", tab === key ? "bg-canvas/20" : "bg-line")}>
                    {count}
                  </span>
                </button>
              )
            )}
          </div>

          {/* Tickets */}
          {tab === "tickets" && loading && <LoadingBlock label="Đang tải vé…" />}
          {tab === "tickets" && error && <ErrorBlock message={error} onRetry={refetch} />}
          {tab === "tickets" && !loading && !error && tickets.length === 0 && (
            <div className="mt-12 flex flex-col items-center gap-2 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-faint">
                <TicketIcon className="h-6 w-6" />
              </span>
              <p className="font-semibold text-ink">Chưa có vé nào</p>
              <p className="max-w-sm text-sm text-muted">Đặt vé một sự kiện để thấy vé điện tử xuất hiện ở đây.</p>
            </div>
          )}
          {tab === "tickets" && !loading && !error && tickets.length > 0 && (
            <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {ticketsPaged.pageItems.map((tk) => {
                const meta = ticketStatusMeta[tk.status];
                return (
                  <button
                    key={tk.id}
                    onClick={() => setActive(tk)}
                    className="group flex overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift cursor-pointer"
                  >
                    <div className="relative w-28 shrink-0 overflow-hidden bg-elevated">
                      <img src={tk.bannerUrl} alt={tk.eventTitle} className="absolute inset-0 h-full w-full object-cover" />
                    </div>
                    <div className="perforation relative flex-1 border-l border-dashed border-line p-4">
                      <div className="flex items-start justify-between gap-2">
                        <Badge className={meta.tone}>{meta.label}</Badge>
                        <QrIcon className="h-5 w-5 text-faint transition-colors group-hover:text-accent" strokeWidth={1.5} />
                      </div>
                      <h3 className="mt-2 line-clamp-2 font-semibold leading-snug text-ink">{tk.eventTitle}</h3>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                        <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {formatDateLong(tk.startTime)} · {formatTime(tk.startTime)}
                      </p>
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                        <span className="text-xs text-faint">{tk.ticketTypeName}{tk.seatLabel ? ` · ${tk.seatLabel}` : ""}</span>
                        <span className="text-xs text-muted">Nhấn để xem QR</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Pagination className="mt-8" page={ticketsPaged.page} pageCount={ticketsPaged.pageCount} onChange={ticketsPaged.setPage} total={ticketsPaged.total} pageSize={8} />
            </>
          )}

          {/* Orders */}
          {tab === "orders" && ordersAsync.loading && <LoadingBlock label="Đang tải đơn hàng…" />}
          {tab === "orders" && ordersAsync.error && <ErrorBlock message={ordersAsync.error} onRetry={ordersAsync.refetch} />}
          {tab === "orders" && !ordersAsync.loading && !ordersAsync.error && bookings.length === 0 && (
            <div className="mt-12 flex flex-col items-center gap-2 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-faint">
                <TicketIcon className="h-6 w-6" />
              </span>
              <p className="font-semibold text-ink">Chưa có đơn hàng nào</p>
              <p className="max-w-sm text-sm text-muted">Đặt vé một sự kiện để thấy đơn hàng xuất hiện ở đây.</p>
            </div>
          )}
          {tab === "orders" && !ordersAsync.loading && !ordersAsync.error && bookings.length > 0 && (
            <>
            <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
              {ordersPaged.pageItems.map((bk, i) => {
                const meta = bookingStatusMeta[bk.status as BookingStatus] ?? bookingStatusMeta.PENDING_PAYMENT;
                return (
                  <Link
                    key={bk.id}
                    to={`/events/${bk.eventId}`}
                    className={cn(
                      "flex items-center gap-4 p-5 transition-colors hover:bg-elevated cursor-pointer",
                      i > 0 && "border-t border-line"
                    )}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <TicketIcon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{bk.eventTitle}</p>
                      <p className="text-sm text-muted">
                        <span className="font-mono">{bk.code}</span> · {bk.items.reduce((s, it) => s + it.quantity, 0)} vé · {bk.createdAt ? formatDateLong(bk.createdAt) : "—"}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-display font-semibold text-ink">{formatVND(bk.totalAmount)}</p>
                      <Badge className={cn("mt-1 border", meta.tone)}>{meta.label}</Badge>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
                  </Link>
                );
              })}
            </div>
            <Pagination className="mt-8" page={ordersPaged.page} pageCount={ordersPaged.pageCount} onChange={ordersPaged.setPage} total={ordersPaged.total} pageSize={8} />
            </>
          )}
        </Container>
      </section>

      <AnimatePresence>
        {active && <TicketModal ticket={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </>
  );
}

function TicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const meta = ticketStatusMeta[ticket.status];
  const toast = useToast();
  const qrRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const svg = qrRef.current?.querySelector("svg");
      await downloadTicketPdf(ticket, svg ?? null);
      toast.success("Đã tải vé PDF.");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Tải vé thất bại");
    } finally {
      setDownloading(false);
    }
  };

  if (!mounted) return null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-lift"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        <div className="relative h-32">
          <img src={ticket.bannerUrl} alt={ticket.eventTitle} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 to-ink/20" />
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-canvas/90 text-ink transition-colors hover:bg-canvas cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="absolute inset-x-0 bottom-0 p-4">
            <Badge className={meta.tone}>{meta.label}</Badge>
            <h3 className="mt-1.5 line-clamp-1 font-semibold text-canvas">{ticket.eventTitle}</h3>
          </div>
        </div>

        <div className="flex flex-col items-center px-6 pb-6 pt-6">
          <div ref={qrRef} className="rounded-2xl border border-line p-3">
            <QrCode value={ticket.qrPayload} size={168} />
          </div>
          <p className="text-xs text-faint mt-3">Đưa mã QR cho nhân viên tại cửa để check-in</p>

          <div className="mt-5 w-full space-y-2.5 border-t border-dashed border-line pt-5 text-sm">
            <Detail icon={CalendarDays} label="Thời gian" value={`${formatDateLong(ticket.startTime)} · ${formatTime(ticket.startTime)}`} />
            <Detail icon={MapPin} label="Địa điểm" value={ticket.venue} />
            <Detail icon={TicketIcon} label="Loại vé" value={`${ticket.ticketTypeName}${ticket.seatLabel ? ` · Ghế ${ticket.seatLabel}` : ""}`} />
          </div>

          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-60 cursor-pointer"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.75} />}
            {downloading ? "Đang tạo PDF…" : "Tải vé (PDF)"}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" strokeWidth={1.75} />
      <div className="flex-1">
        <span className="text-xs text-faint">{label}</span>
        <p className="font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}
