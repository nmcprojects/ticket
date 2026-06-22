# 04 — Thiết kế REST API

Tất cả endpoint được truy cập qua gateway tại `http://localhost:8080`. Đường dẫn **không**
bị viết lại, nên path ở gateway bằng đúng path ở dịch vụ. Quy ước tuân theo nguyên tắc tài
nguyên/phương thức HTTP (danh từ làm tài nguyên, động từ là phương thức HTTP, sub-path cho
chuyển trạng thái).

## auth-service — `/api/auth`

| Method | Path | Mục đích |
|--------|------|----------|
| POST | `/api/auth/register` | Tạo tài khoản |
| POST | `/api/auth/login` | Xác thực, trả về JWT |
| POST | `/api/auth/refresh` | Làm mới token |
| POST | `/api/auth/logout` | Hủy phiên |
| GET  | `/api/auth/users/by-email` | Tra cứu người dùng theo email (dùng nội bộ giữa dịch vụ) |
| GET  | `/api/auth/me` | Người dùng hiện tại |
| PUT  | `/api/auth/me` | Cập nhật người dùng hiện tại |

## event-service

### Sự kiện — `/api/events`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/events` | Danh sách sự kiện |
| GET | `/api/events/{id}` | Chi tiết sự kiện |
| GET | `/api/events/{id}/stats` | Thống kê sự kiện |
| GET | `/api/events/{id}/access` | Kiểm tra quyền truy cập của người dùng hiện tại |
| GET | `/api/events/managed-ids` | Danh sách id sự kiện người dùng được quản lý |
| POST | `/api/events` | Tạo sự kiện |
| PUT | `/api/events/{id}` | Cập nhật sự kiện |
| DELETE | `/api/events/{id}` | Xóa sự kiện |
| GET | `/api/events/{id}/ticket-types` | Danh sách loại vé của sự kiện |
| POST | `/api/events/{id}/ticket-types` | Thêm loại vé |

### Loại vé (inventory) — `/api/ticket-types`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/ticket-types/{id}` | Chi tiết loại vé |
| PUT | `/api/ticket-types/{id}` | Cập nhật loại vé |
| DELETE | `/api/ticket-types/{id}` | Xóa loại vé |
| POST | `/api/ticket-types/{id}/reserve` | Giữ chỗ tồn kho |
| POST | `/api/ticket-types/{id}/confirm` | Đã giữ → đã bán |
| POST | `/api/ticket-types/{id}/release` | Nhả chỗ đang giữ |
| POST | `/api/ticket-types/{id}/refund` | Trả lại tồn kho đã bán |

### Organizer — `/api/organizers`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/organizers` | Danh sách organizer |
| GET | `/api/organizers/{id}` | Chi tiết organizer |
| POST | `/api/organizers` | Tạo organizer |
| PUT | `/api/organizers/{id}` | Cập nhật organizer |
| DELETE | `/api/organizers/{id}` | Xóa organizer |
| GET | `/api/organizers/me` | Hồ sơ organizer của ngưởi dùng hiện tại |
| PUT | `/api/organizers/me` | Cập nhật hồ sơ của mình |

#### Thành viên nhóm — `/api/organizers/me/members`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/organizers/me/members` | Danh sách thành viên |
| POST | `/api/organizers/me/members` | Thêm thành viên |
| PUT | `/api/organizers/me/members/{memberId}` | Cập nhật thành viên |
| DELETE | `/api/organizers/me/members/{memberId}` | Xóa thành viên |

#### Vai trò — `/api/organizers/me/roles`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/organizers/me/roles` | Danh sách vai trò |
| POST | `/api/organizers/me/roles` | Thêm vai trò |
| PUT | `/api/organizers/me/roles/{roleId}` | Cập nhật vai trò |
| DELETE | `/api/organizers/me/roles/{roleId}` | Xóa vai trò |

### Quyền — `/api/organizers/permissions`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/organizers/permissions` | Danh mục quyền có sẵn |

### Upload — `/api/uploads`

| Method | Path | Mục đích |
|--------|------|----------|
| POST | `/api/uploads` | Tải ảnh lên object storage |

## booking-service — `/api/bookings`

| Method | Path | Mục đích |
|--------|------|----------|
| POST | `/api/bookings` | Tạo booking (giữ chỗ + bắt đầu checkout) |
| GET | `/api/bookings/mine` | Booking của người dùng hiện tại |
| GET | `/api/bookings?eventId=` | Booking theo sự kiện (cho organizer) |
| GET | `/api/bookings/{id}` | Chi tiết booking |
| POST | `/api/bookings/{id}/cancel` | Hủy booking (kích hoạt bù trừ) |

## payment-service — `/api/payments`

| Method | Path | Mục đích |
|--------|------|----------|
| POST | `/api/payments` | Tạo thanh toán / phiên checkout |
| GET | `/api/payments/{id}` | Chi tiết thanh toán |
| POST | `/api/payments/{id}/verify` | Xác minh trạng thái thanh toán |
| POST | `/api/payments/{id}/sandbox-complete` | Hoàn tất thanh toán sandbox (dev) |
| POST | `/api/payments/{id}/refund` | Hoàn tiền |
| POST | `/api/payments/payos-webhook` | Callback từ nhà cung cấp PayOS |

## ticket-service

### Vé — `/api/tickets`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/tickets` | Danh sách vé (có lọc) |
| GET | `/api/tickets/stats` | Thống kê vé |
| GET | `/api/tickets/{id}` | Chi tiết vé |
| POST | `/api/tickets` | Tạo vé |
| POST | `/api/tickets/issue` | Phát hành vé (dùng nội bộ khi nhận BookingPaid) |
| PUT | `/api/tickets/{id}` | Cập nhật vé |
| DELETE | `/api/tickets/{id}` | Xóa vé |
| POST | `/api/tickets/check-in` | Check-in một vé |
| POST | `/api/tickets/void` | Hủy toàn bộ vé của một booking |

### Check-in — `/api/checkins`

| Method | Path | Mục đích |
|--------|------|----------|
| POST | `/api/checkins` | Ghi nhận một lượt check-in |
| GET | `/api/checkins` | Danh sách log check-in |

## notification-service — `/api/notifications`

| Method | Path | Mục đích |
|--------|------|----------|
| GET | `/api/notifications` | Danh sách thông báo |
