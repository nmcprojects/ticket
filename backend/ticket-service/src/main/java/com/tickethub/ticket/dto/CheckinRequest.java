package com.tickethub.ticket.dto;

import jakarta.validation.constraints.NotBlank;

public record CheckinRequest(
        @NotBlank String ticketCode,
        Long staffId
) {
}
