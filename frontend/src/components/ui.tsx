"use client";
import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";

// ── Container ───────────────────────────────────────────────────
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

// ── Eyebrow label ───────────────────────────────────────────────
export function Eyebrow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("eyebrow inline-flex items-center gap-2 text-accent", className)}>
      <span className="h-px w-6 bg-accent/50" />
      {children}
    </span>
  );
}

// ── Button ──────────────────────────────────────────────────────
type Variant = "primary" | "outline" | "ghost" | "dark" | "light" | "outlineLight";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
} & (
  | ({ as?: "button" } & React.ButtonHTMLAttributes<HTMLButtonElement>)
  | ({ as: "link"; to: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">)
);

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:pointer-events-none";

const buttonVariants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-ink shadow-soft",
  dark: "bg-ink text-canvas hover:bg-ink/90 shadow-soft",
  outline: "border border-ink/15 text-ink hover:border-ink/40 hover:bg-ink/[0.03]",
  ghost: "text-ink hover:bg-ink/[0.05]",
  light: "bg-canvas text-ink hover:bg-canvas/90 shadow-soft",
  outlineLight: "border border-canvas/30 text-canvas hover:bg-canvas/10",
};

const buttonSizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "px-8 text-base py-3.5",
};

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children } = props;
  const classes = cn(buttonBase, buttonVariants[variant], buttonSizes[size], className);

  if (props.as === "link") {
    const { as: _a, variant: _v, size: _s, className: _c, children: _ch, to, ...rest } = props;
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  const { as: _a, variant: _v, size: _s, className: _c, children: _ch, ...rest } = props;
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}

// ── Badge ───────────────────────────────────────────────────────
export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        className
      )}
    >
      {children}
    </span>
  );
}

// ── Card ────────────────────────────────────────────────────────
export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface shadow-soft", className)}>
      {children}
    </div>
  );
}

// ── Section heading ─────────────────────────────────────────────
export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-3">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="display text-3xl sm:text-4xl font-medium text-balance">{title}</h2>
      </div>
      {action}
    </div>
  );
}
