package com.tickethub.payment.kafka;

import java.math.BigDecimal;
import java.time.Instant;

/** Published to "payment-events" — consumed by booking-service. */
public record PaymentMessage(
        String eventType,   // PaymentSucceeded | PaymentFailed
        Long paymentId,
        Long bookingId,
        BigDecimal amount,
        Instant occurredAt
) {
}
