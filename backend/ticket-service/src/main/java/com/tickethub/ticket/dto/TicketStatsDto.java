package com.tickethub.ticket.dto;

public record TicketStatsDto(
        Long eventId,
        long total,
        long issued,
        long checkedIn,
        long cancelled,
        int checkinPercent
) {
}
