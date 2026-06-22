package com.tickethub.ticket.repository;

import com.tickethub.ticket.domain.CheckinLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CheckinLogRepository extends JpaRepository<CheckinLog, Long> {
    List<CheckinLog> findByEventIdOrderByCheckedInAtDesc(Long eventId);
    List<CheckinLog> findByEventIdInOrderByCheckedInAtDesc(Collection<Long> eventIds, Pageable pageable);
    List<CheckinLog> findAllByOrderByCheckedInAtDesc(Pageable pageable);
}
