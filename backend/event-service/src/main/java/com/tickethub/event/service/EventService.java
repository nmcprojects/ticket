package com.tickethub.event.service;

import com.tickethub.event.domain.Event;
import com.tickethub.event.domain.EventStatus;
import com.tickethub.event.domain.OrganizerProfile;
import com.tickethub.event.domain.Showtime;
import com.tickethub.event.domain.TicketType;
import com.tickethub.event.dto.*;
import com.tickethub.event.exception.NotFoundException;
import com.tickethub.event.kafka.EventEventPublisher;
import com.tickethub.event.kafka.EventMessage;
import com.tickethub.event.repository.EventRepository;
import com.tickethub.event.repository.OrganizerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static com.tickethub.event.dto.EventMapper.toDto;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final OrganizerRepository organizerRepository;
    private final EventEventPublisher publisher;

    @Transactional(readOnly = true)
    public List<EventDto> findAll(EventStatus status, Long organizerId) {
        List<Event> list;
        if (status != null) list = eventRepository.findByStatus(status);
        else if (organizerId != null) list = eventRepository.findByOrganizerId(organizerId);
        else list = eventRepository.findAll();
        return list.stream().map(EventMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public EventDto findById(Long id) {
        return toDto(get(id));
    }

    @Transactional(readOnly = true)
    public com.tickethub.event.dto.EventStatsDto stats(Long id) {
        Event e = get(id);
        int capacity = 0, sold = 0, reserved = 0, available = 0;
        java.math.BigDecimal revenue = java.math.BigDecimal.ZERO;
        for (com.tickethub.event.domain.TicketType t : e.getTicketTypes()) {
            capacity += t.getTotalQuantity();
            sold += t.getSoldQuantity();
            reserved += t.getReservedQuantity();
            available += t.getAvailableQuantity();
            revenue = revenue.add(t.getPrice().multiply(java.math.BigDecimal.valueOf(t.getSoldQuantity())));
        }
        int soldPercent = capacity == 0 ? 0 : Math.round(sold * 100f / capacity);
        return new com.tickethub.event.dto.EventStatsDto(
                e.getId(), capacity, sold, reserved, available, revenue, soldPercent,
                e.getTicketTypes().stream().map(EventMapper::toDto).toList());
    }

    public Event get(Long id) {
        return eventRepository.findById(id).orElseThrow(() -> NotFoundException.of("Event", id));
    }

    /** Ids of all events owned by the given organizations (for scoping check-in logs etc.). */
    @Transactional(readOnly = true)
    public List<Long> idsByOrganizers(java.util.Collection<Long> orgIds) {
        if (orgIds == null || orgIds.isEmpty()) return List.of();
        return eventRepository.findByOrganizerIdIn(orgIds).stream().map(Event::getId).toList();
    }

    @Transactional
    public EventDto create(EventRequest req, Long organizerId) {
        Event e = new Event();
        apply(e, req);
        // The event always belongs to the creator's organization (overrides any organizerId in the body).
        OrganizerProfile org = organizerRepository.findById(organizerId)
                .orElseThrow(() -> NotFoundException.of("Organizer", organizerId));
        e.setOrganizer(org);
        if (req.ticketTypes() != null) {
            for (TicketTypeRequest ttReq : req.ticketTypes()) {
                e.addTicketType(buildTicketType(ttReq));
            }
        }
        Event saved = eventRepository.save(e);
        publisher.publish(EventMessage.of("EventCreated", saved));
        return toDto(saved);
    }

    @Transactional
    public EventDto update(Long id, EventRequest req) {
        Event e = get(id);
        EventStatus before = e.getStatus();
        apply(e, req);
        Event saved = eventRepository.save(e);
        String type = (before != EventStatus.PUBLISHED && saved.getStatus() == EventStatus.PUBLISHED)
                ? "EventPublished" : "EventUpdated";
        publisher.publish(EventMessage.of(type, saved));
        return toDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        Event e = get(id);
        eventRepository.delete(e);
        publisher.publish(EventMessage.of("EventDeleted", e));
    }

    private void apply(Event e, EventRequest req) {
        if (req.organizerId() != null) {
            OrganizerProfile org = organizerRepository.findById(req.organizerId())
                    .orElseThrow(() -> NotFoundException.of("Organizer", req.organizerId()));
            e.setOrganizer(org);
        }
        e.setTitle(req.title());
        e.setDescription(req.description());
        e.setContent(req.content());
        e.setLocation(req.location());
        e.setCity(req.city());
        e.setVenue(req.venue());
        e.setCategory(req.category());
        e.setStartTime(req.startTime());
        e.setEndTime(req.endTime());
        e.setBannerUrl(req.bannerUrl());
        e.setSeatMapUrl(req.seatMapUrl());
        e.setLatitude(req.latitude());
        e.setLongitude(req.longitude());
        if (req.status() != null) e.setStatus(req.status());
        if (req.showtimes() != null) {
            List<Showtime> showtimes = new java.util.ArrayList<>();
            int i = 0;
            for (ShowtimeRequest sReq : req.showtimes()) {
                Showtime s = new Showtime();
                s.setStartTime(sReq.startTime());
                s.setEndTime(sReq.endTime());
                if (sReq.status() != null) s.setStatus(sReq.status());
                s.setPosition(i++);
                showtimes.add(s);
            }
            e.setShowtimes(showtimes);
        }
    }

    private TicketType buildTicketType(TicketTypeRequest req) {
        TicketType t = new TicketType();
        t.setName(req.name());
        t.setDescription(req.description());
        t.setPrice(req.price() != null ? req.price() : BigDecimal.ZERO);
        t.setCurrency(req.currency() != null ? req.currency() : "VND");
        t.setTotalQuantity(req.totalQuantity());
        t.setAvailableQuantity(req.totalQuantity());
        t.setReservedQuantity(0);
        t.setSoldQuantity(0);
        t.setMaxPerOrder(req.maxPerOrder() != null ? req.maxPerOrder() : 10);
        if (req.status() != null) t.setStatus(req.status());
        return t;
    }
}
