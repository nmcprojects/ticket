package com.tickethub.booking.kafka;

import java.math.BigDecimal;
import java.time.Instant;

/** Mirror of payment-service's PaymentMessage on "payment-events". */
public record IncomingPaymentMessage(
        String eventType,
        Long paymentId,
        Long bookingId,
        BigDecimal amount,
        Instant occurredAt
) {
}
