package com.tickethub.common.events;

import java.time.Instant;
import java.util.List;

/** Event published on "ticket-issued-events" by ticket-service. */
public record TicketsIssuedEventMessage(
        String eventType,
        Long bookingId,
        Long userId,
        String customerEmail,
        Long eventId,
        String eventTitle,
        List<String> ticketCodes,
        Instant occurredAt
) {}
