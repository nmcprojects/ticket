package com.tickethub.event.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record OrganizerRoleRequest(
        @NotBlank String name,
        List<String> permissions
) {
}
