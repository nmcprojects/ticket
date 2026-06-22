package com.tickethub.ticket.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Local read-model of events, kept in sync via Kafka ("event-events").
 * Lets the Ticket Service snapshot event_title without calling Event Service.
 */
@Entity
@Table(name = "event_snapshots")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EventSnapshot {

    public static EventSnapshot newInstance() {
        return new EventSnapshot();
    }

    @Id
    private Long eventId;

    private String title;

    private String status;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
