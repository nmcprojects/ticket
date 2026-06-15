"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type DateRange = { from: string | null; to: string | null; label: string };

// TZ-safe add-days on a YYYY-MM-DD string
function isoAddDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function short(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function presetRange(key: "all" | "7" | "30" | "90", anchor: string): DateRange {
  if (key === "all") return { from: null, to: null, label: "Tất cả" };
  const days = Number(key);
  return {
    from: isoAddDays(anchor, -(days - 1)),
    to: anchor,
    label: `${days} ngày qua`,
  };
}

const PRESETS: { key: "all" | "7" | "30" | "90"; label: string }[] = [
  { key: "7", label: "7 ngày qua" },
  { key: "30", label: "30 ngày qua" },
  { key: "90", label: "90 ngày qua" },
  { key: "all", label: "Tất cả" },
];

export function DateRangeFilter({
  value,
  onChange,
  anchor,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  anchor: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pickPreset = (key: "all" | "7" | "30" | "90") => {
    const r = presetRange(key, anchor);
    setFrom(r.from ?? "");
    setTo(r.to ?? "");
    onChange(r);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!from || !to) return;
    const [f, t] = from <= to ? [from, to] : [to, from];
    onChange({ from: f, to: t, label: `${short(f)} – ${short(t)}` });
    setOpen(false);
  };

  const isActivePreset = (key: "all" | "7" | "30" | "90") => {
    const r = presetRange(key, anchor);
    return r.from === value.from && r.to === value.to;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border bg-surface px-4 text-sm font-medium transition-colors cursor-pointer",
          open ? "border-ink/40" : "border-line hover:border-ink/30"
        )}
      >
        <CalendarDays className="h-4 w-4 text-muted" strokeWidth={1.75} />
        <span className="text-ink">{value.label}</span>
        <ChevronDown className={cn("h-4 w-4 text-faint transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 origin-top-right animate-scale-in rounded-2xl border border-line bg-surface p-3 shadow-lift">
          <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-faint">Khoảng nhanh</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => pickPreset(p.key)}
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  isActivePreset(p.key) ? "bg-accent-soft text-accent-ink" : "text-ink hover:bg-ink/[0.05]"
                )}
              >
                {p.label}
                {isActivePreset(p.key) && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>

          <div className="my-3 h-px bg-line" />

          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">Tuỳ chỉnh</p>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-muted">Từ ngày</span>
              <input
                type="date"
                value={from}
                max={to || anchor}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>
            <label className="block">
              <span className="text-xs text-muted">Đến ngày</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={anchor}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </label>
            <button
              onClick={applyCustom}
              disabled={!from || !to}
              className="mt-1 h-10 w-full rounded-full bg-accent text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              Áp dụng khoảng ngày
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
