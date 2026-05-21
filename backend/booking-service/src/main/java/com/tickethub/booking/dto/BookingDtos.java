package com.tickethub.booking.dto;

import com.tickethub.booking.domain.BookingStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class BookingDtos {

    private BookingDtos() {
    }

    public record BookingItemRequest(
            @NotNull Long ticketTypeId,
            // ticketTypeName and unitPrice are advisory/display-only: the server ignores them and
            // resolves the authoritative name and price from event-service (anti price-tampering).
            String ticketTypeName,
            @Min(1) int quantity,
            BigDecimal unitPrice
    ) {
    }

    public record CreateBookingRequest(
            @NotNull Long eventId,
            String eventTitle,
            @NotEmpty @Valid List<BookingItemRequest> items
    ) {
    }

    public record CreateBookingResponse(
            Long bookingId,
            String code,
            BookingStatus status,
            String paymentUrl,
            Long paymentId
    ) {
    }

    public record BookingItemDto(
            Long ticketTypeId,
            String ticketTypeName,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal totalPrice
    ) {
    }

    public record BookingDto(
            Long id,
            String code,
            Long userId,
            String customerEmail,
            Long eventId,
            String eventTitle,
            BigDecimal totalAmount,
            BookingStatus status,
            Long paymentId,
            String paymentUrl,
            List<BookingItemDto> items,
            Instant createdAt,
            Instant paidAt
    ) {
    }
}
