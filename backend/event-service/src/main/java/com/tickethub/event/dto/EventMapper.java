package com.tickethub.event.dto;

import com.tickethub.event.domain.Event;
import com.tickethub.event.domain.OrganizerProfile;
import com.tickethub.event.domain.Showtime;
import com.tickethub.event.domain.TicketType;

import java.util.List;

public final class EventMapper {

    private EventMapper() {
    }

    public static OrganizerDto toDto(OrganizerProfile o) {
        if (o == null) return null;
        return new OrganizerDto(
                o.getId(), o.getAuthUserId(), o.getOrganizationName(),
                o.getContactEmail(), o.getContactPhone(), o.getDescription(), o.getAvatarUrl(),
                o.isVerified(), o.getCreatedAt(), o.getUpdatedAt()
        );
    }

    public static TicketTypeDto toDto(TicketType t) {
        return new TicketTypeDto(
                t.getId(),
                t.getEvent() != null ? t.getEvent().getId() : null,
                t.getName(), t.getDescription(), t.getPrice(), t.getCurrency(),
                t.getTotalQuantity(), t.getAvailableQuantity(), t.getReservedQuantity(),
                t.getSoldQuantity(), t.getMaxPerOrder(), t.getStatus()
        );
    }

    public static ShowtimeDto toDto(Showtime s) {
        return new ShowtimeDto(
                s.getId(), s.getStartTime(), s.getEndTime(), s.getStatus()
        );
    }

    public static EventDto toDto(Event e) {
        List<TicketTypeDto> tts = e.getTicketTypes().stream().map(EventMapper::toDto).toList();
        List<ShowtimeDto> sts = e.getShowtimes().stream().map(EventMapper::toDto).toList();
        return new EventDto(
                e.getId(), toDto(e.getOrganizer()), e.getTitle(), e.getDescription(),
                e.getContent(), e.getLocation(), e.getCity(), e.getVenue(), e.getCategory(),
                e.getStartTime(), e.getEndTime(), e.getBannerUrl(), e.getSeatMapUrl(),
                e.getLatitude(), e.getLongitude(), e.getStatus(),
                tts, sts, e.getCreatedAt(), e.getUpdatedAt()
        );
    }
}
