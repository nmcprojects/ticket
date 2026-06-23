import type { Ticket } from "./types";
import { formatDateLong, formatTime } from "./utils";

// jsPDF is loaded from a CDN on demand (no npm install — same approach as Leaflet).
// The ticket is rendered onto a <canvas> first so Vietnamese diacritics render
// correctly (jsPDF's built-in fonts are Latin-1 only and would garble them).

type JsPdfCtor = new (opts: { unit: string; format: string; orientation: string }) => {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  addImage(data: string, fmt: string, x: number, y: number, w: number, h: number): void;
  save(name: string): void;
};

const CDN = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
let jsPdfPromise: Promise<JsPdfCtor> | null = null;

function loadJsPdf(): Promise<JsPdfCtor> {
  if (jsPdfPromise) return jsPdfPromise;
  jsPdfPromise = new Promise((resolve, reject) => {
    const w = window as unknown as { jspdf?: { jsPDF: JsPdfCtor } };
    if (w.jspdf?.jsPDF) return resolve(w.jspdf.jsPDF);
    const s = document.createElement("script");
    s.src = CDN;
    s.async = true;
    s.onload = () => (w.jspdf?.jsPDF ? resolve(w.jspdf.jsPDF) : reject(new Error("Không tải được thư viện PDF")));
    s.onerror = () => reject(new Error("Không tải được thư viện PDF"));
    document.head.appendChild(s);
  });
  return jsPdfPromise;
}

function svgToImage(svg: SVGElement): Promise<HTMLImageElement> {
  let xml = new XMLSerializer().serializeToString(svg);
  xml = xml.replace(/currentColor/g, "#1a1815"); // resolve to ink before standalone render
  const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không tạo được mã QR"));
    img.src = url;
  });
}

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', 'Courier New', monospace";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function downloadTicketPdf(ticket: Ticket, qrSvg: SVGElement | null) {
  const jsPDF = await loadJsPdf();

  // A4 portrait at ~150dpi.
  const W = 1240;
  const H = 1754;
  const M = 110;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không khởi tạo được canvas");

  const ink = "#1a1815";
  const accent = "#16704f";
  const gold = "#b08544";
  const muted = "#6e6962";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header band
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, W, 230);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f7f6f3";
  ctx.font = `700 64px ${SANS}`;
  ctx.fillText("TicketHub", M, 120);
  ctx.fillStyle = gold;
  ctx.font = `600 26px ${SANS}`;
  ctx.fillText("VÉ ĐIỆN TỬ", M, 168);

  let y = 350;

  // Event title
  ctx.fillStyle = ink;
  ctx.font = `700 50px ${SANS}`;
  for (const line of wrap(ctx, ticket.eventTitle, W - M * 2)) {
    ctx.fillText(line, M, y);
    y += 64;
  }
  y += 24;

  // Detail rows
  const rows: [string, string][] = [
    ["THỜI GIAN", `${formatDateLong(ticket.startTime)} · ${formatTime(ticket.startTime)}`],
    ["ĐỊA ĐIỂM", `${ticket.venue}, ${ticket.city}`],
    ["LOẠI VÉ", ticket.seatLabel ? `${ticket.ticketTypeName} · Ghế ${ticket.seatLabel}` : ticket.ticketTypeName],
  ];
  for (const [label, value] of rows) {
    ctx.fillStyle = muted;
    ctx.font = `600 24px ${SANS}`;
    ctx.fillText(label, M, y);
    y += 38;
    ctx.fillStyle = ink;
    ctx.font = `600 34px ${SANS}`;
    for (const line of wrap(ctx, value, W - M * 2)) {
      ctx.fillText(line, M, y);
      y += 44;
    }
    y += 24;
  }

  // QR block
  if (qrSvg) {
    try {
      const img = await svgToImage(qrSvg);
      const size = 420;
      const qx = (W - size) / 2;
      y += 20;
      ctx.strokeStyle = "#dcdad5";
      ctx.lineWidth = 2;
      ctx.strokeRect(qx - 28, y - 28, size + 56, size + 56);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qx, y, size, size);
      ctx.drawImage(img, qx, y, size, size);
      y += size + 80;
    } catch {
      /* skip QR if it can't be rasterized */
    }
  }

  // Ticket code + footer
  ctx.textAlign = "center";
  ctx.fillStyle = accent;
  ctx.font = `700 44px ${MONO}`;
  ctx.fillText(ticket.ticketCode, W / 2, y);
  y += 56;
  ctx.fillStyle = muted;
  ctx.font = `400 26px ${SANS}`;
  ctx.fillText("Xuất trình mã QR này tại cửa để check-in.", W / 2, y);
  ctx.textAlign = "left";

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, pw, ph);
  doc.save(`ve-${ticket.ticketCode}.pdf`);
}
