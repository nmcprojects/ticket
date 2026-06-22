package com.tickethub.event.dto;

import java.time.Instant;

public record OrganizerMemberDto(
        Long id,
        Long authUserId,
        String email,
        String fullName,
        Long roleId,
        String roleName,
        Instant createdAt
) {
}
