package com.tickethub.ticket.dto;

import jakarta.validation.constraints.NotNull;

public record VoidBookingRequest(
        @NotNull Long bookingId
) {
}
