// Domain types mirroring the microservice schema in Requirements.md
// (auth / event / booking / payment / ticket / notification)

export type RoleCode = "CUSTOMER" | "ORGANIZER" | "STAFF" | "ADMIN";

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  status: "ACTIVE" | "DISABLED" | "LOCKED";
  roles: RoleCode[];
  avatarUrl?: string;
}

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "ENDED";

export interface OrganizerProfile {
  id: string;
  organizationName: string;
  contactEmail: string;
  contactPhone: string;
  description?: string;
  avatarUrl?: string;
  verified?: boolean;
}

export type TicketTypeStatus = "SELLING" | "SOLD_OUT" | "DISABLED";

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string;
  price: number;
  currency: "VND";
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  maxPerOrder: number;
  status: TicketTypeStatus;
}

export type EventCategory =
  | "Âm nhạc"
  | "Sân khấu"
  | "Workshop"
  | "Thể thao"
  | "Hội thảo"
  | "Nghệ thuật";

export interface Showtime {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  status: "SELLING" | "SOLD_OUT" | "ENDED";
  ticketTypes: TicketType[];
}

export interface AppEvent {
  id: string;
  organizer: OrganizerProfile;
  title: string;
  description: string;
  content?: string; // rich HTML entered by the organizer via the editor
  location: string;
  city: string;
  venue: string;
  startTime: string; // ISO
  endTime: string; // ISO
  bannerUrl: string;
  seatMapUrl?: string;
  latitude?: number;
  longitude?: number;
  category: EventCategory;
  status: EventStatus;
  ticketTypes: TicketType[];
  showtimes?: Showtime[];
  featured?: boolean;
}

export type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PAYMENT_FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface BookingItem {
  id: string;
  ticketTypeId: string;
  ticketTypeName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Booking {
  id: string;
  code: string;
  eventId: string;
  eventTitle: string;
  customerEmail: string;
  items: BookingItem[];
  totalAmount: number;
  currency: "VND";
  status: BookingStatus;
  createdAt: string;
  paidAt?: string;
}

export type TicketStatus = "ISSUED" | "CHECKED_IN" | "CANCELLED";

export interface Ticket {
  id: string;
  bookingId: string;
  ticketCode: string;
  qrPayload: string;
  eventId: string;
  eventTitle: string;
  ticketTypeName: string;
  seatLabel?: string;
  status: TicketStatus;
  issuedAt: string;
  checkedInAt?: string;
  startTime: string;
  venue: string;
  city: string;
  bannerUrl: string;
}

export type CheckinResult =
  | "VALID"
  | "ALREADY_CHECKED_IN"
  | "INVALID_TICKET"
  | "CANCELLED_TICKET";
