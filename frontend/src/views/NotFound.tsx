"use client";
import { Ghost } from "lucide-react";
import { Container, Button } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated text-faint">
        <Ghost className="h-8 w-8" strokeWidth={1.5} />
      </span>
      <h1 className="display mt-6 text-4xl font-medium">Không tìm thấy trang</h1>
      <p className="mt-3 max-w-sm text-muted">
        Sự kiện hoặc trang bạn tìm có thể đã kết thúc hoặc không tồn tại.
      </p>
      <Button as="link" to="/" className="mt-7">Về trang chủ</Button>
    </Container>
  );
}
