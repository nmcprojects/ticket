package com.tickethub.ticket.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Inbox-style idempotency guard for consumed messages.
 * Written in the SAME transaction as the business action it protects.
 */
@Entity
@Table(name = "processed_events")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
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
