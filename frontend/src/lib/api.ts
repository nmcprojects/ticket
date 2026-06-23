// REST client for the TicketHub backend (event-service + ticket-service),
// called through the API Gateway. Maps backend DTOs to the frontend types.

import type {
  AppEvent, EventCategory, EventStatus, TicketType, TicketTypeStatus, Ticket,
  CheckinResult, OrganizerProfile, Showtime,
} from "./types";

// Browser calls the gateway via the host-published port; server-side rendering
// (ISR / generateMetadata) runs inside the container and must use the internal
// service name instead. API_BASE_URL_INTERNAL is a runtime-only (non-public) var.
const BASE =
  typeof window === "undefined"
    ? process.env.API_BASE_URL_INTERNAL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      "http://localhost:8080"
    : process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

// Fallback identity for endpoints that still need a user id when nobody is logged in.
export const DEMO_USER_ID = 1;
export const DEMO_STAFF_ID = 1;

const TOKEN_KEY = "th_access_token";
let authToken: string | null = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.message) msg = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Backend DTO shapes ──────────────────────────────────────────
interface OrganizerDtoB {
  id: number;
  organizationName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  avatarUrl: string | null;
  verified: boolean;
}
interface TicketTypeDtoB {
  id: number;
  eventId: number;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  maxPerOrder: number;
  status: string;
}
interface EventDtoB {
  id: number;
  organizer: OrganizerDtoB | null;
  title: string;
  description: string | null;
  content: string | null;
  location: string | null;
  city: string | null;
  venue: string | null;
  category: string | null;
  startTime: string | null;
  endTime: string | null;
  bannerUrl: string | null;
  seatMapUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  ticketTypes: TicketTypeDtoB[];
  showtimes?: { id: number; startTime: string; endTime: string; status: string }[] | null;
}
interface TicketDtoB {
  id: number;
  bookingId: number | null;
  userId: number | null;
  customerEmail: string | null;
  eventId: number | null;
  eventTitle: string | null;
  ticketTypeId: number | null;
  ticketTypeName: string | null;
  ticketCode: string;
  qrPayload: string;
  status: string;
  issuedAt: string | null;
  checkedInAt: string | null;
}
interface CheckinResponseB {
  result: CheckinResult;
  message: string;
  ticket: TicketDtoB | null;
}

const FEATURED_CATEGORIES = ["Âm nhạc", "Thể thao"];

// ── Mappers ─────────────────────────────────────────────────────
function mapOrganizer(o: OrganizerDtoB | null): OrganizerProfile {
  if (!o) {
    return { id: "0", organizationName: "Nhà tổ chức", contactEmail: "", contactPhone: "" };
  }
  return {
    id: String(o.id),
    organizationName: o.organizationName,
    contactEmail: o.contactEmail ?? "",
    contactPhone: o.contactPhone ?? "",
    description: o.description ?? undefined,
    avatarUrl: o.avatarUrl ?? undefined,
    verified: o.verified,
  };
}

function mapTicketType(t: TicketTypeDtoB): TicketType {
  return {
    id: String(t.id),
    eventId: String(t.eventId),
    name: t.name,
    description: t.description ?? "",
    price: t.price,
    currency: "VND",
    totalQuantity: t.totalQuantity,
    availableQuantity: t.availableQuantity,
    reservedQuantity: t.reservedQuantity,
    soldQuantity: t.soldQuantity,
    maxPerOrder: t.maxPerOrder,
    status: t.status as TicketTypeStatus,
  };
}

export function mapEvent(e: EventDtoB): AppEvent {
  const ticketTypes = (e.ticketTypes ?? []).map(mapTicketType);
  const showtimes: Showtime[] = (e.showtimes ?? []).map((s) => ({
    id: String(s.id),
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status as Showtime["status"],
    ticketTypes, // per-showtime ticketing isn't persisted; reuse the event's types for display
  }));
  return {
    id: String(e.id),
    organizer: mapOrganizer(e.organizer),
    title: e.title,
    description: e.description ?? "",
    content: e.content ?? undefined,
    location: e.location ?? "",
    city: e.city ?? "",
    venue: e.venue ?? "",
    startTime: e.startTime ?? new Date().toISOString(),
    endTime: e.endTime ?? new Date().toISOString(),
    bannerUrl: e.bannerUrl ?? "",
    seatMapUrl: e.seatMapUrl ?? undefined,
    latitude: e.latitude ?? undefined,
    longitude: e.longitude ?? undefined,
    category: (e.category ?? "Âm nhạc") as EventCategory,
    status: e.status as EventStatus,
    ticketTypes,
    showtimes: showtimes.length ? showtimes : undefined,
    featured: FEATURED_CATEGORIES.includes(e.category ?? ""),
  };
}

function mapTicket(t: TicketDtoB, eventsById: Map<string, AppEvent>): Ticket {
  const ev = t.eventId != null ? eventsById.get(String(t.eventId)) : undefined;
  return {
    id: String(t.id),
    bookingId: t.bookingId != null ? String(t.bookingId) : "",
    ticketCode: t.ticketCode,
    qrPayload: t.qrPayload,
    eventId: t.eventId != null ? String(t.eventId) : "",
    eventTitle: t.eventTitle ?? ev?.title ?? "Sự kiện",
    ticketTypeName: t.ticketTypeName ?? "Vé",
    status: t.status as Ticket["status"],
    issuedAt: t.issuedAt ?? new Date().toISOString(),
    checkedInAt: t.checkedInAt ?? undefined,
    startTime: ev?.startTime ?? t.issuedAt ?? new Date().toISOString(),
    venue: ev ? `${ev.venue}` : "—",
    city: ev?.city ?? "",
    bannerUrl: ev?.bannerUrl ?? "",
  };
}

// ── Auth ────────────────────────────────────────────────────────
export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  status: string;
  roles: string[];
  permissions: string[];
}
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ── Request bodies ──────────────────────────────────────────────
export interface EventInput {
  organizerId?: number;
  title: string;
  description?: string;
  content?: string;
  location?: string;
  city?: string;
  venue?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  bannerUrl?: string;
  seatMapUrl?: string;
  latitude?: number;
  longitude?: number;
  status?: EventStatus;
  ticketTypes?: TicketTypeInput[];
  showtimes?: { startTime?: string; endTime?: string; status?: string }[];
}

export interface TicketTypeInput {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  totalQuantity: number;
  maxPerOrder?: number;
  status?: TicketTypeStatus;
}

// ── API ─────────────────────────────────────────────────────────
export const api = {
  async listEvents(params?: { status?: EventStatus; organizerId?: number }): Promise<AppEvent[]> {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.organizerId != null) q.set("organizerId", String(params.organizerId));
    const qs = q.toString() ? `?${q}` : "";
    const data = await request<EventDtoB[]>(`/api/events${qs}`);
    return data.map(mapEvent);
  },

  async getEvent(id: string): Promise<AppEvent> {
    return mapEvent(await request<EventDtoB>(`/api/events/${id}`));
  },

  async listOrganizers(): Promise<{ id: number; name: string }[]> {
    const data = await request<OrganizerDtoB[]>(`/api/organizers`);
    return data.map((o) => ({ id: o.id, name: o.organizationName }));
  },

  async createEvent(body: EventInput): Promise<AppEvent> {
    return mapEvent(await request<EventDtoB>(`/api/events`, { method: "POST", body: JSON.stringify(body) }));
  },

  async updateEvent(id: string, body: EventInput): Promise<AppEvent> {
    return mapEvent(await request<EventDtoB>(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(body) }));
  },

  async deleteEvent(id: string): Promise<void> {
    await request<void>(`/api/events/${id}`, { method: "DELETE" });
  },

  async addTicketType(eventId: string, body: TicketTypeInput): Promise<TicketType> {
    return mapTicketType(await request<TicketTypeDtoB>(`/api/events/${eventId}/ticket-types`, {
      method: "POST", body: JSON.stringify(body),
    }));
  },

  async updateTicketType(id: string, body: TicketTypeInput): Promise<TicketType> {
    return mapTicketType(await request<TicketTypeDtoB>(`/api/ticket-types/${id}`, {
      method: "PUT", body: JSON.stringify(body),
    }));
  },

  async deleteTicketType(id: string): Promise<void> {
    await request<void>(`/api/ticket-types/${id}`, { method: "DELETE" });
  },

  async reserve(ticketTypeId: string, quantity: number): Promise<TicketType> {
    return mapTicketType(await request<TicketTypeDtoB>(`/api/ticket-types/${ticketTypeId}/reserve`, {
      method: "POST", body: JSON.stringify({ quantity }),
    }));
  },

  async confirm(ticketTypeId: string, quantity: number): Promise<TicketType> {
    return mapTicketType(await request<TicketTypeDtoB>(`/api/ticket-types/${ticketTypeId}/confirm`, {
      method: "POST", body: JSON.stringify({ quantity }),
    }));
  },

  // ── Tickets ───────────────────────────────────────────────────
  async issueTickets(body: {
    eventId: number; eventTitle?: string; ticketTypeId?: number; ticketTypeName?: string;
    customerEmail?: string; userId?: number; quantity: number;
  }): Promise<void> {
    await request<TicketDtoB[]>(`/api/tickets/issue`, { method: "POST", body: JSON.stringify(body) });
  },

  async listMyTickets(): Promise<Ticket[]> {
    // The server derives the user from the auth token (X-User-Id) and only ever
    // returns the caller's own tickets — no client-supplied userId is trusted.
    // NOTE: backend returns a Spring Data Page<T> object; unwrap .content.
    const [page, events] = await Promise.all([
      request<{ content: TicketDtoB[] }>(`/api/tickets`),
      api.listEvents(),
    ]);
    const ticketsRaw = page.content ?? [];
    const byId = new Map(events.map((e) => [e.id, e]));
    return ticketsRaw
      .map((t) => mapTicket(t, byId))
      .sort((a, b) => +new Date(b.issuedAt) - +new Date(a.issuedAt));
  },

  async checkIn(ticketCode: string, staffId: number = DEMO_STAFF_ID): Promise<{
    result: CheckinResult; message: string; ticket: TicketDtoB | null;
  }> {
    return request<CheckinResponseB>(`/api/tickets/check-in`, {
      method: "POST", body: JSON.stringify({ ticketCode, staffId }),
    });
  },

  // ── Auth ──────────────────────────────────────────────────────
  async login(email: string, password: string): Promise<AuthResult> {
    return request<AuthResult>(`/api/auth/login`, { method: "POST", body: JSON.stringify({ email, password }) });
  },

  async register(body: { email: string; password: string; fullName: string; phoneNumber?: string }): Promise<AuthResult> {
    return request<AuthResult>(`/api/auth/register`, { method: "POST", body: JSON.stringify(body) });
  },

  async me(): Promise<AuthUser> {
    return request<AuthUser>(`/api/auth/me`);
  },

  async updateProfile(body: { fullName: string; phoneNumber?: string; avatarUrl?: string }): Promise<AuthUser> {
    return request<AuthUser>(`/api/auth/me`, { method: "PUT", body: JSON.stringify(body) });
  },

  async logout(refreshToken: string): Promise<void> {
    await request<void>(`/api/auth/logout`, { method: "POST", body: JSON.stringify({ refreshToken }) });
  },

  // ── Booking / Payment ─────────────────────────────────────────
  async createBooking(body: {
    eventId: number; eventTitle: string;
    items: { ticketTypeId: number; ticketTypeName: string; quantity: number; unitPrice: number }[];
  }): Promise<BookingResult> {
    return request<BookingResult>(`/api/bookings`, { method: "POST", body: JSON.stringify(body) });
  },

  async getBooking(id: string | number): Promise<BookingDetail> {
    return request<BookingDetail>(`/api/bookings/${id}`);
  },

  async listBookingsByEvent(eventId: string | number): Promise<BookingDetail[]> {
    return request<BookingDetail[]>(`/api/bookings?eventId=${eventId}`);
  },

  async listMyBookings(): Promise<BookingDetail[]> {
    return request<BookingDetail[]>(`/api/bookings/mine`);
  },

  async cancelBooking(id: string | number): Promise<BookingDetail> {
    return request<BookingDetail>(`/api/bookings/${id}/cancel`, { method: "POST" });
  },

  async getOrganizer(id: string | number): Promise<OrganizerFull> {
    return request<OrganizerFull>(`/api/organizers/${id}`);
  },

  // The logged-in user's own organization (auto-created on first access).
  async getMyOrganizer(): Promise<OrganizerFull> {
    return request<OrganizerFull>(`/api/organizers/me`);
  },

  async updateMyOrganizer(body: OrganizerInput): Promise<OrganizerFull> {
    return request<OrganizerFull>(`/api/organizers/me`, { method: "PUT", body: JSON.stringify(body) });
  },

  // Organization members (team / check-in staff).
  async listMyMembers(): Promise<OrganizerMember[]> {
    return request<OrganizerMember[]>(`/api/organizers/me/members`);
  },
  async addMyMember(body: OrganizerMemberInput): Promise<OrganizerMember> {
    return request<OrganizerMember>(`/api/organizers/me/members`, { method: "POST", body: JSON.stringify(body) });
  },
  async updateMyMember(id: string | number, body: OrganizerMemberInput): Promise<OrganizerMember> {
    return request<OrganizerMember>(`/api/organizers/me/members/${id}`, { method: "PUT", body: JSON.stringify(body) });
  },
  async removeMyMember(id: string | number): Promise<void> {
    await request<void>(`/api/organizers/me/members/${id}`, { method: "DELETE" });
  },

  // Org-defined roles (each = a set of permissions) + the permission catalog.
  async listPermissions(): Promise<AppPermission[]> {
    return request<AppPermission[]>(`/api/organizers/permissions`);
  },
  async listMyRoles(): Promise<OrganizerRole[]> {
    return request<OrganizerRole[]>(`/api/organizers/me/roles`);
  },
  async addMyRole(body: OrganizerRoleInput): Promise<OrganizerRole> {
    return request<OrganizerRole>(`/api/organizers/me/roles`, { method: "POST", body: JSON.stringify(body) });
  },
  async updateMyRole(id: string | number, body: OrganizerRoleInput): Promise<OrganizerRole> {
    return request<OrganizerRole>(`/api/organizers/me/roles/${id}`, { method: "PUT", body: JSON.stringify(body) });
  },
  async removeMyRole(id: string | number): Promise<void> {
    await request<void>(`/api/organizers/me/roles/${id}`, { method: "DELETE" });
  },

  async listOrganizersFull(): Promise<OrganizerFull[]> {
    return request<OrganizerFull[]>(`/api/organizers`);
  },

  async updateOrganizer(id: string | number, body: OrganizerInput): Promise<OrganizerFull> {
    return request<OrganizerFull>(`/api/organizers/${id}`, { method: "PUT", body: JSON.stringify(body) });
  },

  async listCheckins(eventId?: string | number, limit = 100): Promise<CheckinLog[]> {
    const q = new URLSearchParams();
    if (eventId != null) q.set("eventId", String(eventId));
    q.set("limit", String(limit));
    return request<CheckinLog[]>(`/api/checkins?${q}`);
  },

  async getPayment(id: string | number): Promise<PaymentDetail> {
    return request<PaymentDetail>(`/api/payments/${id}`);
  },

  async completeSandboxPayment(id: string | number, result: "SUCCESS" | "FAILED"): Promise<PaymentDetail> {
    return request<PaymentDetail>(`/api/payments/${id}/sandbox-complete?result=${result}`, { method: "POST" });
  },

  /** Confirm a PayOS payment after returning from the gateway (no public webhook needed). */
  async verifyPayment(id: string | number): Promise<PaymentDetail> {
    return request<PaymentDetail>(`/api/payments/${id}/verify`, { method: "POST" });
  },

  // ── Stats ─────────────────────────────────────────────────────
  async getEventStats(id: string | number): Promise<EventStats> {
    return request<EventStats>(`/api/events/${id}/stats`);
  },

  async getTicketStats(eventId: string | number): Promise<TicketStats> {
    return request<TicketStats>(`/api/tickets/stats?eventId=${eventId}`);
  },

  // ── Image upload (Cloudflare R2 via event-service) ────────────
  async uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(`${BASE}/api/uploads`, { method: "POST", body: form, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body?.error ?? "Upload thất bại");
    return body.url as string;
  },
};

export interface EventStats {
  eventId: number;
  capacity: number;
  sold: number;
  reserved: number;
  available: number;
  grossRevenue: number;
  soldPercent: number;
  ticketTypes: { id: number; name: string; price: number; totalQuantity: number; soldQuantity: number; availableQuantity: number; status: string }[];
}
export interface TicketStats {
  eventId: number;
  total: number;
  issued: number;
  checkedIn: number;
  cancelled: number;
  checkinPercent: number;
}

export interface BookingResult {
  bookingId: number;
  code: string;
  status: string;
  paymentUrl: string;
  paymentId: number;
}
export interface BookingDetail {
  id: number;
  code: string;
  userId?: number | null;
  customerEmail?: string | null;
  eventId: number;
  eventTitle: string;
  totalAmount: number;
  status: string;
  paymentId: number | null;
  paymentUrl: string | null;
  createdAt?: string | null;
  paidAt: string | null;
  items: { ticketTypeId: number; ticketTypeName: string; quantity: number; unitPrice: number; totalPrice: number }[];
}

export interface OrganizerFull {
  id: number;
  authUserId?: number | null;
  organizationName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  description: string | null;
  avatarUrl: string | null;
  verified: boolean;
}
export interface OrganizerInput {
  organizationName: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
  avatarUrl?: string;
}
export interface OrganizerMember {
  id: number;
  authUserId: number;
  email: string;
  fullName: string;
  roleId: number;
  roleName: string;
  createdAt?: string | null;
}
export interface OrganizerMemberInput {
  email: string;   // must be an existing system user
  roleId: number;
}
export interface OrganizerRole {
  id: number;
  name: string;
  permissions: string[];
  systemDefault: boolean;
  createdAt?: string | null;
}
export interface OrganizerRoleInput {
  name: string;
  permissions: string[];
}
export interface AppPermission {
  key: string;
  label: string;
}
export interface CheckinLog {
  id: number;
  ticketId: number | null;
  ticketCode: string;
  staffId: number | null;
  eventId: number | null;
  result: CheckinResult;
  message: string;
  checkedInAt: string | null;
}
export interface PaymentDetail {
  id: number;
  bookingId: number;
  amount: number;
  provider: string;
  checkoutUrl: string;
  status: string;
}
