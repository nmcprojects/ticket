package com.tickethub.event.kafka;

import com.tickethub.event.domain.EventStatus;

import java.time.Instant;

/** Domain event published to Kafka when an event changes. */
public record EventMessage(
        String eventType,   // EventCreated | EventUpdated | EventPublished | EventDeleted
        Long eventId,
        String title,
        EventStatus status,
        Instant occurredAt
) {
    public static EventMessage of(String type, com.tickethub.event.domain.Event e) {
        return new EventMessage(type, e.getId(), e.getTitle(), e.getStatus(), Instant.now());
    }
}
