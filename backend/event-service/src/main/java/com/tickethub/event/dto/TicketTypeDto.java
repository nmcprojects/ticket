package com.tickethub.event.dto;

import com.tickethub.event.domain.TicketTypeStatus;

import java.math.BigDecimal;

public record TicketTypeDto(
        Long id,
        Long eventId,
        String name,
        String description,
        BigDecimal price,
        String currency,
        int totalQuantity,
        int availableQuantity,
        int reservedQuantity,
        int soldQuantity,
        int maxPerOrder,
        TicketTypeStatus status
) {
}
