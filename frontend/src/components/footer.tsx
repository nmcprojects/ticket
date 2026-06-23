"use client";
import { Link } from "@/lib/router";
import { Container } from "./ui";

const columns = [
  {
    title: "Khám phá",
    links: [
      { label: "Tất cả sự kiện", href: "/events" },
      { label: "Âm nhạc", href: "/events" },
      { label: "Sân khấu", href: "/events" },
      { label: "Workshop", href: "/events" },
    ],
  },
  {
    title: "Tài khoản",
    links: [
      { label: "Vé của tôi", href: "/my-tickets" },
      { label: "Đơn hàng", href: "/my-tickets" },
      { label: "Trang tổ chức", href: "/organizer" },
      { label: "Check-in", href: "/check-in" },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { label: "Trung tâm trợ giúp", href: "/events" },
      { label: "Điều khoản", href: "/events" },
      { label: "Bảo mật", href: "/events" },
      { label: "Liên hệ", href: "/events" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-canvas grain">
      <Container className="relative py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <span className="display text-xl font-semibold">TicketHub</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-canvas/65">
              Nền tảng đặt vé sự kiện cho âm nhạc, sân khấu, workshop và hơn thế nữa —
              đặt vé nhanh, thanh toán an toàn, check-in bằng mã QR.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="space-y-4">
              <h3 className="eyebrow text-canvas/55">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href}
                      className="text-sm text-canvas/65 transition-colors hover:text-canvas"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-canvas/10 pt-8 text-sm text-canvas/55 sm:flex-row sm:items-center">
          <p>© 2026 TicketHub. Bảo lưu mọi quyền.</p>
          <div className="flex items-center gap-5">
            <Link to="/events" className="transition-colors hover:text-canvas">Điều khoản</Link>
            <Link to="/events" className="transition-colors hover:text-canvas">Bảo mật</Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
