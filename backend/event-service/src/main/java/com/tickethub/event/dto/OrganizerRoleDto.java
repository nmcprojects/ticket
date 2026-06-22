package com.tickethub.event.dto;

import java.time.Instant;
import java.util.List;

public record OrganizerRoleDto(
        Long id,
        String name,
        List<String> permissions,
        boolean systemDefault,
        Instant createdAt
) {
}
