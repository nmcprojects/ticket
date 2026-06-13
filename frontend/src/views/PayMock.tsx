"use client";
import { useState } from "react";
import { useNavigate, useParams } from "@/lib/router";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, CreditCard } from "lucide-react";
import { Container } from "@/components/ui";
import { PageLoading, PageError } from "@/components/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { formatVND } from "@/lib/utils";

/**
 * Sandbox payment gateway — stands in for the real PayOS checkout page until
 * credentials are provided. Mirrors the PayOS redirect-then-webhook flow.
 */
export default function PayMock() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { data: payment, loading, error, refetch } = useAsync(() => api.getPayment(paymentId ?? ""), [paymentId]);
  const [busy, setBusy] = useState<"SUCCESS" | "FAILED" | null>(null);

  if (loading) return <PageLoading />;
  if (error || !payment) return <PageError message={error ?? "Không tìm thấy giao dịch"} onRetry={refetch} />;

  const pay = async (result: "SUCCESS" | "FAILED") => {
    setBusy(result);
    try {
      await api.completeSandboxPayment(payment.id, result);
    } catch {
      /* ignore — still redirect to reflect status */
    }
    if (result === "SUCCESS") navigate(`/booking/success?bookingId=${payment.bookingId}`, { replace: true });
    else navigate(`/booking/cancel?bookingId=${payment.bookingId}`, { replace: true });
  };

  const alreadyDone = payment.status === "SUCCESS" || payment.status === "FAILED";

  return (
    <section className="py-12 lg:py-20">
      <Container className="max-w-md">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
          <div className="flex items-center justify-between border-b border-line bg-ink px-6 py-4 text-canvas">
            <span className="flex items-center gap-2 font-semibold">
              <CreditCard className="h-5 w-5" strokeWidth={1.75} /> PayOS
            </span>
            <span className="rounded-full bg-canvas/15 px-2.5 py-1 text-xs font-medium">Sandbox</span>
          </div>

          <div className="p-6 text-center">
            <p className="text-sm text-muted">Số tiền cần thanh toán</p>
            <p className="display mt-1 text-4xl font-semibold text-ink">{formatVND(payment.amount)}</p>
            <p className="mt-2 font-mono text-xs text-faint">Mã GD #{payment.id} · Booking #{payment.bookingId}</p>

            <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-elevated px-4 py-3 text-xs text-muted">
              <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.75} />
              Đây là cổng thanh toán mô phỏng. Chọn kết quả để tiếp tục.
            </div>

            <div className="mt-6 space-y-2.5">
              <button
                onClick={() => pay("SUCCESS")}
                disabled={busy !== null || alreadyDone}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-medium text-white transition-colors hover:bg-accent-ink disabled:opacity-60 cursor-pointer"
              >
                {busy === "SUCCESS" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />}
                Thanh toán thành công
              </button>
              <button
                onClick={() => pay("FAILED")}
                disabled={busy !== null || alreadyDone}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-line text-sm font-medium text-muted transition-colors hover:border-ink/30 hover:text-ink disabled:opacity-60 cursor-pointer"
              >
                {busy === "FAILED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" strokeWidth={1.75} />}
                Giả lập thất bại / huỷ
              </button>
            </div>
            {alreadyDone && (
              <p className="mt-4 text-sm text-muted">Giao dịch đã ở trạng thái <strong>{payment.status}</strong>.</p>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
