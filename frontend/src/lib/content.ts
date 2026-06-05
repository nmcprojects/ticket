import type { AppEvent } from "./types";

// Rich "Giới thiệu" content fallback — when an organizer hasn't authored custom
// HTML yet, render a sensible default built from the event's own real fields.
export function richContentFor(ev: AppEvent): string {
  if (ev.content) return ev.content;
  return `
    <p><strong>${ev.title}</strong> ${ev.description}</p>
    <h3>Điểm nổi bật</h3>
    <ul>
      <li>Không gian được dàn dựng chỉn chu tại <strong>${ev.venue}</strong>, ${ev.city}.</li>
      <li>Trải nghiệm trọn vẹn dành cho cả người tham dự lần đầu lẫn khán giả quen thuộc.</li>
      <li>Đội ngũ hỗ trợ tận nơi, check-in nhanh bằng mã QR điện tử.</li>
    </ul>
    <figure>
      <img src="${ev.bannerUrl}" alt="${ev.title}" />
      <figcaption>Hình ảnh từ chương trình.</figcaption>
    </figure>
    <h3>Trải nghiệm của bạn</h3>
    <p>Chúng tôi chuẩn bị từng chi tiết để mỗi khoảnh khắc đều đáng nhớ — từ khâu đón tiếp, âm thanh ánh sáng cho tới quà tặng dành riêng cho khách tham dự.</p>
    <blockquote>Vui lòng có mặt trước giờ bắt đầu 30 phút để check-in thuận tiện.</blockquote>
  `;
}
