"use client";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "@/lib/router";
import {
  ChevronLeft, Clock, ShieldCheck, Lock, Loader2, CheckCircle2, User as UserIcon,
} from "lucide-react";
import { Container, Button, Eyebrow } from "@/components/ui";
import { PageLoading } from "@/components/states";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAsync } from "@/lib/use-async";
import { formatVND, formatDateRange, formatDateLong, formatTime } from "@/lib/utils";
import type { AppEvent, TicketType } from "@/lib/types";

type Line = { tt: TicketType; qty: number; subtotal: number };

function parseItems(raw: string | null): { id: string; qty: number }[] {
  if (!raw) return [];
  return raw.split(",").map((part) => {
    const [id, qty] = part.split(":");
    return { id, qty: parseInt(qty, 10) || 0 };
  }).filter((x) => x.id && x.qty > 0);
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const eventId = params.get("event") ?? "";
  const items = useMemo(() => parseItems(params.get("items")), [params]);

  const { data: ev, loading } = useAsync<AppEvent | null>(
    () => (eventId ? api.getEvent(eventId) : Promise.resolve(null)),
    [eventId]
  );

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Require login (event detail already gates, this is a safety net).
  useEffect(() => {
    if (!loading && !user) {
      const target = `/checkout?event=${eventId}&items=${encodeURIComponent(params.get("items") ?? "")}`;
      navigate(`/login?redirect=${encodeURIComponent(target)}`, { replace: true });
    }
  }, [loading, user, eventId, params, navigate]);

  const lines = useMemo<Line[]>(() => {
    if (!ev) return [];
    return items
      .map((it) => {
        const tt = ev.ticketTypes.find((t) => t.id === it.id);
        return tt ? { tt, qty: it.qty, subtotal: tt.price * it.qty } : null;
      })
      .filter((l): l is Line => l !== null);
  }, [ev, items]);

  const showtime = ev?.showtimes?.find((s) => s.id === params.get("show"));
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  if (loading) return <PageLoading />;

  if (!ev || lines.length === 0) {
    return (
      <Container className="py-24 text-center">
        <h1 className="display text-3xl font-medium">Không có vé nào được chọn</h1>
        <p className="mt-3 text-muted">Hãy quay lại và chọn vé cho sự kiện bạn muốn tham gia.</p>
        <Button as="link" to="/events" className="mt-6">Khám phá sự kiện</Button>
      </Container>
    );
  }

  const handlePay = async () => {
    setError(null);
    setProcessing(true);
    try {
      const res = await api.createBooking({
        eventId: Number(ev.id),
        eventTitle: ev.title,
        items: lines.map((l) => ({
          ticketTypeId: Number(l.tt.id),
          ticketTypeName: l.tt.name,
          quantity: l.qty,
          unitPrice: l.tt.price,
        })),
      });
      // Redirect to the payment gateway (PayOS, or the sandbox mock page).
      window.location.href = res.paymentUrl;
    } catch (e) {
      setProcessing(false);
      setError((e as Error)?.message ?? "Không tạo được đơn đặt vé");
    }
  };

  return (
    <section className="py-10">
      <Container>
        <Link to={`/events/${ev.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" /> Quay lại sự kiện
        </Link>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
          <p>Chúng tôi đang <span className="font-semibold">giữ vé</span> cho bạn trong <span className="font-semibold tabular-nums">15:00</span>. Hoàn tất thanh toán để không mất chỗ.</p>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          {/* Left: buyer + payment note */}
          <div className="space-y-8">
            <div>
              <Eyebrow>Người đặt vé</Eyebrow>
              <h2 className="display mt-3 text-2xl font-medium">Thông tin của bạn</h2>
              <div className="mt-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <UserIcon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="font-semibold text-ink">{user?.fullName}</p>
                  <p className="text-sm text-muted">{user?.email}{user?.phoneNumber ? ` · ${user.phoneNumber}` : ""}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-faint">Vé điện tử sẽ được gửi tới email này sau khi thanh toán thành công.</p>
            </div>

            <div>
              <Eyebrow>Thanh toán</Eyebrow>
              <h2 className="display mt-3 text-2xl font-medium">Cổng thanh toán an toàn</h2>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-elevated p-5 text-sm text-muted">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
                <p>
                  Sau khi bấm thanh toán, bạn sẽ được chuyển tới cổng <strong className="text-ink">PayOS</strong> để
                  hoàn tất giao dịch. Vé được phát hành tự động ngay khi thanh toán thành công.
                </p>
              </div>
            </div>
          </div>

          {/* Right: order summary */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
              <div className="relative h-28">
                <img src={ev.bannerUrl} alt={ev.title} className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-ink/10" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="line-clamp-1 font-semibold text-canvas">{ev.title}</p>
                  <p className="text-xs text-canvas/75">
                    {showtime ? `${formatDateLong(showtime.startTime)} · ${formatTime(showtime.startTime)}` : formatDateRange(ev.startTime, ev.endTime)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 p-5">
                {lines.map((l) => (
                  <div key={l.tt.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{l.tt.name}</p>
                      <p className="text-muted">{formatVND(l.tt.price)} × {l.qty}</p>
                    </div>
                    <p className="font-medium tabular-nums">{formatVND(l.subtotal)}</p>
                  </div>
                ))}

                <div className="flex items-end justify-between border-t border-line pt-3">
                  <span className="font-medium">Tổng cộng ({totalQty} vé)</span>
                  <span className="font-display text-2xl font-semibold text-ink">{formatVND(total)}</span>
                </div>

                {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <Button as="button" onClick={handlePay} disabled={processing} size="lg" className="mt-1 w-full">
                  {processing ? (
                    <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Đang chuyển tới thanh toán…</>
                  ) : (
                    <><Lock className="h-4 w-4" strokeWidth={2} /> Thanh toán {formatVND(total)}</>
                  )}
                </Button>

                <ul className="mt-2 space-y-1.5 text-xs text-faint">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> Vé điện tử gửi ngay sau thanh toán</li>
                  <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> Thanh toán bảo mật qua PayOS</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
