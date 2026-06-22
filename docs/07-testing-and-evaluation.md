# 07 — Kiểm thử & Đánh giá

## Chiến lược kiểm thử

Test chạy theo từng module Maven (`mvn test`). Test tích hợp dùng **Testcontainers** để
khởi tạo PostgreSQL thật (và Kafka khi cần), nên phần lưu trữ và messaging được kiểm thử
trên hạ tầng thật thay vì mock.

## Danh sách test (theo dịch vụ)

| Dịch vụ | Test | Kiểm chứng điều gì |
|---------|------|---------------------|
| event-service | `EventServiceCrudTest` | CRUD sự kiện |
| event-service | `TicketTypeInventoryTest` | Logic reserve/confirm/release/refund tồn kho |
| event-service | `TicketTypeConcurrencyTest` | Không bán vượt khi giữ chỗ đồng thời |
| booking-service | `BookingServiceTest` | Logic điều phối booking |
| booking-service | `ProcessedEventIdempotencyTest` | Sự kiện thanh toán trùng chỉ xử lý một lần |
| booking-service | `CircuitBreakerConfigTest` | Cấu hình Resilience4j |
| payment-service | `PaymentServiceSandboxTest` | Luồng thanh toán sandbox |
| payment-service | `PayosSignatureTest` | Xác minh chữ ký webhook PayOS |
| ticket-service | `TicketIssuanceIntegrationTest` | Phát hành vé khi nhận BookingPaid (idempotent) |
| notification-service | `NotificationServiceTest`, `NotificationServicePersistenceTest` | Xử lý & lưu trữ thông báo |
| auth-service | `JwtServiceTest`, `AuthServiceIntegrationTest` | Phát hành/xác thực JWT, luồng auth |
| api-gateway | `JwtAuthGatewayFilterUnitTest`, `AuthGateWebTestClientTest` | Bộ lọc JWT & định tuyến gateway |

## Đánh giá luồng nghiệp vụ xuyên dịch vụ

Bài tập "mua một vé" đầu-cuối (kiểm thử luồng xuyên dịch vụ ở mục 4):

1. `docker compose up -d --build` (từ `backend/`).
2. Đăng ký/đăng nhập qua gateway → lấy JWT.
3. Tạo một sự kiện + loại vé (event-service).
4. `POST /api/bookings` → giữ chỗ tồn kho, trả về URL thanh toán.
5. Hoàn tất thanh toán: `POST /api/payments/{id}/sandbox-complete` (nhà cung cấp sandbox).
6. Quan sát chuỗi: `PaymentSucceeded` → booking `PAID` → `BookingPaid` →
   phát hành vé → `TicketIssued` → gửi email.
7. Kiểm chứng: `GET /api/tickets` hiển thị vé QR đã phát hành; `GET /api/notifications`
   hiển thị thông báo.
8. Kiểm tra luồng tại cửa: `POST /api/tickets/check-in` / `POST /api/checkins`.

Bài tập bù trừ: `POST /api/bookings/{id}/cancel` trên một booking đã thanh toán và xác nhận
tồn kho được hoàn, thanh toán được hoàn, và vé bị hủy.

## Quan sát quá trình chạy

- **Kafka UI** — xem thông điệp chạy qua `payment-events`, `booking-events`,
  `ticket-issued-events`.
- **Zipkin** — trace một request xuyên gateway → các dịch vụ.
- **Grafana** — metrics, logs, và trạng thái circuit breaker.

## Mức độ đáp ứng yêu cầu

| requirement.md | Trạng thái |
|----------------|------------|
| 3.1 ≥3 microservice | ✅ 6 dịch vụ nghiệp vụ + gateway + discovery |
| 3.2 RESTful CRUD API | ✅ xem [04](04-rest-api.md) |
| 3.3 message queue trong ≥1 luồng | ✅ Kafka, nhiều luồng |
| 3.4 DB cho mỗi dịch vụ | ✅ 6 database |
| 3.5 xử lý lỗi / retry | ✅ Resilience4j + idempotency |
| Mục 4 đồng bộ + bất đồng bộ, đa triển khai, logging | ✅ REST + Kafka, Docker Compose, Loki |
| Mục 5 gateway, tracing, log tập trung, CB/retry, saga, monitoring | ✅ (Kubernetes ❌ — chỉ Compose) |
| Mục 6 sản phẩm báo cáo | ✅ bộ tài liệu `docs/` này |
