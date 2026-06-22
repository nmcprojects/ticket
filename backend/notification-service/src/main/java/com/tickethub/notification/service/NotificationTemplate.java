package com.tickethub.notification.service;

import com.tickethub.notification.domain.NotificationType;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Template-driven email content builder.
 * Each notification type = subject template + body template.
 * Adding a new notification = add an enum value + two templates here.
 */
@Component
public class NotificationTemplate {

    public record Content(String subject, String body) {}

    private static final String TICKET_ISSUED_BODY_TEMPLATE = """
            Xin chào,

            Cảm ơn bạn đã đặt vé tại TicketHub. Vé điện tử cho sự kiện "%s" đã được phát hành.

            Mã vé (%d):
            %s

            Vui lòng xuất trình mã QR tương ứng tại cửa để check-in.

            — TicketHub
            """;

    private static final String BOOKING_CANCELLED_BODY_TEMPLATE = """
            Xin chào,

            Booking của bạn cho sự kiện "%s" đã bị huỷ (%s).

            Nếu đã thanh toán, tiền sẽ được hoàn lại trong vòng 3-5 ngày làm việc.

            — TicketHub
            """;

    private static final String PAYMENT_FAILED_BODY_TEMPLATE = """
            Xin chào,

            Thanh toán %,d VNĐ cho sự kiện "%s" không thành công.

            Lý do: %s

            Vui lòng thử lại hoặc liên hệ hỗ trợ.

            — TicketHub
            """;

    private static final String PAYMENT_REFUNDED_BODY_TEMPLATE = """
            Xin chào,

            Yêu cầu hoàn tiền %,d VNĐ cho sự kiện "%s" đã được xử lý.

            Tiền sẽ về tài khoản của bạn trong vòng 3-5 ngày làm việc.

            — TicketHub
            """;

    public Content render(NotificationType type, Map<String, Object> ctx) {
        return switch (type) {
            case TICKET_ISSUED -> ticketIssued(ctx);
            case BOOKING_CANCELLED -> bookingCancelled(ctx);
            case PAYMENT_FAILED -> paymentFailed(ctx);
            case PAYMENT_REFUNDED -> paymentRefunded(ctx);
        };
    }

    private Content ticketIssued(Map<String, Object> ctx) {
        String eventTitle = str(ctx, "eventTitle", "TicketHub");
        @SuppressWarnings("unchecked")
        List<String> codes = (List<String>) ctx.getOrDefault("ticketCodes", List.of());
        String codeList = codes.isEmpty()
                ? "  (chưa có)"
                : codes.stream().map(c -> "  • " + c).reduce((a, b) -> a + "\n" + b).orElse("");

        String subject = "Vé điện tử của bạn — " + eventTitle;
        String body = TICKET_ISSUED_BODY_TEMPLATE.formatted(eventTitle, codes.size(), codeList);
        return new Content(subject, body);
    }

    private Content bookingCancelled(Map<String, Object> ctx) {
        String eventTitle = str(ctx, "eventTitle", "TicketHub");
        String reason = str(ctx, "reason", "theo yêu cầu của bạn");

        String subject = "Booking đã bị huỷ — " + eventTitle;
        String body = BOOKING_CANCELLED_BODY_TEMPLATE.formatted(eventTitle, reason);
        return new Content(subject, body);
    }

    private Content paymentFailed(Map<String, Object> ctx) {
        String eventTitle = str(ctx, "eventTitle", "TicketHub");
        Long amount = (Long) ctx.getOrDefault("amount", 0L);
        String reason = str(ctx, "reason", "lỗi không xác định");

        String subject = "Thanh toán thất bại — " + eventTitle;
        String body = PAYMENT_FAILED_BODY_TEMPLATE.formatted(amount, eventTitle, reason);
        return new Content(subject, body);
    }

    private Content paymentRefunded(Map<String, Object> ctx) {
        String eventTitle = str(ctx, "eventTitle", "TicketHub");
        Long amount = (Long) ctx.getOrDefault("amount", 0L);

        String subject = "Hoàn tiền thành công — " + eventTitle;
        String body = PAYMENT_REFUNDED_BODY_TEMPLATE.formatted(amount, eventTitle);
        return new Content(subject, body);
    }

    private static String str(Map<String, Object> ctx, String key, String fallback) {
        Object v = ctx.get(key);
        return v != null ? v.toString() : fallback;
    }
}
