package com.tickethub.ticket.dto;

import com.tickethub.ticket.domain.CheckinResult;

import java.time.Instant;

public record CheckinLogDto(
        Long id,
        Long ticketId,
        String ticketCode,
        Long staffId,
        Long eventId,
        CheckinResult result,
        String message,
        Instant checkedInAt
) {
}
