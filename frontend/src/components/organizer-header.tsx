"use client";
import { Link } from "@/lib/router";
import { ChevronLeft } from "lucide-react";
import { Container, Eyebrow } from "./ui";

export function OrganizerPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="border-b border-line bg-elevated py-8">
      <Container>
        <Link
          to="/organizer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" /> Bảng điều khiển
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Nhà tổ chức</Eyebrow>
            <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
          </div>
          {actions}
        </div>
      </Container>
    </section>
  );
}

export function StatPills({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-faint">{it.label}</p>
          <p className="mt-0.5 font-display text-xl font-semibold text-ink">{it.value}</p>
        </div>
      ))}
    </div>
  );
}
