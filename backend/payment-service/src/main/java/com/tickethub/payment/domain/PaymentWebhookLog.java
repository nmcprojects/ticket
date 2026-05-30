package com.tickethub.payment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "payment_webhook_logs")
@Getter
@Setter
@NoArgsConstructor
public class PaymentWebhookLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payment_id")
    private Long paymentId;

    private String provider;

    @Column(name = "event_type")
    private String eventType;

    @Column(name = "raw_payload", columnDefinition = "text")
    private String rawPayload;

    private boolean processed;

    @Column(name = "processing_error", columnDefinition = "text")
    private String processingError;

    @CreationTimestamp
    @Column(name = "received_at", updatable = false)
    private Instant receivedAt;
}
