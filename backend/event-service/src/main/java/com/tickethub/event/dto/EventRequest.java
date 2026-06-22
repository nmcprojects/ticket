package com.tickethub.event.dto;

import com.tickethub.event.domain.EventStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.List;

public record EventRequest(
        Long organizerId,
        @NotBlank String title,
        String description,
        String content,
        String location,
        String city,
        String venue,
        String category,
        Instant startTime,
        Instant endTime,
        String bannerUrl,
        String seatMapUrl,
        Double latitude,
        Double longitude,
        EventStatus status,
        @Valid List<TicketTypeRequest> ticketTypes,
        @Valid List<ShowtimeRequest> showtimes
) {
}
