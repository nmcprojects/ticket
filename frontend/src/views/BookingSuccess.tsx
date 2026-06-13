"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "@/lib/router";
import { CheckCircle2, ArrowRight, Mail, Ticket, Loader2 } from "lucide-react";
import { Container, Button } from "@/components/ui";
import { api, type BookingDetail } from "@/lib/api";
import { formatVND } from "@/lib/utils";

export default function BookingSuccess() {
  const [params] = useSearchParams();
  const bookingId = params.get("bookingId") ?? "";
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [settling, setSettling] = useState(true);
  const tries = useRef(0);

  // Poll the booking until it becomes PAID (payment webhook -> Kafka chain).
  useEffect(() => {
    if (!bookingId) {
      setSettling(false);
      return;
    }
    let timer: number;
    const poll = async () => {
      try {
        const b = await api.getBooking(bookingId);
        setBooking(b);
        if (b.status === "PAID" || tries.current > 15) {
          setSettling(false);
          return;
        }
        // PayOS has no public webhook on localhost — confirm via verify on return.
        if (b.paymentId && tries.current < 3) {
          api.verifyPayment(b.paymentId).catch(() => undefined);
        }
      } catch {
        /* keep trying */
      }
      tries.current += 1;
      timer = window.setTimeout(poll, 1200);
    };
    poll();
    return () => window.clearTimeout(timer);
  }, [bookingId]);

  const paid = booking?.status === "PAID";
  const qty = booking?.items.reduce((s, it) => s + it.quantity, 0) ?? 0;

  return (
    <section className="py-16">
      <Container className="max-w-xl">
        <div className="flex flex-col items-center text-center">
          {settling ? (
            <>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-accent">
                <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.75} />
              </span>
              <h1 className="display mt-6 text-3xl font-medium sm:text-4xl">Đang xác nhận thanh toán…</h1>
              <p className="mt-3 text-muted">Vui lòng đợi trong giây lát, chúng tôi đang phát hành vé cho bạn.</p>
            </>
          ) : (
            <>
              <span className="flex h-16 w-16 animate-scale-in items-center justify-center rounded-full bg-accent-soft text-accent">
                <CheckCircle2 className="h-9 w-9" strokeWidth={1.75} />
              </span>
              <h1 className="display mt-6 text-3xl font-medium sm:text-4xl">
                {paid ? "Đặt vé thành công!" : "Đã ghi nhận đơn hàng"}
              </h1>
              <p className="mt-3 text-muted">
                {paid
                  ? `${qty} vé điện tử đã được phát hành và gửi tới email của bạn.`
                  : "Đơn của bạn đang được xử lý. Vé sẽ xuất hiện trong mục Vé của tôi khi hoàn tất."}
              </p>
            </>
          )}
        </div>

        {booking && (
          <div className="mt-10 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-dashed border-line px-6 py-4">
              <span className="text-sm text-muted">Mã đơn hàng</span>
              <span className="font-mono font-semibold tracking-wide text-ink">{booking.code}</span>
            </div>
            <div className="space-y-3 px-6 py-5 text-sm">
              <Row label="Sự kiện" value={booking.eventTitle} />
              {booking.items.map((it) => (
                <Row key={it.ticketTypeId} label={`${it.ticketTypeName} × ${it.quantity}`} value={formatVND(it.totalPrice)} />
              ))}
              <Row label="Trạng thái" value={paid ? "Đã thanh toán" : booking.status} />
            </div>
            <div className="flex items-center justify-between border-t border-line bg-elevated px-6 py-4">
              <span className="font-medium">Tổng cộng</span>
              <span className="font-display text-xl font-semibold">{formatVND(booking.totalAmount)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-elevated px-4 py-3 text-sm text-muted">
          <Mail className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
          Email xác nhận kèm mã vé đã được gửi tới hộp thư của bạn.
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button as="link" to="/my-tickets" size="lg" className="flex-1">
            <Ticket className="h-4.5 w-4.5" strokeWidth={1.75} /> Xem vé của tôi
          </Button>
          <Button as="link" to="/events" variant="outline" size="lg" className="flex-1">
            Tiếp tục khám phá <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </Container>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
