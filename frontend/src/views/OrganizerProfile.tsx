"use client";
import { useEffect, useState } from "react";
import { Loader2, Check, Save, BadgeCheck, ShieldAlert, Settings2, Users, ShieldCheck } from "lucide-react";
import { Container, Button } from "@/components/ui";
import { OrganizerPageHeader } from "@/components/organizer-header";
import { OrganizerMembers, OrganizerRoles } from "@/components/organizer-members";
import { LoadingBlock, ErrorBlock } from "@/components/states";
import { ImageUpload } from "@/components/image-upload";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import type { OrganizerFull, OrganizerInput } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { cn } from "@/lib/utils";

const inputCls =
  "mt-1.5 h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

type Tab = "info" | "members" | "roles";

const TABS: [Tab, string, typeof Settings2][] = [
  ["info", "Hồ sơ", Settings2],
  ["members", "Thành viên", Users],
  ["roles", "Vai trò & quyền", ShieldCheck],
];

export default function OrganizerProfile() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("info");

  // Each logged-in user manages their OWN organization (auto-created on first access).
  const { data, loading, error, refetch } = useAsync<OrganizerFull>(() => api.getMyOrganizer(), []);

  const [organizationName, setOrganizationName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [verified, setVerified] = useState(false);
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const seed = (o: OrganizerFull) => {
    setOrganizationName(o.organizationName ?? "");
    setContactEmail(o.contactEmail ?? "");
    setContactPhone(o.contactPhone ?? "");
    setAvatarUrl(o.avatarUrl ?? "");
    setDescription(o.description ?? "");
    setVerified(o.verified);
    setSaved(false);
    setSaveError(null);
  };

  useEffect(() => {
    if (data) seed(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const save = async () => {
    setSaveError(null);
    if (!organizationName.trim()) {
      setSaveError("Vui lòng nhập tên tổ chức.");
      return;
    }
    setSaving(true);
    try {
      const body: OrganizerInput = {
        organizationName: organizationName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        description: description.trim() || undefined,
        avatarUrl: avatarUrl || undefined,
      };
      const updated = await api.updateMyOrganizer(body);
      seed(updated);
      setSaved(true);
      toast.success("Đã lưu hồ sơ tổ chức.");
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      const msg = (err as Error)?.message ?? "Lưu thất bại";
      setSaveError(msg);
      toast.error(`Lưu thất bại: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <OrganizerPageHeader
        title="Cài đặt tổ chức"
        subtitle="Quản lý thông tin, thành viên và phân quyền."
      />

      {/* Sticky tab bar */}
      <section className="sticky top-16 z-30 border-b border-line bg-elevated/95 py-4 backdrop-blur">
        <Container>
          <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
            {TABS.map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  tab === key ? "bg-ink text-canvas" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} /> {label}
              </button>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-12">
        <Container className="max-w-2xl">
          {/* ───────────── Tab: Org info ───────────── */}
          {tab === "info" && (
            loading ? (
              <LoadingBlock />
            ) : error ? (
              <ErrorBlock message={error} onRetry={refetch} />
            ) : (
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-display text-xl font-semibold text-ink">Thông tin tổ chức</h2>
                  {verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} /> Đã xác minh
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1 text-xs font-semibold text-muted">
                      <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} /> Chưa xác minh
                    </span>
                  )}
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <ImageUpload label="Logo tổ chức" value={avatarUrl} onChange={setAvatarUrl} aspect="1 / 1" />
                  </div>

                  <div className="grid content-start gap-4 sm:col-span-1">
                    <label className="block">
                      <span className="text-sm font-medium text-ink">Tên tổ chức</span>
                      <input
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className={inputCls}
                        placeholder="Tên tổ chức của bạn"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-ink">Email liên hệ</span>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className={inputCls}
                        placeholder="lienhe@tochuc.vn"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-ink">Số điện thoại liên hệ</span>
                      <input
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className={inputCls}
                        placeholder="0900 000 000"
                      />
                    </label>
                  </div>
                  <label className="mt-4 block">
                    <span className="text-sm font-medium text-ink">Giới thiệu</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="Mô tả ngắn về tổ chức — hiển thị ở trang sự kiện cho khách xem."
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </label>
                </div>

                <p className="mt-5 text-xs text-faint">
                  Trạng thái “Đã xác minh” do quản trị viên cấp, không tự chỉnh được.
                </p>

                {saveError && (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {saveError}
                  </p>
                )}

                <div className="mt-6 flex items-center gap-3">
                  <Button as="button" onClick={save} disabled={saving} size="lg">
                    {saving ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" /> Đang lưu…
                      </>
                    ) : saved ? (
                      <>
                        <Check className="h-4.5 w-4.5" strokeWidth={2.5} /> Đã lưu
                      </>
                    ) : (
                      <>
                        <Save className="h-4.5 w-4.5" strokeWidth={1.75} /> Lưu thay đổi
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          )}

          {/* ───────────── Tab: Members ───────────── */}
          {tab === "members" && <OrganizerMembers />}

          {/* ───────────── Tab: Roles & permissions ───────────── */}
          {tab === "roles" && <OrganizerRoles />}
        </Container>
      </section>
    </>
  );
}
