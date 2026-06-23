"use client";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { Camera, Loader2, Check, Mail, ShieldCheck, Save } from "lucide-react";
import { Container, Eyebrow, Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Profile() {
  const { user, loading, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login?redirect=/profile", { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setPhone(user.phoneNumber ?? "");
      setAvatar(user.avatarUrl);
    }
  }, [user]);

  if (loading || !user) return <Container className="py-24 text-center text-muted">Đang tải…</Container>;

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      setAvatar(await api.uploadImage(file));
    } catch (err) {
      setError((err as Error)?.message ?? "Upload ảnh thất bại");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!fullName.trim()) { setError("Vui lòng nhập họ tên."); return; }
    setSaving(true);
    try {
      const updated = await api.updateProfile({ fullName: fullName.trim(), phoneNumber: phone || undefined, avatarUrl: avatar ?? undefined });
      updateUser(updated);
      setSaved(true);
      toast.success("Đã lưu hồ sơ.");
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      const msg = (err as Error)?.message ?? "Lưu thất bại";
      setError(msg);
      toast.error(`Lưu thất bại: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

  return (
    <section className="py-12">
      <Container className="max-w-2xl">
        <Eyebrow>Tài khoản</Eyebrow>
        <h1 className="display mt-4 text-3xl font-medium sm:text-4xl">Hồ sơ của tôi</h1>
        <p className="mt-2 text-muted">Cập nhật thông tin cá nhân và ảnh đại diện.</p>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src={avatar ?? `https://i.pravatar.cc/120?u=${user.email}`}
                alt={user.fullName}
                className="h-24 w-24 rounded-full object-cover ring-1 ring-line"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Đổi ảnh đại diện"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-ink text-canvas shadow-soft transition-colors hover:bg-ink/90 disabled:opacity-60 cursor-pointer"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" strokeWidth={1.75} />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
            </div>
            <div>
              <p className="text-lg font-semibold text-ink">{user.fullName}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted"><Mail className="h-3.5 w-3.5" strokeWidth={1.75} /> {user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <span key={r} className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.65rem] font-semibold text-accent-ink">{r}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium text-ink">Họ và tên</span>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Số điện thoại</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="0900 000 000" />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input value={user.email} readOnly className={`${inputCls} bg-elevated text-muted`} />
            </label>
          </div>

          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}

          <div className="mt-6 flex items-center gap-3">
            <Button as="button" onClick={save} disabled={saving || uploading} size="lg">
              {saving ? <><Loader2 className="h-4.5 w-4.5 animate-spin" /> Đang lưu…</> : saved ? <><Check className="h-4.5 w-4.5" strokeWidth={2.5} /> Đã lưu</> : <><Save className="h-4.5 w-4.5" strokeWidth={1.75} /> Lưu thay đổi</>}
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-faint"><ShieldCheck className="h-3.5 w-3.5" /> Thông tin được bảo mật</span>
          </div>
        </div>
      </Container>
    </section>
  );
}
