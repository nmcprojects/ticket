"use client";
import { XCircle, ArrowRight, RotateCw } from "lucide-react";
import { Container, Button } from "@/components/ui";

export default function BookingCancel() {
  return (
    <section className="py-20">
      <Container className="max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <XCircle className="h-9 w-9" strokeWidth={1.75} />
        </span>
        <h1 className="display mt-6 text-3xl font-medium">Thanh toán chưa hoàn tất</h1>
        <p className="mt-3 text-muted">
          Giao dịch đã bị huỷ hoặc thất bại. Vé đang giữ đã được trả lại — bạn có thể thử đặt lại bất cứ lúc nào.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button as="link" to="/events" size="lg">
            <RotateCw className="h-4.5 w-4.5" strokeWidth={1.75} /> Chọn sự kiện khác
          </Button>
          <Button as="link" to="/my-tickets" variant="outline" size="lg">
            Đơn hàng của tôi <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Button>
        </div>
      </Container>
    </section>
  );
}
