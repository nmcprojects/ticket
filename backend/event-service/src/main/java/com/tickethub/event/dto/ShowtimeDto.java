package com.tickethub.event.dto;

import java.time.Instant;

public record ShowtimeDto(
        Long id,
        Instant startTime,
        Instant endTime,
        String status
) {
}
