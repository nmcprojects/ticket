package com.tickethub.booking.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Synchronous call to ticket-service to void a booking's issued tickets.
 * Best-effort (compensation) — nuốt lỗi, chỉ log để không chặn luồng huỷ booking.
 */
@Slf4j
@Component
public class TicketClient {

    private final RestClient client;
    private final String internalSecret;

    public TicketClient(@Value("${tickethub.services.ticket-url}") String baseUrl,
                        @Value("${tickethub.internal.secret:tickethub-internal-secret}") String internalSecret) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
        this.internalSecret = internalSecret;
    }

    public void voidBooking(Long bookingId) {
        try {
            client.post()
                    .uri("/api/tickets/void")
                    .header("Content-Type", "application/json")
                    .header("X-Internal-Secret", internalSecret)
                    .body(Map.of("bookingId", bookingId))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Void vé cho booking={} thất bại (bỏ qua): {}", bookingId, e.getMessage());
        }
    }
}
