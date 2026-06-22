# 08 — Hạn chế đã biết & Các đánh đổi

Đây là những đánh đổi có chủ đích ở quy mô demo. Việc liệt kê chúng một cách trung thực
cũng là một phần của đánh giá (nó cho thấy sự nhận thức về các mối quan tâm của hệ phân tán).

## Messaging

- **Không có transactional outbox (dual-write).** Một dịch vụ commit vào database của mình
  rồi mới gọi `kafkaTemplate.send()` một cách riêng rẽ. Một sự cố crash giữa hai bước này
  sẽ làm mất sự kiện. Cách khắc phục ở production là **outbox pattern** (ghi sự kiện vào
  một bảng outbox trong cùng transaction DB, rồi chuyển tiếp lên Kafka một cách bất đồng
  bộ). Consumer idempotent giảm thiểu *trùng lặp* nhưng không xử lý được khoảng *mất mát* này.
- **Xử lý kết quả gửi không nhất quán.** Một số publisher kiểm tra future của lệnh gửi
  (`event-events`, `ticket-events` dùng `.whenComplete`), trong khi `payment-events` và
  `booking-events` là fire-and-forget — sự cố broker ở đó sẽ âm thầm.
- **Một partition / một replica.** Topic được tạo với `partitions(1).replicas(1)`: không
  mở rộng consumer theo chiều ngang và không chịu được lỗi broker. Ổn cho demo, không ổn
  cho throughput/HA ở production.
- **`PaymentRefunded` không có consumer.** Nó được phát khi hoàn tiền, nhưng việc đối soát
  hoàn tiền hiện diễn ra qua lệnh gọi đồng bộ `paymentClient.refund()`. Hoặc đấu nối một
  consumer, hoặc ghi chú rằng nó dành cho mục đích tương lai.

## Dữ liệu & triển khai

- **Dùng chung instance Postgres.** Các database tách biệt về logic (đáp ứng tính cô lập)
  nhưng dùng chung một server — một điểm lỗi đơn lẻ và một bể tài nguyên dùng chung.
  Production sẽ tách instance hoặc dùng database được quản lý (managed).
- **`ddl-auto: update`.** Tiện cho phát triển; production nên dùng migration có phiên bản
  (Flyway/Liquibase).
- **Chỉ có Docker Compose.** Không có manifest Kubernetes (mục nâng cao duy nhất ở mục 5
  chưa thực hiện).

## Dữ liệu & nhất quán

- **Sold-vs-issued drift.** `TicketType.soldQuantity` (do event-service quản lý) và số lượng
  dòng `Ticket` (do ticket-service quản lý) *lý thuyết* phải khớp nhau, nhưng được duy trì
  độc lập qua saga (event ↔ booking ↔ ticket) mà không có cơ chế đối soát (reconciliation).
  Nếu một bước trong saga bị lỗi hoặc message bị mất, hai bảng này sẽ lệch. Đây là mối
  quan tâm cấp hệ thống, không thể "sửa" bằng cách đưa inventory vào ticket-service.
  Giải pháp tương lai: đối soát định kỳ hoặc event-sourcing.

## Đặt tên

- **`ticket-service` so với `inventory-service`.** *Inventory* (tồn kho, reserve/confirm/
  release) nằm ở **event-service** trên thực thể `TicketType`, còn `ticket-service` xử lý
  phát hành vé + check-in. Đổi tên `ticket-service` thành `inventory-service` sẽ không
  chính xác. Nếu muốn tên rõ ràng cho inventory, cách đúng là *tách* logic tồn kho
  `TicketType` ra khỏi event-service thành một `inventory-service` mới, và để
  `ticket-service` là dịch vụ phát hành/check-in.

## Phân tách dịch vụ (Service decomposition)

- **event-service là "god-service".** Hiện tại event-service gói 4 bounded context trong một
  deployment: catalog (sự kiện) + inventory (`TicketType`) + organizer/RBAC + upload. Điều này
  tạo ra shared failure domain và coupled scaling. Ở quy mô demo đây là đánh đổi có chủ ý
  (ít deployment, đơn giản vận hành), nhưng candidate đầu tiên để tách là **inventory-service**
  (chứa `TicketType` và các thao tác reserve/confirm/release/refund) vì có transactional
  seam rõ ràng nhất và nằm trên hot path của booking.

## Bảo mật

- Khóa JWT dev được commit để tiện dùng và phải được luân chuyển (rotate) cho bất kỳ triển
  khai thật nào (`JWT_SECRET`). Thông tin đăng nhập PayOS và object-storage được điều khiển
  qua biến môi trường và mặc định tắt/sandbox.
