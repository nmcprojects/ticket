package com.tickethub.event.dto;

import java.math.BigDecimal;
import java.util.List;

public record EventStatsDto(
        Long eventId,
        int capacity,
        int sold,
        int reserved,
        int available,
        BigDecimal grossRevenue,
        int soldPercent,
        List<TicketTypeDto> ticketTypes
) {
}
