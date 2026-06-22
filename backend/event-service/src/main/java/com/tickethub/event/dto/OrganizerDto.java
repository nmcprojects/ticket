package com.tickethub.event.dto;

import java.time.Instant;

public record OrganizerDto(
        Long id,
        Long authUserId,
        String organizationName,
        String contactEmail,
        String contactPhone,
        String description,
        String avatarUrl,
        boolean verified,
        Instant createdAt,
        Instant updatedAt
) {
}
