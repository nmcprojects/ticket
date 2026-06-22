package com.tickethub.event.dto;

import java.time.Instant;

public record ShowtimeRequest(
        Instant startTime,
        Instant endTime,
        String status
) {
}
