package com.tickethub.common.events;

import java.time.Instant;
import java.util.List;

/** Event published on "booking-events" by booking-service. */
public record BookingEventMessage(
        String eventType,
        Long bookingId,
        Long userId,
        String customerEmail,
        Long eventId,
        String eventTitle,
        List<Item> items,
        Instant occurredAt
) {
    public record Item(Long ticketTypeId, String ticketTypeName, int quantity) {}
}
