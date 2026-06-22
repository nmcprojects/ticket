package com.tickethub.notification.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "email_notifications", indexes = {
        @Index(name = "idx_email_booking", columnList = "booking_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_email_dedup", columnNames = {"dedup_key"})
})
@Getter
@Setter
@NoArgsConstructor
public class EmailNotification {

    public enum Status { PENDING, SENT, FAILED, LOGGED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "payment_id")
    private Long paymentId;

    @Column(name = "recipient_email")
    private String recipientEmail;

    private String subject;

    @Column(columnDefinition = "text")
    private String content;

    @Column(name = "ticket_codes", columnDefinition = "text")
    private String ticketCodes;

    @Column(name = "dedup_key", unique = true)
    private String dedupKey;

    private String provider; // SMTP | LOG

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false)
    private NotificationType notificationType = NotificationType.TICKET_ISSUED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.PENDING;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "sent_at")
    private Instant sentAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
