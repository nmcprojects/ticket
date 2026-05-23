package com.tickethub.booking.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Synchronous calls to event-service for the reserve / confirm / release flow.
 * Được bọc bởi Resilience4j: retry khi lỗi tạm thời, circuit breaker khi event-service "chết".
 */
@Slf4j
@Component
public class EventClient {

    private final RestClient client;
    private final String internalSecret;

    public EventClient(@Value("${tickethub.services.event-url}") String baseUrl,
                       @Value("${tickethub.internal.secret:tickethub-internal-secret}") String internalSecret) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
        this.internalSecret = internalSecret;
    }

    @Retry(name = "event")
    @CircuitBreaker(name = "event", fallbackMethod = "reserveFallback")
    public void reserve(Long ticketTypeId, int quantity) {
        inventory(ticketTypeId, "reserve", quantity);
    }

    @Retry(name = "event")
    @CircuitBreaker(name = "event", fallbackMethod = "confirmFallback")
    public void confirm(Long ticketTypeId, int quantity) {
        inventory(ticketTypeId, "confirm", quantity);
    }

    @Retry(name = "event")
    @CircuitBreaker(name = "event", fallbackMethod = "releaseFallback")
    public void release(Long ticketTypeId, int quantity) {
        inventory(ticketTypeId, "release", quantity);
    }

    @Retry(name = "event")
    @CircuitBreaker(name = "event", fallbackMethod = "refundFallback")
    public void refund(Long ticketTypeId, int quantity) {
        inventory(ticketTypeId, "refund", quantity);
    }

    /** Không giữ được chỗ → không thể tiếp tục đặt vé, ném lỗi để rollback saga. */
    @SuppressWarnings("unused")
    private void reserveFallback(Long ticketTypeId, int quantity, Throwable t) {
        log.error("Reserve vé ticketType={} thất bại sau retry/circuit-breaker: {}", ticketTypeId, t.getMessage());
        throw new EventServiceUnavailableException(
                "Không giữ được vé do hệ thống sự kiện tạm thời gián đoạn. Vui lòng thử lại.", t);
    }

    @SuppressWarnings("unused")
    private void confirmFallback(Long ticketTypeId, int quantity, Throwable t) {
        log.error("Confirm vé ticketType={} thất bại sau retry/circuit-breaker: {}", ticketTypeId, t.getMessage());
        throw new EventServiceUnavailableException(
                "Không xác nhận được vé do hệ thống sự kiện tạm thời gián đoạn.", t);
    }

    /** Release là bù trừ (compensation) — nuốt lỗi, chỉ log để không chặn luồng. */
    @SuppressWarnings("unused")
    private void releaseFallback(Long ticketTypeId, int quantity, Throwable t) {
        log.warn("Release vé ticketType={} thất bại (bỏ qua): {}", ticketTypeId, t.getMessage());
    }

    /** Refund là bù trừ (compensation) — nuốt lỗi, chỉ log để không chặn luồng. */
    @SuppressWarnings("unused")
    private void refundFallback(Long ticketTypeId, int quantity, Throwable t) {
        log.warn("Refund vé ticketType={} thất bại (bỏ qua): {}", ticketTypeId, t.getMessage());
    }

    /**
     * Whether {@code userId} manages (owns / belongs to the org of) the given event. Fail-closed:
     * returns false if event-service can't be reached, so access is denied rather than leaked.
     */
    public boolean canManageEvent(Long eventId, Long userId) {
        try {
            Map<?, ?> res = client.get()
                    .uri("/api/events/{id}/access?userId={uid}", eventId, userId)
                    .header("X-Internal-Secret", internalSecret)
                    .retrieve()
                    .body(Map.class);
            return res != null && Boolean.TRUE.equals(res.get("canManage"));
        } catch (Exception e) {
            log.warn("Kiểm tra quyền sự kiện {} cho user {} thất bại: {}", eventId, userId, e.getMessage());
            return false;
        }
    }

    /** Authoritative ticket-type snapshot from event-service. {@code price} is the source of truth. */
    public record TicketTypeInfo(Long id, Long eventId, String name, BigDecimal price, String status) {
    }

    /**
     * Fetch the authoritative ticket type so booking totals are computed from the server-side
     * price, never from client-supplied values (prevents price tampering). Throws on failure so
     * a booking is never created with an unverified price.
     */
    public TicketTypeInfo getTicketType(Long ticketTypeId) {
        TicketTypeInfo info = client.get()
                .uri("/api/ticket-types/{id}", ticketTypeId)
                .header("X-Internal-Secret", internalSecret)
                .retrieve()
                .body(TicketTypeInfo.class);
        if (info == null || info.price() == null) {
            throw new IllegalArgumentException("Không lấy được thông tin loại vé " + ticketTypeId);
        }
        return info;
    }

    private void inventory(Long ticketTypeId, String op, int quantity) {
        client.post()
                .uri("/api/ticket-types/{id}/{op}", ticketTypeId, op)
                .header("Content-Type", "application/json")
                .header("X-Internal-Secret", internalSecret)
                .body(Map.of("quantity", quantity))
                .retrieve()
                .toBodilessEntity();
    }
}
