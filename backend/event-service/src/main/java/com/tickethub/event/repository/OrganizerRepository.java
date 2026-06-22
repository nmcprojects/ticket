package com.tickethub.event.repository;

import com.tickethub.event.domain.OrganizerProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OrganizerRepository extends JpaRepository<OrganizerProfile, Long> {
    Optional<OrganizerProfile> findByAuthUserId(Long authUserId);
}
