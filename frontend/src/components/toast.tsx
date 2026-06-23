"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "success" | "error" | "info";
type Toast = { id: number; message: string; variant: Variant };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: Variant) => {
      const id = (_id += 1);
      setToasts((list) => [...list, { id, message, variant }]);
      window.setTimeout(() => remove(id), 3500);
    },
    [remove]
  );

  const api: ToastApi = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const meta = {
  success: { icon: CheckCircle2, ring: "border-emerald-200", color: "text-emerald-600" },
  error: { icon: XCircle, ring: "border-red-200", color: "text-red-600" },
  info: { icon: Info, ring: "border-line", color: "text-ink" },
} as const;

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const m = meta[toast.variant];
  const Icon = m.icon;
  return (
    <motion.div
      layout
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-lift",
        m.ring
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", m.color)} strokeWidth={2} />
      <p className="flex-1 text-sm font-medium leading-snug text-ink">{toast.message}</p>
      <button
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="shrink-0 text-faint transition-colors hover:text-ink cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
