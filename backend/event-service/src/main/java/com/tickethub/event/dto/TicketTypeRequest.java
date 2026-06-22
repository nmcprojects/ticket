package com.tickethub.event.dto;

import com.tickethub.event.domain.TicketTypeStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TicketTypeRequest(
        @NotBlank String name,
        String description,
        @NotNull @Min(0) BigDecimal price,
        String currency,
        @Min(0) int totalQuantity,
        @Min(1) Integer maxPerOrder,
        TicketTypeStatus status
) {
}
