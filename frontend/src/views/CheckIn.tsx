"use client";
import { useEffect, useRef, useState } from "react";
import {
  ScanLine, CheckCircle2, XCircle, AlertTriangle, Ban, Search, Camera, CameraOff, Clock, UserCheck,
} from "lucide-react";
import { Container, Eyebrow, Button } from "@/components/ui";
import { api, DEMO_STAFF_ID } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { CheckinResult } from "@/lib/types";


type Scan = {
  code: string;
  result: CheckinResult;
  holder?: string;
  eventTitle?: string;
  ticketTypeName?: string;
  seat?: string;
  time: string;
};

const resultMeta: Record<
  CheckinResult,
  { label: string; sub: string; icon: typeof CheckCircle2; ring: string; bg: string; text: string; chip: string }
> = {
  VALID: {
    label: "Hợp lệ — Cho vào",
    sub: "Vé đã được check-in thành công.",
    icon: CheckCircle2,
    ring: "ring-accent/30", bg: "bg-accent-soft", text: "text-accent-ink", chip: "bg-accent text-white",
  },
  ALREADY_CHECKED_IN: {
    label: "Đã check-in trước đó",
    sub: "Vé này đã được sử dụng để vào cửa.",
    icon: AlertTriangle,
    ring: "ring-amber-300/40", bg: "bg-amber-50", text: "text-amber-800", chip: "bg-amber-500 text-white",
  },
  INVALID_TICKET: {
    label: "Vé không hợp lệ",
    sub: "Không tìm thấy mã vé trong hệ thống.",
    icon: XCircle,
    ring: "ring-red-300/40", bg: "bg-red-50", text: "text-red-700", chip: "bg-red-500 text-white",
  },
  CANCELLED_TICKET: {
    label: "Vé đã bị huỷ",
    sub: "Vé này đã bị huỷ, không cho vào.",
    icon: Ban,
    ring: "ring-red-300/40", bg: "bg-red-50", text: "text-red-700", chip: "bg-red-500 text-white",
  },
};

export default function CheckIn() {
  const [code, setCode] = useState("");
  const [current, setCurrent] = useState<Scan | null>(null);
  const [log, setLog] = useState<Scan[]>([]);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScan = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const { user } = useAuth();

  // The staff performing the check-in IS the logged-in user — no selection needed.
  const staffId = user?.id ?? DEMO_STAFF_ID;

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const verify = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    setCode("");
    try {
      // QR payloads contain ':' and are Base64 (case-sensitive); plain codes are uppercase.
      const payload = c.includes(":") ? c : c.toUpperCase();
      const res = await api.checkIn(payload, staffId);
      const scan: Scan = {
        code: c,
        result: res.result,
        holder: res.ticket?.customerEmail ?? undefined,
        eventTitle: res.ticket?.eventTitle ?? undefined,
        ticketTypeName: res.ticket?.ticketTypeName ?? undefined,
        time: now(),
      };
      setCurrent(scan);
      setLog((prev) => [scan, ...prev].slice(0, 8));
    } catch (e) {
      const scan: Scan = {
        code: c,
        result: "INVALID_TICKET" as CheckinResult,
        holder: undefined,
        eventTitle: "Lỗi kết nối: " + ((e as Error)?.message ?? ""),
        time: now(),
      };
      setCurrent(scan);
      setLog((prev) => [scan, ...prev].slice(0, 8));
    }
  };

  // Keep the camera loop pointed at the latest verify without restarting the stream.
  const verifyRef = useRef(verify);
  verifyRef.current = verify;

  useEffect(() => {
    if (!scanning) return;
    type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
    const BD = (window as unknown as {
      BarcodeDetector?: new (o: { formats: string[] }) => Detector;
    }).BarcodeDetector;
    if (!BD) {
      setCamError("Trình duyệt không hỗ trợ quét QR tự động. Vui lòng nhập mã thủ công bên dưới.");
      setScanning(false);
      return;
    }
    const detector = new BD({ formats: ["qr_code"] });
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found.length) {
              const raw = found[0].rawValue;
              const t = Date.now();
              if (raw && (raw !== lastScan.current.code || t - lastScan.current.at > 2500)) {
                lastScan.current = { code: raw, at: t };
                verifyRef.current(raw);
              }
            }
          } catch {
            /* ignore transient per-frame decode errors */
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setCamError("Không truy cập được camera. Hãy cấp quyền camera cho trang hoặc nhập mã thủ công.");
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [scanning]);

  const toggleScan = () => {
    setCamError(null);
    setScanning((s) => !s);
  };

  return (
    <section className="py-12">
      <Container className="max-w-5xl">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-canvas">
            <ScanLine className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <Eyebrow>Nhân viên · STAFF</Eyebrow>
            <h1 className="display text-3xl font-medium">Check-in tại cửa</h1>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* Scanner */}
          <div>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft">
              {/* Người thực hiện check-in chính là tài khoản đang đăng nhập */}
              {user && (
                <div className="mb-5 flex items-center gap-3 rounded-xl border border-line bg-elevated px-3.5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <UserCheck className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-faint">Nhân viên check-in</p>
                    <p className="truncate text-sm font-medium text-ink">{user.fullName}</p>
                  </div>
                </div>
              )}

              {/* Camera viewfinder — real QR scanning via BarcodeDetector */}
              <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-ink">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={cn("absolute inset-0 h-full w-full object-cover", !scanning && "hidden")}
                />
                {scanning ? (
                  <>
                    <div className="pointer-events-none relative h-40 w-40 rounded-xl border-2 border-canvas/40">
                      {["-top-px -left-px border-t-2 border-l-2 rounded-tl-xl", "-top-px -right-px border-t-2 border-r-2 rounded-tr-xl", "-bottom-px -left-px border-b-2 border-l-2 rounded-bl-xl", "-bottom-px -right-px border-b-2 border-r-2 rounded-br-xl"].map((c) => (
                        <span key={c} className={cn("absolute h-7 w-7 border-accent", c)} />
                      ))}
                      <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-accent shadow-[0_0_12px_rgb(var(--accent))]" />
                    </div>
                    <span className="absolute bottom-3 flex items-center gap-1.5 text-xs text-canvas/70">
                      <Camera className="h-3.5 w-3.5" /> Đưa mã QR vào khung hình
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas/10 text-canvas/70">
                      <Camera className="h-7 w-7" strokeWidth={1.5} />
                    </span>
                    <p className="max-w-[16rem] text-sm text-canvas/60">Quét mã QR trên vé bằng camera, hoặc nhập mã thủ công bên dưới.</p>
                  </div>
                )}
              </div>

              <button
                onClick={toggleScan}
                className={cn(
                  "mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors cursor-pointer",
                  scanning ? "border border-line bg-surface text-ink hover:border-ink/30" : "bg-ink text-canvas hover:bg-ink/90"
                )}
              >
                {scanning ? <><CameraOff className="h-4 w-4" strokeWidth={1.75} /> Tắt camera</> : <><Camera className="h-4 w-4" strokeWidth={1.75} /> Bật camera quét QR</>}
              </button>

              {camError && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{camError}</p>
              )}

              {/* Manual entry */}
              <div className="mt-5">
                <p className="mb-2 text-xs font-medium text-muted">Hoặc nhập mã vé thủ công</p>
                <form
                  onSubmit={(e) => { e.preventDefault(); verify(code); }}
                  className="flex items-center gap-2 rounded-full border border-line bg-elevated px-4 focus-within:border-accent/60"
                >
                  <Search className="h-5 w-5 text-muted" strokeWidth={1.75} />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Nhập mã vé, vd: TICKET-7Q2M-001"
                    aria-label="Mã vé"
                    className="h-12 flex-1 bg-transparent font-mono text-sm outline-none placeholder:font-sans placeholder:text-faint"
                  />
                  <Button as="button" type="submit" size="sm" className="h-9 px-5">Kiểm tra</Button>
                </form>
              </div>
            </div>

            {/* Result */}
            {current && (() => {
              const m = resultMeta[current.result];
              const Icon = m.icon;
              return (
                <div className={cn("mt-5 animate-scale-in rounded-2xl border border-line p-6 ring-4", m.bg, m.ring)}>
                  <div className="flex items-start gap-4">
                    <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", m.chip)}>
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <div className="flex-1">
                      <p className={cn("font-display text-xl font-semibold", m.text)}>{m.label}</p>
                      <p className={cn("text-sm opacity-80", m.text)}>{m.sub}</p>
                      <p className="mt-2 font-mono text-xs text-ink/70">{current.code}</p>
                      {current.holder && (
                        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink/10 pt-3 text-sm">
                          <Info label="Khách" value={current.holder} />
                          <Info label="Sự kiện" value={current.eventTitle ?? "—"} />
                          <Info label="Loại vé" value={current.ticketTypeName ?? "—"} />
                          {current.seat && <Info label="Ghế" value={current.seat} />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Log */}
          <div>
            <div className="rounded-2xl border border-line bg-surface shadow-soft">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="font-semibold text-ink">Lượt check-in gần đây</h2>
                <span className="flex items-center gap-1.5 text-xs text-faint">
                  <Clock className="h-3.5 w-3.5" /> {log.length} lượt
                </span>
              </div>
              {log.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-faint">
                    <ScanLine className="h-6 w-6" />
                  </span>
                  <p className="text-sm text-muted">Chưa có lượt check-in nào.<br />Quét hoặc nhập mã vé để bắt đầu.</p>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {log.map((scan, i) => {
                    const m = resultMeta[scan.result];
                    const Icon = m.icon;
                    return (
                      <li key={i} className="flex items-center gap-3 px-5 py-3.5">
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", m.chip)}>
                          <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{scan.holder ?? "Không xác định"}</p>
                          <p className="truncate font-mono text-xs text-faint">{scan.code}</p>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-xs font-semibold", m.text)}>{m.label.split("—")[0].trim()}</p>
                          <p className="text-xs text-faint">{scan.time}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-ink/50">{label}</span>
      <p className="font-medium text-ink">{value}</p>
    </div>
  );
}
