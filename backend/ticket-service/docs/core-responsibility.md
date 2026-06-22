# Ticket Service — Core Responsibility

## Purpose

The `ticket-service` is the **single source of truth for digital tickets** in the TicketHub platform. It turns paid bookings into tangible, verifiable tickets and manages their entire lifecycle from issuance through event entry.

---

## What This Service Owns

| Responsibility | Detail |
|----------------|--------|
| **Ticket Issuance** | Creates unique tickets when a booking is paid (via Kafka) or on manual/admin request |
| **QR Code Generation** | Produces tamper-proof, HMAC-signed QR payloads for offline verification |
| **Check-In Verification** | Atomically marks tickets as `CHECKED_IN` at the event gate; handles race conditions |
| **Ticket Lifecycle** | Manages states: `ISSUED` → `CHECKED_IN` / `CANCELLED` |
| **Audit Logging** | Records every scan attempt (valid, duplicate, invalid, cancelled) |
| **Event Snapshot Cache** | Maintains a local read-model of event titles to avoid cross-service lookups |

---

## What This Service Does NOT Own

| Concern | Owned By |
|---------|----------|
| Booking creation / payment | `booking-service`, `payment-service` |
| Event creation / management | `event-service` |
| Email delivery | `notification-service` (consumed from `ticket-issued-events`) |
| User authentication | `auth-service` / gateway |

---

## Key Interactions

### Inbound

| Source | Trigger | Mechanism |
|--------|---------|-----------|
| `booking-service` | BookingPaid | Kafka `booking-events` |
| `event-service` | EventCreated / EventUpdated / EventDeleted | Kafka `event-events` |
| Gateway / Staff App | Check-in, list tickets, void booking | REST API |

### Outbound

| Target | Event | Mechanism |
|--------|-------|-----------|
| `notification-service` | TicketsIssued | Kafka `ticket-issued-events` |
| `event-service` | Event access check (organizer validation) | REST (Feign/internal) |

---

## Critical Business Rules

1. **One ticket per booking item quantity.** A booking with 3 VIP items produces 3 distinct ticket codes.
2. **Idempotent issuance.** The same `BookingPaid` event processed twice must not create duplicate tickets (guarded by `ProcessedEvent`).
3. **Atomic check-in.** Only one concurrent scan of the same QR code can succeed; the rest receive `ALREADY_CHECKED_IN`.
4. **Saga compensation.** If a booking is refunded, all its tickets are voided (`CANCELLED`) via `POST /api/tickets/void`.
5. **Offline QR validity.** A ticket’s QR code can be cryptographically verified without internet access (HMAC-SHA256).

---

## Data Boundaries

- **Database:** `ticket_db` (PostgreSQL) — isolated; no physical foreign keys to other services.
- **Tables:** `tickets`, `checkin_logs`, `processed_events`, `event_snapshots`
- **Shared-nothing:** Event titles are denormalized (snapshots); user/booking references are logical IDs only.

---

## Failure Modes & Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate Kafka message | `ProcessedEvent` dedup key with DB unique constraint |
| Ticket issued but Kafka publish fails | Transaction outbox: publisher only sends after DB commit |
| Concurrent double check-in | Atomic JPQL `UPDATE … WHERE status = ISSUED` |
| QR forgery | HMAC-SHA256 signature; constant-time comparison |
| Event service unavailable | Local `EventSnapshot` cache populated asynchronously |

---

## Entry Points for Developers

| File | Responsibility |
|------|----------------|
| `TicketService.java` | Core business logic: issue, check-in, void, stats |
| `BookingEventsConsumer.java` | Kafka listener for `BookingPaid` |
| `TicketController.java` | REST API for tickets |
| `CheckinController.java` | REST API for check-ins and audit logs |
| `QrSigner.java` | Cryptographic QR signing/verification |
| `TicketEventPublisher.java` | Outbox-style Kafka producer |
