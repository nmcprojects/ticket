package com.tickethub.common.events;

import java.time.Instant;

/** Event published on "payment-events" by payment-service. */
public record PaymentEventMessage(
        String eventType,
        Long paymentId,
        Long bookingId,
        java.math.BigDecimal amount,
        Instant occurredAt
) {}
