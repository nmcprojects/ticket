package com.tickethub.event.repository;

import com.tickethub.event.domain.OrganizerRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizerRoleRepository extends JpaRepository<OrganizerRole, Long> {
    List<OrganizerRole> findByOrganizerIdOrderByIdAsc(Long organizerId);
}
