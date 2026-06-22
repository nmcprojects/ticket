package com.tickethub.ticket.dto;

import com.tickethub.ticket.domain.TicketStatus;
import jakarta.validation.constraints.NotNull;

public record TicketRequest(
        Long bookingId,
        Long bookingItemId,
        Long userId,
        String customerEmail,
        @NotNull Long eventId,
        String eventTitle,
        Long ticketTypeId,
        String ticketTypeName,
        TicketStatus status
) {
}
