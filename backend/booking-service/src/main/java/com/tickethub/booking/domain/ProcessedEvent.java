package com.tickethub.booking.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** Inbox-style idempotency guard for consumed messages. */
@Entity
@Table(name = "processed_events")
@Getter
@Setter
@NoArgsConstructor
public class ProcessedEvent {

    @Id
    @Column(name = "message_key")
    private String messageKey;

    @CreationTimestamp
    @Column(name = "processed_at", updatable = false)
    private Instant processedAt;

    public ProcessedEvent(String messageKey) {
        this.messageKey = messageKey;
    }
}
