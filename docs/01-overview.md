# 01 — Tổng quan & Bài toán

## Bài toán

Việc bán vé cho các sự kiện trực tiếp liên quan đến nhiều mối quan tâm khác nhau, mỗi
mối quan tâm thay đổi với tốc độ khác nhau và có đặc tính mở rộng cũng như đặc tính lỗi
khác nhau:

- quản lý **danh mục sự kiện** và **tồn kho (stock)** của từng loại vé,
- nhận **đặt vé** mà không bán vượt số lượng (overselling),
- thu **thanh toán** qua nhà cung cấp bên ngoài,
- phát hành **vé** (có mã QR) và xác thực vé tại cửa,
- gửi thông báo cho khách hàng.

Một ứng dụng nguyên khối (monolith) sẽ ràng buộc tất cả những điều này lại với nhau: một
nhà cung cấp thanh toán chậm hoặc một đợt quét check-in dồn dập lúc mở cửa sẽ ảnh hưởng
tới các phần không liên quan của hệ thống, và một nhóm không thể triển khai phần danh mục
độc lập với phần tích hợp thanh toán.

## Vì sao chọn microservice

TicketHub tách các mối quan tâm này thành các dịch vụ triển khai độc lập, mỗi dịch vụ sở
hữu dữ liệu riêng và phối hợp qua các hợp đồng (contract) rõ ràng:

- **REST đồng bộ** ở nơi bên gọi cần câu trả lời ngay (ví dụ: "còn vé không? giữ chỗ đi",
  "tạo phiên thanh toán").
- **Sự kiện Kafka bất đồng bộ** ở nơi bên gọi chỉ cần thông báo rằng một việc đã xảy ra và
  để các dịch vụ quan tâm tự phản ứng (thanh toán thành công → phát hành vé → gửi email).

Điều này đáp ứng các mục tiêu cốt lõi của đề bài: tách dịch vụ, giao tiếp lai (đồng bộ/bất
đồng bộ), khả năng mở rộng, chịu lỗi và tính nhất quán dữ liệu trong hệ phân tán.

## Phạm vi

Trong phạm vi:

- Xác thực & tài khoản (JWT).
- Quản lý sự kiện & loại vé, gồm nhóm tổ chức (organizer), vai trò và quyền.
- Đặt vé có giữ chỗ tồn kho và luồng thanh toán (checkout).
- Thanh toán qua nhà cung cấp có thể thay thế (`sandbox` mặc định, `payos` cho thanh toán thật).
- Phát hành vé (QR) và check-in tại cửa.
- Thông báo qua email khi phát hành vé.

Ngoài phạm vi (xem [08 — Hạn chế](08-limitations.md)):

- Transactional outbox / giao nhận chính xác-một-lần (exactly-once).
- Topic Kafka nhiều partition / có replica.
- Triển khai Kubernetes (chỉ dùng Docker Compose).

## Tác nhân (Actor)

| Tác nhân | Sử dụng |
|----------|---------|
| **Người tham dự** | Duyệt sự kiện, đặt vé, thanh toán, xem "vé của tôi". |
| **Ban tổ chức** | Tạo/quản lý sự kiện & loại vé, quản lý thành viên & vai trò, xem đơn, chạy check-in tại cửa. |
| **Quản trị viên** | Toàn quyền quản lý xuyên các organizer/sự kiện. |
| **Nhà cung cấp thanh toán** | Hệ thống bên ngoài (PayOS) xác nhận thanh toán qua webhook. |
