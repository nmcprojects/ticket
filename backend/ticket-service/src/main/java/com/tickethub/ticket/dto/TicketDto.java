package com.tickethub.ticket.dto;

import com.tickethub.ticket.domain.TicketStatus;

import java.time.Instant;

public record TicketDto(
        Long id,
        Long bookingId,
        Long bookingItemId,
        Long userId,
        String customerEmail,
        Long eventId,
        String eventTitle,
        Long ticketTypeId,
        String ticketTypeName,
        String ticketCode,
        String qrPayload,
        TicketStatus status,
        Instant issuedAt,
        Instant checkedInAt
) {
}
