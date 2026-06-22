package com.tickethub.ticket.repository;

import com.tickethub.ticket.domain.EventSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventSnapshotRepository extends JpaRepository<EventSnapshot, Long> {
}
