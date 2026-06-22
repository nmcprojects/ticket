# 06 — Dữ liệu, Khả năng chịu lỗi & Quan sát hệ thống

## Mỗi dịch vụ một database

Mỗi dịch vụ sở hữu một database PostgreSQL riêng; không dịch vụ nào đọc bảng của dịch vụ
khác. Chúng dùng chung một *instance* Postgres (tiện cho chi phí/vận hành ở dự án sinh
viên) nhưng được cô lập về mặt logic — đáp ứng mục tiêu độc lập dữ liệu ở `requirement.md`
mục 3.4.

`backend/init-db/01-init.sql` tạo tất cả database khi khởi động lần đầu:

```sql
CREATE DATABASE auth_db;
CREATE DATABASE event_db;
CREATE DATABASE ticket_db;
CREATE DATABASE booking_db;
CREATE DATABASE payment_db;
CREATE DATABASE notification_db;
```

| Dịch vụ | Database |
|---------|----------|
| auth-service | `auth_db` |
| event-service | `event_db` |
| booking-service | `booking_db` |
| payment-service | `payment_db` |
| ticket-service | `ticket_db` |
| notification-service | `notification_db` |

Schema được quản lý bởi Hibernate (`ddl-auto: update`). Thông tin đăng nhập mặc định là
`tickethub` / `tickethub`.

### Dữ liệu xuyên dịch vụ: sao chép, không dùng chung bảng

Vì các dịch vụ không thể truy vấn database của nhau, ticket-service giữ một bảng
`EventSnapshot` cục bộ, được cập nhật liên tục bằng cách tiêu thụ `event-events`. Điều này
bảo toàn tính cô lập trong khi tránh một lượt tra cứu đồng bộ trên đường đi nóng (hot path).

## Khả năng chịu lỗi (fault tolerance)

booking-service bọc các lệnh gọi REST ra ngoài tới `event` và `payment` bằng
**Resilience4j** (`backend/booking-service/src/main/resources/application.yml`):

**Circuit breaker** (cho mỗi instance `event`, `payment`):

| Cấu hình | Giá trị |
|----------|---------|
| Cửa sổ trượt | COUNT_BASED, kích thước 10 |
| Số lệnh gọi tối thiểu | 5 |
| Ngưỡng tỷ lệ lỗi | 50% |
| Thời gian chờ ở trạng thái open | 10s |
| Số lệnh gọi cho phép ở half-open | 3 |
| Tự động open→half-open | bật |

**Retry** (cho mỗi instance `event`, `payment`):

| Cấu hình | Giá trị |
|----------|---------|
| Số lần thử tối đa | 3 |
| Thời gian chờ cơ sở | 300ms |
| Backoff | hàm mũ, hệ số 2 |

Điều này đáp ứng mục 3.5 (dịch vụ tạm thời không phản hồi, retry cơ bản). Consumer group
của Kafka cho giao nhận ít-nhất-một-lần; tính idempotent (xem [05](05-messaging.md)) khiến
việc giao nhận lại trở nên an toàn.

## Quan sát hệ thống (Observability)

| Khả năng | Công cụ | Ghi chú |
|----------|---------|---------|
| Tracing phân tán | Zipkin | tương quan request/trace xuyên các dịch vụ |
| Metrics | Prometheus + Micrometer | scrape từ endpoint actuator của mỗi dịch vụ |
| Log tập trung | Loki + Promtail | log container đẩy về Loki |
| Dashboard | Grafana (`:3000`, admin/admin) | xem metrics + logs |

Metrics của circuit-breaker và retry được expose qua actuator
(`health,info,prometheus,metrics,circuitbreakers,retries`), nên trạng thái breaker hiển
thị được trong Grafana/Prometheus.
