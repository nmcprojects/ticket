package com.tickethub.ticket.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/** Issue N tickets at once (mirrors the BookingPaid -> issue tickets flow). */
public record IssueRequest(
        Long bookingId,
        Long bookingItemId,
        Long userId,
        String customerEmail,
        @NotNull Long eventId,
        String eventTitle,
        Long ticketTypeId,
        String ticketTypeName,
        @Min(1) @Max(50) int quantity
) {
}
