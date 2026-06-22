package com.tickethub.event.repository;

import com.tickethub.event.domain.Event;
import com.tickethub.event.domain.EventStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface EventRepository extends JpaRepository<Event, Long> {
    List<Event> findByStatus(EventStatus status);
    List<Event> findByOrganizerId(Long organizerId);
    List<Event> findByOrganizerIdIn(Collection<Long> organizerIds);
}
