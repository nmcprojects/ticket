package com.tickethub.ticket.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "tickets", indexes = {
        @Index(name = "idx_ticket_code", columnList = "ticket_code", unique = true),
        @Index(name = "idx_ticket_user", columnList = "user_id"),
        @Index(name = "idx_ticket_event", columnList = "event_id")
})
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Ticket {

    public static Ticket newInstance() {
        return new Ticket();
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Logical references (no physical FK across services)
    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "booking_item_id")
    private Long bookingItemId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "customer_email")
    private String customerEmail;

    @Column(name = "event_id")
    private Long eventId;

    // Snapshot fields
    @Column(name = "event_title")
    private String eventTitle;

    @Column(name = "ticket_type_id")
    private Long ticketTypeId;

    @Column(name = "ticket_type_name")
    private String ticketTypeName;

    @Column(name = "ticket_code", nullable = false, unique = true)
    private String ticketCode;

    @Column(name = "qr_payload", columnDefinition = "text")
    private String qrPayload;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status = TicketStatus.ISSUED;

    @Column(name = "issued_at")
    private Instant issuedAt;

    @Column(name = "checked_in_at")
    private Instant checkedInAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
