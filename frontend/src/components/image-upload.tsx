"use client";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop / click image uploader (Cloudflare R2 via /api/uploads).
 * Shows a live preview; falls back to pasting a URL for power users.
 */
export function ImageUpload({
  value,
  onChange,
  aspect = "16 / 9",
  label,
  hint = "PNG, JPG, WebP — tối đa 8MB",
  className,
}: {
  value: string;
  onChange: (url: string) => void;
  aspect?: string;
  label?: string;
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlMode, setUrlMode] = useState(false);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Chỉ chấp nhận tệp ảnh."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Ảnh vượt quá 8 MB."); return; }
    setError(null);
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      onChange(url);
    } catch (e) {
      setError((e as Error)?.message ?? "Tải ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {label && <span className="text-sm font-medium text-ink">{label}</span>}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!drag) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}
        style={{ aspectRatio: aspect }}
        className={cn(
          "group relative mt-1.5 overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          drag ? "border-accent bg-accent-soft/50" : value ? "border-solid border-line" : "border-line bg-elevated hover:border-ink/25"
        )}
      >
        {value ? (
          <>
            <img src={value} alt="Xem trước" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-ink/0 opacity-0 transition-all duration-200 group-hover:bg-ink/45 group-hover:opacity-100">
              <button type="button" onClick={() => inputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3.5 py-2 text-sm font-medium text-ink shadow-lift transition-transform hover:scale-105 cursor-pointer">
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} /> Đổi ảnh
              </button>
              <button type="button" onClick={() => onChange("")}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink/70 px-3.5 py-2 text-sm font-medium text-canvas backdrop-blur transition-colors hover:bg-red-600 cursor-pointer">
                <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Xoá
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center cursor-pointer">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-accent shadow-soft transition-transform group-hover:scale-105">
                <ImagePlus className="h-6 w-6" strokeWidth={1.75} />
              </span>
            )}
            <p className="text-sm font-medium text-ink">
              {uploading ? "Đang tải lên…" : drag ? "Thả ảnh để tải lên" : "Kéo thả ảnh vào đây hoặc bấm để chọn"}
            </p>
            <p className="text-xs text-faint">{hint}</p>
          </button>
        )}

        {uploading && value && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/50">
            <Loader2 className="h-8 w-8 animate-spin text-canvas" />
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; handleFile(f); }} />

      <div className="mt-1.5 flex items-center justify-between gap-3">
        {error ? <p className="text-xs text-red-600">{error}</p> : <span />}
        <button type="button" onClick={() => setUrlMode((v) => !v)}
          className="shrink-0 text-xs font-medium text-muted transition-colors hover:text-ink cursor-pointer">
          {urlMode ? "Ẩn" : "hoặc dán URL"}
        </button>
      </div>
      {urlMode && (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…"
          className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15" />
      )}
    </div>
  );
}
