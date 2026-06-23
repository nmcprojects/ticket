package com.tickethub.payment.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "payments", indexes = {
        @Index(name = "idx_payment_order_code", columnList = "order_code", unique = true),
        @Index(name = "idx_payment_booking", columnList = "booking_id")
})
@Getter
@Setter
@NoArgsConstructor
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "user_id")
    private Long userId;

    /** PayOS orderCode (numeric). Also used by the sandbox. */
    @Column(name = "order_code", unique = true)
    private Long orderCode;

    @Column(nullable = false)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false)
    private String currency = "VND";

    private String provider; // SANDBOX | PAYOS

    @Column(name = "checkout_url", columnDefinition = "text")
    private String checkoutUrl;

    @Column(name = "return_url", columnDefinition = "text")
    private String returnUrl;

    @Column(name = "cancel_url", columnDefinition = "text")
    private String cancelUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.PENDING;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "failed_at")
    private Instant failedAt;

    @Column(name = "refunded_at")
    private Instant refundedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
