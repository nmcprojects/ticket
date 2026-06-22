package com.tickethub.event.dto;

import com.tickethub.event.domain.EventStatus;

import java.time.Instant;
import java.util.List;

public record EventDto(
        Long id,
        OrganizerDto organizer,
        String title,
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
        List<TicketTypeDto> ticketTypes,
        List<ShowtimeDto> showtimes,
        Instant createdAt,
        Instant updatedAt
) {
}
