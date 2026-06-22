# Notification Service — Real Flow Test Instructions

This guide covers end-to-end testing of `notification-service` using Docker, focusing on the actual business flow (not unit tests).

---

## Prerequisites

- Docker Desktop running
- `jq` installed (`brew install jq`)
- Full stack running:
  ```bash
  cd /path/to/tickethub/backend
  docker compose up -d --build
  ```
- API Gateway route for notification-service must exist (check `application.yml` has the `/api/notifications/**` route)

---

## 1. Verify Stack Health

```bash
# Check Eureka registry
curl -s http://localhost:8761/eureka/apps | grep -o '<name>[^<]*</name>'

# Expected to include: NOTIFICATION-SERVICE
```

---

## 2. Log In as Demo Buyer

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"an@example.com","password":"password"}' | jq -r '.accessToken')

echo "Token: ${TOKEN:0:40}..."
```

---

## 3. Trigger a Ticket Issued Notification

The notification flow is **async via Kafka**. The only way to trigger it is to complete a booking payment:

```bash
# Step 1: Create a booking
curl -s -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "eventId": 1,
    "eventTitle": "Test Event",
    "items": [{"ticketTypeId": 1, "quantity": 2}]
  }' | jq '{bookingId: .id, paymentId: .paymentId}'

# Step 2: Complete payment (this triggers the whole chain)
# Replace PAYMENT_ID with the value from step 1
curl -s -X POST "http://localhost:8080/api/payments/PAYMENT_ID/sandbox-complete?result=SUCCESS" \
  -H "Authorization: Bearer $TOKEN" | jq '{status: .status, bookingId: .bookingId}'
```

**What happens behind the scenes:**
1. `payment-service` → Kafka `payment-events` → `PaymentSucceeded`
2. `booking-service` → Kafka `booking-events` → `BookingPaid`
3. `ticket-service` issues tickets → Kafka `ticket-issued-events` → `TicketIssued`
4. `notification-service` consumes `TicketIssued` → renders email → sends SMTP (or logs)

---

## 4. Verify Notification Was Created

### Via API

```bash
# List all recent notifications
curl -s http://localhost:8080/api/notifications \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, type: .notificationType, status, recipientEmail, subject}'
```

### Via Logs

```bash
# Watch notification-service process the event
docker compose logs --tail=30 notification-service

# Look for:
# "Nhận [TicketIssued] booking=1 email=an@example.com"
# "[EMAIL-LOG] TICKET_ISSUED-1 | To: an@example.com | Vé điện tử của bạn..."
# OR:
# "Da GUI TICKET_ISSUED-1 toi an@example.com"
```

---

## 5. Test Other Notification Types

### Booking Cancelled

Create a paid booking (steps 3 above), then cancel it:

```bash
# Replace BOOKING_ID with actual booking id
curl -s -X POST "http://localhost:8080/api/bookings/BOOKING_ID/cancel" \
  -H "Authorization: Bearer $TOKEN" | jq '{status: .status}'
```

This publishes `BookingCancelled` → `notification-service` sends cancellation email.

Verify:
```bash
curl -s http://localhost:8080/api/notifications \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.notificationType == "BOOKING_CANCELLED")'
```

### Payment Failed

Create a booking, then complete with `FAILED`:

```bash
curl -s -X POST "http://localhost:8080/api/payments/PAYMENT_ID/sandbox-complete?result=FAILED" \
  -H "Authorization: Bearer $TOKEN" | jq '{status: .status}'
```

This publishes `PaymentFailed` → `notification-service` records the event.

---

## 6. Test Idempotency

The notification service deduplicates by `(notificationType, referenceId)`. Re-triggering the same event should produce:

```
TICKET_ISSUED-1 da xu ly truoc do (SENT), bo qua
```

And only **one** `EmailNotification` row should exist for that booking.

---

## 7. Kafka Topic Inspection

Open Kafka UI at http://localhost:8090 and browse:
- `ticket-issued-events` — should contain `TicketIssued` messages
- `booking-events` — should contain `BookingCancelled` messages
- `payment-events` — should contain `PaymentFailed` / `PaymentRefunded` messages

Or via CLI:
```bash
docker exec -it tickethub-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic ticket-issued-events \
  --from-beginning \
  --max-messages 5
```

---

## 8. SMTP vs Log Mode

By default, `tickethub.mail.enabled=true` in `application.yml`. If SMTP credentials are valid, emails are sent for real. If SMTP fails or is disabled, notifications fall back to **LOG** mode:

```bash
# Check the provider column in the response
curl -s http://localhost:8080/api/notifications \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, provider, status}'
```

- `provider: "SMTP"` + `status: "SENT"` → Email was sent
- `provider: "LOG"` + `status: "LOGGED"` → Email was only logged (no SMTP)
- `provider: "SMTP"` + `status: "FAILED"` → SMTP error occurred

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `404` on `/api/notifications` | Missing gateway route | Ensure gateway `application.yml` has notification-service route, then restart gateway |
| No notifications after payment | Kafka consumer not running or lag | Check `docker compose ps`, restart `notification-service` if needed |
| Kafka died (OOM) | Mac memory pressure | `docker compose up -d kafka` |
| Duplicate notifications | Consumer rebalanced and re-read offset | Check idempotency key in DB; dedup should prevent duplicates |
| SMTP failures | Gmail rate limit or auth issue | Check `docker compose logs notification-service` for SMTP errors |
| Java "Not Responding" | Too many containers | Stop observability: `docker compose stop grafana prometheus promtail loki zipkin kafka-ui` |

---

## Memory-Saving Tip (Mac)

If your Mac is struggling, run only the essential services:

```bash
# Stop heavy observability containers
docker compose stop grafana prometheus promtail loki zipkin kafka-ui

# Keep only: postgres, kafka, eureka, gateway, auth, event, payment, booking, ticket, notification
```

This saves ~2-3GB of RAM.
