"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bold, Italic, Heading2, Heading3, List, Quote, Link2, Undo2, Redo2, ImagePlus, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// A lightweight WYSIWYG editor (demo). Uses document.execCommand — deprecated
// but supported across browsers and sufficient for an organizer content editor.

type Cmd = { icon: typeof Bold; title: string; run: () => void };

export function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize once (uncontrolled to preserve caret position)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML.trim() === "") {
      ref.current.innerHTML = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const addLink = () => {
    const url = window.prompt("Nhập đường dẫn (URL):", "https://");
    if (url) exec("createLink", url);
  };

  const rememberCaret = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const insertImage = (url: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    document.execCommand("insertHTML", false, `<figure><img src="${url}" alt="" /></figure><p><br/></p>`);
    onChange(el.innerHTML);
  };

  const uploadAndInsert = async (file: File) => {
    if (!file.type.startsWith("image/")) { setError("Chỉ chấp nhận tệp ảnh."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Ảnh vượt quá 8 MB."); return; }
    setError(null);
    setUploading(true);
    try {
      const url = await api.uploadImage(file);
      insertImage(url);
    } catch (err) {
      setError((err as Error)?.message ?? "Tải ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadAndInsert(file);
  };

  const [dragOver, setDragOver] = useState(false);
  const onDropFiles = (e: React.DragEvent) => {
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    e.preventDefault();
    setDragOver(false);
    // Place the caret at the drop point so the image lands where the user dropped it.
    const r = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range })
      .caretRangeFromPoint?.(e.clientX, e.clientY);
    if (r) savedRange.current = r;
    uploadAndInsert(file);
  };

  const groups: Cmd[][] = [
    [
      { icon: Heading2, title: "Tiêu đề lớn", run: () => exec("formatBlock", "<h2>") },
      { icon: Heading3, title: "Tiêu đề nhỏ", run: () => exec("formatBlock", "<h3>") },
    ],
    [
      { icon: Bold, title: "In đậm", run: () => exec("bold") },
      { icon: Italic, title: "In nghiêng", run: () => exec("italic") },
    ],
    [
      { icon: List, title: "Danh sách", run: () => exec("insertUnorderedList") },
      { icon: Quote, title: "Trích dẫn", run: () => exec("formatBlock", "<blockquote>") },
      { icon: Link2, title: "Chèn liên kết", run: addLink },
    ],
    [
      { icon: Undo2, title: "Hoàn tác", run: () => exec("undo") },
      { icon: Redo2, title: "Làm lại", run: () => exec("redo") },
    ],
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      {/* Internal scroll context so the toolbar can stick while editing long content */}
      <div className="max-h-[68vh] overflow-y-auto">
        {/* Toolbar — sticks to the top of the scroll area */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-line bg-elevated/95 px-3 py-2 backdrop-blur">
          {groups.map((group, gi) => (
            <div key={gi} className="flex items-center gap-1">
              {gi > 0 && <span className="mx-1 h-5 w-px bg-line" />}
              {group.map((c) => (
                <button
                  key={c.title}
                  type="button"
                  title={c.title}
                  onMouseDown={(e) => { e.preventDefault(); c.run(); }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink cursor-pointer"
                >
                  <c.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          ))}

          <span className="mx-1 h-5 w-px bg-line" />
          <button
            type="button"
            title="Chèn ảnh"
            disabled={uploading}
            onMouseDown={(e) => { e.preventDefault(); rememberCaret(); }}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-50 cursor-pointer"
          >
            {uploading ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ImagePlus className="h-4.5 w-4.5" strokeWidth={1.75} />}
            Ảnh
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />

          <span className="ml-auto pr-1 text-xs text-faint">Kéo thả ảnh vào nội dung để chèn</span>
        </div>

        {/* Editable area — drop an image anywhere to insert it inline */}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => ref.current && onChange(ref.current.innerHTML)}
          onKeyUp={rememberCaret}
          onMouseUp={rememberCaret}
          onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); if (!dragOver) setDragOver(true); } }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropFiles}
          className={cn(
            "rich min-h-[440px] max-w-none px-6 py-5 outline-none transition-colors",
            dragOver ? "bg-accent-soft/40 ring-2 ring-inset ring-accent/40" : "focus:bg-elevated/30"
          )}
        />
      </div>
      {error && <p className="border-t border-line px-6 py-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
