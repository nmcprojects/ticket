package com.tickethub.common.events;

import java.time.Instant;

/** Event published on "event-events" by event-service. */
public record EventEventMessage(
        String eventType,
        Long eventId,
        String title,
        String status,
        Instant occurredAt
) {}
