"use client";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "@/lib/router";
import { Search, Ticket, Menu, X, LayoutDashboard, ScanLine, LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

function useNavItems() {
  const { hasRole } = useAuth();
  const items = [
    { href: "/events", label: "Sự kiện" },
    { href: "/my-tickets", label: "Vé của tôi" },
    { href: "/organizer", label: "Tổ chức", icon: LayoutDashboard, role: "ORGANIZER" },
    { href: "/check-in", label: "Check-in", icon: ScanLine, role: "STAFF" },
  ];
  return items.filter((i) => !i.role || hasRole(i.role));
}

export function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const nav = useNavItems();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 16;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Transparent only on landing ("/") near the top; force solid when mobile menu is open.
  const transparent = pathname === "/" && !scrolled && !open;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const doLogout = () => {
    logout();
    setMenu(false);
    setOpen(false);
    navigate("/");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        transparent
          ? "border-b border-canvas/10 bg-ink/70 backdrop-blur-md"
          : "border-b border-line bg-canvas/80 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <span
            className={cn(
              "display text-xl font-semibold tracking-tight transition-colors duration-300",
              transparent && "text-canvas"
            )}
          >
            TicketHub
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200",
                isActive(item.href)
                  ? transparent
                    ? "bg-canvas text-ink"
                    : "bg-ink text-canvas"
                  : transparent
                    ? "text-canvas/90 hover:bg-canvas/10 hover:text-canvas"
                    : "text-muted hover:bg-ink/[0.05] hover:text-ink"
              )}
            >
              {item.icon && <item.icon className="h-4 w-4" strokeWidth={1.75} />}
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/events"
            aria-label="Tìm kiếm sự kiện"
            className={cn(
              "hidden h-10 w-10 items-center justify-center rounded-full transition-colors sm:flex cursor-pointer",
              transparent
                ? "text-canvas/80 hover:bg-canvas/10 hover:text-canvas"
                : "text-muted hover:bg-ink/[0.05] hover:text-ink"
            )}
          >
            <Search className="h-5 w-5" strokeWidth={1.75} />
          </Link>

          {user ? (
            <div className="relative hidden sm:block" ref={menuRef}>
              <button
                onClick={() => setMenu((v) => !v)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition-colors cursor-pointer",
                  transparent
                    ? "border-canvas/30 bg-canvas/10 text-canvas hover:border-canvas/50"
                    : "border-line bg-surface hover:border-ink/30"
                )}
              >
                <img src={user.avatarUrl ?? undefined} alt={user.fullName} className="h-8 w-8 rounded-full object-cover" />
                <span className="text-sm font-medium">{user.fullName.split(" ").slice(-1)}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", transparent ? "text-canvas/70" : "text-faint", menu && "rotate-180")} />
              </button>
              {menu && (
                <div className="absolute right-0 mt-2 w-60 origin-top-right animate-scale-in rounded-2xl border border-line bg-surface p-2 shadow-lift">
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <img src={user.avatarUrl ?? undefined} alt={user.fullName} className="h-10 w-10 rounded-full object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{user.fullName}</p>
                      <p className="truncate text-xs text-faint">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 px-3 pb-2">
                    {user.roles.map((r) => (
                      <span key={r} className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold text-accent-ink">{r}</span>
                    ))}
                  </div>
                  <div className="my-1 h-px bg-line" />
                  <Link to="/profile" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.05] cursor-pointer">
                    <UserIcon className="h-4 w-4" strokeWidth={1.75} /> Hồ sơ của tôi
                  </Link>
                  <Link to="/my-tickets" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.05] cursor-pointer">
                    <Ticket className="h-4 w-4" strokeWidth={1.75} /> Vé của tôi
                  </Link>
                  <button onClick={doLogout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
                    <LogOut className="h-4 w-4" strokeWidth={1.75} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className={cn(
                "hidden h-10 items-center rounded-full px-4 text-sm font-medium transition-colors sm:flex cursor-pointer",
                transparent ? "bg-canvas text-ink hover:bg-canvas/90" : "bg-ink text-canvas hover:bg-ink/90"
              )}
            >
              Đăng nhập
            </Link>
          )}

          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Đóng menu" : "Mở menu"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors md:hidden cursor-pointer",
              transparent ? "text-canvas/80 hover:bg-canvas/10 hover:text-canvas" : "text-ink hover:bg-ink/[0.05]"
            )}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-canvas md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-medium transition-colors",
                  isActive(item.href) ? "bg-ink text-canvas" : "text-ink hover:bg-ink/[0.05]"
                )}
              >
                {item.icon && <item.icon className="h-4 w-4" strokeWidth={1.75} />}
                {item.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-line" />
            {user ? (
              <button onClick={doLogout} className="flex items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-medium text-red-600 hover:bg-red-50 cursor-pointer">
                <LogOut className="h-4 w-4" strokeWidth={1.75} /> Đăng xuất ({user.fullName.split(" ").slice(-1)})
              </button>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-[15px] font-medium text-canvas">
                Đăng nhập
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
