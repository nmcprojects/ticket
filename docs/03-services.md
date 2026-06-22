# 03 — Các Microservice

## 3.1. Lý do tách thành các dịch vụ này

Việc phân tách dựa trên các **miền nghiệp vụ (business domains)** độc lập, mỗi miền có đặc
tính về tải, yêu cầu nhất quán và khả năng chịu lỗi khác nhau:

| Miền | Đặc điểm | Lý do tách riêng |
|------|----------|------------------|
| **Xác thực** | Tần suất cao, đọc nhiều hơn ghi; cần bảo mật tập trung. | Tách để tái sử dụng cho nhiều hệ thống; giảm rủi ro lộ dữ liệu ngưởi dùng. |
| **Sự kiện & Tồn kho** | Miền cốt lõi, đọc nhiều; tồn kho cần xử lý đồng thởi (concurrency). | Tách để scale độc lập khi có đợt mở bán lớn; tránh xung đột tài nguyên với thanh toán. |
| **Đặt vé (Booking)** | Luồng phối hợp phức tạp giữa nhiều miền; cần saga/bù trừ. | Tập trung logic điều phối; dễ bảo trì luồng mua vé mà không ảnh hưởng dịch vụ khác. |
| **Thanh toán** | Phụ thuộc nhà cung cấp bên ngoài; có thể chậm hoặc lỗi. | Cách ly lỗi từ PayOS/sandbox; cho phép thay đổi nhà cung cấp mà không đụng code booking. |
| **Vé & Check-in** | Phát hành vé là phản ứng sau thanh toán; check-in dồn dập tại cửa. | Tách để check-in tại cửa không ảnh hưởng hệ thống đặt vé; phát hành vé bất đồng bộ qua Kafka. |
| **Thông báo** | Không cần phản hồi ngay; có thể retry; dễ bị tắc nghẽn (SMTP chậm). | Tách để tránh SMTP làm chận luồng chính; cho phép tắt/bật mail độc lập. |

**Nguyên tắc áp dụng:**

1. **Single Responsibility** — Mỗi dịch vụ sở hữu một miền duy nhất và database riêng.
2. **Failure Isolation** — Thanh toán chậm hoặc SMTP tắc nghẽn không làm sập luồng đặt vé.
3. **Independent Scaling** — `event-service` và `ticket-service` có thể scale riêng khi mở bán
   hoặc ngày diễn ra sự kiện.
4. **Technology Heterogeneity** — `payment-service` tích hợp PayOS riêng; `notification-service`
   chỉ cần SMTP — không bắt buộc cùng stack.

## 3.2. Chi tiết từng dịch vụ

Mỗi dịch vụ sở hữu một miền chức năng riêng và database riêng của nó. `common-security`
là thư viện dùng chung (phân tích/xác thực JWT), không phải dịch vụ triển khai độc lập.

## auth-service (`:8083`, `auth_db`)

Tài khoản và xác thực. Phát hành và làm mới JWT, expose người dùng hiện tại (`/me`) và
một endpoint tra cứu người dùng được các dịch vụ khác dùng (ví dụ event-service phân giải
danh tính organizer).

## event-service (`:8081`, `event_db`)

Danh mục **và là nơi sở hữu tồn kho (inventory)**. Quản lý:

- **Sự kiện** — CRUD, thống kê, kiểm tra quyền truy cập, tra cứu sự kiện được quản lý.
- **Loại vé (ticket type)** — chính là **đơn vị tồn kho**: giữ số lượng và thực hiện các
  thao tác `reserve` / `confirm` / `release` / `refund` (đây là nơi ngăn chặn bán vượt;
  xem `TicketTypeService`, có test về concurrency/inventory).
- **Organizer** — hồ sơ ban tổ chức, thành viên nhóm, vai trò và quyền.
- **Upload** — ảnh sự kiện lên object storage (R2/S3).

Phát (publish) `event-events` (sự kiện được tạo/cập nhật/xóa) để các dịch vụ khác giữ một
bản sao cục bộ. Gọi auth-service qua REST để phân giải người dùng.

> Lưu ý đặt tên: logic *inventory* nằm ở đây, **không** phải ở `ticket-service`. Xem
> [08 — Hạn chế](08-limitations.md) để biết thảo luận về việc đặt tên dịch vụ.

## booking-service (`:8085`, `booking_db`)

**Bộ điều phối (orchestrator)** của luồng mua vé và là điều phối viên saga. Kiểm tra loại
vé, giữ chỗ tồn kho, tạo phiên thanh toán, rồi phản ứng theo kết quả thanh toán để xác
nhận hoặc nhả tồn kho và kích hoạt phát hành vé. Gọi event-service, payment-service và
ticket-service qua REST (được bảo vệ bởi Resilience4j); tiêu thụ `payment-events`; phát
`booking-events`.

## payment-service (`:8084`, `payment_db`)

Xử lý thanh toán phía sau một **nhà cung cấp có thể thay thế** (`sandbox` mặc định, `payos`
cho thanh toán thật). Tạo phiên thanh toán, xác minh/hoàn tất thanh toán (gồm webhook
PayOS và lối tắt sandbox-complete), và hoàn tiền. Phát `PaymentSucceeded` /
`PaymentFailed` / `PaymentRefunded` lên `payment-events`.

## ticket-service (`:8082`, `ticket_db`)

**Phát hành vé và check-in tại cửa** — *không phải* inventory. Khi nhận `BookingPaid`, nó
phát hành một vé QR cho mỗi số lượng của mỗi mục đặt vé (idempotent), và xác thực vé tại
cửa (`CheckinController`). Giữ một `EventSnapshot` cục bộ (cập nhật từ `event-events`) để
có thể phát hành vé mà không cần gọi đồng bộ tới event-service. Phát `ticket-issued-events`.

> **Ghi chú kiến trúc — Ranh giới nghiệp vụ (bounded context):** Phát hành vé (async, write-once)
> và check-in tại cửa (sync, burst, staff-facing) có hình dạng khác nhau. Trong dự án này
> chúng được giữ trong cùng một dịch vụ vì cùng thao tác trên thực thể `Ticket`, nhưng đường
> ranh giới này là một *seam* rõ ràng: nếu tải check-in tăng cao (sự kiện lớn, nhiều cửa),
> có thể tách `check-in-service` riêng để scale độc lập mà không ảnh hưởng luồng phát hành.

## notification-service (`:8086`, `notification_db`)

Gửi thông báo cho khách hàng (email). Tiêu thụ `ticket-issued-events` và gửi một email cho
mỗi đơn; lưu lại bản ghi thông báo. Việc gửi email có thể bật/tắt (`tickethub.mail.enabled`).

## Bảng tổng hợp

| Dịch vụ | Cổng | Database | Phát (Kafka) | Tiêu thụ (Kafka) | Gọi REST đồng bộ tới |
|---------|------|----------|--------------|------------------|----------------------|
| auth-service | 8083 | auth_db | — | — | — |
| event-service | 8081 | event_db | `event-events` | — | auth-service |
| booking-service | 8085 | booking_db | `booking-events` | `payment-events` | event, payment, ticket |
| payment-service | 8084 | payment_db | `payment-events` | — | (PayOS, bên ngoài) |
| ticket-service | 8082 | ticket_db | `ticket-events`, `ticket-issued-events` | `booking-events`, `event-events` | event-service |
| notification-service | 8086 | notification_db | — | `ticket-issued-events` | — |
