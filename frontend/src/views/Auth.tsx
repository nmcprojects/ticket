"use client";
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "@/lib/router";
import { Ticket, Mail, Lock, User, Phone, Loader2, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui";
import { useAuth } from "@/lib/auth";

// Real seeded accounts (password "password"). See auth-service DataSeeder.
const DEMO_ACCOUNTS = [
  { email: "an@example.com", label: "Khách hàng" },
  { email: "absolute@tickethub.vn", label: "Nhà tổ chức" },
  { email: "vy@tickethub.vn", label: "Nhân viên" },
  { email: "admin@tickethub.vn", label: "Quản trị" },
];

export default function Auth({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await login(email.trim(), password);
      else await register({ email: email.trim(), password, fullName: fullName.trim(), phoneNumber: phone || undefined });
      navigate(redirect, { replace: true });
    } catch (err) {
      setBusy(false);
      setError((err as Error)?.message ?? "Đã có lỗi xảy ra");
    }
  };

  const quickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password");
    setError(null);
    setBusy(true);
    try {
      await login(demoEmail, "password");
      navigate(redirect, { replace: true });
    } catch (err) {
      setBusy(false);
      setError((err as Error)?.message ?? "Đăng nhập thất bại");
    }
  };

  const inputCls =
    "h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-3.5 text-[15px] outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

  return (
    <section className="py-12 lg:py-20">
      <Container className="max-w-md">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-canvas">
            <Ticket className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <h1 className="display mt-5 text-3xl font-medium">
            {isLogin ? "Đăng nhập TicketHub" : "Tạo tài khoản"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isLogin ? "Đăng nhập để đặt vé và quản lý sự kiện của bạn." : "Đăng ký miễn phí, bắt đầu đặt vé ngay."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-3 rounded-2xl border border-line bg-surface p-6 shadow-soft">
          {!isLogin && (
            <>
              <Field icon={User} placeholder="Họ và tên" value={fullName} onChange={setFullName} className={inputCls} required />
              <Field icon={Phone} placeholder="Số điện thoại (tuỳ chọn)" value={phone} onChange={setPhone} className={inputCls} />
            </>
          )}
          <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} className={inputCls} required />
          <Field icon={Lock} type="password" placeholder="Mật khẩu" value={password} onChange={setPassword} className={inputCls} required />

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-medium text-white transition-colors hover:bg-accent-ink disabled:opacity-60 cursor-pointer"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>{isLogin ? "Đăng nhập" : "Đăng ký"} <ArrowRight className="h-4 w-4" strokeWidth={2} /></>
            )}
          </button>

          <p className="pt-1 text-center text-sm text-muted">
            {isLogin ? (
              <>Chưa có tài khoản? <Link to="/register" className="font-medium text-accent hover:text-accent-ink">Đăng ký</Link></>
            ) : (
              <>Đã có tài khoản? <Link to="/login" className="font-medium text-accent hover:text-accent-ink">Đăng nhập</Link></>
            )}
          </p>
        </form>

        {isLogin && (
          <div className="mt-6">
            <p className="text-center text-xs uppercase tracking-wide text-faint">Tài khoản demo (mật khẩu: password)</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => quickLogin(a.email)}
                  disabled={busy}
                  className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-ink/30 disabled:opacity-60 cursor-pointer"
                >
                  <p className="text-sm font-medium text-ink">{a.label}</p>
                  <p className="truncate text-xs text-faint">{a.email}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

function Field({
  icon: Icon, placeholder, value, onChange, type = "text", className, required,
}: {
  icon: typeof Mail;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" strokeWidth={1.75} />
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </div>
  );
}
