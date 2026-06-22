package com.tickethub.ticket.dto;

import com.tickethub.ticket.domain.CheckinResult;

public record CheckinResponse(
        CheckinResult result,
        String message,
        TicketDto ticket
) {
}
