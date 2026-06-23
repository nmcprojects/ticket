"use client";
import { Loader2, WifiOff, RotateCw } from "lucide-react";
import { Container } from "./ui";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className ?? "h-5 w-5"}`} strokeWidth={1.75} />;
}

export function LoadingBlock({ label = "Đang tải…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <WifiOff className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="font-semibold text-ink">Không kết nối được máy chủ</p>
      <p className="max-w-md text-sm text-muted">{message}</p>
      <p className="max-w-md text-xs text-faint">
        Hãy chắc chắn backend đang chạy (API Gateway tại <span className="font-mono">localhost:8080</span>).
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/30 cursor-pointer"
        >
          <RotateCw className="h-4 w-4" strokeWidth={1.75} /> Thử lại
        </button>
      )}
    </div>
  );
}

/** Full-page wrappers (with a Container) for top-level page states. */
export function PageLoading() {
  return <Container><LoadingBlock /></Container>;
}
export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Container><ErrorBlock message={message} onRetry={onRetry} /></Container>;
}
