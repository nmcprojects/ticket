# Ticket Service — Real Flow Test Instructions

This guide covers end-to-end testing of `ticket-service` using Docker, focusing on the actual business flow (not unit tests).

---

## Prerequisites

- Docker Desktop running
- `jq` installed (`brew install jq`)
- Full stack running:
  ```bash
  cd /path/to/tickethub/backend
  docker compose up -d --build
  ```

---

## 1. Verify Stack Health

Wait ~60 seconds after startup for all services to register with Eureka.

```bash
# Check all services are registered
curl -s http://localhost:8761/eureka/apps | grep -o '<name>[^<]*</name>'

# Expected: AUTH-SERVICE, API-GATEWAY, BOOKING-SERVICE, EVENT-SERVICE,
#           PAYMENT-SERVICE, TICKET-SERVICE, NOTIFICATION-SERVICE
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

## 3. Pick an Event and Ticket Type

```bash
# List events
curl -s http://localhost:8080/api/events | jq '.[0] | {id, title}'

# List ticket types for event 1
curl -s http://localhost:8080/api/events/1/ticket-types | jq '.[] | {id, name, price, availableQuantity}'
```

Pick one `ticketTypeId` (e.g., `1`) and note the `eventId` (e.g., `1`).

---

## 4. Create a Booking

```bash
curl -s -X POST http://localhost:8080/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "eventId": 1,
    "eventTitle": "Test Event",
    "items": [{"ticketTypeId": 1, "quantity": 2}]
  }' | jq
```

Save the `paymentId` and `id` (bookingId) from the response.

---

## 5. Complete Payment (Trigger Ticket Issuance)

This is the critical step that fires the Kafka chain:

```bash
# Replace 1 with the actual paymentId from step 4
curl -s -X POST "http://localhost:8080/api/payments/1/sandbox-complete?result=SUCCESS" \
  -H "Authorization: Bearer $TOKEN" | jq
```

**What happens behind the scenes:**
1. `payment-service` marks payment as SUCCESS
2. Publishes `PaymentSucceeded` → Kafka `payment-events`
3. `booking-service` consumes it, marks booking PAID
4. Publishes `BookingPaid` → Kafka `booking-events`
5. `ticket-service` consumes it, issues tickets
6. Publishes `TicketIssued` → Kafka `ticket-issued-events`
7. `notification-service` sends confirmation email

---

## 6. Verify Tickets Were Issued

### Via API

```bash
# List my tickets
curl -s http://localhost:8080/api/tickets \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, ticketCode, status, eventTitle}'

# Get ticket stats for the event
curl -s "http://localhost:8080/api/tickets/stats?eventId=1" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Via Logs

```bash
# Watch ticket-service processing the BookingPaid event
docker compose logs --tail=30 ticket-service

# Look for:
# "Nhận [BookingPaid] booking=1 (1 loại vé)"
# "Đã publish [TicketIssued] booking=1 (2 vé) -> ticket-issued-events"
```

---

## 7. Check-In Flow

Take a `ticketCode` from step 6:

```bash
# Replace TICKET-XXXX-XXXX with actual code
curl -s -X POST http://localhost:8080/api/tickets/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"ticketCode":"TICKET-XXXX-XXXX","eventId":1}' | jq

# Expected first time: {"result":"VALID", ...}
# Expected second time: {"result":"ALREADY_CHECKED_IN", ...}
```

---

## 8. Verify Check-In Logs

```bash
curl -s "http://localhost:8080/api/checkins?eventId=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {ticketCode, result, checkedInAt}'
```

---

## 9. Test Idempotency (Duplicate BookingPaid)

Re-publish the same `BookingPaid` event manually via Kafka, or simply re-call the sandbox-complete (it's idempotent on the payment side). The ticket-service should log:

```
Bỏ qua: booking 1 đã được xử lý
```

And no duplicate tickets should be created.

---

## 10. Kafka Topic Inspection

Open Kafka UI at http://localhost:8090 and browse:
- `booking-events` — should contain `BookingPaid` messages
- `ticket-issued-events` — should contain `TicketIssued` messages

Or via CLI:
```bash
docker exec -it tickethub-kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic ticket-issued-events \
  --from-beginning \
  --max-messages 5
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `404` on `/api/tickets` | Ticket-service not registered in Eureka yet | Wait 30s, retry |
| `404` on `/api/notifications` | Missing gateway route (fixed in gateway `application.yml`) | Restart gateway: `docker compose up -d --build api-gateway` |
| Tickets not appearing | Kafka died (OOM) | `docker compose up -d kafka` |
| Java "Not Responding" in Activity Monitor | Too many containers + Mac memory pressure | Stop observability stack: `docker compose stop grafana prometheus promtail loki zipkin` |
| Booking stays `PENDING_PAYMENT` | Kafka consumer lag or service not running | Check `docker compose ps`, restart booking-service if needed |

---

## Memory-Saving Tip (Mac)

If your Mac is struggling, run only the essential services:

```bash
# Stop heavy observability containers
docker compose stop grafana prometheus promtail loki zipkin kafka-ui

# Keep only: postgres, kafka, eureka, gateway, auth, event, payment, booking, ticket, notification
```

This saves ~2-3GB of RAM.
