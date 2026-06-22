# Notification Service — Core Responsibility

## Purpose

The `notification-service` is the **centralized email notification hub** of the TicketHub platform. It consumes business events from Kafka, renders human-readable email content, and delivers notifications to users via SMTP (with a LOG fallback for local development).

---

## What This Service Owns

| Responsibility | Detail |
|----------------|--------|
| **Email Rendering** | Turns Kafka events into localized email subjects and bodies using `NotificationTemplate` |
| **Email Delivery** | Sends via SMTP (Gmail) or falls back to console/DB logging when SMTP is unavailable |
| **Idempotency & Retry** | Deduplicates by `(notificationType, referenceId)`; retries `FAILED` deliveries on next Kafka poll |
| **Notification Audit** | Persists every notification attempt with status (`PENDING`, `SENT`, `FAILED`, `LOGGED`) |
| **Kafka Event Consumption** | Listens to `ticket-issued-events`, `booking-events`, and `payment-events` |

---

## What This Service Does NOT Own

| Concern | Owned By |
|---------|----------|
| Ticket issuance / QR generation | `ticket-service` |
| Booking creation / cancellation | `booking-service` |
| Payment processing / refunds | `payment-service` |
| Event management | `event-service` |
| User authentication | `auth-service` / gateway |

---

## Key Interactions

### Inbound (Kafka)

| Source | Topic | Event Type | Handler |
|--------|-------|------------|---------|
| `ticket-service` | `ticket-issued-events` | `TicketIssued` | `handleTicketsIssued()` |
| `booking-service` | `booking-events` | `BookingCancelled` | `handleBookingCancelled()` |
| `payment-service` | `payment-events` | `PaymentFailed` | `handlePaymentFailed()` |
| `payment-service` | `payment-events` | `PaymentRefunded` | `handlePaymentRefunded()` |

**Intentionally ignored:** `PaymentSucceeded` (handled by `booking-service`).

### Outbound

| Target | Mechanism | Purpose |
|--------|-----------|---------|
| Gmail SMTP | `JavaMailSender` | Real email delivery |
| `notification_db` (PostgreSQL) | JPA | Audit trail and dedup state |

---

## Critical Business Rules

1. **Exactly-once delivery per reference.** A `TicketIssued` for booking #42 will only ever produce one email, guarded by `dedupKey` unique constraint.
2. **Retry on SMTP failure.** If sending fails, status is set to `FAILED`; the next Kafka retry resets it to `PENDING` and attempts delivery again.
3. **Graceful degradation.** If SMTP is disabled, unavailable, or the recipient email is blank, the notification is marked `LOGGED` instead of lost.
4. **No direct user input.** All data comes from trusted internal Kafka events; there is no user-facing write API.

---

## Data Boundaries

- **Database:** `notification_db` (PostgreSQL) — isolated.
- **Table:** `email_notifications`
- **Shared-nothing:** References to `bookingId`, `paymentId`, and `userId` are logical only (no physical foreign keys).

---

## Failure Modes & Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate Kafka message | `dedupKey` (`{TYPE}-{referenceId}`) with DB unique constraint |
| SMTP temporary failure | Mark `FAILED`; Kafka retry re-attempts delivery |
| SMTP permanent failure / missing credentials | Falls back to `LOGGED` status; inspectable via `/api/notifications` |
| Gmail rate limit | `FAILED` status + retry; may eventually succeed or stay `FAILED` |
| Missing recipient email | `LOGGED` status so the event is not silently lost |

---

## Entry Points for Developers

| File | Responsibility |
|------|----------------|
| `NotificationService.java` | Core handlers: render, dedup, deliver, status updates |
| `NotificationTemplate.java` | Email subject/body string templates per notification type |
| `TicketIssuedConsumer.java` | Kafka listener for `ticket-issued-events` |
| `BookingEventsConsumer.java` | Kafka listener for `booking-events` (BookingCancelled) |
| `PaymentEventsConsumer.java` | Kafka listener for `payment-events` (PaymentFailed, PaymentRefunded) |
| `NotificationController.java` | Read-only debug endpoint `/api/notifications` |
