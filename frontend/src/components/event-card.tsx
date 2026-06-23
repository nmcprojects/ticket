"use client";
import { Link } from "@/lib/router";
import { MapPin, ArrowUpRight } from "lucide-react";
import type { AppEvent } from "@/lib/types";
import { formatVND, parseDate } from "@/lib/utils";
import { Badge } from "./ui";

function lowestPrice(ev: AppEvent): number {
  const selling = ev.ticketTypes.filter((t) => t.status !== "DISABLED");
  return Math.min(...selling.map((t) => t.price));
}

export function DateBlock({ iso, className }: { iso: string; className?: string }) {
  const d = parseDate(iso);
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-line bg-surface px-3 py-2 leading-none ${className ?? ""}`}
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-accent">
        {d.month}
      </span>
      <span className="display text-xl font-semibold">{d.day}</span>
    </div>
  );
}

export function EventCard({ ev }: { ev: AppEvent }) {
  const price = lowestPrice(ev);
  const d = parseDate(ev.startTime);

  return (
    <Link
      to={`/events/${ev.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift cursor-pointer"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-elevated">
        <img
          src={ev.bannerUrl}
          alt={ev.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
        <div className="absolute left-3 top-3">
          <Badge className="bg-surface text-ink shadow-soft ring-1 ring-ink/5">{ev.category}</Badge>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/30 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <DateBlock iso={ev.startTime} className="shrink-0" />
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-semibold leading-snug text-ink">
              {ev.title}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{ev.city}</span>
              <span className="text-faint">·</span>
              <span>{d.weekday} {d.hours}:{d.minutes}</span>
            </p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
          <div>
            <span className="text-[0.7rem] uppercase tracking-wide text-faint">Từ</span>
            <p className="font-display text-lg font-semibold text-ink">{formatVND(price)}</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/[0.04] text-ink transition-colors group-hover:bg-accent group-hover:text-white">
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
}
