package com.tickethub.event.repository;

import com.tickethub.event.domain.OrganizerMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface OrganizerMemberRepository extends JpaRepository<OrganizerMember, Long> {
    List<OrganizerMember> findByOrganizerIdOrderByIdAsc(Long organizerId);
    List<OrganizerMember> findByAuthUserId(Long authUserId);
    boolean existsByOrganizerIdAndAuthUserId(Long organizerId, Long authUserId);
    long countByRoleId(Long roleId);
}
