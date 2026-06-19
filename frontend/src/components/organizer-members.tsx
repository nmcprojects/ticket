"use client";
import { useMemo, useState } from "react";
import {
  Loader2,
  UserPlus,
  Trash2,
  Users,
  ShieldCheck,
  Lock,
  Plus,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type { OrganizerMember, OrganizerRole, AppPermission } from "@/lib/api";
import { useAsync } from "@/lib/use-async";
import { useToast } from "@/components/toast";
import { LoadingBlock, ErrorBlock } from "@/components/states";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/15";

const chipCls =
  "inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink";

const errMsg = (e: unknown, fallback: string) => (e as Error)?.message ?? fallback;

type RoleDraft = { name: string; perms: Set<string> };

// ───────────────────────── Roles & permissions ─────────────────────────
export function OrganizerRoles() {
  const toast = useToast();
  const roles = useAsync<OrganizerRole[]>(() => api.listMyRoles(), []);
  const permissions = useAsync<AppPermission[]>(() => api.listPermissions(), []);

  const loading = roles.loading || permissions.loading;
  const error = roles.error || permissions.error;
  const retryAll = () => {
    roles.refetch();
    permissions.refetch();
  };

  const roleList = roles.data ?? [];
  const permList = permissions.data ?? [];

  // key -> label map for rendering permission chips.
  const permLabel = useMemo(() => {
    const m = new Map<string, string>();
    permList.forEach((p) => m.set(p.key, p.label));
    return m;
  }, [permList]);

  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<RoleDraft>({ name: "", perms: new Set() });
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);

  const openNewRole = () => {
    setRoleErr(null);
    setEditing("new");
    setDraft({ name: "", perms: new Set() });
  };
  const openEditRole = (r: OrganizerRole) => {
    setRoleErr(null);
    setEditing(r.id);
    setDraft({ name: r.name, perms: new Set(r.permissions) });
  };
  const closeEditor = () => {
    setEditing(null);
    setRoleErr(null);
  };
  const togglePerm = (key: string) => {
    setDraft((d) => {
      const next = new Set(d.perms);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...d, perms: next };
    });
  };

  const saveRole = async () => {
    if (!draft.name.trim()) {
      setRoleErr("Nhập tên vai trò.");
      return;
    }
    setRoleErr(null);
    setRoleBusy(true);
    const body = { name: draft.name.trim(), permissions: Array.from(draft.perms) };
    try {
      const isNew = editing === "new";
      if (isNew) await api.addMyRole(body);
      else if (typeof editing === "number") await api.updateMyRole(editing, body);
      closeEditor();
      roles.refetch();
      toast.success(isNew ? `Đã tạo vai trò "${body.name}".` : `Đã lưu vai trò "${body.name}".`);
    } catch (e) {
      setRoleErr(errMsg(e, "Lưu vai trò thất bại"));
    } finally {
      setRoleBusy(false);
    }
  };

  const deleteRole = async (r: OrganizerRole) => {
    if (!window.confirm(`Xoá vai trò "${r.name}"?`)) return;
    setRoleErr(null);
    setRoleBusy(true);
    try {
      await api.removeMyRole(r.id);
      if (editing === r.id) closeEditor();
      roles.refetch();
      toast.success(`Đã xoá vai trò "${r.name}".`);
    } catch (e) {
      setRoleErr(errMsg(e, "Xoá vai trò thất bại"));
    } finally {
      setRoleBusy(false);
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={retryAll} />;
  if (loading) return <LoadingBlock />;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-accent" strokeWidth={1.75} />
          <h2 className="font-display text-xl font-semibold text-ink">Vai trò &amp; quyền hạn</h2>
        </div>
        <button
          onClick={openNewRole}
          disabled={editing === "new"}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50 cursor-pointer"
        >
          <Plus className="h-4 w-4" strokeWidth={2} /> Thêm vai trò
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Mỗi vai trò là một tập quyền. Gán vai trò cho thành viên ở mục Thành viên.
      </p>

      {/* Editor for a NEW role (rendered at top) */}
      {editing === "new" && (
        <RoleEditor
          draft={draft}
          permList={permList}
          busy={roleBusy}
          err={roleErr}
          onName={(name) => setDraft((d) => ({ ...d, name }))}
          onToggle={togglePerm}
          onSave={saveRole}
          onCancel={closeEditor}
        />
      )}

      <div className="mt-5 space-y-3">
        {roleList.length === 0 && editing !== "new" && (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Chưa có vai trò nào. Nhấn “Thêm vai trò” để tạo.
          </p>
        )}

        {roleList.map((r) =>
          editing === r.id ? (
            <RoleEditor
              key={r.id}
              draft={draft}
              permList={permList}
              busy={roleBusy}
              err={roleErr}
              onName={(name) => setDraft((d) => ({ ...d, name }))}
              onToggle={togglePerm}
              onSave={saveRole}
              onCancel={closeEditor}
            />
          ) : (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{r.name}</p>
                    {r.systemDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
                        <Lock className="h-3 w-3" strokeWidth={2} /> Mặc định
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.permissions.length === 0 ? (
                      <span className="text-xs text-faint">Không có quyền nào</span>
                    ) : (
                      r.permissions.map((p) => (
                        <span key={p} className={chipCls}>
                          {permLabel.get(p) ?? p}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {!r.systemDefault && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditRole(r)}
                      disabled={roleBusy || editing != null}
                      aria-label={`Sửa vai trò ${r.name}`}
                      title="Sửa"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-ink transition-colors hover:bg-accent-soft disabled:opacity-50 cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => deleteRole(r)}
                      disabled={roleBusy || editing != null}
                      aria-label={`Xoá vai trò ${r.name}`}
                      title="Xoá"
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* Errors not tied to the open editor (e.g. delete failure) */}
      {roleErr && editing == null && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {roleErr}
        </p>
      )}
    </section>
  );
}

// ───────────────────────── Members ─────────────────────────
export function OrganizerMembers() {
  const toast = useToast();
  const roles = useAsync<OrganizerRole[]>(() => api.listMyRoles(), []);
  const members = useAsync<OrganizerMember[]>(() => api.listMyMembers(), []);

  const loading = roles.loading || members.loading;
  const error = roles.error || members.error;
  const retryAll = () => {
    roles.refetch();
    members.refetch();
  };

  const roleList = roles.data ?? [];
  const memberList = members.data ?? [];

  const [email, setEmail] = useState("");
  const [addRoleId, setAddRoleId] = useState<number | "">("");
  const [memberBusy, setMemberBusy] = useState<string | null>(null); // "add" | member id
  const [memberErr, setMemberErr] = useState<string | null>(null);

  const defaultRoleIds = useMemo(
    () => new Set(roleList.filter((r) => r.systemDefault).map((r) => r.id)),
    [roleList],
  );
  const isOwner = (m: OrganizerMember) => defaultRoleIds.has(m.roleId);

  const addMember = async () => {
    if (!email.trim()) {
      setMemberErr("Nhập email thành viên.");
      return;
    }
    if (addRoleId === "") {
      setMemberErr("Chọn vai trò cho thành viên.");
      return;
    }
    setMemberErr(null);
    setMemberBusy("add");
    try {
      const added = email.trim();
      await api.addMyMember({ email: added, roleId: addRoleId });
      setEmail("");
      setAddRoleId("");
      members.refetch();
      toast.success(`Đã thêm ${added} vào tổ chức.`);
    } catch (e) {
      setMemberErr(errMsg(e, "Thêm thành viên thất bại. Email có thể chưa có tài khoản trên hệ thống."));
    } finally {
      setMemberBusy(null);
    }
  };

  const changeMemberRole = async (m: OrganizerMember, roleId: number) => {
    setMemberErr(null);
    setMemberBusy(String(m.id));
    try {
      await api.updateMyMember(m.id, { email: m.email, roleId });
      members.refetch();
      toast.success(`Đã cập nhật vai trò của ${m.fullName || m.email}.`);
    } catch (e) {
      setMemberErr(errMsg(e, "Cập nhật vai trò thất bại"));
    } finally {
      setMemberBusy(null);
    }
  };

  const removeMember = async (m: OrganizerMember) => {
    if (!window.confirm(`Xoá thành viên "${m.fullName}"?`)) return;
    setMemberErr(null);
    setMemberBusy(String(m.id));
    try {
      await api.removeMyMember(m.id);
      members.refetch();
      toast.success(`Đã xoá ${m.fullName || m.email} khỏi tổ chức.`);
    } catch (e) {
      setMemberErr(errMsg(e, "Xoá thành viên thất bại"));
    } finally {
      setMemberBusy(null);
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={retryAll} />;
  if (loading) return <LoadingBlock />;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6 shadow-soft sm:p-8">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-accent" strokeWidth={1.75} />
        <h2 className="font-display text-xl font-semibold text-ink">Thành viên</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Thêm người dùng đã có tài khoản qua email và gán vai trò. Chủ tổ chức không thể bị xoá.
      </p>

      <div className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
        {memberList.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">Chưa có thành viên nào.</p>
        ) : (
          memberList.map((m) => {
            const rowBusy = memberBusy === String(m.id);
            const owner = isOwner(m);
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{m.fullName || m.email}</p>
                  <p className="truncate text-xs text-faint">{m.email}</p>
                </div>

                {owner ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-ink">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} /> {m.roleName}
                  </span>
                ) : (
                  <select
                    value={m.roleId}
                    onChange={(e) => changeMemberRole(m, Number(e.target.value))}
                    disabled={rowBusy}
                    aria-label={`Vai trò của ${m.fullName || m.email}`}
                    className="h-10 cursor-pointer rounded-xl border border-line bg-surface px-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
                  >
                    {roleList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}

                {!owner && (
                  <button
                    onClick={() => removeMember(m)}
                    disabled={rowBusy}
                    aria-label={`Xoá ${m.fullName || m.email}`}
                    title="Xoá thành viên"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                  >
                    {rowBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add member */}
      <div className="mt-4 grid gap-2 sm:grid-cols-[1.6fr_1fr_auto]">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email người dùng *"
          className={inputCls}
        />
        <select
          value={addRoleId}
          onChange={(e) => setAddRoleId(e.target.value === "" ? "" : Number(e.target.value))}
          className={`${inputCls} cursor-pointer`}
          aria-label="Vai trò"
        >
          <option value="">Chọn vai trò *</option>
          {roleList.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <button
          onClick={addMember}
          disabled={memberBusy === "add"}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50 cursor-pointer"
        >
          {memberBusy === "add" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
          )}
          Thêm
        </button>
      </div>

      {memberErr && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {memberErr}
        </p>
      )}
    </section>
  );
}

// ─────────────────────────── Role editor ───────────────────────────
function RoleEditor({
  draft,
  permList,
  busy,
  err,
  onName,
  onToggle,
  onSave,
  onCancel,
}: {
  draft: RoleDraft;
  permList: AppPermission[];
  busy: boolean;
  err: string | null;
  onName: (name: string) => void;
  onToggle: (key: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-accent/40 bg-accent-soft/30 p-4 sm:p-5">
      <label className="block text-sm font-medium text-ink">Tên vai trò</label>
      <input
        value={draft.name}
        onChange={(e) => onName(e.target.value)}
        placeholder="VD: Quản lý sự kiện"
        className={`${inputCls} mt-1.5`}
        autoFocus
      />

      <p className="mt-4 text-sm font-medium text-ink">Quyền hạn</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {permList.map((p) => {
          const checked = draft.perms.has(p.key);
          return (
            <label
              key={p.key}
              className={`flex min-h-[40px] cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors ${
                checked ? "border-accent bg-surface" : "border-line bg-surface hover:border-accent/50"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(p.key)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-accent"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{p.label}</span>
                <span className="block text-xs text-faint">{p.key}</span>
              </span>
            </label>
          );
        })}
      </div>

      {err && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {err}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-medium text-canvas transition-colors hover:bg-ink/90 disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2} />}
          Lưu
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-ink/30 disabled:opacity-50 cursor-pointer"
        >
          <X className="h-4 w-4" strokeWidth={2} /> Huỷ
        </button>
      </div>
    </div>
  );
}
