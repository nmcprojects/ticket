"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 168 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    QRCode.toString(value, {
      type: "svg",
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then(setSvg)
      .catch(() => setSvg(""));
  }, [value, size]);

  if (!svg) {
    return (
      <div
        className="flex items-center justify-center bg-white"
        style={{ width: size, height: size }}
      >
        <span className="text-xs text-muted">Đang tạo mã QR…</span>
      </div>
    );
  }

  return (
    <div
      className="bg-white"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label={`Mã QR: ${value}`}
      role="img"
    />
  );
}
