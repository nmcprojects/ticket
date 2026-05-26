package com.tickethub.booking.kafka;

import java.time.Instant;
import java.util.List;

/** Published to "booking-events" — consumed by ticket-service to issue tickets. */
public record BookingMessage(
        String eventType,   // BookingPaid | BookingPaymentFailed
        Long bookingId,
        Long userId,
        String customerEmail,
        Long eventId,
        String eventTitle,
        List<Item> items,
        Instant occurredAt
) {
    public record Item(Long ticketTypeId, String ticketTypeName, int quantity) {
    }
}
