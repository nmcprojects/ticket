# Backend Developer Notes

## Quick Commands

```bash
# Build everything
mvn clean install

# Run full stack
docker compose up -d --build

# Run just infra (for local service dev)
docker compose up -d postgres kafka

# Run a single service
mvn spring-boot:run -pl auth-service
```

## Important Defaults

- **Gateway URL:** http://localhost:8080
- **Eureka:** http://localhost:8761
- **Postgres host port:** 5433 (to avoid conflict with native Postgres on 5432)
- **JWT secret (dev):** `tickethub-super-secret-key-change-me-please-0123456789`
- **Grafana:** http://localhost:3000 (admin/admin)

## Per-Service Databases

All services connect to the same Postgres instance but use separate databases:

| Service | JDBC URL |
|---------|----------|
| auth | `jdbc:postgresql://localhost:5433/auth_db` |
| event | `jdbc:postgresql://localhost:5433/event_db` |
| ticket | `jdbc:postgresql://localhost:5433/ticket_db` |
| booking | `jdbc:postgresql://localhost:5433/booking_db` |
| payment | `jdbc:postgresql://localhost:5433/payment_db` |
| notification | `jdbc:postgresql://localhost:5433/notification_db` |

Credentials: `tickethub` / `tickethub`

## Env Vars Worth Changing for Production

- `JWT_SECRET` — must be rotated
- `PAYMENT_PROVIDER` — set to `payos` for real payments
- `tickethub.mail.enabled` — toggle email sending
- Cloudflare R2 / S3 credentials in `event-service`
- PayOS credentials in `payment-service`

## Testing

Integration tests use Testcontainers (Postgres + Kafka). Run with:

```bash
mvn test
```

## Resilience4j Config (booking-service)

- Circuit breaker opens at 50% failure rate
- Open duration: 10 seconds
- Retries: 3 attempts with exponential backoff
- Applies to `event` and `payment` inter-service calls

## Kafka Consumer Groups

- `booking-service` → listens on `payment-events`
- `ticket-service` → listens on `event-events`, `booking-events`
- `notification-service` → listens on `ticket-issued-events`
