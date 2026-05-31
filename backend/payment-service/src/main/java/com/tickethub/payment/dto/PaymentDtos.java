package com.tickethub.payment.dto;

import com.tickethub.payment.domain.PaymentStatus;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public final class PaymentDtos {

    private PaymentDtos() {
    }

    public record CreatePaymentRequest(
            @NotNull Long bookingId,
            Long userId,
            @NotNull BigDecimal amount,
            String description,
            String returnUrl,
            String cancelUrl
    ) {
    }

    public record CreatePaymentResponse(
            Long paymentId,
            Long orderCode,
            String checkoutUrl,
            PaymentStatus status
    ) {
    }

    public record PaymentDto(
            Long id,
            Long bookingId,
            Long orderCode,
            BigDecimal amount,
            String provider,
            String checkoutUrl,
            PaymentStatus status,
            Instant paidAt
    ) {
    }
}
