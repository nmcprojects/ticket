package com.tickethub.ticket.client;

import com.tickethub.ticket.dto.EventAccessResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * Asks event-service whether a user manages a given event, so ticket/check-in endpoints can
 * enforce per-event ownership (one organization can't read another's stats / check-in logs).
 */
@Slf4j
@Component
public class EventClient {

    private static final String DEFAULT_BASE_URL = "http://localhost:8081";
    private static final String DEFAULT_INTERNAL_SECRET = "tickethub-internal-secret";
    private static final String HEADER_INTERNAL_SECRET = "X-Internal-Secret";
    private static final String URI_CAN_MANAGE = "/api/events/{id}/access?userId={uid}";
    private static final String URI_MANAGED_IDS = "/api/events/managed-ids?userId={uid}";

    private final RestClient client;
    private final String internalSecret;

    public EventClient(
            @Value("${tickethub.services.event-url:" + DEFAULT_BASE_URL + "}") String baseUrl,
            @Value("${tickethub.internal.secret:" + DEFAULT_INTERNAL_SECRET + "}") String internalSecret) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
        this.internalSecret = internalSecret;
    }

    public boolean canManageEvent(Long eventId, Long userId) {
        if (eventId == null || userId == null) return false;
        try {
            EventAccessResponse res = client.get()
                    .uri(URI_CAN_MANAGE, eventId, userId)
                    .header(HEADER_INTERNAL_SECRET, internalSecret)
                    .retrieve()
                    .body(EventAccessResponse.class);
            return res != null && res.canManage();
        } catch (Exception e) {
            log.warn("Check permission for event {} for user {} failed: {}", eventId, userId, e.getMessage());
            return false;
        }
    }

    public List<Long> managedEventIds(Long userId) {
        if (userId == null) return List.of();
        try {
            List<Long> ids = client.get()
                    .uri(URI_MANAGED_IDS, userId)
                    .header(HEADER_INTERNAL_SECRET, internalSecret)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<Long>>() {});
            return ids != null ? ids : List.of();
        } catch (Exception e) {
            log.warn("Fetching managed event IDs for user {} failed: {}", userId, e.getMessage());
            return List.of();
        }
    }
}

